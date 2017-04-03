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
          const {Page, Runtime} = client;

          // Enable events on domains we are interested in.
          Promise.all([
            Page.enable(),
            Runtime.enable(),
          ]).then(() => {
            Page.navigate({url: this._url});
          });

          // Load and dump DOM of head element.
          Page.loadEventFired(() => {
            setTimeout(async () => {
              let result = await Runtime.evaluate({expression: 'document.head.outerHTML'});
              CDP.Close({id: client.tab.id});
              resolve(result.result.value);
            }, 3000);
          });
        } catch (err) {
          console.error(err);
          CDP.Close({id: client.tab.id});
          reject(err);
        }
      });
    });
  }
}

module.exports = Renderer;