import { Server, ServerCredentials } from "@grpc/grpc-js";
import {
  IRendertronServiceServer,
  RendertronServiceService,
} from "../generated/nodejs/nemoengineering/rendertron/v1/rendertron_grpc_pb";
import { Config, config } from "./config";
import {
  PageError,
  PageSetupError,
  Renderer,
  ScreenshotError,
} from "./renderer";
import puppeteer from "puppeteer";
import { Status } from "@grpc/grpc-js/build/src/constants";

class Rendertron {
  private server = new Server();
  private config: Config;
  private renderer: Renderer | undefined;

  constructor(config: Config) {
    this.config = config;
  }

  async createRenderer() {
    const browser = await puppeteer.launch({ args: this.config.puppeteerArgs });

    browser.on("disconnected", () => {
      this.createRenderer();
    });

    this.renderer = new Renderer(browser, this.config);
  }

  async initialize() {
    await this.createRenderer();

    const service: IRendertronServiceServer = {
      screenshot: (call, callback) => {
        this.renderer
          ?.screenshot(call.request.toObject())
          .then((res) => callback(null, res))
          .catch((err) => {
            if (err instanceof PageError) {
              callback({
                code: Status.ABORTED,
                name: err.status.toString(),
                message: `Requested page returned non 2xx code. (Code: ${err.status})`,
              });
            } else if (err instanceof PageSetupError) {
              callback(err);
            } else if (err instanceof ScreenshotError) {
              callback(err);
            } else {
              console.error(err);
              callback({ code: Status.INTERNAL });
            }
          });
      },
      serialize: (call, callback) => {
        this.renderer
          ?.serialize(call.request.toObject())
          .then((res) => callback(null, res))
          .catch((err) => {
            if (err instanceof PageError) {
              callback({
                code: Status.ABORTED,
                name: err.status.toString(),
                message: `Requested page returned non 2xx code. (Code: ${err.status})`,
              });
            } else if (err instanceof PageSetupError) {
              callback(err);
            } else {
              console.error(err);
              callback({ code: Status.INTERNAL });
            }
          });
      },
    };

    this.server.addService(RendertronServiceService, service);

    const listener = `${this.config.host}:${this.config.port}`;
    this.server.bindAsync(listener, ServerCredentials.createInsecure(), () => {
      this.server.start();

      console.log(`server is running on ${listener}`);
    });
  }
}

const rendertron = new Rendertron(config);
rendertron.initialize();
