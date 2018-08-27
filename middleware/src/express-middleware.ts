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

import * as express from 'express';
import * as request from 'request';

import {applyDefaults, Options} from './options';

/**
 * Create a new Express middleware function that proxies requests to a
 * Rendertron bot rendering service.
 */
export function makeExpressMiddleware(options: Options): express.Handler {
  const opts = applyDefaults(options);

  return function rendertronExpressMiddleware(req, res, next) {
    let ua = req.headers['user-agent'];
    if (ua instanceof Array) {
      ua = ua[0];
    }
    if (ua === undefined || !opts.userAgentPattern.test(ua) ||
        opts.excludeUrlPattern.test(req.path)) {
      next();
      return;
    }
    const incomingUrl =
        req.protocol + '://' + req.get('host') + req.originalUrl;
    let renderUrl = opts.proxyUrl + encodeURIComponent(incomingUrl);
    if (opts.injectShadyDom) {
      renderUrl += '?wc-inject-shadydom=true';
    }
    request({url: renderUrl, timeout: opts.timeout}, (e) => {
      if (e) {
        console.error(
            `[rendertron middleware] ${e.code} error fetching ${renderUrl}`);
        next();
      }
    }).pipe(res);
  };
}
