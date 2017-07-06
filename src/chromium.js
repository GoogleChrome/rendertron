const fs = require('fs');
const execFile = require('child_process').execFile;

function startChromium() {
  const chromium = '/usr/bin/google-chrome-stable';
  if (!fs.existsSync(chromium)) {
    console.error('Cannot find chromium');
    return false;
  }

  execFile(chromium, ['--headless', '--disable-gpu', '--remote-debugging-address=0.0.0.0', '--remote-debugging-port=9222']);
  return true;
}

module.exports = startChromium;
