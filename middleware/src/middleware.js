'use strict';

const request = require('request');
const url = require('url');

/**
 * A default set of user agent patterns for bots/crawlers that do not perform
 * well with pages that require JavaScript.
 */
const botUserAgents = module.exports.botUserAgents = [
  'W3C_Validator',
  'baiduspider',
  'bingbot',
  'embedly',
  'facebookexternalhit',
  'linkedinbo',
  'outbrain',
  'pinterest',
  'quora link preview',
  'rogerbo',
  'showyoubot',
  'slackbot',
  'twitterbot',
  'vkShare',
];

/**
 * Return a new Express middleware function that proxies requests to a
 * Rendertron bot rendering service. Options:
 *
 * - proxyURL: Base URL of the Rendertron proxy service. Required.
 * - userAgentMatcher: RegExp to match user agent headers against. Defaults to
 *   a set of bots that do not perform well with pages that require JavaScript.
 * - injectShadyDOM: Force web components polyfills to be loaded and enabled.
 * - timeout: Millisecond timeout for proxy requests.
 */
module.exports.makeMiddleware = function(options) {
  if (!options || !options.proxyURL) {
    throw new Error('Must set options.proxyURL.');
  }
  const proxyURL = options.proxyURL;
  const userAgentMatcher =
      options.userAgentMatcher || new RegExp(botUserAgents.join('|'), 'i');
  const injectShadyDOM = !!options.injectShadyDOM;
  const timeout = options.timeout || 10000;  // Milliseconds.

  return function rendertronMiddleware(req, res, next) {
    if (!userAgentMatcher.test(req.headers['user-agent'])) {
      next();
      return;
    }
    const incomingURL =
        req.protocol + '://' + req.get('host') + req.originalUrl;
    let renderURL = proxyURL + encodeURIComponent(incomingURL);
    if (injectShadyDOM) {
      renderURL += '?wc-inject-shadydom';
    }
    request({url: renderURL, timeout}).pipe(res);
  };
}
