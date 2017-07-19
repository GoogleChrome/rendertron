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
