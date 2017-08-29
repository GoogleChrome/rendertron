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

const request = require('request');

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

/* eslint-disable no-multi-spaces */

/**
 * A default set of file extensions for static assets that do not need to be
 * proxied.
 */
const staticFileExtensions = [
  'ai',  'avi',  'css', 'dat',  'dmg', 'doc',     'doc',  'exe', 'flv',
  'gif', 'ico',  'iso', 'jpeg', 'jpg', 'js',      'less', 'm4a', 'm4v',
  'mov', 'mp3',  'mp4', 'mpeg', 'mpg', 'pdf',     'png',  'ppt', 'psd',
  'rar', 'rss',  'svg', 'swf',  'tif', 'torrent', 'ttf',  'txt', 'wav',
  'wmv', 'woff', 'xls', 'xml',  'zip',
];

/* eslint-enable no-multi-spaces */

/**
 * @return {!Object} A new Express middleware function that proxies requests to
 * a Rendertron bot rendering service. Options:
 *
 * @param {!Object} options Configuration object with the following properties:
 * - proxyUrl: Base URL of the Rendertron proxy service. Required.
 * - userAgentPattern: Regular expression to match user agent to proxy.
 *   Defaults to a set of bots that do not perform well with pages that require
 *   JavaScript.
 * - excludeUrlPattern: Regular expression used to exclude request URL paths.
 *   Defaults to a set of typical static asset file extensions.
 * - injectShadyDom: Force web components polyfills to be loaded and enabled.
 * - timeout: Millisecond timeout for proxy requests.
 */
module.exports.makeMiddleware = function(options) {
  if (!options || !options.proxyUrl) {
    throw new Error('Must set options.proxyUrl.');
  }
  let proxyUrl = options.proxyUrl;
  if (!proxyUrl.endsWith('/')) {
    proxyUrl += '/';
  }
  const userAgentPattern =
      options.userAgentPattern || new RegExp(botUserAgents.join('|'), 'i');
  const excludeUrlPattern = options.excludeUrlPattern ||
      new RegExp(`\\.(${staticFileExtensions.join('|')})$`, 'i');
  const injectShadyDom = !!options.injectShadyDom;
  // The Rendertron service itself has a hard limit of 10 seconds to render, so
  // let's give a little more time than that by default.
  const timeout = options.timeout || 11000; // Milliseconds.

  return function rendertronMiddleware(req, res, next) {
    if (!userAgentPattern.test(req.headers['user-agent']) ||
        excludeUrlPattern.test(req.path)) {
      next();
      return;
    }
    const incomingUrl =
        req.protocol + '://' + req.get('host') + req.originalUrl;
    let renderUrl = proxyUrl + encodeURIComponent(incomingUrl);
    if (injectShadyDom) {
      renderUrl += '?wc-inject-shadydom=true';
    }
    request({url: renderUrl, timeout}, (e) => {
      if (e) {
        console.error(
            `[rendertron middleware] ${e.code} error fetching ${renderUrl}`);
        next();
      }
    }).pipe(res);
  };
};
