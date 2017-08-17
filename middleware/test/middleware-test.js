'use strict';

const express = require('express');
const supertest = require('supertest');
const test = require('ava');

const rendertron = require('../src/middleware');

/**
 * Start the given Express app on localhost with a random port and return its
 * HTTP URL.
 */
async function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(/* random */ 0, 'localhost', () => {
      resolve(`http://localhost:${server.address().port}`);
    });
  });
}

/**
 * Make an Express app that uses the Rendertron middleware and returns
 * "fallthrough" if the middleware skipped the request (i.e. called `next`).
 */
function makeApp(options) {
  return express()
      .use(rendertron.makeMiddleware(options))
      .use((req, res) => res.end('fallthrough'));
}

/**
 * Make an Express app that takes the place of a Rendertron server instance and
 * always responds with "proxy <decoded url>".
 */
function makeProxy() {
  return express().use((req, res) => {
    res.end('proxy ' + decodeURIComponent(req.url.substring(1)));
  });
}

const bot = 'slackbot';
const human = 'Chrome';

async function get(userAgent, url, path) {
  return await supertest(url).get(path).set('User-Agent', userAgent);
}

test('makes a middleware function', async (t) => {
  const m = rendertron.makeMiddleware({proxyUrl: 'http://example.com'});
  t.truthy(m);
});

test('throws if no proxyUrl given', async (t) => {
  t.throws(() => rendertron.makeMiddleware());
  t.throws(() => rendertron.makeMiddleware({}));
  t.throws(() => rendertron.makeMiddleware({proxyUrl: ''}));
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
  t.is(res.text, 'proxy ' + appUrl + '/foo?wc-inject-shadydom');
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
  const proxyUrl = await listen(
      express().use((req, res) => res.status(500).end('proxy error')));
  const appUrl = await listen(makeApp({proxyUrl}));

  const res = await get(bot, appUrl, '/bar');
  t.is(res.status, 500);
  t.is(res.text, 'proxy error');
});

test('falls through after timeout', async (t) => {
  // This proxy returns after 20ms, but our timeout is 10ms.
  const proxyUrl = await listen(express().use((req, res) => {
    setTimeout(() => res.end('too slow'), 20);
  }));
  const appUrl = await listen(makeApp({proxyUrl, timeout: 10}));

  const res = await get(bot, appUrl, '/foo');
  t.is(res.text, 'fallthrough');
});
