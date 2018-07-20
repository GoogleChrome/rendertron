import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as koaCompress from 'koa-compress';
import * as route from 'koa-route';
import * as puppeteer from 'puppeteer';
import * as url from 'url';

import {DatastoreCache} from './cache';
import {Renderer} from './renderer';

/**
 * Rendertron rendering service. This runs the server which routes rendering
 * requests through to the renderer.
 */
export class Rendertron {
  app: Koa = new Koa();
  private renderer: Renderer|undefined;
  private port = process.env.PORT || '3000';

  constructor() {
    this.app.use(koaCompress());

    this.app.use(bodyParser());

    this.app.use(new DatastoreCache().middleware());

    this.app.use(
        route.get('/_ah/health', (ctx: Koa.Context) => ctx.body = 'OK'));
    this.app.use(
        route.get('/render/:url(.*)', this.handleRenderRequest.bind(this)));
    this.app.use(route.get(
        '/screenshot/:url(.*)', this.handleScreenshotRequest.bind(this)));
    this.app.use(route.post(
        '/screenshot/:url(.*)', this.handleScreenshotRequest.bind(this)));
  }

  async initialize() {
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
    this.renderer = new Renderer(browser);

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

    const serialized = await this.renderer.serialize(url);
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

    const img = await this.renderer.screenshot(url, options);
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
