'use strict';
import 'dotenv/config'

export interface Config {
  port: number;
  host: string;
  allowedRenderOrigins: Array<string>;
  restrictedUrlPattern?: string;
  closeBrowserAfterRender: boolean;
}

export const config: Config = {
  port: Number(process.env.PORT || "4000"),
  host: process.env.HOST || "0.0.0.0",
  allowedRenderOrigins: process.env.ALLOWED_RENDER_ORIGINS?.split(" ") || [],
  restrictedUrlPattern: process.env.RESTRICTED_URL_PATTERN,
  closeBrowserAfterRender: (process.env.CLOSE_BROWSER_AFTER_RENDER === "true")
} 
