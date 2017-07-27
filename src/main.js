'use strict';

const render = require('./renderer');
const chromeLauncher = require('chrome-launcher');
const express = require('express');
const compression = require('compression');
const commandLineArgs = require('command-line-args');
const portscanner = require('portscanner');
const app = express();
const cache = require('./cache');

// Set up app command line flag options.
let config = {};
const optionsDefinitions = [
  {name: 'cache', type: Boolean, defaultValue: false},
  {name: 'debug', type: Boolean, defaultValue: false}
];

if (!module.parent) {
  config = commandLineArgs(optionsDefinitions);
  if (config.cache) {
    app.get('/', cache.middleware());
    // Always clear the cache for now, while things are changing.
    cache.clearCache();
  }
}

app.use(compression());

app.get('/', async function(request, response) {
  const injectShadyDom = !!request.query['wc-inject-shadydom'];
  const result = await render(request.query.url, injectShadyDom, config).catch((err) => console.error(err));
  response.status(result.status).send(result.body);
});

app.get('/_ah/health', (request, response) => response.send('OK'));

app.get('/_ah/stop', async(request, response) => {
  await config.chrome.kill();
  response.send('OK');
});

const appPromise = portscanner.findAPortNotInUse(9000, 15000, '127.0.0.1').then((port) => {
  config.port = port;
  return chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--remote-debugging-address=0.0.0.0'],
    port: port
  });
}).then((chrome) => {
  config.chrome = chrome;
  // Don't open a port when running from inside a module (eg. tests). Importing
  // module can control this.
  const port = process.env.PORT || '3000';
  if (!module.parent) {
    app.listen(port, function() {
      console.log('Listening on port', port);
    });
  }
  return app;
});

module.exports = appPromise;
