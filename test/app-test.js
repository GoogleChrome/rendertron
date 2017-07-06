'use strict';

const request = require('supertest');
const path = require('path');
const test = require('ava');

/**
 * This deletes server from the require cache and reloads
 * the server, allowing for a clean state between each test.
 * @return {!Object} app server
 */
function createServer() {
  delete require.cache[require.resolve('../src/main.js')];
  return require('../src/main.js');
}

test('health check responds correctly', async(t) => {
  const res = await request(createServer()).get('/_ah/health');
  t.is(res.status, 200);
});

test('renders basic script', async(t) => {
  const testFile = path.resolve(__dirname, 'resources/basic-script.html');
  const res = await request(createServer()).get('/?url=file://' + testFile);
  t.is(res.status, 200);
  t.is(res.text.replace(/\n/, ''), '<head>my head element</head>');
});

