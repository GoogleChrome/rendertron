# Rendertron [![Build status](https://img.shields.io/travis/GoogleChrome/rendertron.svg?style=flat-square)](https://travis-ci.org/GoogleChrome/rendertron)

> Rendertron is a dockerized, headless Chrome rendering solution designed to render & serialise web pages on the fly.

Rendertron is designed to enable your Progressive Web App (PWA) to serve the correct
content to any bot that doesn't render or execute Javascript. Rendertron runs as a
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
  - [Explicit rendering event](#explicit-rendering-event)
  - [Web components](#web-components)
  - [Status codes](#status-codes)
- [Installing & deploying](#installing--deploying)
  - [Config](#config)

## Middleware
Once you have the service up and running, you'll need to implement the differential serving
layer. This checks the user agent to determine whether prerendering is required.

This is a list of middleware available to use with the Rendertron service:
 * [Express.js middleware](/middleware)
 * [Firebase functions](https://github.com/justinribeiro/pwa-firebase-functions-botrender) (Community maintained)

Rendertron is also compatible with [prerender.io middleware](https://prerender.io/documentation/install-middleware).
Note: the user agent lists differ there.

## API

### Render
```
/render/<url>
```

The `render` endpoint will render your page and serialize your page. Available options:
 * `wc-inject-shadydom` default `false` - used to correctly render Web Components v1. See
 [Using with web components](#web-components) for more information.

### Screenshot
```
/screenshot/<url>
```

The `screenshot` endpoint can be used to verify that your page is rendering correctly.
Available options:
 * `width` default `1000` - used to set the viewport width (max 2000)
 * `height` default `1000` - used to set the viewport height (max 2000)

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

### Explicit rendering event
In some cases, the auto loading function may be insufficient, for example if there is content
being streamed on the page. To explicitly signal when the page is visually complete, fire an
event as follows:
```js
  myElement.dispatchEvent(new Event('render-complete', { bubbles: true, composed: true}));
```

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

### Dependencies
This project requires Node 7+ and Docker ([installation instructions](https://docs.docker.com/engine/installation/)). For deployment this
project uses the [Google Cloud Platform SDK](https://cloud.google.com/sdk/).

### Installing
Install node dependencies using:
```bash
npm install
```

Install Chrome:
```bash
apt-get install google-chrome
```

### Running locally
With a local instance of Chrome installed, you can start the server locally:
```bash
npm start
```

To test a rendering, send a request:
```
http://localhost:3000/?url=https://dynamic-meta.appspot.com
```

### Docker
After installing docker, build the docker image:
```bash
docker build -t rendertron . --no-cache=true
```

### Running the container
The container enables the cache to run by default, so be sure to disable the cache when running locally.

Building the container:
```bash
docker run -it -p 8080:8080 --name rendertron-container rendertron
```

In the case where your kernel lacks user namespace support or are receiving a `ECONNREFUSED` error when trying to access the service in the container (as noted in issues [2](https://github.com/GoogleChrome/rendertron/issues/2) and [3](https://github.com/GoogleChrome/rendertron/issues/3)), the two recommended methods below should solve this:
1. [Recommended] - Use [Jessie Frazelle' seccomp profile](https://github.com/jessfraz/dotfiles/blob/master/etc/docker/seccomp/chrome.json) and `-security-opt` flag
2. Utilize the `--cap-add SYS_ADMIN` flag

[Recommended] Start a container with the built image using Jessie Frazelle' seccomp profile for Chrome:
```bash
wget https://raw.githubusercontent.com/jfrazelle/dotfiles/master/etc/docker/seccomp/chrome.json -O ~/chrome.json
docker run -it -p 8080:8080 --security-opt seccomp=$HOME/chrome.json --name rendertron-container rendertron
```

Start a container with the built image using SYS_ADMIN:
```bash
docker run -it -p 8080:8080 --cap-add SYS_ADMIN --name rendertron-container rendertron
```

Load the homepage in any browser:
```bash
http://localhost:8080/
```

Stop the container:
```bash
docker kill rendertron-container
```

Clear containers:
```bash
docker rm -f $(docker ps -a -q)
```

### Deploying to Google Cloud Platform
```
gcloud app deploy app.yaml --project <your-project-id>
```

### Config
When deploying the service, set configuration variables by including a `config.json` in the
root. Available configuration options:
 * `analyticsTrackingId` default `""` - set to a Google Analytics property
 [tracking id](https://support.google.com/analytics/answer/1008080?hl=en#trackingID) to
 send Rendertron rendering events to analytics.
 * `cache` default `false` - set to `true` to enable caching on Google Cloud using datastore
 * `debug` default `false` - set to `true` to log console messages from within the
 rendered pages.
 * `renderOnly` - restrict the endpoint to only service requests for certain domains. Specified
 as an array of strings. eg. `['http://render.only.this.domain']`. This is a strict prefix
 match, so ensure you specify the exact protocols that will be used (eg. http, https).

