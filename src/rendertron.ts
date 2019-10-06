import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as koaCompress from 'koa-compress';
import * as route from 'koa-route';
import * as koaSend from 'koa-send';
import * as koaLogger from 'koa-logger';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as url from 'url';

import { Renderer, ScreenshotError } from './renderer';
import { Config, ConfigManager } from './config';

/**
 * Rendertron rendering service. This runs the server which routes rendering
 * requests through to the renderer.
 */
export class Rendertron {
  app: Koa = new Koa();
  private config: Config = ConfigManager.config;
  private renderer: Renderer | undefined;
  private port = process.env.PORT || this.config.port;
  private host = process.env.HOST || this.config.host;

  async initialize() {
    // Load config
    this.config = await ConfigManager.getConfiguration();

    this.port = this.port || this.config.port;
    this.host = this.host || this.config.host;

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    this.renderer = new Renderer(browser, this.config);

    this.app.use(koaLogger());

    this.app.use(koaCompress());

    this.app.use(bodyParser());

    this.app.use(route.get('/', async (ctx: Koa.Context) => {
      await koaSend(
        ctx, 'index.html', { root: path.resolve(__dirname, '../src') });
    }));
    this.app.use(
      route.get('/_ah/health', (ctx: Koa.Context) => ctx.body = 'OK'));

    // Optionally enable cache for rendering requests.
    if (this.config.cache === 'datastore') {
      const { DatastoreCache } = await import('./datastore-cache');
      this.app.use(new DatastoreCache().middleware());
    } else if (this.config.cache === 'memory') {
      const { MemoryCache } = await import('./memory-cache');
      this.app.use(new MemoryCache().middleware());
    }

    this.app.use(
      route.get('/render/:url(.*)', this.handleRenderRequest.bind(this)));
    this.app.use(route.get(
      '/screenshot/:url(.*)', this.handleScreenshotRequest.bind(this)));
    this.app.use(route.post(
      '/screenshot/:url(.*)', this.handleScreenshotRequest.bind(this)));

    return this.app.listen(+this.port, this.host, () => {
      console.log(`Listening on port ${this.port}`);
    });
  }

  /**
   * Checks whether or not the URL is valid. For example, we don't want to allow
   * the requester to read the file system via Chrome.
   */
  restricted(href: string): boolean {
    const parsedUrl = url.parse(href);
    const protocol = parsedUrl.protocol || '';

    if (!protocol.match(/^https?/)) {
      return true;
    }

    return false;
  }

  async handleRenderRequest(ctx: Koa.Context, url: string) {
    if (!this.renderer) {
      throw (new Error('No renderer initalized yet.'));
    }

    if (this.restricted(url)) {
      ctx.status = 403;
      return;
    }

    const mobileVersion = 'mobile' in ctx.query ? true : false;

    const serialized = await this.renderer.serialize(url, mobileVersion);

    for (const key in this.config.headers) {
      ctx.set(key, this.config.headers[key]);
    }

    // Mark the response as coming from Rendertron.
    ctx.set('x-renderer', 'rendertron');
    // Add custom headers to the response like 'Location'
    serialized.customHeaders.forEach((value: string, key: string) => ctx.set(key, value));
    ctx.status = serialized.status;
    ctx.body = serialized.content;
  }

  async handleScreenshotRequest(ctx: Koa.Context, url: string) {
    if (!this.renderer) {
      throw (new Error('No renderer initalized yet.'));
    }

    if (this.restricted(url)) {
      ctx.status = 403;
      return;
    }

    let options = undefined;
    if (ctx.method === 'POST' && ctx.request.body) {
      options = ctx.request.body;
    }

    const dimensions = {
      width: Number(ctx.query['width']) || this.config.width,
      height: Number(ctx.query['height']) || this.config.height
    };

    const mobileVersion = 'mobile' in ctx.query ? true : false;

    try {
      const img = await this.renderer.screenshot(
        url, mobileVersion, dimensions, options);

      for (const key in this.config.headers) {
        ctx.set(key, this.config.headers[key]);
      }

      ctx.set('Content-Type', 'image/jpeg');
      ctx.set('Content-Length', img.length.toString());
      ctx.body = img;
    } catch (error) {
      const err = error as ScreenshotError;
      ctx.status = err.type === 'Forbidden' ? 403 : 500;
    }
  }
}

async function logUncaughtError(error: Error) {
  console.error('Uncaught exception');
  console.error(error);
  process.exit(1);
}

// The type for the unhandleRejection handler is set to contain Promise<any>,
// so we disable that linter rule for the next line
// tslint:disable-next-line: no-any
async function logUnhandledRejection(reason: unknown, _: Promise<any>) {
  console.error('Unhandled rejection');
  console.error(reason);
  process.exit(1);
}

// Start rendertron if not running inside tests.
if (!module.parent) {
  const rendertron = new Rendertron();
  rendertron.initialize();

  process.on('uncaughtException', logUncaughtError);
  process.on('unhandledRejection', logUnhandledRejection);
}
