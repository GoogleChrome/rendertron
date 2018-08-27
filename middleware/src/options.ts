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

/**
 * Options for makeMiddleware.
 */
export interface CompleteOptions {
  /**
   * Base URL of the Rendertron proxy service. Required.
   */
  proxyUrl: string;

  /**
   * Regular expression to match user agent to proxy. Defaults to a set of bots
   * that do not perform well with pages that require JavaScript.
   */
  userAgentPattern: RegExp;

  /**
   * Regular expression used to exclude request URL paths. Defaults to a set of
   * typical static asset file extensions.
   */
  excludeUrlPattern: RegExp;

  /**
   * Force web components polyfills to be loaded and enabled. Defaults to false.
   */
  injectShadyDom: boolean;

  /**
   * Millisecond timeout for proxy requests. Defaults to 11000 milliseconds.
   */
  timeout: number;
}

export interface Options extends Partial<CompleteOptions> {
  proxyUrl: string;
}

/**
 * A default set of user agent patterns for bots/crawlers that do not perform
 * well with pages that require JavaScript.
 */
const botUserAgents = [
  'W3C_Validator',
  'baiduspider',
  'bingbot',
  'embedly',
  'facebookexternalhit',
  'linkedinbot',
  'outbrain',
  'pinterest',
  'quora link preview',
  'rogerbot',
  'showyoubot',
  'slackbot',
  'twitterbot',
  'vkShare',
];

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

export function applyDefaults(options: Options): CompleteOptions {
  if (!options || !options.proxyUrl) {
    throw new Error('Must set options.proxyUrl.');
  }
  return {
    userAgentPattern: new RegExp(botUserAgents.join('|'), 'i'),
    excludeUrlPattern:
        new RegExp(`\\.(${staticFileExtensions.join('|')})$`, 'i'),
    injectShadyDom: false,
    // The Rendertron service itself has a hard limit of 10 seconds to render,
    // so let's give a little more time than that by default.
    timeout: 11000,  // Milliseconds.

    ...options,

    proxyUrl: options.proxyUrl.endsWith('/') ? options.proxyUrl :
                                               options.proxyUrl + '/',
  };
}
