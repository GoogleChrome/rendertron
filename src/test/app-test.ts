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

import {test} from 'ava';
import * as Koa from 'koa';
import * as koaStatic from 'koa-static';
import * as path from 'path';
import * as request from 'supertest';

import {Rendertron} from '../rendertron';

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
        clip: {x: 100, y: 100, width: 100, height: 100},
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
