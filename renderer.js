'use strict';

const CDP = require('chrome-remote-interface');

class Renderer {
  constructor(url) {
    this._url = url;
  }

  extractHead() {
    return new Promise((resolve, reject) => {
      CDP((client) => {
        try {
          // Extract DevTools domains.
          const {Page, Runtime} = client;

          // Enable events on domains we are interested in.
          Promise.all([
            Page.enable(),
            Runtime.enable(),
          ]).then(() => {
            return Page.navigate({url: this._url});
          });

          // Load and dump DOM of head element.
          Page.loadEventFired(() => {
            setTimeout(async () => {
              let result = await Runtime.evaluate({expression: 'document.head.outerHTML'});
              resolve(result.result.value);
              client.close();
            }, 3000);
          });
        } catch (err) {
          console.error(err);
          client.close();
          reject(err);
        }
      }).on('error', (err) => {
        console.error('Cannot connect to browser:', err);
        reject(err);
      });
    });
  }
}

module.exports = Renderer;