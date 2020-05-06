/*
 * Copyright 2020 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 not
 * use this file except in compliance with the License. You may obtain a copy
 of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 under
 * the License.
 */

'use strict';

import { createHash } from 'crypto';

import * as fs from 'fs';
import * as path from 'path';
import * as Koa from 'koa';
import {Config} from './config';

type CacheContent = {
  saved: Date,
  expires: Date,
  response: string,
  payload: string,
};

function hashCode(s: string): string {
  const hash = 0;
  if (s.length === 0) return hash.toString();

  return createHash('md5').update(s).digest('hex');
}

export class FilesystemCache {
  private config: Config;
  private cacheConfig: { [key: string]: string };

  constructor(config: Config) {
    this.config = config;
    this.cacheConfig = this.config.cacheConfig;

    if (!fs.existsSync(this.getDir(''))) {
      fs.mkdirSync(this.getDir(''), { recursive: true });
    }
  }

  getDir = (key: string) => {
    const dir = this.cacheConfig.snapshotDir;

    if (key) {
      return path.join(dir, key);
    }

    return dir;
  }

  async clearCache(key: string) {
    fs.rmdirSync(this.getDir(key), {recursive: true});
  }

  async clearAllCache() {
    fs.rmdirSync(this.getDir(''), {recursive: true});
  }

  cacheContent(key: string, ctx: Koa.Context) {
    const responseHeaders = ctx.response;
    const responseBody = ctx.body;
    const request = ctx.request;

    if (!fs.existsSync(this.getDir(key))) {
      fs.mkdirSync(this.getDir(key), { recursive: true });
    }

    fs.writeFileSync(path.join(this.getDir(key), this.cacheConfig.payloadFilename), responseBody);
    fs.writeFileSync(path.join(this.getDir(key), this.cacheConfig.responseFilename), JSON.stringify(responseHeaders));
    fs.writeFileSync(path.join(this.getDir(key), this.cacheConfig.requestFilename), JSON.stringify(request));
  }

  getCachedContent(ctx: Koa.Context, key: string): CacheContent | null {
    if (ctx.query.refreshCache) {
      return null;
    } else {
      try {
        const response = fs.readFileSync(path.join(this.getDir(key), this.cacheConfig.responseFilename), 'utf8');
        const payload = fs.readFileSync(path.join(this.getDir(key), this.cacheConfig.payloadFilename), 'utf8');

        if (!payload || !response) {
          return null;
        }

        const fd = fs.openSync(path.join(this.getDir(key), this.cacheConfig.payloadFilename), 'r');
        const stats = fs.fstatSync(fd);

        // use modification time as the saved time
        const saved = stats.mtime;
        const expires = new Date(saved.getTime() + parseInt(this.cacheConfig.cacheDurationMinutes) * 60 * 1000);

        return {
          saved,
          expires,
          payload,
          response,
        };
      } catch (err) {
        return null;
      }
    }
  }

  /**
   * Returns middleware function.
   */
  middleware() {
    const cacheContent = this.cacheContent.bind(this);

    return async function(
               this: FilesystemCache,
               ctx: Koa.Context,
               next: () => Promise<unknown>) {
      // Cache based on full URL. This means requests with different params are
      // cached separately (except for refreshCache parameter)
      let cacheKey = ctx.url
          .replace(/&?refreshCache=(?:true|false)&?/i, '');

      if (cacheKey.charAt(cacheKey.length - 1) === '?') {
        cacheKey = cacheKey.slice(0, -1);
      }

      // remove /render/ from key
      cacheKey = cacheKey.replace(/^\/render\//, '');

      // remove trailing slash from key
      cacheKey = cacheKey.replace(/\/$/, '');

      // key is hashed crudely
      const key = hashCode(cacheKey);
      const content = await this.getCachedContent(ctx, key);

      if (content) {
        // Serve cached content if its not expired.
        if (content.expires.getTime() >= new Date().getTime()) {
          const response = JSON.parse(content.response);
          ctx.set(response.header);
          ctx.set('x-rendertron-cached', content.saved.toUTCString());
          ctx.status = response.status;
          try {
            ctx.body = content.payload;
            return;
          } catch (error) {
            console.log(
                'Erroring parsing cache contents, falling back to normal render');
          }
        }
      }

      await next();

      if (ctx.status === 200) {
        cacheContent(key, ctx);
      }
    }.bind(this);
  }
}
