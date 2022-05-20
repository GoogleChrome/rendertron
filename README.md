# Rendertron-slim

[![CI](https://github.com/nemoengineering/rendertron/workflows/CI/badge.svg)](https://github.com/nemoengineering/rendertron/actions)

> Rendertron is a headless Chrome rendering solution designed to render & serialise web pages on the fly.

#### :hammer: Built with [Puppeteer](https://github.com/GoogleChrome/puppeteer)

## Contents

- [API](#api)
  - [Render](#render)
  - [Screenshot](#screenshot)
- [FAQ](#faq)
  - [Page render timing](#page-render-timing)
  - [Rendering budget timeout](#rendering-budget-timeout)
  - [Web components](#web-components)
  - [Status codes](#status-codes)
- [Installing & deploying](#installing--deploying)
  - [Building](#building)
  - [Config](#config)

## API

Rendertron-slim uses a GRPC API. Docs and GRPC the schema are availabe at: [buf.build/nemoengineering/rendertron](https://buf.build/nemoengineering/rendertron)

### Render()

The `render` endpoint will render your page and serialize your page.

### Screenshot()

The `screenshot` endpoint takes an screenshot of the page provided in the URL

### Page render timing

The service attempts to detect when a page has loaded by looking at the page load event, ensuring there
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

## Installing & deploying

### Building

To build rendertron-slim `buf` and `protoc` is required.
Clone and install dependencies:

```bash
git clone https://github.com/nemoengineering/rendertron-slim.git
cd rendertron-slim
npm install
npm run build
```

### Running locally

With a local instance of Chrome installed, you can start the server locally:

```bash
npm run start
```

### Deploying using Docker

Rendertron no longer includes a Docker file. Instead, refer to
[Puppeteer documentation](https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-in-docker)
on how to deploy run headless Chrome in Docker.

### Config

When deploying the service, set configuration variables by setting the following environment variables:

- `PORT` _default `4000`_ - set the port to use for running and listening the rendertron service.
- `HOST` _default `0.0.0.0`_ - set the hostname to use for running and listening the rendertron service.
- `ALLOWED_RENDER_ORIGINS` - restrict the endpoint to only service requests for certain domains. Specified as an array of strings. eg. `"http://render.only.this.domain, http://or.this.domain"`. This is a strict prefix match, so ensure you specify the exact protocols that will be used (eg. http, https).
- `CLOSE_BROWSER_AFTER_RENDER`_default `false`_ - `true` forces the browser to close and reopen between each page render, some sites might need this to prevent URLs past the first one rendered returning null responses.
- `RESTRICTED_URL_PATTERN`_default `null`_ - set the restrictedUrlPattern to restrict the requests matching given regex pattern.
