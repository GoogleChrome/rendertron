const redis = require('ioredis');
const _ = require('lodash');
require('dotenv').config();

const host = process.env.ELASTICACHE_CONFIGURATION_ENDPOINT || 'localhost';
const lazyConnect = process.env.LAZY_CONNECT == 'false' ? false : true;

// uncomment the line below if you want to use moment to set the cache deletion time
// const moment = require('moment-timezone');

// AWS ElastiCache with redis cluster mode
// uncomment the lines below and replace the host with your configuration endpoint
// change lazyConnect to true if you want redis client to connect to the redis server as soon as it's created
// with lazyConnect: true, it will only connect when running query against the redis database
// const redisClient = new redis.Cluster([
//   {host: host, port: 6379, lazyConnect: lazyConnect}
// ]);

// AWS ElastiCache with redis cluster mode OFF
// uncomment the lines below and replace the host with your node endpoint
// change lazyConnect to true if you want redis client to connect to the redis server as soon as it's created
// with lazyConnect: true, it will only connect when running query against the redis database
const redisClient = new redis({host: host, port: 6379, lazyConnect: lazyConnect});

let redisReady = false;

// detect if redis server is down
redisClient.on('error', function(err) {
  console.error(err);
  redisReady = false;
});

// detect if redis server is up
redisClient.on('ready', function(err) {
  console.log('redist is ready!');
  redisReady = true;
});

class ElastiCache {
  /**
   * Cache render results to redis
   * @param {String} key
   * @param {String} headers
   * @param {String} payload
   */
  async cacheContent(key, headers, payload) {
    const pagePayload = JSON.stringify(payload);
    const pageHeaders = JSON.stringify(headers);

    // Set cache length to 1 day.
    let cacheDurationMinutes = 60*24;

    const params = [
      key,
      'payload',
      pagePayload,
      'headers',
      pageHeaders
    ];

    // put the render result into cache
    await redisClient.hmset(params, function(err, reply) {
      if (err) {
        console.error(err);
      } else {
        // use the code below if you want the cache to live for a duration in terms of seconds
        let expirationTime = Math.floor(Date.now()/1000) + cacheDurationMinutes*60*1000;

        // use the code below if you want to clear at a specific period of time
        // let end = Math.floor(moment.tz('America/New_York').endOf('day').valueOf()/1000);
        // let start = Math.floor(moment.tz('America/New_York').valueOf()/1000);
        // let expirationTime = end - start + Math.floor(Math.random()*3600);

        redisClient.expire(key, expirationTime, function(err, reply) {
          if (err) {
            console.error(err);
          };
        });
      };
    });
  }

  /**
   * Get cached rendering results from redis
   * @param {String} key
   * @return {Object}
   */
  async getContent(key) {
    if (redisReady) {
      return redisClient.hgetall(key)
        .then(function(result) {
          if (!_.isEmpty(result)) {
            let headers = JSON.parse(result.headers);
            let payload = JSON.parse(result.payload);
            if (payload && typeof(payload) == 'object' && payload.type == 'Buffer')
              payload = new Buffer(payload);
            return {headers, payload};
          }
          return false;
        })
        .catch(function(error) {
          console.error(error);
        });
    }
  }
}

module.exports = new ElastiCache();
