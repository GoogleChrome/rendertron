/*
 * Copyright 2019 Google Inc. All rights reserved.
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
  headers: string,
  payload: string,
};

export const CACHE_MAX_ENTRIES = 100;

// implements a cache that uses the "least-recently used" strategy to clear unused elements.
export class MemoryCache {
  private store: Map<string, CacheEntry> = new Map();

  async clearCache() {
    this.store.clear();
  }

  cacheContent(key: string, headers: {[key: string]: string}, payload: Buffer) {
    // if the cache gets too big, we evict the least recently used entry (i.e. the first value in the map)
    if (this.store.size >= CACHE_MAX_ENTRIES) {
      const keyToDelete = this.store.keys().next().value;
      this.store.delete(keyToDelete);
    }

    //remove refreshCache from URL
    let cacheKey = key
        .replace(/&?refreshCache=(?:true|false)&?/i, '');

    if (cacheKey.charAt(cacheKey.length - 1) === '?') {
      cacheKey = cacheKey.slice(0, -1);
    }

    this.store.set(cacheKey, {
      saved: new Date(),
      headers: JSON.stringify(headers),
      payload: JSON.stringify(payload)
    });
  }

  getCachedContent(ctx: Koa.Context, key: string) {
    if (ctx.query.refreshCache) {
      return;
    }
    const entry = this.store.get(key);
    // we need to re-insert this key to mark it as "most recently read"
    if (entry) {
      this.store.delete(key);
      this.store.set(key, entry);
    }
    return entry;
  }

  middleware() {
    return this.handleRequest.bind(this);
  }

  private async handleRequest(ctx: Koa.Context, next: () => Promise<unknown>) {
    // Cache based on full URL. This means requests with different params are
    // cached separately.
    const cacheKey = ctx.url;
    const cachedContent = this.getCachedContent(ctx, cacheKey);
    if (cachedContent) {
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
      this.cacheContent(cacheKey, ctx.response.headers, ctx.body);
    }
  }
}
