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

const CDP = require('chrome-remote-interface');

class Renderer {
  _loadPage(client, url, options, config) {
    /**
     * Finds any meta tags setting the status code.
     * @return {?number} status code
     */
    function getStatusCode() {
      const metaElement = document.querySelector('meta[name="render:status_code"]');
      if (!metaElement)
        return undefined;
      return parseInt(metaElement.getAttribute('content')) || undefined;
    }

    /**
     * Listens for the 'render-complete' event.
     */
    function listenForCompletionEvent() {
      document.addEventListener('render-complete', () => {
        console.log('Rendering complete');
      });
    }

    return new Promise(async(resolve, reject) => {
      const {Page, Runtime, Network, Emulation, Console} = client;

      await Promise.all([
        Page.enable(),
        Runtime.enable(),
        Console.enable(),
        Network.enable(),
        Network.setBypassServiceWorker({bypass: true}),
      ]);

      // Inject the Shady DOM polyfill if web components v1 is used, so we can
      // serialize the page.
      // TODO(samli): This needs to change to use the non-deprecated API after Chrome 61
      //   addScriptToEvaluateOnNewDocument({source: `ShadyDOM = {force: true}`})
      if (!!options['wc-inject-shadydom']) {
        // Deprecated in Chrome 61.
        Page.addScriptToEvaluateOnLoad({scriptSource: `customElements.forcePolyfill = true`});
        Page.addScriptToEvaluateOnLoad({scriptSource: `ShadyDOM = {force: true}`});
        Page.addScriptToEvaluateOnLoad({scriptSource: `ShadyCSS = {shimcssproperties: true}`});
      }

      // Add hook for completion event.
      Page.addScriptToEvaluateOnLoad({scriptSource: `(${listenForCompletionEvent.toString()})()`});

      if (!!config['debug']) {
        Console.messageAdded((event) => {
          console.log(`[${event.message.level}] ${event.message.text}`);
        });
      }

      Page.navigate({url: url}).catch(reject);

      // Check that all outstanding network requests have finished loading.
      const outstandingRequests = new Map();
      let initialRequestId = undefined;
      Network.requestWillBeSent((event) => {
        if (!initialRequestId)
          initialRequestId = event.requestId;
        outstandingRequests.set(event.requestId, event);
      });

      let statusCode = 200;
      Network.responseReceived((event) => {
        if (event.requestId == initialRequestId && event.response.status != 0)
          statusCode = event.response.status;
      });

      Network.loadingFinished((event) => {
        outstandingRequests.delete(event.requestId);
      });

      Network.loadingFailed((event) => {
        if (event.requestId == initialRequestId) {
          reject({message: event.errorText});
        }
        outstandingRequests.delete(event.requestId);
      });

      // Ensure the page load event has fired.
      let pageLoadEventFired = false;
      Page.loadEventFired(() => {
        pageLoadEventFired = true;
      });

      // Set a virtual time budget of 10 seconds. This 10 second timer is paused while there are
      // any active network requests. This allows for a maximum of 10 seconds in script/rendering
      // time. Once the page is idle, the virtual time budget expires immediately.
      let currentTimeBudget = 10000;
      Emulation.setVirtualTimePolicy({policy: 'pauseIfNetworkFetchesPending', budget: currentTimeBudget});

      let budgetExpired = async() => {
        let result = await Runtime.evaluate({expression: `(${getStatusCode.toString()})()`});
        // Original status codes which aren't either 200 or 304 always return with that
        // status code, regardless of meta tags.
        if ((statusCode == 200 || statusCode == 304) && result.result.value)
          statusCode = result.result.value;

        resolve({status: statusCode || 200});
        budgetExpired = () => {};
        clearTimeout(timeoutId);
      };

      Emulation.virtualTimeBudgetExpired((event) => {
        // Reset the virtual time budget if there is still outstanding work. Converge the virtual time
        // budget just in case network requests are firing on a regular timer.
        if (outstandingRequests.size || !pageLoadEventFired) {
          // Budget must be an integer.
          currentTimeBudget = Math.ceil(currentTimeBudget / 2);
          Emulation.setVirtualTimePolicy({policy: 'pauseIfNetworkFetchesPending', budget: currentTimeBudget});
          return;
        }
        budgetExpired();
      });

      // Set a hard limit of 10 seconds.
      let timeoutId = setTimeout(() => {
        console.log(`10 second time budget limit reached.
          Attempted rendering: ${url}
          Page load event fired: ${pageLoadEventFired}
          Outstanding network requests: ${outstandingRequests.size}`);
        budgetExpired();
      }, 10000);

      // Listen for the message that signals that rendering event was fired.
      Console.messageAdded((event) => {
        if (event.message.text === 'Rendering complete') {
          budgetExpired();
        }
      });
    });
  }

  serialize(url, options, config) {
    /**
     * Executed on the page after the page has loaded. Strips script and
     * import tags to prevent further loading of resources.
     */
    function stripPage() {
      const elements = document.querySelectorAll('script, link[rel=import]');
      elements.forEach((e) => e.remove());
    }

    /**
     * Injects a <base> tag which allows other resources to load. This
     * has no effect on serialised output, but allows it to verify render quality.
     * @param {string} url - Requested URL to set as the base.
     */
    function injectBaseHref(url) {
      const base = document.createElement('base');
      base.setAttribute('href', url);
      document.head.appendChild(base);
    }

    return new Promise(async(resolve, reject) => {
      const tab = await CDP.New({port: config.port});
      const client = await CDP({tab: tab, port: config.port});

      const {Runtime} = client;

      try {
        let renderResult = await this._loadPage(client, url, options, config);

        await Runtime.evaluate({expression: `(${stripPage.toString()})()`});
        await Runtime.evaluate({expression: `(${injectBaseHref.toString()})('${url}')`});

        let result = await Runtime.evaluate({expression: 'document.firstElementChild.outerHTML'});
        CDP.Close({id: client.target.id, port: config.port});
        resolve({
          status: renderResult.status,
          body: result.result.value});
      } catch (error) {
        reject(error);
      }
    });
  }

  captureScreenshot(url, options, config) {
    return new Promise(async(resolve, reject) => {
      const tab = await CDP.New({port: config.port});
      const client = await CDP({tab: tab, port: config.port});

      const {Animation, Page, Emulation} = client;

      // Accelerate global animation timeline so that loading animations
      // are hopefully complete by the time we take the screenshot.
      Animation.setPlaybackRate({playbackRate: 1000});

      const width = Math.min(2000, parseInt(options['width']) || 1000);
      const height = Math.min(2000, parseInt(options['height']) || 1000);
      await Emulation.setDeviceMetricsOverride({width: width, height: height, mobile: true, deviceScaleFactor: 3.5, fitWindow: false, screenWidth: width, screenHeight: height});
      await Emulation.setVisibleSize({width: width, height: height});

      try {
        await this._loadPage(client, url, options, config);
        let {data} = await Page.captureScreenshot({format: 'jpeg', quality: 60});

        CDP.Close({id: client.target.id, port: config.port});
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new Renderer();
