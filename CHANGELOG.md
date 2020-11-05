# Change Log

<!-- ## Unreleased -->

## [3.1.0] 2020-11-04

### Security improvements

- Prevents rendering of \*.internal URLs, patching an issue with GCE.
- Adds allow-listing option to restrict rendering to a given list of domains or URL patterns.

### Features

- Include Heroku deploy documentation and an interactive "Click to deploy" for Heroku
- Introduces an API endpoint to clear all cache
- Adds timezone support
- Adds optional forced browser restart between renders
- Adds documentation to deploy Rendertron via Docker
- Adds option to add request headers to the rendered pages in Rendertron

### Improvements

- Fixes a bug in the filesystem cache
- Fixes issue with the injected base tag
- Updates all dependencies
- Increased the required node.js version to Node.js 10+
- Updates to the FaQ

## [3.0.0] 2020-07-02

- Introduces new configuration file format for the `config.json` options (see [README.md](./README.md))
- Introduces new cache providers:
  - In-memory cache
  - File system cache
- Introduces API endpoint to invalidate cache for a URL
- Introduces a number of new configuration options
- Introduces `refreshCache` parameter to force cache update for a URL
- Relaunches browser when the browser disconnects from Puppeteer
- Now includes doctype in rendered output
- Harmonises the configuration options for caches
- Closes page after screenshot
- Fixes security issue with AppEngine deployments
- Fixes issue with specifying host and port

## [2.0.1] 2018-09-18

- Remove testing and other files from NPM package.
- Fix NPM main config.
- Improved restrictions for endpoints.
- Support for structured data by not stripping all script tags.

## [2.0.0] 2018-07-26

- Rebuilt with Puppeteer under the hood
- Rebuilt as Koa server instead of an Express server
- Rebuilt using Typescript
- Removed explicit rendering flag
- Added support for a mobile parameter
- Added more options for screenshots

## [1.1.1] 2018-01-05

- Update `debug` flag to log requested URLs to render
- Fix for renderComplete flag
- Minor bug fixes

## [1.1.0] 2017-10-27

- Initial release on NPM
