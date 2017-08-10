'use strict';

const test = require('ava');
const middleware = require('../src/middleware');

test('makes a middleware function', async (t) => {
  const m = middleware.makeMiddleware({proxyURL: 'http://localhost/'});
  t.truthy(m);
});

test('requires a proxyURL', async (t) => {
  t.throws(() => middleware.makeMiddleware());
  t.throws(() => middleware.makeMiddleware({}));
  t.throws(() => middleware.makeMiddleware({proxyURL: ''}));
});
