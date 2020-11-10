# Deploying Rendertron to Google Cloud Platform

Rendertron runs a server that takes a URL and returns static HTML for the URL by using headless Chromium. This guide follows
`https://github.com/GoogleChrome/rendertron#deploying-to-google-cloud-platform`

- To clone the Rendertron repository from GitHub, run the following command:
  `git clone https://github.com/GoogleChrome/rendertron.git`

- Change directories:
  `cd rendertron`

- To install dependencies and build Rendertron on your computer, run the following command:
  `npm install && npm run build`

- Create a new file called config.json in the rendertron directory with the following content to enable Rendertron's cache:
  `{ "datastoreCache": true }`

- From the rendertron directory, run the following command. Replace YOUR_PROJECT_ID with your project ID that you set in Google Cloud Platform.
  `gcloud app deploy app.yaml --project YOUR_PROJECT_ID`

- Select a region of your choice and confirm the deployment. Wait for the command to finish.

- Enter YOUR_PROJECT_ID.appspot.com in your browser. Replace YOUR_PROJECT_ID with your actual project ID that you set in Google Cloud Platform. You should see Rendertron's interface with an input field and a few buttons.

- When you see the Rendertron web interface, you have successfully deployed your own Rendertron instance. Take note of your project's URL (YOUR_PROJECT_ID.appspot.com) as you will need it later.

# Deploying Rendertron to Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://dashboard.heroku.com/new?button-url=https://github.com/GoogleChrome/rendertron/tree/main&template=https://github.com/GoogleChrome/rendertron/tree/main)

Setup Herokuapp and Heroku CLI
`https://devcenter.heroku.com/articles/heroku-cli`

First, add the Google Chrome buildpack to your project:

```
$ heroku buildpacks:set https://github.com/heroku/heroku-buildpack-google-chrome.git -a <app-name>
```

Next, add the `heroku/nodejs` buildpack to your project:

```
$ heroku buildpacks:add --index 2 heroku/nodejs -a <app-name>
```

Then, update the `package.json` entry for `engines` to specific node and npm versions. I used:

```
{
  ...
  "engines": {
    "node": "10.15.1",
    "npm": "6.4.1"
  },
  ...
}
```

This was helpful in getting past a `node-gyp` issue during `npm install`, which Heroku will run each time you deploy.

Next, enter a new script into your `package.json`:

```
{
  "scripts": {
    ...,
    "heroku-postbuild": "npm run build"
  }
}
```

This will make sure to build rendertron into `bin/rendertron` on each deploy, in case you have any local changes.

Finally, add a `Procfile` to your project with the following:

```
web: node bin/rendertron
```

# Deploying Rendertron in a docker container

Based on Puppeteer instructions we can create a docker image that bundles a headless chrome and rendertron. We can start from node 14 base image.

For more information about chrome installation please see the pupeteer page: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#running-puppeteer-in-docker

If you don't want to use rendertron default configurations you can create a config.json file. This file must be created at the project root level, in the same directory as the Dockerfile.

```
{
    "cache": "filesystem",
    "cacheConfig": {
        "cacheDurationMinutes": 7200,
        "cacheMaxEntries": 1000,
        "snapshotDir": "/cache"
    }
}
```

Then we can define the Dockerfile like this:

```
FROM node:14.11.0-stretch

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# This directoty will store cached files as specified in the config.json.
# If you haven't defined the cacheConfig.snapshotDir property you can remove the following line
RUN mkdir /cache

RUN git clone https://github.com/GoogleChrome/rendertron.git

WORKDIR /rendertron

RUN npm install && npm run build

# If you aren't using a custom config.json file you must remove the following line
ADD config.json .

EXPOSE 3000

CMD ["npm", "run", "start"]

```

And we can build an image using the previous Dockerfile:

```
docker build . -t rendertron:3.0
docker run -d --log-opt max-size=100m --log-opt max-file=3 --name rendertron -p 3000:3000 rendertron:3.0
```

The rendertron api will be avaiable at localhost:3000
