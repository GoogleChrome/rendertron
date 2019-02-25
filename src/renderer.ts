import * as puppeteer from 'puppeteer';
import {Request} from 'puppeteer';
import * as url from 'url';
import {RespondOptions} from 'puppeteer';
// import * as fse from 'fs-extra';
import InMemoryLRUCache from './InMemoryLRUCache';
import {Response} from 'puppeteer';

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

type ImageResponseOption =
    | 'BLANK_PIXEL'
    | 'IGNORE'
    | 'ALLOW';

interface ResponseCacheConfig {
    cacheExpiry: number;
    cacheUrlRegex: RegExp;
    imageCacheOptions: ImageResponseOption;
}

export interface RendererConfig {
    internalRequestCacheConfig?: ResponseCacheConfig;
    allowedRequestUrlsRegex?: RegExp;
}

export class Renderer {
    private browser: puppeteer.Browser;
    private config: RendererConfig;
    private cacheStore = new InMemoryLRUCache<RespondOptions>();
    private IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'];
    private imageRespondOptions = new Map<string, RespondOptions>();

    constructor(browser: puppeteer.Browser, config?: RendererConfig) {
        this.browser = browser;
        this.config = config || {};
        if (this.config.internalRequestCacheConfig) {
            this.IMAGE_TYPES.forEach((extension) => {
                const imageBuffer: Buffer = new Buffer('');
                const respondOptions: RespondOptions = {
                    contentType: `image/${extension}`,
                    body: imageBuffer,
                };
                this.imageRespondOptions.set(extension, respondOptions);
            });
        }
    }

    private async internalRequestCacheInterceptor(interceptedRequest: Request) {
        if (this.config.internalRequestCacheConfig) {
            const interceptedRequestFullUrl = interceptedRequest.url();
            const interceptedUrl = interceptedRequest.url().split('?')[0] || '';
            const extension = interceptedUrl.split('.').pop();
            if (extension && this.IMAGE_TYPES.indexOf(extension) !== -1) {
                if (this.config.internalRequestCacheConfig.imageCacheOptions === 'BLANK_PIXEL') {
                    const respondOptions: RespondOptions | undefined = this.imageRespondOptions.get(extension);
                    if (respondOptions) {
                        await interceptedRequest.respond(respondOptions);
                    } else {
                        await interceptedRequest.continue();
                    }
                } else if (this.config.internalRequestCacheConfig.imageCacheOptions === 'IGNORE') {
                    await interceptedRequest.abort();
                } else {
                    await interceptedRequest.continue();
                }
            } else if (interceptedUrl.match(this.config.internalRequestCacheConfig.cacheUrlRegex)) {
                const cachedResponse = this.cacheStore.get(interceptedRequestFullUrl);
                if (cachedResponse) {
                    await interceptedRequest.respond(cachedResponse);
                } else {
                    await interceptedRequest.continue();
                }
            } else {
                await interceptedRequest.continue();
            }
        }

    }

    private async internalResponseCacheInterceptor(response: Response) {
        if (this.config.internalRequestCacheConfig && response) {
            const url = response.url();
            const interceptedUrl = url.split('?')[0] || '';
            const extension = interceptedUrl.split('.').pop();
            if (interceptedUrl.match(this.config.internalRequestCacheConfig.cacheUrlRegex) && (!extension || this.IMAGE_TYPES.indexOf(extension) === -1 || this.config.internalRequestCacheConfig.imageCacheOptions === 'ALLOW') && !this.cacheStore.get(url)) {
                const headers = response.headers();
                return await response.buffer().then((buffer: Buffer) => {
                    this.cacheStore.set(url, {
                        headers: headers,
                        contentType: headers && headers['content-type'] ? headers['content-type'] : 'text/html',
                        status: response.status(),
                        body: buffer,
                        // @ts-ignore
                    }, this.config.internalRequestCacheConfig.cacheExpiry);
                });
            }
        }
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

        const page = await this.browser.newPage();

        // Page may reload when setting isMobile
        // https://github.com/GoogleChrome/puppeteer/blob/v1.10.0/docs/api.md#pagesetviewportviewport
        await page.setViewport({width: 1000, height: 1000, isMobile});

        if (this.config.internalRequestCacheConfig) {
            await page.setRequestInterception(true);
            page.on('request', async (interceptedRequest: Request) => {
                if (this.config.allowedRequestUrlsRegex) {
                    if (interceptedRequest.url().match(this.config.allowedRequestUrlsRegex)) {
                        if (this.internalRequestCacheInterceptor) {
                            await this.internalRequestCacheInterceptor(interceptedRequest);
                        } else {
                            interceptedRequest.continue();
                        }
                    } else {
                        await interceptedRequest.abort();
                    }
                } else {
                    await interceptedRequest.continue();
                }
            });
        }

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
        page.addListener('response', async (r: puppeteer.Response) => {
            if (!response) {
                response = r;
            }
            if (this.config.internalRequestCacheConfig) {
                await this.internalResponseCacheInterceptor(r);
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
        return {status: statusCode, content: result};
    }

    async screenshot(
        url: string,
        isMobile: boolean,
        dimensions: ViewportDimensions,
        options?: object): Promise<Buffer> {
        const page = await this.browser.newPage();

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
                await page.goto(url, {timeout: 10000, waitUntil: 'networkidle0'});
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
    }
}

type ErrorType = 'Forbidden' | 'NoResponse';

export class ScreenshotError extends Error {
    type: ErrorType;

    constructor(type: ErrorType) {
        super(type);

        this.name = this.constructor.name;

        this.type = type;
    }
}
