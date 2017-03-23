'use strict';

const Renderer = require('./renderer');
const Chromium = require('./chromium');
const express = require('express');

const app = express();

app.get('/', async function(request, response) {
	const head = await new Renderer(request.query.url).extractHead();
	response.send(head);
});

const port = process.env.PORT || '3000';
app.listen(port, function() {
	console.log('Listening on port', port);
});

new Chromium().start();
