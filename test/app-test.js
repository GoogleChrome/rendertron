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

const request = require('supertest');
const path = require('path');
const test = require('ava');
const express = require('express');

const app = express();
app.use(express.static(path.resolve(__dirname, 'resources')));
const testBase = 'http://localhost:1234/';

test.before(async(t) => {
  await app.listen(1234);
});


/**
 * This deletes server from the require cache and reloads
 * the server, allowing for a clean state between each test.
 * @param {?Object} config
 * @return {!Object} app server
 */
async function createServer(config) {
  delete require.cache[require.resolve('../src/main.js')];
  const app = await require('../src/main.js');
  if (config)
    app.setConfig(config);
  return request(app);
}

test('health check responds correctly', async(t) => {
  const server = await createServer();
  const res = await server.get('/_ah/health');
  t.is(res.status, 200);
});

test('renders basic script', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}basic-script.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') != -1);
});

test('renders script after page load event', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}script-after-load.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('injectedElement') != -1);
});

// This test is failing as the polyfills (shady polyfill & scoping shim) are not
// yet injected properly.
test.failing('renders shadow DOM - no polyfill', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}shadow-dom-no-polyfill.html?wc-inject-shadydom=true`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') != -1);
});

test('renders shadow DOM - polyfill loader', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}shadow-dom-polyfill-loader.html?wc-inject-shadydom=true`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') != -1);
});

test('renders shadow DOM - webcomponents-lite.js polyfill', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}shadow-dom-polyfill-all.html?wc-inject-shadydom=true`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') != -1);
});

test('script tags and link[rel=import] tags are stripped', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}include-script.html`);
  t.is(res.status, 200);
  t.false(res.text.indexOf('script src') != -1);
  t.true(res.text.indexOf('injectedElement') != -1);
  t.false(res.text.indexOf('link rel') != -1);
  t.true(res.text.indexOf('element-text') != -1);
});

test('server status code should be forwarded', async(t) => {
  const server = await createServer();
  const res = await server.get('/render/http://httpstat.us/404');
  t.is(res.status, 404);
  t.true(res.text.indexOf('404 Not Found') != -1);
});

test('http status code should be able to be set via a meta tag', async(t) => {
  const server = await createServer();
  const testFile = path.resolve(__dirname, 'resources/http-meta-status-code.html');
  const res = await server.get('/render/file://' + testFile + '?wc-inject-shadydom=true');
  t.is(res.status, 400);
});

test('http status codes need to be respected from top to bottom', async(t) => {
  const server = await createServer();
  const testFile = path.resolve(__dirname, 'resources/http-meta-status-code-multiple.html');
  const res = await server.get('/render/file://' + testFile + '?wc-inject-shadydom=true');
  t.is(res.status, 401);
});

test('screenshot is an image', async(t) => {
  const server = await createServer();
  const res = await server.get(`/screenshot/${testBase}basic-script.html`);
  t.is(res.status, 200);
  t.is(res.header['content-type'], 'image/jpeg');
  t.is(res.body.length, parseInt(res.header['content-length']));
});

test('invalid url fails', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/abc`);
  t.is(res.status, 400);
});

test('unknown url fails', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/http://unknown.blah.com`);
  t.is(res.status, 400);
});

test('explicit render event ends early', async(t) => {
  const server = await createServer();
  const res = await server.get(`/render/${testBase}explicit-render-event.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('async loaded') != -1);
});

test('whitelist ensures other urls do not get rendered', async(t) => {
  const server = await createServer({
    renderOnly: [testBase]
  });
  let res = await server.get(`/render/${testBase}basic-script.html`);
  t.is(res.status, 200);

  res = await server.get(`/render/http://anotherDomain.com`);
  t.is(res.status, 403);
});
