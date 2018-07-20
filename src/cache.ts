// /*
//  * Copyright 2018 Google Inc. All rights reserved.
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License"); you may
//  not
//  * use this file except in compliance with the License. You may obtain a copy
//  of
//  * the License at
//  *
//  *     http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
//  * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
//  * License for the specific language governing permissions and limitations
//  under
//  * the License.
//  */

// 'use strict';

// import * as Datastore from '@google-cloud/datastore';
// import * as express from 'express';
// import {DatastoreKey} from '@google-cloud/datastore/entity';

// const datastore = new Datastore({});

// type CacheContent = {
//   saved: Date,
//   expires: Date,
//   headers: string,
//   payload: string,
// };

// type DatastoreObject = {
//   [datastore.KEY]: DatastoreKey
// };

// class Cache {
//   async clearCache() {
//     const query = datastore.createQuery('Page');
//     const data = await query.run();
//     const entities = data[0];
//     const entityKeys =
//         entities.map((entity) => (entity as DatastoreObject)[datastore.KEY]);
//     console.log(`Removing ${entities.length} items from the cache`);
//     await datastore.delete(entityKeys);
//     // TODO(samli): check info (data[1]) and loop through pages of entities
//     to
//     // delete.
//   }

//   async cacheContent(key: DatastoreKey, headers: {}, payload: Buffer) {
//     // Set cache length to 1 day.
//     const cacheDurationMinutes = 60 * 24;
//     const now = new Date();
//     const entity = {
//       key: key,
//       data: [
//         {name: 'saved', value: now},
//         {
//           name: 'expires',
//           value: new Date(now.getTime() + cacheDurationMinutes * 60 * 1000)
//         },
//         {
//           name: 'headers',
//           value: JSON.stringify(headers),
//           excludeFromIndexes: true
//         },
//         {
//           name: 'payload',
//           value: JSON.stringify(payload),
//           excludeFromIndexes: true
//         },
//       ]
//     };
//     await datastore.save(entity);
//   }

//   /**
//    * Returns middleware function.
//    * @return {function}
//    */
//   middleware() {
//     const cacheContent = this.cacheContent;

//     return async function(
//         request: express.Request,
//         response: express.Response,
//         next: express.NextFunction) {
//       function accumulateContent(content: Buffer|string) {
//         if (typeof (content) === 'string') {
//           body = Buffer.concat([body, new Buffer(content)]);
//         } else if (Buffer.isBuffer(content)) {
//           body = Buffer.concat([body, content], body.length +
//           content.length);
//         }
//       }

//       function responseEnd(
//           content?: Buffer|string, encoding?: string, callback?: Function):
//           void;
//       function responseEnd(encoding?: string, callback?: Function): void;
//       function responseEnd(callback?: Function): void;
//       function responseEnd(
//           arg1?: Buffer|string|Function,
//           arg2?: string|Function,
//           callback?: Function): void {
//         if (response.statusCode === 200 && typeof arg1 === 'string' ||
//             Buffer.isBuffer(arg1)) {
//           accumulateContent(arg1);
//           // Don't need to wait for cache contents to be written, will happen
//           // asynchronously.
//           cacheContent(key, response.getHeaders(), body);
//         }

//         return methods.end.apply(response, arguments);
//       }

//       // Cache based on full URL. This means requests with different params
//       are
//       // cached separately.
//       const key = datastore.key(['Page', request.url]);
//       const results = await datastore.get(key);

//       if (results.length && results[0] != undefined) {
//         const content = results[0] as CacheContent;
//         // Serve cached content if its not expired.
//         if (content.expires.getTime() >= new Date().getTime()) {
//           const headers = JSON.parse(content.headers);
//           response.set(headers);
//           response.set('x-rendertron-cached', content.saved.toUTCString());
//           let payload = JSON.parse(content.payload);
//           if (payload && typeof (payload) == 'object' &&
//               payload.type == 'Buffer')
//             payload = new Buffer(payload);
//           response.send(payload);
//           return;
//         }
//       }

//       // Capture output to cache.
//       const methods = {
//         write: response.write,
//         end: response.end,
//       };
//       let body: Buffer = new Buffer(0);

//       response.write = function(content: Buffer|string) {
//         accumulateContent(content);
//         return methods.write.apply(response, arguments);
//       };

//       response.end = responseEnd;

//       next();
//     };
//   }
// }

// // TODO(samli): Allow for caching options, like freshness options.
// module.exports = new Cache();
