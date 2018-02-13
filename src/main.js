/*
 * Copyright 2017 Google Inc. All rights reserved.
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

'use strict';

const assert = require('assert');
const fs = require('fs');
const https = require('https');
const path = require('path');
const url = require('url');
const chromeLauncher = require('chrome-launcher');
const compression = require('compression');
const express = require('express');
const now = require('performance-now');
const uuidv4 = require('uuid/v4');
const cache = require('./cache');
const renderer = require('./renderer');

const app = express();

const CONFIG_PATH = path.resolve(__dirname, '../config.json');
const PROGRESS_BAR_PATH = path.resolve(__dirname, '../node_modules/progress-bar-element/progress-bar.html');
const PORT = process.env.PORT || '3000';

let config = {};

// Load config from config.json if it exists.
if (fs.existsSync(CONFIG_PATH)) {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH));
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
app.use('/progress-bar.html', express.static(PROGRESS_BAR_PATH));

app.get('/', (request, response) => {
  response.sendFile(path.resolve(__dirname, 'index.html'));
});

function isRestricted(urlReq) {
  const protocol = (url.parse(urlReq).protocol || '');

  if (!protocol.match(/^https?/)) return true;
  if (!config['renderOnly']) return false;

  for (let i = 0; i < config['renderOnly'].length; i++) {
    if (urlReq.startsWith(config['renderOnly'][i])) {
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

if (!!config['debug']) {
  console.log(`Rendertron configured with ${JSON.stringify(config, null, 2)}`);
  app.get('/render/:url(*)', (req, res, next) => {
    console.log('Render requested for ' + req.params.url);
    next();
  });
  app.get('/screenshot/:url(*)', (req, res, next) => {
    console.log('Screenshot requested for ' + req.params.url);
    next();
  });
}

app.get('/render/:url(*)', async(request, response) => {
  if (isRestricted(request.params.url)) {
    response.status(403).send('Render request forbidden, domain excluded');
    return;
  }

  try {
    const start = now();
    const result = await renderer.serialize(request.params.url, request.query, config);
    response.set('x-renderer', 'rendertron');
    response.status(result.status).send(result.body);
    track('render', now() - start);
  } catch (err) {
    response.status(400).send('Cannot render requested URL');
    console.error('Cannot render requested URL');
    console.error(err);
  }
});

app.get('/screenshot/:url(*)', async(request, response) => {
  if (isRestricted(request.params.url)) {
    response.status(403).send('Render request forbidden, domain excluded');
    return;
  }

  try {
    const start = now();
    const result = await renderer.captureScreenshot(request.params.url, request.query, config);
    const img = new Buffer(result, 'base64');
    response.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': img.length
    });
    response.end(img);
    track('screenshot', now() - start);
  } catch (err) {
    response.status(400).send('Cannot render requested URL');
    console.error('Cannot render requested URL');
    console.error(err);
  }
});

app.get('/_ah/health', (request, response) => response.send('OK'));

app.stop = async() => {
  await config.chrome.kill();
};

const appPromise = chromeLauncher.launch({
  chromeFlags: ['--headless', '--disable-gpu', '--remote-debugging-address=0.0.0.0'],
  port: 0
}).then((chrome) => {
  console.log('Chrome launched with debugging on port', chrome.port);
  config.chrome = chrome;
  config.port = chrome.port;
  // Don't open a port when running from inside a module (eg. tests). Importing
  // module can control this.
  if (!module.parent) {
    app.listen(PORT, function() {
      console.log('Listening on port', PORT);
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
      await app.stop();
    process.exit(1);
  }
}

if (!module.parent) {
  process.on('uncaughtException', logUncaughtError);
  process.on('unhandledRejection', logUncaughtError);
}

module.exports = appPromise;
