'use strict';

const Renderer = require('./renderer');
const startChromium = require('./chromium');
const express = require('express');

const app = express();

app.get('/', async function(request, response) {
  const head = await new Renderer(request.query.url).extractHead().catch((err) => console.error(err));
  response.send(head);
});

app.get('/_ah/health', (request, response) => response.send('OK'));

// Don't open a port when running from inside a module (eg. tests). Importing
// module can control this.
const chromiumStarted = startChromium();
if (chromiumStarted && !module.parent) {
  const port = process.env.PORT || '3000';
  app.listen(port, function() {
    console.log('Listening on port', port);
  });
} else if (!chromiumStarted) {
  console.error('Failed to start Chromium');
}

module.exports = app;
