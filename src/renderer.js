'use strict';

const CDP = require('chrome-remote-interface');

function dump(url) {
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

      let result = await Runtime.evaluate({expression: 'document.firstElementChild.outerHTML'});
      CDP.Close({id: client.target.id});
      resolve(result.result.value);
    });
  });
}

module.exports = dump;
