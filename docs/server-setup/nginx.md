## Set up Rendertron with nginx

In nginx you would configure Rendertron by [setting up nginx as a reverse proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/), but make it conditional on the `$http_user_agent` value of the request.

If the `$http_user_agent` is looking like a bot, send the request to Rendertron, otherwise send it to your web application directly.

Example configuration that uses Rendertron for every user agent that contains "bot" (case insensitive):

```
server {
  listen 80;
  server_name example.com;
  # ...other configuration...

  # only send requests from user agents containing the word "bot" to Rendertron
  if ($http_user_agent ~* 'bot') {
    rewrite ^(.*)$ /rendertron/$1;
  }

	location /rendertron/ {
    add_header x-wtf $host;
		proxy_set_header X-Real-IP  $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    # replace PUT-YOUR-RENDERTRON-URL-HERE with your rendertron server address below
    proxy_pass http://PUT-YOUR-RENDERTRON-URL-HERE/render/$scheme://$host:$server_port$request_uri; 
  }
}
```

### Setting up Rendertron for multiple bot user agents:

To enable Rendertron for a list of (bot) user agents, you can map the `$http_user_agent` to a custom variable indicating if you consider this user agent a bot. To do so, add this to your `nginx.conf`:

```
  # Creates $is_bot variable and match user agents
  map $http_user_agent $is_bot {
    default 0;
    '~*googlebot' 1;
    '~*bingbot' 1;
    # add more lines for other user agents here
  }
```
In your site configuration, you can use the following to send requests where `$is_bot` is 1 (i.e. the user agent is considered a bot) to Rendertron:

```
server {
  listen 80;
  server_name example.com;
  # ...other configuration...
  # only send requests from user agents containing the word "bot" to Rendertron
  if ($is_bot = 1) {
    rewrite ^(.*)$ /rendertron/$1;
  }

	location /rendertron/ {
    add_header x-wtf $host;
		proxy_set_header X-Real-IP  $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    # replace PUT-YOUR-RENDERTRON-URL-HERE with your rendertron server address below
    proxy_pass http://PUT-YOUR-RENDERTRON-URL-HERE/render/$scheme://$host:$server_port$request_uri; 
  }
}
```