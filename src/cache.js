/*
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

'use strict';

const datastore = require('@google-cloud/datastore')();
const elastiCache = require('./elastiCache');

class Cache {
  async clearCache() {
    const query = datastore.createQuery('Page');
    const data = await datastore.runQuery(query);
    const entities = data[0];
    const entityKeys = entities.map((entity) => entity[datastore.KEY]);
    console.log(`Removing ${entities.length} items from the cache`);
    await datastore.delete(entityKeys);
    // TODO(samli): check info (data[1]) and loop through pages of entities to delete.
  }

  async cacheContent(key, headers, payload) {
    // Set cache length to 1 day.
    const cacheDurationMinutes = 60*24;
    const now = new Date();
    const entity = {
      key: key,
      data: [
        {name: 'saved', value: now},
        {name: 'expires', value: new Date(now.getTime() + cacheDurationMinutes*60*1000)},
        {name: 'headers', value: JSON.stringify(headers), excludeFromIndexes: true},
        {name: 'payload', value: JSON.stringify(payload), excludeFromIndexes: true},
      ]
    };
    await datastore.save(entity);
  }

  /**
   * Returns middleware function.
   * @param {String} cacheMode
   * @return {function}
   */
  middleware(cacheMode) {
    return async function(request, response, next) {
      function accumulateContent(content) {
        if (typeof(content) === 'string') {
          body = body || '' + content;
        } else if (Buffer.isBuffer(content)) {
          if (!body)
            body = new Buffer(0);
          body = Buffer.concat([body, content], body.length + content.length);
        }
      }

      /**
       * Parse the headers and payload
       * @param {String} resultHeaders
       * @param {String} resultPayload
       * @return {object}
       */
      function parsingContent(resultHeaders, resultPayload) {
        let headers = JSON.parse(resultHeaders);
        let payload = JSON.parse(resultPayload);
        if (payload && typeof(payload) == 'object' && payload.type == 'Buffer')
          payload = new Buffer(payload);
        return {headers, payload};
      }

      if (cacheMode === 'elastiCache') {
        const key = request.url;
        const result = await elastiCache.getContent(key);

        if (result) {
          const {headers, payload} = parsingContent(result.headers, result.payload);
          response.set(headers);
          response.send(payload);
          return;
        }
      } else if (cacheMode === 'google-cloud') {
        const key = datastore.key(['Page', request.url]);
        const results = await datastore.get(key);

        // Cache based on full URL. This means requests with different params are
        // cached separately.
        if (results.length && results[0] != undefined) {
          // Serve cached content if its not expired.
          if (results[0].expires.getTime() >= new Date().getTime()) {
            const {headers, payload} = parsingContent(results[0].headers, results[0].payload);
            response.set(headers);
            response.set('x-rendertron-cached', results[0].saved.toUTCString());
            response.send(payload);
            return;
          }
        }
      }

      // Capture output to cache.
      const methods = {
        write: response.write,
        end: response.end,
      };
      let body = null;

      response.write = function(content, ...args) {
        accumulateContent(content);
        return methods.write.apply(response, [content].concat(args));
      };

      response.end = async function(content, ...args) {
        if (response.statusCode == 200) {
          accumulateContent(content);
          if (cacheMode === 'google-cloud') {
            const key = datastore.key(['Page', request.url]);
            await this.cacheContent(key, response.getHeaders(), body);
          } else if (cacheMode === 'elastiCache') {
            await elastiCache.cacheContent(request.url, response.getHeaders(), body);
          }
        }
        return methods.end.apply(response, [content].concat(args));
      }.bind(this);

      next();
    }.bind(this);
  }
}

// TODO(samli): Allow for caching options, like freshness options.
module.exports = new Cache();
