import puppeteer, { ScreenshotOptions } from "puppeteer";
import { dirname } from "path";

import {
  PageConfig,
  ScreenshotEncoding,
  ScreenshotImageOptions,
  ScreenshotRequest,
  ScreenshotResponse,
  ScreenshotType,
  SerializeRequest,
  SerializeResponse,
  WaitUntil,
} from "../generated/nodejs/nemoengineering/rendertron/v1/rendertron_pb";
import { Config } from "./config";

const MOBILE_USERAGENT =
  "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2 XL Build/OPD1.170816.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.75 Mobile Safari/537.36";

/**
 * Wraps Puppeteer's interface to Headless Chrome to expose high level rendering
 * APIs that are able to handle web components and PWAs.
 */
export class Renderer {
  private browser: puppeteer.Browser;
  private config: Config;

  constructor(browser: puppeteer.Browser, config: Config) {
    this.browser = browser;
    this.config = config;
  }

  async screenshot(
    req: ScreenshotRequest.AsObject
  ): Promise<ScreenshotResponse> {
    if (this.isRestricted(req.url))
      throw new PageSetupError("Requested URL is restricted");

    const page = await this.setupPage(req.pageConfig);

    let response: puppeteer.HTTPResponse | undefined;
    try {
      // Navigate to page. Wait until there are no oustanding network requests.
      response = await page.goto(req.url, {
        timeout: req.timeoutMilliseconds,
        waitUntil: Renderer.waitUntilFactory(req.waitUntil),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      await page.close();
      await this.teardownBrowser();
      throw e;
    }

    if (!response) {
      await page.close();
      await this.teardownBrowser();
      throw new ScreenshotError("NoResponse");
    }

    if (!response.ok() && !req.screenshotError) {
      console.error(
        `Page returned Status: ${response.status()} URL: ${req.url}`
      );
      await page.close();
      await this.teardownBrowser();

      throw new PageError(response.status());
    }

    // Disable access to compute metadata. See
    // https://cloud.google.com/compute/docs/storing-retrieving-metadata.
    if (response.headers()["metadata-flavor"] === "Google") {
      await page.close();
      await this.teardownBrowser();
      throw new ScreenshotError("Forbidden");
    }

    if (!req.imageOptions) throw new PageSetupError("ImageOptions missing");

    // Must be jpeg & binary format.
    const screenshotOptions: ScreenshotOptions = {
      type: Renderer.typeFactory(req.imageOptions.type),
      encoding: Renderer.encodingFactory(req.encoding),
      quality: req.imageOptions.quality,
      fullPage: req.imageOptions.fullPage,
      captureBeyondViewport: req.imageOptions.captureBeyondViewport,
      omitBackground: req.imageOptions.omitBackground,
      clip: Renderer.clipFactory(req.imageOptions.clip),
    };

    const screenshot = await page.screenshot(screenshotOptions);
    await page.close();
    await this.teardownBrowser();

    const res = new ScreenshotResponse();
    res.setType(req.imageOptions.type);
    res.setStatusCode(response.status());

    for (const name in response.headers()) {
      res.getHeadersMap().set(name, response.headers()[name]);
    }

    if (screenshot instanceof Buffer) {
      res.setBinary(screenshot);
    } else {
      res.setBase64(screenshot);
    }

    return res;
  }

  async serialize(req: SerializeRequest.AsObject): Promise<SerializeResponse> {
    if (this.isRestricted(req.url))
      throw new PageSetupError("Requested URL is restricted");
    /**
     * Executed on the page after the page has loaded. Strips script and
     * import tags to prevent further loading of resources.
     */
    function stripPage() {
      // Strip only script tags that contain JavaScript (either no type attribute or one that contains "javascript")
      const elements = document.querySelectorAll(
        'script:not([type]), script[type*="javascript"], script[type="module"], link[rel=import]'
      );
      for (const e of Array.from(elements)) {
        e.remove();
      }
    }

    /**
     * Injects a <base> tag which allows other resources to load. This
     * has no effect on serialised output, but allows it to verify render
     * quality.
     */
    function injectBaseHref(origin: string, directory: string) {
      const bases = document.head.querySelectorAll("base");
      if (bases.length) {
        // Patch existing <base> if it is relative.
        const existingBase = bases[0].getAttribute("href") || "";
        if (existingBase.startsWith("/")) {
          // check if is only "/" if so add the origin only
          if (existingBase === "/") {
            bases[0].setAttribute("href", origin);
          } else {
            bases[0].setAttribute("href", origin + existingBase);
          }
        }
      } else {
        // Only inject <base> if it doesn't already exist.
        const base = document.createElement("base");
        // Base url is the current directory
        base.setAttribute("href", origin + directory);
        document.head.insertAdjacentElement("afterbegin", base);
      }
    }
    const page = await this.setupPage(req.pageConfig);

    page.evaluateOnNewDocument("customElements.forcePolyfill = true");
    page.evaluateOnNewDocument("ShadyDOM = {force: true}");
    page.evaluateOnNewDocument("ShadyCSS = {shimcssproperties: true}");

    let response: puppeteer.HTTPResponse | null = null;
    // Capture main frame response. This is used in the case that rendering
    // times out, which results in puppeteer throwing an error. This allows us
    // to return a partial response for what was able to be rendered in that
    // time frame.
    page.on("response", (r: puppeteer.HTTPResponse) => {
      if (!response) response = r;
    });

    try {
      // Navigate to page. Wait until there are no oustanding network requests.
      response = await page.goto(req.url, {
        timeout: req.timeoutMilliseconds,
        waitUntil: Renderer.waitUntilFactory(req.waitUntil),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error(e);
      throw new Error(e);
    }

    if (!response) {
      console.error("response does not exist");
      // This should only occur when the page is about:blank. See
      // https://github.com/GoogleChrome/puppeteer/blob/v1.5.0/docs/api.md#pagegotourl-options.
      await page.close();
      await this.teardownBrowser();
      throw new ScreenshotError("NoResponse");
    }

    // Disable access to compute metadata. See
    // https://cloud.google.com/compute/docs/storing-retrieving-metadata.
    if (response.headers()["metadata-flavor"] === "Google") {
      await page.close();
      await this.teardownBrowser();
      throw new ScreenshotError("IllegalMetadataAccess");
    }

    // Set status to the initial server's response code. Check for a <meta
    // name="render:status_code" content="4xx" /> tag which overrides the status
    // code.
    let statusCode = response.status();
    const newStatusCode = await page
      .$eval('meta[name="render:status_code"]', (element) =>
        parseInt(element.getAttribute("content") || "")
      )
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

    // Check for <meta name="render:header" content="key:value" /> tag to allow a custom header in the response
    // to the crawlers.
    const customHeaders = await page
      .$eval('meta[name="render:header"]', (element) => {
        const result = new Map<string, string>();
        const header = element.getAttribute("content");
        if (header) {
          const i = header.indexOf(":");
          if (i !== -1) {
            result.set(
              header.substring(0, i).trim(),
              header.substring(i + 1).trim()
            );
          }
        }
        return JSON.stringify([...result]);
      })
      .catch(() => undefined);

    // Remove script & import tags.
    await page.evaluate(stripPage);
    // Inject <base> tag with the origin of the request (ie. no path).
    const parsedUrl = new URL(req.url);
    await page.evaluate(
      injectBaseHref,
      `${parsedUrl.protocol}//${parsedUrl.host}`,
      `${dirname(parsedUrl.pathname || "")}`
    );

    // Serialize page.
    const content = (await page.content()) as string;

    await page.close();
    await this.teardownBrowser();

    const res = new SerializeResponse();
    res.setContent(content);
    res.setStatusCode(statusCode);

    const resHeaders: Map<string, string> = customHeaders
      ? new Map(JSON.parse(customHeaders))
      : new Map();
    resHeaders.forEach((value, key) => res.getHeadersMap().set(key, value));

    return res;
  }

  private async setupPage(
    conf: PageConfig.AsObject | undefined
  ): Promise<puppeteer.Page> {
    if (!conf) throw new PageSetupError("Page config missing");

    const page = await this.browser.newPage();

    if (!conf.viewportDimensions)
      throw new PageSetupError("Viewport dimensions missing");
    await page.setViewport({
      height: conf.viewportDimensions.height,
      width: conf.viewportDimensions.width,
      isMobile: conf.isMobile,
    });

    const userAgent = conf.isMobile
      ? conf.userAgent || MOBILE_USERAGENT
      : conf.userAgent;
    if (userAgent) page.setUserAgent(userAgent);

    if (conf.timezoneId) {
      try {
        await page.emulateTimezone(conf.timezoneId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (e.message.includes("Invalid timezone")) {
          throw new PageSetupError("Invalid timezone id");
        }
      }
    }

    const headers = conf.headersMap.reduce<{ [key: string]: string }>(
      (m, [key, value]) => {
        m[key] = value;
        return m;
      },
      {}
    );
    await page.setExtraHTTPHeaders(headers);

    await page.setRequestInterception(true);

    page.on("request", (interceptedRequest: puppeteer.HTTPRequest) => {
      if (this.restrictRequest(interceptedRequest.url())) {
        interceptedRequest.abort();
      } else {
        interceptedRequest.continue();
      }
    });

    return page;
  }

  private restrictRequest(requestUrl: string): boolean {
    const parsedUrl = new URL(requestUrl);

    if (parsedUrl.hostname && parsedUrl.hostname.match(/\.internal$/)) {
      return true;
    }

    if (
      this.config.restrictedUrlPattern &&
      requestUrl.match(new RegExp(this.config.restrictedUrlPattern))
    ) {
      return true;
    }

    return false;
  }

  private async teardownBrowser() {
    if (this.config.closeBrowserAfterRender) await this.browser.close();
  }

  private isRestricted(href: string): boolean {
    const parsedUrl = new URL(href);

    if (parsedUrl.hostname && parsedUrl.hostname.match(/\.internal$/)) {
      return true;
    }

    if (!this.config.allowedRenderOrigins.length) {
      return false;
    }

    for (let i = 0; i < this.config.allowedRenderOrigins.length; i++) {
      if (href.startsWith(this.config.allowedRenderOrigins[i])) {
        return false;
      }
    }

    return true;
  }

  private static clipFactory(
    clip: ScreenshotImageOptions.Clip.AsObject | undefined
  ): puppeteer.ScreenshotClip | undefined {
    if (!clip) return;
    if (!clip.dimensions) throw new PageSetupError("Clip dimensions missing");
    return {
      height: clip.dimensions.height,
      width: clip.dimensions?.width,
      x: clip.x,
      y: clip.y,
    };
  }

  private static waitUntilFactory(
    req: WaitUntil
  ): puppeteer.PuppeteerLifeCycleEvent {
    switch (req) {
      case WaitUntil.WAIT_UNTIL_LOAD:
        return "load";
      case WaitUntil.WAIT_UNTIL_DOMCONTENT_LOADED:
        return "domcontentloaded";
      case WaitUntil.WAIT_UNTIL_NET_IDLE_0:
        return "networkidle0";
      case WaitUntil.WAIT_UNTIL_NET_IDLE_2:
        return "networkidle2";
      default:
        return "networkidle0";
    }
  }

  private static typeFactory(req: ScreenshotType): ScreenshotOptions["type"] {
    switch (req) {
      case ScreenshotType.SCREENSHOT_TYPE_JPEG:
        return "jpeg";
      case ScreenshotType.SCREENSHOT_TYPE_PNG:
        return "png";
      case ScreenshotType.SCREENSHOT_TYPE_WEBP:
        return "webp";
      default:
        return "jpeg";
    }
  }

  private static encodingFactory(
    req: ScreenshotEncoding
  ): ScreenshotOptions["encoding"] {
    switch (req) {
      case ScreenshotEncoding.SCREENSHOT_ENCODING_BASE64:
        return "base64";
      case ScreenshotEncoding.SCREENSHOT_ENCODING_BINARY:
        return "binary";
      default:
        return "base64";
    }
  }
}

type ErrorType = "Forbidden" | "NoResponse" | "IllegalMetadataAccess";

export class ScreenshotError extends Error {
  type: ErrorType;

  constructor(type: ErrorType) {
    super(type);

    this.name = this.constructor.name;

    this.type = type;
  }
}

export class PageSetupError extends Error {}

export class PageError extends Error {
  status: number;

  constructor(status: number) {
    super();
    this.status = status;
  }
}
