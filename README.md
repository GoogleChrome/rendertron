# bot-render [![Build status](https://img.shields.io/travis/samuelli/bot-render.svg?style=flat-square)](https://travis-ci.org/samuelli/bot-render)

A Docker container which runs headless Chrome and renders web pages on the fly.

## Dependencies
This project requires Node 7+ and Docker ([installation instructions](https://docs.docker.com/engine/installation/)). For deployment this
project uses the [Google Cloud Platform SDK](https://cloud.google.com/sdk/).

## Installing
Install node dependencies using:
```bash
npm install
```

Install Chrome:
```bash
apt-get install google-chrome
```

## Running locally
With a local instance of Chrome installed, you can start the server locally:
```bash
npm start
```

To test a rendering, send a request:
```
http://localhost:3000/?url=https://dynamic-meta.appspot.com
```

## Docker
After installing docker, build the docker image:
```bash
docker build -t bot-render . --no-cache=true
```

## Running the container

There are two ways to run the container locally:
1. [Recommended] - Use [Jessie Frazelle' seccomp profile](https://github.com/jessfraz/dotfiles/blob/master/etc/docker/seccomp/chrome.json) and `-security-opt` flag
2. Utilize the `--cap-add SYS_ADMIN` flag

In the case where your kernel lacks user namespace support or are receiving a `ECONNREFUSED` error when trying to access the service in the container (as noted in issues [2](https://github.com/samuelli/bot-render/issues/2) and [3](https://github.com/samuelli/bot-render/issues/3)), both methods above should resolve the problem.

[Recommended] Start a container with the built image using Jessie Frazelle' seccomp profile for Chrome:
```bash
wget https://raw.githubusercontent.com/jfrazelle/dotfiles/master/etc/docker/seccomp/chrome.json -O ~/chrome.json
docker run -it -p 8080:8080 --security-opt seccomp=$HOME/chrome.json --name bot-render-container bot-render
```

Start a container with the built image using SYS_ADMIN:
```bash
docker run -it -p 8080:8080 --cap-add SYS_ADMIN --name bot-render-container bot-render
```

Send a request to the server running inside the container:
```bash
curl http://localhost:8080/?url=https://dynamic-meta.appspot.com
```

Stop the container:
```bash
docker kill bot-render-container
```

Clear containers:
```bash
docker rm -f $(docker ps -a -q)
```

## Deploying to Google Cloud Platform
```
gcloud app deploy app.yaml --project <your-project-id>
```