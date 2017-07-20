'use strict';

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const shadyDomPolyfill = fs.readFileSync(require.resolve('@webcomponents/shadydom'), 'utf8');

/**
 * Executed on the page after the page has loaded. Strips script and
 * import tags to prevent further loading of resources.
 */
function stripPage() {
  const elements = document.querySelectorAll('script, link[rel=import]');
  elements.forEach((e) => e.remove());
}

function render(url, injectShadyDom) {
  return new Promise(async(resolve, reject) => {
    const tab = await CDP.New();
    const client = await CDP({tab: tab});

    const {Page, Runtime, Network, Emulation} = client;

    await Promise.all([
      Page.enable(),
      Runtime.enable(),
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
      Page.addScriptToEvaluateOnLoad({scriptSource: `ShadyDOM = {force: true}`});
      Page.addScriptToEvaluateOnLoad({scriptSource: shadyDomPolyfill});
    }

    Page.navigate({url: url});

    // Check that all outstanding network requests have finished loading.
    const outstandingRequests = new Map();
    Network.requestWillBeSent((event) => {
      outstandingRequests.set(event.requestId, event);
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

      let result = await Runtime.evaluate({expression: 'document.firstElementChild.outerHTML'});
      CDP.Close({id: client.target.id});
      resolve(result.result.value);
    });
  });
}

module.exports = render;
