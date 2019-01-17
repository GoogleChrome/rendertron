import * as puppeteer from 'puppeteer';
import * as url from 'url';
import {BrowserPool} from './browserPool';
import {Browser, Request, RespondOptions} from 'puppeteer';

type SerializedResponse = {
  status: number; content: string;
};

type ViewportDimensions = {
  width: number; height: number;
};
const MOBILE_USERAGENT =
    'Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL Build/OPD1.170816.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.75 Mobile Safari/537.36';

/**
 * Wraps Puppeteer's interface to Headless Chrome to expose high level rendering
 * APIs that are able to handle web components and PWAs.
 */
export class Renderer {
  private readonly browserPool: BrowserPool;
  private responseCache: Record<string, RespondOptions> = {};
  private responseCacheSize: number = 0;
  private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 1 day cache
  private static readonly ALLOWED_URL_PATTERN = /^https?:\/\/(.*?).?gozefo.com.*/;
  private static readonly CACHE_URL_PATTERN = /^https?:\/\/(img[0-9]{0,2}).?gozefo.com.*/;
  private responseCacheStartTimeStamp = (new Date()).getTime();

  constructor() {
    this.browserPool = new BrowserPool();
  }

  async serialize(requestUrl: string, isMobile: boolean):
      Promise<SerializedResponse> {
    /**
     * Executed on the page after the page has loaded. Strips script and
     * import tags to prevent further loading of resources.
     */
    function stripPage() {
      // Strip only script tags that contain JavaScript (either no type attribute or one that contains "javascript")
      const elements = document.querySelectorAll('script:not([type]), script[type*="javascript"], link[rel=import]');
      for (const e of Array.from(elements)) {
        e.remove();
      }
    }

    /**
     * Injects a <base> tag which allows other resources to load. This
     * has no effect on serialised output, but allows it to verify render
     * quality.
     */
    function injectBaseHref(origin: string) {
      const base = document.createElement('base');
      base.setAttribute('href', origin);

      const bases = document.head.querySelectorAll('base');
      if (bases.length) {
        // Patch existing <base> if it is relative.
        const existingBase = bases[0].getAttribute('href') || '';
        if (existingBase.startsWith('/')) {
          bases[0].setAttribute('href', origin + existingBase);
        }
      } else {
        // Only inject <base> if it doesn't already exist.
        document.head.insertAdjacentElement('afterbegin', base);
      }
    }

    return await this.browserPool.acquire(async (browser: Browser) => {
      const newIncognitoBrowserContext = await browser.createIncognitoBrowserContext();
      const page = await newIncognitoBrowserContext.newPage();
      await page.setRequestInterception(true);

      page.on('request', (interceptedRequest: Request) => {
        const interceptedUrl = interceptedRequest.url();
        // console.log('interceptedUrl: ', interceptedUrl, 'allowed: ', interceptedUrl.match(allowedUrlsRegex) ? 'true' : false);
        if (!interceptedUrl.match(Renderer.ALLOWED_URL_PATTERN))
          interceptedRequest.abort();
        else if (interceptedUrl.match(Renderer.CACHE_URL_PATTERN)) {
          if (this.responseCacheSize > 2000 || ((new Date()).getTime() - this.responseCacheStartTimeStamp) > Renderer.CACHE_EXPIRY) {
            this.responseCache = {};
            this.responseCacheSize = 0;
            this.responseCacheStartTimeStamp = (new Date()).getTime();
          }
          // @ts-ignore
          if (this.responseCache[interceptedUrl]) {
            // console.log('from cached: ', interceptedUrl);
            // @ts-ignore
            interceptedRequest.respond(this.responseCache[interceptedUrl]);
          } else {
            interceptedRequest.continue().then(() => {
              const response = interceptedRequest.response();
              if (response) {
                // @ts-ignore
                const headers = response.headers();
                response.buffer().then((buffer: Buffer) => {
                  // console.log('caching: ', response.url());
                  // @ts-ignore
                  this.responseCache[response.url()] = {
                    headers: headers,
                    contentType: headers && headers['content-type'] ? headers['content-type'] : 'text/html',
                    // @ts-ignore
                    status: response.status(),
                    // @ts-ignore
                    body: buffer,
                  };
                  this.responseCacheSize++;
                });
              }
            });
          }
        } else {
          interceptedRequest.continue();
        }
      });

      // Page may reload when setting isMobile
      // https://github.com/GoogleChrome/puppeteer/blob/v1.10.0/docs/api.md#pagesetviewportviewport
      await page.setViewport({width: 1000, height: 5000, isMobile});

      if (isMobile) {
        page.setUserAgent(MOBILE_USERAGENT);
      }

      page.evaluateOnNewDocument('customElements.forcePolyfill = true');
      page.evaluateOnNewDocument('ShadyDOM = {force: true}');
      page.evaluateOnNewDocument('ShadyCSS = {shimcssproperties: true}');

      let response: puppeteer.Response | null = null;
      // Capture main frame response. This is used in the case that rendering
      // times out, which results in puppeteer throwing an error. This allows us
      // to return a partial response for what was able to be rendered in that
      // time frame.
      page.addListener('response', (r: puppeteer.Response) => {
        if (!response) {
          response = r;
        }
      });

      try {
        // Navigate to page. Wait until there are no oustanding network requests.
        response = await page.goto(
            requestUrl, {timeout: 10000, waitUntil: 'networkidle2'});
      } catch (e) {
        console.error(e);
      }

      if (!response) {
        console.error('response does not exist');
        // This should only occur when the page is about:blank. See
        // https://github.com/GoogleChrome/puppeteer/blob/v1.5.0/docs/api.md#pagegotourl-options.
        return {status: 400, content: ''};
      }

      // Disable access to compute metadata. See
      // https://cloud.google.com/compute/docs/storing-retrieving-metadata.
      if (response.headers()['metadata-flavor'] === 'Google') {
        return {status: 403, content: ''};
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
      // Inject <base> tag with the origin of the request (ie. no path).
      const parsedUrl = url.parse(requestUrl);
      await page.evaluate(
          injectBaseHref, `${parsedUrl.protocol}//${parsedUrl.host}`);

      // Serialize page.
      const result = await page.evaluate('document.firstElementChild.outerHTML');

      await page.close();
      await newIncognitoBrowserContext.close();
      return {status: statusCode, content: result};
    });
  }

  async screenshot(
      url: string,
      isMobile: boolean,
      dimensions: ViewportDimensions,
      options?: object): Promise<Buffer> {
    return await this.browserPool.acquire(async (browser: Browser) => {

      const page = await browser.newPage();

      // Page may reload when setting isMobile
      // https://github.com/GoogleChrome/puppeteer/blob/v1.10.0/docs/api.md#pagesetviewportviewport
      await page.setViewport(
          {width: dimensions.width, height: dimensions.height, isMobile});

      if (isMobile) {
        page.setUserAgent(MOBILE_USERAGENT);
      }

      let response: puppeteer.Response | null = null;

      try {
        // Navigate to page. Wait until there are no oustanding network requests.
        response =
            await page.goto(url, {timeout: 10000, waitUntil: 'networkidle2'});
      } catch (e) {
        console.error(e);
      }

      if (!response) {
        throw new ScreenshotError('NoResponse');
      }

      // Disable access to compute metadata. See
      // https://cloud.google.com/compute/docs/storing-retrieving-metadata.
      if (response!.headers()['metadata-flavor'] === 'Google') {
        throw new ScreenshotError('Forbidden');
      }

      // Must be jpeg & binary format.
      const screenshotOptions =
          Object.assign({}, options, {type: 'jpeg', encoding: 'binary'});
      // Screenshot returns a buffer based on specified encoding above.
      // https://github.com/GoogleChrome/puppeteer/blob/v1.8.0/docs/api.md#pagescreenshotoptions
      const buffer = await page.screenshot(screenshotOptions) as Buffer;
      return buffer;
    });
  }
}

type ErrorType = 'Forbidden'|'NoResponse';

export class ScreenshotError extends Error {
  type: ErrorType;

  constructor(type: ErrorType) {
    super(type);

    this.name = this.constructor.name;

    this.type = type;
  }
}
