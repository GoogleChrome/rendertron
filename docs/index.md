## What is Rendertron?

> Rendertron is a headless Chrome rendering solution designed to render &
> serialise web pages on the fly.

-   <a href="#"><img alt="hammer" class="emoji" src="https://github.githubassets.com/images/icons/emoji/unicode/1f528.png" height="20" width="20"></a>
    Built with [Puppeteer](https://github.com/GoogleChrome/puppeteer)
-   <a href="#"><img alt="cloud" class="emoji" src="https://github.githubassets.com/images/icons/emoji/unicode/2601.png" height="20" width="20"></a>
    Easy deployment to Google Cloud
-   <a href="#"><img alt="mag" class="emoji" src="https://github.githubassets.com/images/icons/emoji/unicode/1f50d.png" height="20" width="20"></a>
    Improves SEO

Rendertron is designed to enable your Progressive Web App (PWA) to serve the
correct content to any bot that doesn't render or execute JavaScript. Rendertron
runs as a standalone HTTP server. Rendertron renders requested pages using
Headless Chrome, [auto-detecting](#auto-detecting-loading-function) when your
PWA has completed loading and serializes the response back to the original
request. To use Rendertron, your application configures
[middleware](#middleware) to determine whether to proxy a request to Rendertron.
Rendertron is compatible with all client side technologies, including
[web components](#web-components).

## Demo endpoint

A demo Rendertron service is available at https://render-tron.appspot.com/. It
is not designed to be used as a production endpoint. You can use it, but there
are no uptime guarantees.

## Learn more

-   [Rendertron user guide](users-guide)
-   [Configuring Rendertron](configure)
-   [Deploying Rendertron](deploy)
- [Using Rendertron with your server](server-setup)
-   [API Reference](api-reference)
-   [Best practices](best_practices)
-   [Contributing to Rendertron](contributing)