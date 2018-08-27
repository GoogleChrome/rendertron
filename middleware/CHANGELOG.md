# Change Log

## Unreleased
* [***BREAKING***] Added middleware for [Koa](https://koajs.com/). Users should
  now import either `makeKoaMiddleware` or `makeExpressMiddleware` (previously
  known as `makeMiddleware`).
* Converted to TypeScript.

## [0.1.2] 2017-08-29
* Fix bug with wc-inject-shadydom URL parameter.

## [0.1.1] 2017-08-23
* Remove broken typings configuration.

## [0.1.0] 2017-08-17
* Initial release.
