import * as fse from 'fs-extra';
import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as koaCompress from 'koa-compress';
import * as route from 'koa-route';
import * as koaSend from 'koa-send';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import * as url from 'url';

import {Renderer} from './renderer';

const CONFIG_PATH = path.resolve(__dirname, '../config.json');

type Config = {
  datastoreCache: boolean;
};

/**
 * Rendertron rendering service. This runs the server which routes rendering
 * requests through to the renderer.
 */
export class Rendertron {
  app: Koa = new Koa();
  config: Config = {datastoreCache: false};
  private renderer: Renderer|undefined;
  private port = process.env.PORT || '3000';

  async initialize() {
    // Load config.json if it exists.
    if (fse.pathExistsSync(CONFIG_PATH)) {
      this.config = Object.assign(this.config, await fse.readJson(CONFIG_PATH));
    }

    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    this.renderer = new Renderer(browser);

    this.app.use(koaCompress());

    this.app.use(bodyParser());

    this.app.use(route.get('/', async (ctx: Koa.Context) => {
      await koaSend(
          ctx, 'index.html', {root: path.resolve(__dirname, '../src')});
    }));
    this.app.use(
        route.get('/_ah/health', (ctx: Koa.Context) => ctx.body = 'OK'));

    // Optionally enable cache for rendering requests.
    if (this.config.datastoreCache) {
      const {DatastoreCache} = await import('./datastore-cache');
      this.app.use(new DatastoreCache().middleware());
    }

    this.app.use(
        route.get('/render/:url(.*)', this.handleRenderRequest.bind(this)));
    this.app.use(route.get(
        '/screenshot/:url(.*)', this.handleScreenshotRequest.bind(this)));
    this.app.use(route.post(
        '/screenshot/:url(.*)', this.handleScreenshotRequest.bind(this)));

    return this.app.listen(this.port, () => {
      console.log(`Listening on port ${this.port}`);
    });
  }

  /**
   * Checks whether or not the URL is valid. For example, we don't want to allow
   * the requester to read the file system via Chrome.
   */
  restricted(href: string): boolean {
    const protocol = url.parse(href).protocol || '';

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
    // Mark the response as coming from Rendertron.
    ctx.set('x-renderer', 'rendertron');
    ctx.status = serialized.status;
    ctx.body = serialized.content;
  }

  async handleScreenshotRequest(ctx: Koa.Context, url: string) {
    if (!this.renderer) {
      throw (new Error('No renderer initalized yet.'));
    }

    let options = undefined;
    if (ctx.method === 'POST' && ctx.request.body) {
      options = ctx.request.body;
    }

    const dimensions = {
      width: Number(ctx.query['width']) || 1000,
      height: Number(ctx.query['height']) || 1000
    };

    const mobileVersion = 'mobile' in ctx.query ? true : false;

    const img =
        await this.renderer.screenshot(url, mobileVersion, dimensions, options);
    ctx.set('Content-Type', 'image/jpeg');
    ctx.set('Content-Length', img.length.toString());
    ctx.body = img;
  }
}

async function logUncaughtError(error: Error) {
  console.error('Uncaught exception');
  console.error(error);
  process.exit(1);
}

// Start rendertron if not running inside tests.
if (!module.parent) {
  const rendertron = new Rendertron();
  rendertron.initialize();

  process.on('uncaughtException', logUncaughtError);
  process.on('unhandledRejection', logUncaughtError);
}
