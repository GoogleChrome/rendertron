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

import { DatastoreKey } from '@google-cloud/datastore/entity';
import * as Koa from 'koa';
import { Config, ConfigManager } from './config';

import Datastore = require('@google-cloud/datastore');

type CacheContent = {
  saved: Date,
  expires: Date,
  headers: string,
  payload: string
};

type DatastoreObject = {
  [Datastore.KEY]: DatastoreKey
};

export class DatastoreCache {
  datastore: Datastore = new Datastore();
  private config: Config = ConfigManager.config;

  async clearCache() {
    const query = this.datastore.createQuery('Page');
    const data = await query.run();
    const entities = data[0];
    const entityKeys = entities.map(
      (entity) => (entity as DatastoreObject)[this.datastore.KEY]);
    console.log(`Removing ${entities.length} items from the cache`);
    await this.datastore.delete(entityKeys);
    // TODO(samli): check info (data[1]) and loop through pages of entities to
    // delete.
  }

  async cacheContent(key: DatastoreKey, headers: {}, payload: Buffer) {
    const now = new Date();
    // query datastore to see if we are over the max number of allowed entries, and max entries isn't disabled with a value of -1 and remove over quota, removes oldest first
    if (parseInt(this.config.cacheConfig.cacheMaxEntries) !== -1) {
      const query = this.datastore.createQuery('Page').select('__key__').order('expires');
      const self = this;
      this.datastore.runQuery(query, function (err, entities) {
        if (err) {
          console.log(`datastore err: ${err} reported`);
        }
        const dataStoreCache = entities.map(
          (entity) => (entity as DatastoreObject)[self.datastore.KEY]);
        if (dataStoreCache.length >= parseInt(self.config.cacheConfig.cacheMaxEntries)) {
          const toRemove = dataStoreCache.length - parseInt(self.config.cacheConfig.cacheMaxEntries) + 1;
          const toDelete = dataStoreCache.slice(0, toRemove);
          console.log(`Deleting: ${toRemove}`);
          self.datastore.delete(toDelete);
        }
      });
    }
    const entity = {
      key: key,
      data: [
        { name: 'saved', value: now },
        {
          name: 'expires',
          value: new Date(now.getTime() + parseInt(this.config.cacheConfig.cacheDurationMinutes) * 60 * 1000)
        },
        {
          name: 'headers',
          value: JSON.stringify(headers),
          excludeFromIndexes: true
        },
        {
          name: 'payload',
          value: JSON.stringify(payload),
          excludeFromIndexes: true
        }
      ]
    };
    await this.datastore.save(entity);
  }

  async removeEntry(key: string) {
    const datastoreKey = this.datastore.key(['Page', key]);
    await this.datastore.delete(datastoreKey);
  }

  async getCachedContent(ctx: Koa.Context, key: DatastoreKey) {
    if (ctx.query.refreshCache) {
      return null;
    } else {
      return await this.datastore.get(key);
    }
  }

  /**
   * Returns middleware function.
   */
  middleware() {
    const cacheContent = this.cacheContent.bind(this);

    return async function(
      this: DatastoreCache,
      ctx: Koa.Context,
      next: () => Promise<unknown>) {
      // Cache based on full URL. This means requests with different params are
      // cached separately (except for refreshCache parameter)
      let cacheKey = ctx.url
        .replace(/&?refreshCache=(?:true|false)&?/i, '');

      if (cacheKey.charAt(cacheKey.length - 1) === '?') {
        cacheKey = cacheKey.slice(0, -1);
      }
      const key = this.datastore.key(['Page', cacheKey]);
      const results = await this.getCachedContent(ctx, key);
      if (results && results.length && results[0] !== undefined) {
        const content = results[0] as CacheContent;
        // Serve cached content if its not expired.
        if (content.expires.getTime() >= new Date().getTime() || parseInt(this.config.cacheConfig.cacheDurationMinutes) === -1) {
          const headers = JSON.parse(content.headers);
          ctx.set(headers);
          ctx.set('x-rendertron-cached', content.saved.toUTCString());
          try {
            let payload = JSON.parse(content.payload);
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
      }

      await next();

      if (ctx.status === 200) {
        cacheContent(key, ctx.response.headers, ctx.body);
      }
    }.bind(this);
  }

  invalidateHandler() {
    return this.handleInvalidateRequest.bind(this);
  }

  private async handleInvalidateRequest(ctx: Koa.Context, url: string) {
    this.removeEntry(url);
    ctx.status = 200;
  }

}
