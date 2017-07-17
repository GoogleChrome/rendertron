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
  return request(app);
}

test('health check responds correctly', async(t) => {
  const server = await createServer();
  const res = await server.get('/_ah/health');
  t.is(res.status, 200);
});

test('renders basic script', async(t) => {
  const server = await createServer();
  const testFile = path.resolve(__dirname, 'resources/basic-script.html');
  const res = await server.get('/?url=file://' + testFile);
  t.is(res.status, 200);
  t.is(res.text.replace(/\n/, ''), '<html><head>my head element</head><body></body></html>');
});

test('renders script after page load event', async(t) => {
  const server = await createServer();
  const testFile = path.resolve(__dirname, 'resources/script-after-load.html');
  const res = await server.get('/?url=file://' + testFile);
  t.is(res.status, 200);
  t.true(res.text.indexOf('injectedElement') != -1);
});

test('renders shadow DOM', async(t) => {
  const server = await createServer();
  const testFile = path.resolve(__dirname, 'resources/shadow-dom.html');
  const res = await server.get('/?url=file://' + testFile + '&wc-inject-shadydom=true');
  t.is(res.status, 200);
  t.true(res.text.indexOf('shadow-root-text') != -1);
});
