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
