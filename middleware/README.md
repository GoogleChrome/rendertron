[![Build status](https://img.shields.io/travis/samuelli/bot-render.svg?style=flat-square)](https://travis-ci.org/samuelli/bot-render)
[![NPM version](http://img.shields.io/npm/v/rendertron-middleware.svg)](https://www.npmjs.com/package/rendertron-middleware)

# rendertron-middleware

An Express middleware for [Rendertron](https://github.com/samuelli/bot-render).

Rendertron is a server which runs headless Chrome and renders web pages on the fly, which can be set up to serve pages to search engines, social networks and link rendering bots.

This middleware checks the User-Agent header of incoming requests, and if it matches one of a configurable set of bots, proxies that request through Rendertron.

## Usage
```sh
$ npm install --save express rendertron-middleware
```

```js
const express = require('express');
const rendertron = require('rendertron-middleware');

const app = express();

app.use(rendertron.makeMiddleware({
  proxyUrl: 'http://my-rendertron-instance/render',
}));

app.use(express.static('files'));
app.listen(8080);
```

## Configuration

The `makeMiddleware` function takes a configuration object with the following
properties:

| Property | Default | Description |
| -------- | ------- | ----------- |
| `proxyUrl` | *Required* | Base URL of your running Rendertron proxy service. |
| `userAgentPattern` | A set of known bots that benefit from pre-rendering. [Full list.](https://github.com/samuelli/bot-render/blob/master/middleware/src/middleware.ts) | RegExp for matching requests by User-Agent header. |
| `excludeUrlPattern` | A set of known static file extensions. [Full list.](https://github.com/samuelli/bot-render/blob/master/middleware/src/middleware.ts) | RegExp for excluding requests by the path component of the URL. |
| `injectShadyDom` | `false` | Force the web components polyfills to be loaded. [Read more.](https://github.com/samuelli/bot-render#web-components) |
| `timeout` | `11000` | Millisecond timeout for the proxy request to Rendertron. If exceeded, the standard response is served (i.e. `next()` is called). This is **not** the timeout for the Rendertron server itself. See also the [Rendertron timeout.](https://github.com/googlechrome/rendertron#rendering-budget-timeout) |
| `allowedForwardedHosts` | `[]` | If a forwarded host header is found and matches one of the hosts in this array, then that host will be used for the request to the rendertron server instead of the actual host of the current request. This is usedful if this middleware is running on a different host which is proxied behind the actual site, and the rendertron server should request the main site. **Note:** For security, because the header info is untrusted, only those hosts which you explicitly allow will be forwarded, otherwise they will be ignored. Leaving this undefined or empty (the default) will disable host forwarding. |
| `forwardedHostHeader` | `"X-Forwarded-Host"` | Header used to determine the forwarded host that should be used when building the URL to be rendered. Only used if `allowedForwardedHosts` is not empty. |


