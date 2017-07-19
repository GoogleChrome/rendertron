'use strict';

const datastore = require('@google-cloud/datastore')();

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
   * @return {function}
   */
  middleware() {
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

      // Cache based on full URL. This means requests with different params are
      // cached separately.
      const key = datastore.key(['Page', request.url]);
      const results = await datastore.get(key);

      if (results.length && results[0] != undefined) {
        // Serve cached content if its not expired.
        if (results[0].expires.getTime() >= new Date().getTime()) {
          const headers = JSON.parse(results[0].headers);
          response.set(headers);
          let payload = JSON.parse(results[0].payload);
          if (typeof(payload) == 'object' && payload.type == 'Buffer')
            payload = new Buffer(payload);
          response.send(payload);
          return;
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
          await this.cacheContent(key, response.getHeaders(), body);
        }
        return methods.end.apply(response, [content].concat(args));
      }.bind(this);

      next();
    }.bind(this);
  }
}

// TODO(samli): Allow for caching options, like freshness options.
module.exports = new Cache();
