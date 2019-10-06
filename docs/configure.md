### Config
When deploying the service, set configuration variables by including a `config.json` in the
root. Available configuration options:
 * `timeout` _default `10000`_ - set the timeout used to render the target page. 
 * `port` _default `3000`_ - set the port to use for running and listening the rendertron service. Note if process.env.PORT is set, it will be used instead.
 * `host` _default `0.0.0.0`_ - set the hostname to use for running and listening the rendertron service. Note if process.env.HOST is set, it will be used instead.
 * `width` _default `1000`_ - set the width (resolution) to be used for rendering the page.
 * `height` _default `1000`_ - set the height (resolution) to be used for rendering the page.
 * `cache` _default `null`_ - set to `datastore` to enable caching on Google Cloud using datastore or to `memory` to enable in-memory caching
