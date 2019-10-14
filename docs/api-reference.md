## Rendertron API Reference

`/render`

Fetch and serialize a URL in headless Chrome.

| param  | type     | description                     |
| ------ | -------- | ------------------------------- |
| `url`  | `String` | a valid URL to fetch            |
| `opts` | `Object` | `Renderer` config class options |

#### `Renderer`

Create a `puppeteer` instance to render the requested URL. Uses default `Config`
class or a user-defined `Config` file.

```javascript
export class Renderer {
    private browser: puppeteer.Browser;
    private config: Config;

    constructor(browser: puppeteer.Browser, config: Config) {
    this.browser = browser;
    this.config = config;
}
```

#### `Config`

The `Config` class defaults can be overridden with your own settings.
[More details](https://github.com/GoogleChrome/rendertron/blob/master/docs/configure.md)

```javascript
public static config: Config = {
    cache: null,
    timeout: 10000,
    port: '3000',
    host: '0.0.0.0',
    width: 1000,
    height: 1000,
    headers: {}
};
```

`/screenshot`

Return a screenshot of the requested URL

```javascript
async screenshot(
    url: string,
    isMobile: boolean,
    dimensions: ViewportDimensions,
    options?: object): Promise<Buffer>
}
```

| param        | type                                        | description                                                                             |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `url`        | `String`                                    | A valid URL to fetch                                                                    |
| `isMobile`   | `Bool`                                      | Specify a mobile layout with a querystring automatically appended to the requested URL. |
| `dimensions` | [`ViewportDimensions`](viewport-dimensions) | `height` and `width` specifications for the rendered page                               |
| `options`    | `Object`                                    | define screenshot params                                                                |

#### `ViewportDimensions`

An Object setting the width and height of the requested resource.

```javascript
type ViewportDimensions = {
    width: number,
    height: number,
};
```

#### `Options`

Specify the screenshot file type.

```javascript
const screenshotOptions = Object.assign({}, options, {
    type: 'jpeg',
    encoding: 'binary',
});
```
