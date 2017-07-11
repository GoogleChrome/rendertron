'use strict';

const request = require('supertest');
const path = require('path');
const test = require('ava');

/**
 * This deletes server from the require cache and reloads
 * the server, allowing for a clean state between each test.
 * @return {!Object} app server
 */
async function createServer() {
  delete require.cache[require.resolve('../src/main.js')];
  const app = await require('../src/main.js');
  return app;
}

test('health check responds correctly', async(t) => {
  const app = await createServer();
  const res = await request(app).get('/_ah/health');
  t.is(res.status, 200);
});

test('renders basic script', async(t) => {
  const app = await createServer();
  const testFile = path.resolve(__dirname, 'resources/basic-script.html');
  const res = await request(app).get('/?url=file://' + testFile);
  t.is(res.status, 200);
  t.is(res.text.replace(/\n/, ''), '<head>my head element</head>');
});

