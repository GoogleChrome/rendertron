## Set up Rendertron with express.js

If you use [expressjs](https://expressjs.com) you can use the [rendertron-middleware] to add Rendertron to your express.js application.

### Install rendertron-middleware

### Setup your express.js application to use the middleware

```javascript
const express = require("express");
const rendertron = require("rendertron-middleware");

const app = express();

app.use(
  rendertron.makeMiddleware({
    // replace this with the web address of your rendertron instance
    proxyUrl: "http://PUT-YOUR-RENDERTRON-URL-HERE/render"
  })
);

app.use(express.static("files"));
app.listen(8080);
```

### Configure which user agents are pre-rendered with Rendertron

TBD