# Rendertron [![Build status](https://travis-ci.org/GoogleChrome/rendertron.svg?branch=master)](https://travis-ci.org/GoogleChrome/rendertron) [![NPM rendertron package](https://img.shields.io/npm/v/rendertron.svg)](https://npmjs.org/package/rendertron)

> Rendertron is a headless Chrome rendering solution designed to render & serialise web pages on the fly.

#### :hammer: Built with [Puppeteer](https://github.com/GoogleChrome/puppeteer)
#### :cloud: Easy deployment to Google Cloud
#### :mag: Improves SEO

Rendertron is designed to enable your Progressive Web App (PWA) to serve the correct
content to any bot that doesn't render or execute JavaScript. Rendertron runs as a
standalone HTTP server. Rendertron renders requested pages using Headless Chrome,
[auto-detecting](#auto-detecting-loading-function) when your PWA has completed loading
and serializes the response back to the original request. To use Rendertron, your application
configures [middleware](#middleware) to determine whether to proxy a request to Rendertron.
Rendertron is compatible with all client side technologies, including [web components](#web-components).

**Demo endpoint**

A demo Rendertron service is available at https://render-tron.appspot.com/. It is not designed
to be used as a production endpoint. You can use it, but there are no uptime guarantees.

## Contents
- [Middleware](#middleware)
- [API](#api)
  - [Render](#render)
  - [Screenshot](#screenshot)
- [FAQ](#faq)
  - [Query parameters](#query-parameters)
  - [Auto detecting loading function](#auto-detecting-loading-function)
  - [Rendering budget timeout](#rendering-budget-timeout)
  - [Web components](#web-components)
  - [Status codes](#status-codes)
- [Installing & deploying](#installing--deploying)
  - [Building](#building)
  - [Running locally](#running-locally)
  - [Deploying to Google Cloud Platform](#deploying-to-google-cloud-platform)
  - [Deploying using Docker](#deploying-using-docker)
  - [Config](#config)
  - [Troubleshooting](#troubleshooting)

## Middleware
Once you have the service up and running, you'll need to implement the differential serving
layer. This checks the user agent to determine whether prerendering is required.

This is a list of middleware available to use with the Rendertron service:
 * [Express.js middleware](/middleware)
 * [Firebase functions](https://github.com/justinribeiro/pwa-firebase-functions-botrender) (Community maintained)
 * [ASP.net core middleware](https://github.com/galamai/AspNetCore.Rendertron) (Community maintained)

Rendertron is also compatible with [prerender.io middleware](https://prerender.io/documentation/install-middleware).
Note: the user agent lists differ there.

## API

### Render
```
GET /render/<url>
```

The `render` endpoint will render your page and serialize your page. Options are
specified as query parameters:
 * `mobile` defaults to `false`. Enable by passing `?mobile` to request the
  mobile version of your site.

### Screenshot
```
GET /screenshot/<url>
POST /screenshot/<url>
```

The `screenshot` endpoint can be used to verify that your page is rendering
correctly.

Both endpoints support the following query parameters:
 * `width` defaults to `1000` - specifies viewport width.
 * `height` defaults to `1000` - specifies viewport height.
 * `mobile` defaults to `false`. Enable by passing `?mobile` to request the
  mobile version of your site.

Additional options are available as a JSON string in the `POST` body. See
[Puppeteer documentation](https://github.com/GoogleChrome/puppeteer/blob/v1.6.0/docs/api.md#pagescreenshotoptions)
for available options. You cannot specify the `type` (defaults to `jpeg`) and
`encoding` (defaults to `binary`) parameters.

## FAQ

### Query parameters
When setting query parameters as part of your URL, ensure they are encoded correctly. In JS,
this would be `encodeURIComponent(myURLWithParams)`. For example to specify `page=home`:
```
https://render-tron.appspot.com/render/http://my.domain/%3Fpage%3Dhome
```

### Auto detecting loading function
The service detects when a page has loaded by looking at the page load event, ensuring there
are no outstanding network requests and that the page has had ample time to render.

### Rendering budget timeout
There is a hard limit of 10 seconds for rendering. Ensure you don't hit this budget by ensuring
your application is rendered well before the budget expires.

### Web components
Headless Chrome supports web components but shadow DOM is difficult to serialize effectively.
As such, [shady DOM](https://github.com/webcomponents/shadydom) (a lightweight shim for Shadow DOM)
is required for web components.

If you are using web components v0 (deprecated), you will need to enable Shady DOM to
render correctly. In Polymer 1.x, which uses web components v0, Shady DOM is enabled by default.
If you are using Shadow DOM, override this by setting the query parameter `dom=shady` when
directing requests to the Rendertron service.

If you are using web components v1 and either `webcomponents-lite.js` or `webcomponents-loader.js`,
set the query parameter `wc-inject-shadydom=true` when directing requests to the Rendertron
service. This renderer service will force the necessary polyfills to be loaded and enabled.

### Status codes
Status codes from the initial requested URL are preserved. If this is a 200, or 304, you can
set the HTTP status returned by the rendering service by adding a meta tag.
```html
<meta name="render:status_code" content="404" />
```

## Running locally
To install Rendertron and run it locally, first install Rendertron:
```bash
npm install -g rendertron
```

With Chrome installed on your machine run the Rendertron CLI:
```bash
rendertron
```

## Installing & deploying

### Building
Clone and install dependencies:
```bash
git clone https://github.com/GoogleChrome/rendertron.git
cd rendertron
npm install
npm run build
```

### Running locally
With a local instance of Chrome installed, you can start the server locally:
```bash
npm run start
```

### Deploying to Google Cloud Platform
```
gcloud app deploy app.yaml --project <your-project-id>
```

### Deploying using Docker
Rendertron no longer includes a Docker file. Instead, refer to
[Puppeteer documentation](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker)
on how to deploy run headless Chrome in Docker.

### Config
When deploying the service, set configuration variables by including a `config.json` in the
root. Available configuration options:
 * `datastoreCache` default `false` - set to `true` to enable caching on Google Cloud using datastore
 * `timeout` default `10000` - set the timeout used to render the target page. 
 * `port` default `3000` - set the port to use for running and listening the rendertron service. Note if process.env.PORT is set, it will be used instead.
 * `width` default `1000` - set the width (resolution) to be used for rendering the page.
 * `height` default `1000` - set the height (resolution) to be used for rendering the page.

### Troubleshooting
If you're having troubles with getting Headless Chrome to run in your
environment, refer to the
[troubleshooting guide](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md)
for Puppeteer.
