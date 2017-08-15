'use strict';

const assert = require('assert');
const renderer = require('./renderer');
const chromeLauncher = require('chrome-launcher');
const express = require('express');
const fs = require('fs');
const compression = require('compression');
const path = require('path');
const https = require('https');
const app = express();
const cache = require('./cache');
const now = require('performance-now');
const uuidv4 = require('uuid/v4');

// Load config from config.json if it exists.
let config = {};
const configPath = path.resolve(__dirname, '../config.json');

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
  assert(config instanceof Object);
}

// Only start a cache if configured and not in testing.
if (!module.parent && !!config['cache']) {
  app.get('/render/:url(*)', cache.middleware());
  app.get('/screenshot/:url(*)', cache.middleware());
  // Always clear the cache for now, while things are changing.
  cache.clearCache();
}

// Allows the config to be overriden
app.setConfig = (newConfig) => {
  const oldConfig = config;
  config = newConfig;
  config.chrome = oldConfig.chrome;
  config.port = oldConfig.port;
};

app.use(compression());

app.use('/node_modules', express.static(path.resolve(__dirname, '../node_modules')));

app.get('/', (request, response) => {
  response.sendFile(path.resolve(__dirname, 'index.html'));
});

function isRestricted(url) {
  if (!config['renderOnly'])
    return false;
  for (let i = 0; i < config['renderOnly'].length; i++) {
    if (url.startsWith(config['renderOnly'][i])) {
      return false;
    }
  }
  return true;
}

// If configured, report action & time to Google Analytics.
function track(action, time) {
  if (config['analyticsTrackingId']) {
    const postOptions = {
      host: 'www.google-analytics.com',
      path: '/collect',
      method: 'POST'
    };

    const post = https.request(postOptions);
    post.write(`v=1&t=event&ec=render&ea=${action}&ev=${Math.round(time)}&tid=${config['analyticsTrackingId']}&cid=${uuidv4()}`);
    post.end();
  }
}

app.get('/render/:url(*)', async(request, response) => {
  if (isRestricted(request.params.url)) {
    response.status(403).send('Render request forbidden, domain excluded');
    return;
  }

  try {
    const start = now();
    const result = await renderer.serialize(request.params.url, request.query, config);
    response.status(result.status).send(result.body);
    track('render', now() - start);
  } catch (err) {
    let message = `Cannot render ${request.params.url}`;
    if (err && err.message)
      message += ` - "${err.message}"`;
    response.status(400).send(message);
  }
});

app.get('/screenshot/:url(*)', async(request, response) => {
  if (isRestricted(request.params.url)) {
    response.status(403).send('Render request forbidden, domain excluded');
    return;
  }

  try {
    const start = now();
    const result = await renderer.captureScreenshot(request.params.url, request.query, config).catch((err) => console.error(err));
    const img = new Buffer(result, 'base64');
    response.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': img.length
    });
    response.end(img);
    track('screenshot', now() - start);
  } catch (err) {
    let message = `Cannot render ${request.params.url}`;
    if (err && err.message)
      message += ` - "${err.message}"`;
    response.status(400).send(message);
  }
});

app.get('/_ah/health', (request, response) => response.send('OK'));

app.get('/_ah/stop', async(request, response) => {
  await config.chrome.kill();
  response.send('OK');
});

const appPromise = chromeLauncher.launch({
  chromeFlags: ['--headless', '--disable-gpu', '--remote-debugging-address=0.0.0.0'],
  port: 0
}).then((chrome) => {
  console.log('Chrome launched with debugging on port', chrome.port);
  config.chrome = chrome;
  config.port = chrome.port;
  // Don't open a port when running from inside a module (eg. tests). Importing
  // module can control this.
  const port = process.env.PORT || '3000';
  if (!module.parent) {
    app.listen(port, function() {
      console.log('Listening on port', port);
    });
  }
  return app;
}).catch((error) => {
  console.error(error);
  // Critical failure, exit with error code.
  process.exit(1);
});


let exceptionCount = 0;
async function logUncaughtError(error) {
  console.error('Uncaught exception');
  console.error(error);
  exceptionCount++;
  // Restart instance due to several failures.
  if (exceptionCount > 5) {
    console.log(`Detected ${exceptionCount} errors, shutting instance down`);
    if (config && config.chrome)
      await config.chrome.kill();
    process.exit(1);
  }
}

if (!module.parent) {
  process.on('uncaughtException', logUncaughtError);
  process.on('unhandledRejection', logUncaughtError);
}

module.exports = appPromise;
