import * as compression from 'compression';
import * as express from 'express';
import * as puppeteer from 'puppeteer';
import * as url from 'url';

export class Rendertron {
  app = express();
  private renderer: Renderer|undefined;
  private port = process.env.PORT || '3000';

  constructor() {
    this.app.use(compression());

    this.app.get(
        '/_ah/health',
        (_request: express.Request, response: express.Response) =>
            response.send('OK'));
    this.app.get('/render/:url(*)', this.handleRenderRequest.bind(this));
    this.app.get(
        '/screenshot/:url(*)', this.handleScreenshotRequest.bind(this));
  }

  async initialize(startServer = true) {
    const browser = await puppeteer.launch();
    this.renderer = new Renderer(browser);

    if (startServer) {
      this.app.listen(this.port, () => {
        console.log(`Listening on port ${this.port}`);
      });
    }
  }

  restricted(href: string): boolean {
    const protocol = url.parse(href).protocol || '';

    if (!protocol.match(/^https?/)) {
      return true;
    }

    return false;
  }

  async handleRenderRequest(
      request: express.Request,
      response: express.Response) {
    if (!this.renderer) {
      console.error(`No renderer yet`);
      return;
    }

    if (this.restricted(request.params.url)) {
      response.sendStatus(403);
      return;
    }

    const serialized = await this.renderer.serialize(request.params.url);
    // Mark the response as coming from Rendertron.
    response.set('x-renderer', 'rendertron');
    response.status(serialized.status).send(serialized.content);
  }

  async handleScreenshotRequest(
      request: express.Request,
      response: express.Response) {
    if (!this.renderer) {
      console.error(`No renderer yet`);
      return;
    }

    const img = await this.renderer.screenshot(request.params.url);
    response.set({'Content-Type': 'image/jpeg', 'Content-Length': img.length});
    response.end(img);
  }
}

type SerializedResponse = {
  status: number; content: string;
}

class Renderer {
  private browser: puppeteer.Browser;

  constructor(browser: puppeteer.Browser) {
    this.browser = browser;
  }

  async serialize(url: string): Promise<SerializedResponse> {
    /**
     * Executed on the page after the page has loaded. Strips script and
     * import tags to prevent further loading of resources.
     */
    function stripPage() {
      const elements = document.querySelectorAll('script, link[rel=import]');
      for (const e of Array.from(elements)) {
        e.remove();
      }
    }

    /**
     * Injects a <base> tag which allows other resources to load. This
     * has no effect on serialised output, but allows it to verify render
     * quality.
     * @param {string} url - Requested URL to set as the base.
     */
    function injectBaseHref(url: string) {
      const base = document.createElement('base');
      base.setAttribute('href', url);
      document.head.appendChild(base);
    }

    const page = await this.browser.newPage();

    page.evaluateOnNewDocument('customElements.forcePolyfill = true');
    page.evaluateOnNewDocument('ShadyDOM = {force: true}');
    page.evaluateOnNewDocument('ShadyCSS = {shimcssproperties: true}');

    // Navigate to page.
    const response =
        await page.goto(url, {waitUntil: 'networkidle0'}).catch(() => {
          return undefined;
        });
    if (!response) {
      // This should only occur when the page is about:blank. See
      // https://github.com/GoogleChrome/puppeteer/blob/v1.5.0/docs/api.md#pagegotourl-options.
      return {status: 400, content: ''};
    }

    let statusCode = response.status();
    const newStatusCode =
        await page
            .$eval(
                'meta[name="render:status_code"]',
                (element) => parseInt(element.getAttribute('content') || ''))
            .catch(() => undefined);
    // Treat 304 Not Modified as 200 OK.
    if (statusCode === 304) {
      statusCode = 200;
    }
    // Original status codes which aren't 200 always return with that status
    // code, regardless of meta tags.
    if (statusCode === 200 && newStatusCode) {
      statusCode = newStatusCode;
    }

    // Remove script & import tags.
    await page.evaluate(stripPage);
    // Inject <base> tag.
    await page.evaluate(injectBaseHref);

    // Serialize page.
    const result = await page.evaluate('document.firstElementChild.outerHTML');

    await page.close();
    return {status: statusCode, content: result};
  }

  async screenshot(url: string): Promise<Buffer> {
    const page = await this.browser.newPage();

    await page.goto(url, {waitUntil: 'networkidle0'});

    // Typings are out of date.
    const buffer =
        await page.screenshot({type: 'jpeg', encoding: 'base64'} as any);
    return buffer;
  }
}

if (!module.parent) {
  const rendertron = new Rendertron();
  rendertron.initialize();
}

async function logUncaughtError(error: Error) {
  console.error('Uncaught exception');
  console.error(error);
  process.exit(1);
}

if (!module.parent) {
  process.on('uncaughtException', logUncaughtError);
  process.on('unhandledRejection', logUncaughtError);
}
