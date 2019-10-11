###  Deploying Rendertron to Google Cloud Platform

Rendertron runs a server that takes a URL and returns static HTML for the URL by using headless Chromium. This guide follows
`https://github.com/GoogleChrome/rendertron#deploying-to-google-cloud-platform`

* To clone the Rendertron repository from GitHub, run the following command:
`git clone https://github.com/GoogleChrome/rendertron.git`

* Change directories:
`cd rendertron`

*To install dependencies and build Rendertron on your computer, run the following command:
`npm install && npm run build`

* Create a new file called config.json in the rendertron directory with the following content to enable Rendertron's cache:
`{ "datastoreCache": true }`

* From the rendertron directory, run the following command. Replace YOUR_PROJECT_ID with your project ID that you set in Google Cloud Platform.
`gcloud app deploy app.yaml --project YOUR_PROJECT_ID`

* Select a region of your choice and confirm the deployment. Wait for the command to finish.

* Enter YOUR_PROJECT_ID.appspot.com in your browser. Replace YOUR_PROJECT_ID with your actual project ID that you set in Google Cloud Platform. You should see Rendertron's interface with an input field and a few buttons.

* When you see the Rendertron web interface, you have successfully deployed your own Rendertron instance. Take note of your project's URL (YOUR_PROJECT_ID.appspot.com) as you will need it later.


###  Deploying Rendertron to Heroku

Setup Herokuapp and Heroku CLI
`https://devcenter.heroku.com/articles/heroku-cli`

First, add the Google Chrome buildpack to your project:

```
$ heroku buildpacks:set https://github.com/heroku/heroku-buildpack-google-chrome.git -a <app-name>
```

Next, add the `heroku/nodejs` buildpack to your project:

```
$ heroku buildpacks:add heroku/nodejs -a <app-name>
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

