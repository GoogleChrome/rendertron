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

const test = require('ava');
const request = require('supertest');
const express = require('express');
const compression = require('compression');
const cache = require('../src/cache.js');

const app = express();
const server = request(app);

app.use(cache.middleware());

let handlerCalledCount = 0;

test.before(async(t) => {
  await cache.clearCache();
});

app.get('/', (request, response) => {
  handlerCalledCount++;
  response.end('Called ' + handlerCalledCount + ' times');
});

test('caches content and serves same content on cache hit', async(t) => {
  let res = await server.get('/?basictest');
  const previousCount = handlerCalledCount;
  t.is(res.status, 200);
  t.is(res.text, 'Called ' + previousCount + ' times');

  res = await server.get('/?basictest');
  t.is(res.status, 200);
  t.is(res.text, 'Called ' + previousCount + ' times');

  res = await server.get('/?basictest');
  t.is(res.status, 200);
  t.is(res.text, 'Called ' + previousCount + ' times');

  res = await server.get('/?basictest2');
  t.is(res.status, 200);
  t.is(res.text, 'Called ' + (previousCount + 1) + ' times');
});

app.get('/set-header', (request, response) => {
  response.set('my-header', 'header-value');
  response.end('set-header-payload');
});

test('caches headers', async(t) => {
  let res = await server.get('/set-header');
  t.is(res.status, 200);
  t.is(res.header['my-header'], 'header-value');
  t.is(res.text, 'set-header-payload');

  res = await server.get('/set-header');
  t.is(res.status, 200);
  t.is(res.header['my-header'], 'header-value');
  t.is(res.text, 'set-header-payload');
});

app.use('/compressed', compression());
app.get('/compressed', (request, response) => {
  response.set('Content-Type', 'text/html');
  response.send(new Array(1025).join('x'));
});

test('compression preserved', async(t) => {
  const expectedBody = new Array(1025).join('x');
  let res = await server.get('/compressed').set('Accept-Encoding', 'gzip, deflate, br');
  t.is(res.status, 200);
  t.is(res.header['content-encoding'], 'gzip');
  t.is(res.text, expectedBody);

  res = await server.get('/compressed').set('Accept-Encoding', 'gzip, deflate, br');
  t.is(res.status, 200);
  t.is(res.header['content-encoding'], 'gzip');
  t.is(res.text, expectedBody);
});

let statusCallCount = 0;
app.get('/status/:status', (request, response) => {
  // Every second call sends a different status.
  if (statusCallCount % 2 == 0) {
    response.sendStatus(request.params.status);
  } else {
    response.sendStatus(456);
  }
  statusCallCount++;
});

test('original status is preserved', async(t) => {
  let res = await server.get('/status/123');
  t.is(res.status, 123);

  // Non 200 status code should not be cached.
  res = await server.get('/status/123');
  t.is(res.status, 456);
});
