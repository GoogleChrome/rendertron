# Change Log

<!-- ## Unreleased -->

## [3.0.0] 2020-07-02
 * Introduces new configuration file format for the `config.json` options (see [README.md](./README.md))
 * Introduces new cache providers:
   - In-memory cache
   - File system cache
 * Introduces API endpoint to invalidate cache for a URL
 * Introduces a number of new configuration options
 * Introduces `refreshCache` parameter to force cache update for a URL
 * Relaunches browser when the browser disconnects from Puppeteer
 * Now includes doctype in rendered output
 * Harmonises the configuration options for caches
 * Closes page after screenshot
 * Fixes security issue with AppEngine deployments
 * Fixes issue with specifying host and port

## [2.0.1] 2018-09-18
 * Remove testing and other files from NPM package.
 * Fix NPM main config.
 * Improved restrictions for endpoints.
 * Support for structured data by not stripping all script tags.

## [2.0.0] 2018-07-26
 * Rebuilt with Puppeteer under the hood
 * Rebuilt as Koa server instead of an Express server
 * Rebuilt using Typescript
 * Removed explicit rendering flag
 * Added support for a mobile parameter
 * Added more options for screenshots

## [1.1.1] 2018-01-05
 * Update `debug` flag to log requested URLs to render
 * Fix for renderComplete flag
 * Minor bug fixes

## [1.1.0] 2017-10-27
 * Initial release on NPM
