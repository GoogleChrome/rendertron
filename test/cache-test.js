'use strict';

const test = require('ava');
const request = require('supertest');
const express = require('express');
const cache = require('../src/cache.js');

const app = express();
const server = request(app);

app.get('/', cache.middleware());

let handlerCalledCount = 0;
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
