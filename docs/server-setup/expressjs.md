## Set up Rendertron with express.js

If you use [expressjs](https://expressjs.com) you can use the [rendertron-middleware] to add Rendertron to your express.js application.

### Install rendertron-middleware

Inside the root directory of your web application, run the following command:

```
npm install --save rendertron-middleware
```

### Setup your express.js application to use the middleware

```javascript
const express = require('express');
const rendertron = require('rendertron-middleware');

const app = express();

app.use(
  rendertron.makeMiddleware({
    // replace this with the web address of your rendertron instance
    proxyUrl: 'http://PUT-YOUR-RENDERTRON-URL-HERE/render',
  })
);

app.use(express.static('files'));
app.listen(8080);
```

### Configure which user agents are pre-rendered with Rendertron

The middleware comes with a pre-configured [bot list](https://github.com/GoogleChrome/rendertron/blob/a1dd3ab1f054bc19e89dcdecdb71dc004f7d068e/middleware/src/middleware.ts#L24-L41).

If you wish to use Rendertron for other bots, you can either _replace_ or _extend_ this list.

To replace the list with your own, configure the middleware like this:

```javascript
// only use Rendertron for LinkedInBot and Twitterbot
const myBotList = ['linkedinbot', 'twitterbot'];

app.use(
  rendertron.makeMiddleware({
    // replace the default bot list with your own:
    userAgentPattern: new RegExp(myBotList.join('|'), 'i'),
    // replace this with the web address of your rendertron instance
    proxyUrl: 'http://PUT-YOUR-RENDERTRON-URL-HERE/render',
  })
);
```

You can also extend the bot list to include more bots:

```javascript
// add googlebot and yolobot to bot list
const myBotList = rendertron.botUserAgents.concat(['googlebot', 'yolobot']);

app.use(
  rendertron.makeMiddleware({
    // use the extended bot list:
    userAgentPattern: new RegExp(myBotList.join('|'), 'i'),
    // replace this with the web address of your rendertron instance
    proxyUrl: 'http://PUT-YOUR-RENDERTRON-URL-HERE/render',
  })
);
```
