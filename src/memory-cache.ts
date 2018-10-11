/*
 * Copyright 2018 Google Inc. All rights reserved.
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

import * as Koa from 'koa';

type CacheEntry = {
  saved: Date,
  expires: Date,
  headers: string,
  payload: string,
};

export const CACHE_DURATION_MINUTES = 60 * 24;

export class MemoryCache {
  private store: any = {};

  async clearCache() {
    this.store = {};
  }

  cacheContent(key: symbol, headers: {}, payload: Buffer) {
    const now = new Date();

    this.store[key] = {
      saved: now,
      expires: new Date(now.getTime() + CACHE_DURATION_MINUTES * 60 * 1000),
      headers: JSON.stringify(headers),
      payload: JSON.stringify(payload)
    } as CacheEntry;
  }

  getCachedContent(key: symbol) {
    return this.store[key];
  }

  middleware() { 
    const addToCache = this.cacheContent.bind(this);
    const getFromCache = this.getCachedContent.bind(this);

    return async function (
      this: MemoryCache,
      ctx: Koa.Context,
      next: () => Promise<unknown>) {
        // Cache based on full URL. This means requests with different params are
        // cached separately.
        const cacheKey = ctx.url;
        const cachedContent = getFromCache(cacheKey);
        if (cachedContent && cachedContent.expires.getTime() >= new Date().getTime()) {
          const headers = JSON.parse(cachedContent.headers);
          ctx.set(headers);
          ctx.set('x-rendertron-cached', cachedContent.saved.toUTCString());
          try {
            let payload = JSON.parse(cachedContent.payload);
            if (payload && typeof (payload) === 'object' &&
                payload.type === 'Buffer') {
              payload = new Buffer(payload);
            }
            ctx.body = payload;
            return;
          } catch (error) {
            console.log(
                'Erroring parsing cache contents, falling back to normal render');
          }
        }
      
        await next();

        if (ctx.status === 200) {
          addToCache(cacheKey, ctx.response.headers, ctx.body);
          console.log(`cached ${cacheKey}`);
        }
    }.bind(this);
  }
}