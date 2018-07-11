import * as express from 'express';
import * as compression from 'compression';

import * as puppeteer from 'puppeteer';

class Rendertron {
  private renderer: Renderer|undefined;
  private app = express();
  private port = process.env.PORT || '3000';


  constructor() {
    this.app.use(compression());

    this.app.get('/render/:url(*)', this.handleRenderRequest.bind(this));

    this.initialize();
  }

  async initialize() {
    const browser = await puppeteer.launch();
    this.renderer = new Renderer(browser);
    this.app.listen(this.port, () => {
      console.log(`Listening on port ${this.port}`);
    });
  }

  async handleRenderRequest(request: express.Request, response: express.Response) {
    if (!this.renderer) {
      return;
    }
    const serialized = await this.renderer.serialize(request.params.url);
    // Mark the response as coming from Rendertron.
    response.set('x-renderer', 'rendertron');
    response.send(serialized);
  }
}

class Renderer {
  private browser: puppeteer.Browser;

  constructor(browser: puppeteer.Browser) {
    this.browser = browser;
  }

  async serialize(url: string) {
    const page = await this.browser.newPage();

    await page.goto(url, {waitUntil: 'networkidle0'});

    const response = await page.evaluate('document.firstElementChild.outerHTML');

    await page.close();

    return response;
  }
}

new Rendertron();
