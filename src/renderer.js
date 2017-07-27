'use strict';

const CDP = require('chrome-remote-interface');

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

/**
 * Executed on the page after the page has loaded. Strips script and
 * import tags to prevent further loading of resources.
 */
function stripPage() {
  const elements = document.querySelectorAll('script, link[rel=import]');
  elements.forEach((e) => e.remove());
}

function render(url, injectShadyDom, config) {
  return new Promise(async(resolve, reject) => {
    const tab = await CDP.New();
    const client = await CDP({tab: tab});

    const {Page, Runtime, Network, Emulation, Console} = client;

    await Promise.all([
      Page.enable(),
      Runtime.enable(),
      Console.enable(),
      Network.enable(),
      Network.clearBrowserCache(),
      Network.setCacheDisabled({cacheDisabled: true}),
      Network.setBypassServiceWorker({bypass: true}),
    ]);

    // Inject the Shady DOM polyfill if web components v1 is used, so we can
    // serialize the page.
    // TODO(samli): This needs to change to use the non-deprecated API after Chrome 61
    //   addScriptToEvaluateOnNewDocument({source: `ShadyDOM = {force: true}`})
    if (injectShadyDom) {
      // Deprecated in Chrome 61.
      Page.addScriptToEvaluateOnLoad({scriptSource: `customElements.forcePolyfill = true`});
      Page.addScriptToEvaluateOnLoad({scriptSource: `ShadyDOM = {force: true}`});
      Page.addScriptToEvaluateOnLoad({scriptSource: `ShadyCSS = {shimcssproperties: true}`});
    }

    if (config.debug) {
      Console.messageAdded((event) => {
        console.log(`[${event.message.level}] ${event.message.text}`);
      });
    }

    Page.navigate({url: url});

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

    Emulation.virtualTimeBudgetExpired(async(event) => {
      // Reset the virtual time budget if there is still outstanding work. Converge the virtual time
      // budget just in case network requests are firing on a regular timer.
      if (outstandingRequests.size || !pageLoadEventFired) {
        currentTimeBudget = currentTimeBudget / 2;
        Emulation.setVirtualTimePolicy({policy: 'pauseIfNetworkFetchesPending', budget: currentTimeBudget});
        return;
      }

      await Runtime.evaluate({expression: `(${stripPage.toString()})()`});
      let result = await Runtime.evaluate({expression: `(${getStatusCode.toString()})()`});
      // Original status codes which aren't either 200 or 304 always return with that
      // status code, regardless of meta tags.
      if ((statusCode == 200 || statusCode == 304) && result.result.value)
        statusCode = result.result.value;
      result = await Runtime.evaluate({expression: `(${injectBaseHref.toString()})('${url}')`});

      result = await Runtime.evaluate({expression: 'document.firstElementChild.outerHTML'});
      CDP.Close({id: client.target.id});
      resolve({
        status: statusCode || 200,
        body: result.result.value});
    });
  });
}

module.exports = render;
