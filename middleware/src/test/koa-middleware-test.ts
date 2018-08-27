/**
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
import * as koa from 'koa';
import * as net from 'net';
import * as supertest from 'supertest';

import {makeKoaMiddleware} from '../koa-middleware';
import {Options} from '../options';

/**
 * Start the given Koa app on localhost with a random port.
 * @param {!Object} app The app.
 */
async function listen(app: koa): Promise<string> {
  return new Promise<string>((resolve: (url: string) => void) => {
    const server = app.listen(/* random */ 0, 'localhost', () => {
      resolve(`http://localhost:${(server.address() as net.AddressInfo).port}`);
    });
  });
}

/**
 * Make a Koa app that uses the Rendertron middleware and returns "fallthrough"
 * if the middleware skipped the request (i.e. called `next`).
 */
function makeApp(options: Options) {
  return new koa()
      .use(makeKoaMiddleware(options))
      .use((ctx, _next) => ctx.body = 'fallthrough');
}

/**
 * Make a Koa app that takes the place of a Rendertron server instance and
 * always responds with "proxy <decoded url>".
 */
function makeProxy() {
  return new koa().use((ctx, _next) => {
    ctx.body = 'proxy ' + decodeURIComponent(ctx.url.substring(1));
  });
}

const bot = 'slackbot';
const human = 'Chrome';

/**
 * GET a URL with the given user agent.
 * @param userAgent The user agent string.
 * @param host The host part of the URL.
 * @param path The path part of the URL.
 * @return Promise of the GET response.
 */
async function get(userAgent: string, host: string, path: string) {
  return await supertest(host).get(path).set('User-Agent', userAgent);
}

test('makes a middleware function', async (t) => {
  const m = makeKoaMiddleware({proxyUrl: 'http://example.com'});
  t.truthy(m);
});

test('throws if no proxyUrl given', async (t) => {
  const makeMiddlewareUntyped = makeKoaMiddleware as (options?: unknown) =>
                                    koa.Middleware;
  t.throws(() => makeMiddlewareUntyped());
  t.throws(() => makeMiddlewareUntyped({}));
  t.throws(() => makeMiddlewareUntyped({proxyUrl: ''}));
});

test('proxies through given url', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl}));

  const res = await get(bot, appUrl, '/foo');
  t.is(res.status, 200);
  t.is(res.text, 'proxy ' + appUrl + '/foo');
});

test('proxyUrl can have trailing slash', async (t) => {
  const proxyUrl = await listen(makeProxy());
  // Make sure our other tests are testing the no-trailing-slash case.
  t.false(proxyUrl.endsWith('/'));
  const appUrl = await listen(makeApp({proxyUrl: proxyUrl + '/'}));

  const res = await get(bot, appUrl, '/foo');
  t.is(res.status, 200);
  t.is(res.text, 'proxy ' + appUrl + '/foo');
});

test('adds shady dom parameter', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl, injectShadyDom: true}));

  const res = await get(bot, appUrl, '/foo');
  t.is(res.status, 200);
  t.is(res.text, 'proxy ' + appUrl + '/foo?wc-inject-shadydom=true');
});

test('excludes static file paths by default', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl}));

  const res = await get(bot, appUrl, '/foo.png');
  t.is(res.text, 'fallthrough');
});

test('url exclusion only matches url path component', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl}));

  const res = await get(bot, appUrl, '/foo.png?params');
  t.is(res.text, 'fallthrough');
});

test('excludes non-bot user agents by default', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl}));

  const res = await get(human, appUrl, '/foo');
  t.is(res.text, 'fallthrough');
});

test('respects custom user agent pattern', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl, userAgentPattern: /borg/}));

  let res;

  res = await get('humon', appUrl, '/foo');
  t.is(res.text, 'fallthrough');

  res = await get('borg', appUrl, '/foo');
  t.is(res.text, 'proxy ' + appUrl + '/foo');
});

test('respects custom exclude url pattern', async (t) => {
  const proxyUrl = await listen(makeProxy());
  const appUrl = await listen(makeApp({proxyUrl, excludeUrlPattern: /foo/}));

  let res;

  res = await get(bot, appUrl, '/foo');
  t.is(res.text, 'fallthrough');

  res = await get(bot, appUrl, '/bar');
  t.is(res.text, 'proxy ' + appUrl + '/bar');
});

test('forwards proxy error status and body', async (t) => {
  // This proxy always returns an error.
  const proxyUrl = await listen(new koa().use((ctx, _next) => {
    ctx.status = 500;
    ctx.body = 'proxy error';
  }));
  const appUrl = await listen(makeApp({proxyUrl}));

  const res = await get(bot, appUrl, '/bar');
  t.is(res.status, 500);
  t.is(res.text, 'proxy error');
});

test.failing('falls through after timeout', async (t) => {
  // This proxy returns after 20ms, but our timeout is 10ms.
  const proxyUrl = await listen(new koa().use((ctx, _next) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        ctx.body = 'too slow';
        resolve();
      }, 20);
    });
  }));
  const appUrl = await listen(makeApp({proxyUrl, timeout: 10}));

  const res = await get(bot, appUrl, '/foo');
  t.is(res.text, 'fallthrough');
});
