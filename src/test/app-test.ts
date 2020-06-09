/*
 * Copyright 2018 Google Inc. All rights reserved.
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

import { test } from 'ava';
import * as Koa from 'koa';
import * as koaStatic from 'koa-static';
import * as path from 'path';
import * as request from 'supertest';
import * as fs from 'fs';
import * as os from 'os';

import { Rendertron } from '../rendertron';

const app = new Koa();
app.use(koaStatic(path.resolve(__dirname, '../../test-resources')));

const testBase = 'http://localhost:1234/';

const rendertron = new Rendertron();

let server: request.SuperTest<request.Test>;

test.before(async () => {
  server = request(await rendertron.initialize());
  await app.listen(1234);
});

test('health check responds correctly', async (t) => {
  const res = await server.get('/_ah/health');
  t.is(res.status, 200);
});

test('renders basic script', async (t) => {
  const res = await server.get(`/render/${testBase}basic-script.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
});

test('renders script after page load event', async (t) => {
  const res = await server.get(`/render/${testBase}script-after-load.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('injectedElement') !== -1);
});

test('renders HTML docType declaration', async (t) => {
  const res = await server.get(
    `/render/${testBase}include-doctype.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('<!DOCTYPE html>') !== -1);
});

test('sets the correct base URL for a subfolder', async (t) => {
  const res = await server.get(`/render/${testBase}subfolder/index.html`);
  const matches = res.text.match('<base href="([^"]+)">');
  const baseUrl = matches ? matches[1] : '';
  t.is(baseUrl, `${testBase}subfolder`);
});

test('sets the correct base URL for the root folder', async (t) => {
  const res = await server.get(`/render/${testBase}basic-script.html`);
  const matches = res.text.match('<base href="([^"]+)">');
  const baseUrl = matches ? matches[1] : '';
  t.is(baseUrl, `${testBase}`);
});


// This test is failing as the polyfills (shady polyfill & scoping shim) are not
// yet injected properly.
test.failing('renders shadow DOM - no polyfill', async (t) => {
  const res = await server.get(
    `/render/${testBase}shadow-dom-no-polyfill.html?wc-inject-shadydom=true`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') !== -1);
});

test('renders shadow DOM - polyfill loader', async (t) => {
  const res = await server.get(`/render/${
    testBase}shadow-dom-polyfill-loader.html?wc-inject-shadydom=true`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') !== -1);
});

test('renders shadow DOM - polyfill loader - different flag', async (t) => {
  const res = await server.get(
    `/render/${testBase}shadow-dom-polyfill-loader.html?wc-inject-shadydom`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') !== -1);
});

test('renders shadow DOM - webcomponents-lite.js polyfill', async (t) => {
  const res = await server.get(`/render/${
    testBase}shadow-dom-polyfill-all.html?wc-inject-shadydom=true`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') !== -1);
});

test('script tags and link[rel=import] tags are stripped', async (t) => {
  const res = await server.get(`/render/${testBase}include-script.html`);
  t.is(res.status, 200);
  t.false(res.text.indexOf('script src') !== -1);
  t.true(res.text.indexOf('injectedElement') !== -1);
  t.false(res.text.indexOf('link rel') !== -1);
  t.true(res.text.indexOf('element-text') !== -1);
});

test('script tags for JSON-LD are not stripped', async (t) => {
  const res = await server.get(`/render/${testBase}include-json-ld.html`);
  t.is(res.status, 200);
  t.false(res.text.indexOf('script src') !== -1);
  t.true(res.text.indexOf('application/ld+json') !== -1);
  t.false(res.text.indexOf('javascript') !== -1);
});

test('server status code should be forwarded', async (t) => {
  const res = await server.get('/render/http://httpstat.us/404');
  t.is(res.status, 404);
  t.true(res.text.indexOf('404 Not Found') !== -1);
});

test('http status code should be able to be set via a meta tag', async (t) => {
  const testFile = 'http-meta-status-code.html';
  const res = await server.get(
    `/render/${testBase}${testFile}?wc-inject-shadydom=true`);
  t.is(res.status, 400);
});

test('http status codes need to be respected from top to bottom', async (t) => {
  const testFile = 'http-meta-status-code-multiple.html';
  const res = await server.get(
    `/render/${testBase}${testFile}?wc-inject-shadydom=true`);
  t.is(res.status, 401);
});

test('screenshot is an image', async (t) => {
  const res = await server.post(`/screenshot/${testBase}basic-script.html`);
  t.is(res.status, 200);
  t.is(res.header['content-type'], 'image/jpeg');
  t.true(res.body.length > 300);
  t.is(res.body.length, parseInt(res.header['content-length']));
});

test('screenshot accepts options', async (t) => {
  const res =
    await server.post(`/screenshot/${testBase}basic-script.html`).send({
      clip: { x: 100, y: 100, width: 100, height: 100 },
      path: 'test.jpeg'
    });
  t.is(res.status, 200);
  t.is(res.header['content-type'], 'image/jpeg');
  t.true(res.body.length > 300);
  t.is(res.body.length, parseInt(res.header['content-length']));
});

test('invalid url fails', async (t) => {
  const res = await server.get(`/render/abc`);
  t.is(res.status, 403);
});

test('unknown url fails', async (t) => {
  const res = await server.get(`/render/http://unknown.blah.com`);
  t.is(res.status, 400);
});

test('file url fails', async (t) => {
  const res = await server.get(`/render/file:///dev/fd/0`);
  t.is(res.status, 403);
});

test('file url fails for screenshot', async (t) => {
  const res = await server.get(`/screenshot/file:///dev/fd/0`);
  t.is(res.status, 403);
});

test('appengine internal url fails', async (t) => {
  const res = await server.get(`/render/http://metadata.google.internal/computeMetadata/v1beta1/instance/service-accounts/default/token`);
  t.is(res.status, 403);
});

test('appengine internal url fails for screenshot', async (t) => {
  const res = await server.get(`/screenshot/http://metadata.google.internal/computeMetadata/v1beta1/instance/service-accounts/default/token`);
  t.is(res.status, 403);
});

test.failing('explicit render event ends early', async (t) => {
  const res = await server.get(`/render/${testBase}explicit-render-event.html`);
  t.is(res.status, 200);
  t.true(res.text.indexOf('async loaded') !== -1);
});

// TODO: support URL whitelisting.
// test('whitelist ensures other urls do not get rendered', async(t) => {
//   const server = await createServer({
//     renderOnly: [testBase]
//   });
//   let res = await server.get(`/render/${testBase}basic-script.html`);
//   t.is(res.status, 200);

//   res = await server.get(`/render/http://anotherDomain.com`);
//   t.is(res.status, 403);
// });

test('unknown url fails safely on screenshot', async (t) => {
  const res = await server.get(`/render/http://unknown.blah.com`);
  t.is(res.status, 400);
});

test('endpont for invalidating memory cache works if configured', async (t) => {
  const mock_config = {
    cache: 'memory' as const,
    cacheConfig: {
      cacheDurationMinutes: '120',
      cacheMaxEntries: '50'
    },
    timeout: 10000,
    port: '3000',
    host: '0.0.0.0',
    width: 1000,
    height: 1000,
    headers: {},
    puppeteerArgs: ['--no-sandbox']
  };
  const cached_server = request(await (new Rendertron()).initialize(mock_config));
  const test_url = `/render/${testBase}basic-script.html`;
  await app.listen(1235);
  // Make a request which is not in cache
  let res = await cached_server.get(test_url);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
  t.true(res.header['x-rendertron-cached'] == null);

  // Ensure that it is cached
  res = await cached_server.get(test_url);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
  t.true(res.header['x-rendertron-cached'] != null);

  // Invalidate cache and ensure it is not cached
  res = await cached_server.get(`/invalidate/${test_url}`);
  res = await cached_server.get(test_url);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
  t.true(res.header['x-rendertron-cached'] == null);

});

test('endpont for invalidating filesystem cache works if configured', async (t) => {
  const mock_config = {
    cache: 'filesystem' as const,
    cacheConfig: {
      cacheDurationMinutes: '120',
      cacheMaxEntries: '50',
      snapshotDir: path.join(os.tmpdir(), 'rendertron-test-cache')
    },
    timeout: 10000,
    port: '3000',
    host: '0.0.0.0',
    width: 1000,
    height: 1000,
    headers: {},
    puppeteerArgs: ['--no-sandbox']
  };
  const cached_server = request(await (new Rendertron()).initialize(mock_config));
  const test_url = `/render/${testBase}basic-script.html`;
  await app.listen(1236);
  // Make a request which is not in cache
  let res = await cached_server.get(test_url);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
  t.true(res.header['x-rendertron-cached'] == null);

  // Ensure that it is cached
  res = await cached_server.get(test_url);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
  t.true(res.header['x-rendertron-cached'] != null);

  // Invalidate cache and ensure it is not cached
  res = await cached_server.get(`/invalidate/${testBase}basic-script.html`);
  res = await cached_server.get(test_url);
  t.is(res.status, 200);
  t.true(res.text.indexOf('document-title') !== -1);
  t.is(res.header['x-renderer'], 'rendertron');
  t.true(res.header['x-rendertron-cached'] == null);

  // cleanup cache to prevent future tests failing
  res = await cached_server.get(`/invalidate/${testBase}basic-script.html`);
  fs.rmdirSync(path.join(os.tmpdir(), 'rendertron-test-cache'));
});
