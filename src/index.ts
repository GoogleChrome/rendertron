import { Server, ServerCredentials, ServerErrorResponse, StatusObject } from "@grpc/grpc-js";
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
        console.log("screenshot of: ", call.request.getUrl())

        this.renderer
          ?.screenshot(call.request.toObject())
          .then((res) => callback(null, res))
          .catch((err) => callback(Rendertron.handleError(err)));
      },
      serialize: (call, callback) => {
        console.log("serializing of: ", call.request.getUrl())
        this.renderer
          ?.serialize(call.request.toObject())
          .then((res) => callback(null, res))
          .catch((err) => callback(Rendertron.handleError(err)));
      },
    };

    this.server.addService(RendertronServiceService, service);

    const listener = `${this.config.host}:${this.config.port}`;
    this.server.bindAsync(listener, ServerCredentials.createInsecure(), () => {
      this.server.start();

      console.log(`server is running on ${listener}`);
    });
  }

  private static handleError(err: any): Partial<StatusObject> | ServerErrorResponse {
    console.error(err)
    if (err instanceof PageError) {
        return {
          code: Status.FAILED_PRECONDITION,
          name: err.status.toString(),
          message: `Requested page returned non 2xx code. (Code: ${err.status})`,
        };
      } else if (err instanceof PageSetupError) {
        return err;
      } else if (err instanceof ScreenshotError) {
        return err;
      } else if (err instanceof puppeteer.errors.TimeoutError) {
        return {
            code: Status.ABORTED,
            message: err.message,
            name: err.name
        };
      } else {
        console.error(err);
        return { 
            message: "Internal error",
            code: Status.INTERNAL
        };
      }
  }
}

const rendertron = new Rendertron(config);
rendertron.initialize();
