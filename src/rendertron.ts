import * as compression from 'compression';
import * as express from 'express';
import * as puppeteer from 'puppeteer';
import * as url from 'url';

import {Renderer} from './renderer';

/**
 * Rendertron rendering service. This runs the server which routes rendering
 * requests through to the renderer.
 */
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
    const browser = await puppeteer.launch({args: ['--no-sandbox']});
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
