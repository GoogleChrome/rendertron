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

import Koa from 'koa';
import { Config, ConfigManager } from './config';
import { createHash } from 'crypto';
import { MongoClient } from 'mongodb';

type CacheContent = {
  saved: Date;
  expires: Date;
  headers: string;
  payload: string;
};


export class MongoCache {
  private client: MongoClient = new MongoClient('mongodb://192.168.86.22:27017/render-cache', { useNewUrlParser: true, useUnifiedTopology: true });
  private config: Config = ConfigManager.config;
  private cacheConfig: { [key: string]: string };

  constructor(config: Config) {
    this.config = config;
    this.cacheConfig = this.config.cacheConfig;
  }

  hashCode = (s: string) => {
    const hash = 0;
    if (s.length === 0) return hash.toString();

    return createHash('md5').update(s).digest('hex');
  };

  async clearCache() {
    console.debug('TODO: Not implemented yet!');
    // const query = this.datastore.createQuery('Page');
    // const data = await query.run();
    // const entities = data[0];
    // const entityKeys = entities.map(
    //   (entity: Record<string, unknown>) =>
    //     (entity as DatastoreObject)[Datastore.KEY]
    // );
    // console.debug(`Removing ${entities.length} items from the cache`);
    // await this.datastore.delete(entityKeys);
    // // TODO(samli): check info (data[1]) and loop through pages of entities to
    // // delete.
  }

  // async find(query) {
  //   try {
  //     const db = await this.getDatabase();
  //     db.
  //   } catch (err) {
  //     console.error(`MongoCache: ${err}`);
  //   } finally {
  //     // Lets make sure the client connection will be closed
  //     await this.client.close();
  //   }
  // }

  async getDatabase() {
    if (this.client && !this.client.isConnected()) {
      console.debug('getDatabase: Opening Mongo client connection');
      await this.client.connect();
    }
    const database = this.client.db();
    return database;
  }

  async cacheContent(
    key: string,
    url: string,
    headers: Record<string, string>,
    payload: Buffer
  ) {
    console.debug('mongoCache: cacheContent');
    const database = await this.getDatabase();
    const Pages = database.collection("Pages");

    const now = new Date();

    // Step 1: query to see if we are over the max number of allowed entries, and max entries isn't disabled with a value of -1 and remove over quota, removes oldest first
    if (parseInt(this.cacheConfig.cacheMaxEntries) !== -1) {
      console.debug(`MongoCache: cacheMaxEntries is set to  ${this.cacheConfig.cacheMaxEntries}, so checking current number of entries`);
      Pages.findOneAndReplace({},)
      // const query = this.datastore
      //   .createQuery('Page')
      //   .select('__key__')
      //   .order('expires');
      // // eslint-disable-next-line @typescript-eslint/no-this-alias
      // const self = this;
      // this.datastore.runQuery(query, function (err, entities) {
      //   if (err) {
      //     console.debug(`datastore err: ${err} reported`);
      //   }
      //   const dataStoreCache = (entities || []).map(
      //     (entity: Record<string, unknown>) =>
      //       (entity as DatastoreObject)[Datastore.KEY]
      //   );
      //   if (
      //     dataStoreCache.length >=
      //     parseInt(self.config.cacheConfig.cacheMaxEntries)
      //   ) {
      //     const toRemove =
      //       dataStoreCache.length -
      //       parseInt(self.config.cacheConfig.cacheMaxEntries) +
      //       1;
      //     const toDelete = dataStoreCache.slice(0, toRemove);
      //     console.debug(`Deleting: ${toRemove}`);
      //     self.datastore.delete(toDelete);
      //   }
      // });
    }
    const entity = {
      'key': key,
      'url': url,
      'saved': now,
      'expires': new Date(
        now.getTime() +
        parseInt(this.cacheConfig.cacheDurationMinutes) * 60 * 1000
      ),
      'headers': JSON.stringify(headers),
      'payload': JSON.stringify(payload)
    };

    try {
      console.debug('Saving in mongo');
      const result = await Pages.updateOne({ 'key': key }, { $set: entity }, { upsert: true });
      //console.debug(result);
    } catch (err) {
      console.error(`MongoCache: ${err}`);
    }
  }

  async removeEntry(key: string) {
    console.debug('MongoCache.removeEntry', key);
    // const datastoreKey = this.datastore.key(['Page', key]);
    // await this.datastore.delete(datastoreKey);
  }

  getCachedContent(ctx: Koa.Context, key: string): CacheContent | null {

    console.debug("MongoCache.getCachedContent", key, ctx)
    return null;
    // if (ctx.query.refreshCache) {
    //   return null;
    // } else {
    //   return await this.datastore.get(key);
    //}
  }

  /**
   * Returns middleware function.
   */
  middleware() {
    const cacheContent = this.cacheContent.bind(this);

    return async function (
      this: MongoCache,
      ctx: Koa.Context,
      next: () => Promise<unknown>
    ) {
      let sanitizedUrl = this.sanitizeURL(ctx.url);
      if (sanitizedUrl.charAt(sanitizedUrl.length - 1) === '?') {
        sanitizedUrl = sanitizedUrl.slice(0, -1);
      }
      // key is hashed crudely
      const key = this.hashCode(sanitizedUrl);

      const results = await this.getCachedContent(ctx, key);
      if (results) {
        const content = results as CacheContent;
        // Serve cached content if its not expired.
        if (
          content.expires.getTime() >= new Date().getTime() ||
          parseInt(this.cacheConfig.cacheDurationMinutes) === -1
        ) {
          const headers = JSON.parse(content.headers);
          ctx.set(headers);
          ctx.set('x-rendertron-cached', content.saved.toUTCString());
          try {
            let payload = JSON.parse(content.payload);
            if (
              payload &&
              typeof payload === 'object' &&
              payload.type === 'Buffer'
            ) {
              payload = Buffer.from(payload);
            }
            ctx.body = payload;
            return;
          } catch (error) {
            console.debug(
              'Erroring parsing cache contents, falling back to normal render'
            );
          }
        }
      }

      await next();

      if (ctx.status === 200) {
        cacheContent(key, sanitizedUrl, ctx.response.headers, ctx.body);
      }
    }.bind(this);
  }

  invalidateHandler() {
    return this.handleInvalidateRequest.bind(this);
  }

  sanitizeURL(key: string) {
    // Cache based on full URL. This means requests with different params are
    // cached separately (except for refreshCache parameter
    let cacheKey = key.replace(/&?refreshCache=(?:true|false)&?/i, '');

    if (cacheKey.charAt(cacheKey.length - 1) === '?') {
      cacheKey = cacheKey.slice(0, -1);
    }

    // remove /render/ from key, only at the start
    if (cacheKey.startsWith('/render/')) {
      cacheKey = cacheKey.substring(8);
    }

    // remove trailing slash from key
    cacheKey = cacheKey.replace(/\/$/, '');
    return cacheKey
  }

  private async handleInvalidateRequest(ctx: Koa.Context, url: string) {
    let cacheKey = this.sanitizeURL(url);

    // remove /invalidate/ from key, only at the start
    if (cacheKey.startsWith('/invalidate/')) {
      cacheKey = cacheKey.substring(12);
    }

    // key is hashed crudely
    const key = this.hashCode(cacheKey);
    this.removeEntry(key);
    ctx.status = 200;
  }

  clearAllCacheHandler() {
    return this.handleClearAllCacheRequest.bind(this);
  }

  private async handleClearAllCacheRequest(ctx: Koa.Context) {
    this.clearCache();
    ctx.status = 200;
  }
}
