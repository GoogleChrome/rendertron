import * as puppeteer from 'puppeteer';

type SerializedResponse = {
  status: number; content: string;
}

/**
 * Wraps Puppeteer's interface to Headless Chrome to expose high level rendering
 * APIs that are able to handle web components and PWAs.
 */
export class Renderer {
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

    // Navigate to page. Wait until there are no oustanding network requests.
    const response =
        await page.goto(url, {timeout: 10000, waitUntil: 'networkidle0'})
            .catch(() => {
              // Catch navigation errors like navigating to an invalid URL.
              return undefined;
            });
    if (!response) {
      // This should only occur when the page is about:blank. See
      // https://github.com/GoogleChrome/puppeteer/blob/v1.5.0/docs/api.md#pagegotourl-options.
      return {status: 400, content: ''};
    }

    // Set status to the initial server's response code. Check for a <meta
    // name="render:status_code" content="4xx" /> tag which overrides the status
    // code.
    let statusCode = response.status();
    const newStatusCode =
        await page
            .$eval(
                'meta[name="render:status_code"]',
                (element) => parseInt(element.getAttribute('content') || ''))
            .catch(() => undefined);
    // On a repeat visit to the same origin, browser cache is enabled, so we may
    // encounter a 304 Not Modified. Instead we'll treat this as a 200 OK.
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

  async screenshot(url: string, options?: object): Promise<Buffer> {
    const page = await this.browser.newPage();

    page.setViewport({width: 1000, height: 1000});

    await page.goto(url, {timeout: 10000, waitUntil: 'networkidle0'});

    const screenshotOptions =
        Object.assign({type: 'jpeg', encoding: 'base64'}, options);

    const buffer = await page.screenshot(screenshotOptions);
    return buffer;
  }
}
