/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import * as koa from 'koa';
import * as request from 'request';

import {applyDefaults, Options} from './options';

/**
 * Create a new Koa middleware function that proxies requests to a
 * Rendertron bot rendering service.
 */
export function makeKoaMiddleware(options: Options): koa.Middleware {
  const opts = applyDefaults(options);

  return function rendertronKoaMiddleware(ctx, next) {
    const ua = ctx.headers['user-agent'];
    if (ua === undefined || !opts.userAgentPattern.test(ua) ||
        opts.excludeUrlPattern.test(ctx.path)) {
      return next();
    }
    const incomingUrl = ctx.protocol + '://' + ctx.host + ctx.originalUrl;
    let renderUrl = opts.proxyUrl + encodeURIComponent(incomingUrl);
    if (opts.injectShadyDom) {
      renderUrl += '?wc-inject-shadydom=true';
    }
    ctx.body = request({url: renderUrl, timeout: opts.timeout});
  };
}
