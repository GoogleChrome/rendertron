'use strict';

const CDP = require('chrome-remote-interface');

class Renderer {
  constructor(url) {
    this._url = url;
  }

  extractHead() {
    return new Promise((resolve, reject) => {
      CDP.New().then((tab) => {
        return CDP({tab: tab});
      }).then((client) => {
        try {
          // Extract DevTools domains.
          const {Page, Runtime, Network} = client;

          // Enable events on domains we are interested in.
          Promise.all([
            Page.enable(),
            Runtime.enable(),
            Network.enable(),
          ]).then(() => {
            return Promise.all([
              Network.clearBrowserCache(),
              Network.setCacheDisabled({cacheDisabled: true}),
              Network.setBypassServiceWorker({bypass: true}),
            ]);
          }).then(() => {
            Page.navigate({url: this._url});
          });

          // Load and dump DOM of head element.
          Page.loadEventFired(() => {
            setTimeout(async () => {
              let result = await Runtime.evaluate({expression: 'document.head.outerHTML'});
              CDP.Close({id: client.tab.id});
              resolve(result.result.value);
            }, 1500);
          });
        } catch (err) {
          console.error(err);
          CDP.Close({id: client.tab.id});
          reject(err);
        }
      }).catch((e) => {
        reject(e);
      });
    });
  }
}

module.exports = Renderer;