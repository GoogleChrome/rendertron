const https = require('follow-redirects').https;
const fs = require('fs');
const AdmZip = require('adm-zip');
const execFile = require('child_process').execFile;

class Chromium {
  constructor() {
  }

  download() {
    return new Promise((resolve, reject) => {
      const path = 'chromium.zip';
      if (fs.existsSync(path))
        fs.unlinkSync(path);

      https.get('https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots', function(response) {
        response.on('data', data => fs.appendFileSync(path, data));
        response.on('end', function() {
          var zip = new AdmZip(path);
          zip.extractAllTo('chromium');
          fs.unlinkSync(path);
          resolve();
        });
      });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.download().then(() => {

        const chromium = 'chromium/chrome-linux/chrome';
        if (!fs.existsSync(chromium)) {
          console.error('Cannot find chromium');
          reject();
          return;
        }

        // Ensure it is executable.
        fs.chmodSync(chromium, '777');
        execFile(chromium, ['--headless', '--disable-gpu', '--remote-debugging-port=9222']);
        resolve();
      });
    });
  }
}

module.exports = Chromium;