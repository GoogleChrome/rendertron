# bot-render

A Docker container which runs headless Chrome and renders web pages on the fly.

## Dependencies
This project requires Node 7+ and Docker ([installation instructions](https://docs.docker.com/engine/installation/)).

## Installing
Install node dependencies using:
```bash
npm install
```

Install Chrome:
```bash
apt-get install google-chrome-beta
```

## Running locally
With a local instance of Chrome Beta installed, you can start the server locally:
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
docker build -t bot-render .
```

Start a container with the built image:
```bash
docker run --name bot-render-container bot-render
```

Send a request to the server running inside the container:
```bash
docker exec bot-render-container curl http://localhost:8080/?url=https://dynamic-meta.appspot.com
```

Stop the container:
```bash
docker kill bot-render-container
```

Clear containers:
```bash
docker rm -f $(docker ps -a -q)
```
