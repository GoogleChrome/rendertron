## Set up Rendertron with nginx

In nginx you would configure Rendertron by [setting up nginx as a reverse proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/), but make it conditional on the `$http_user_agent` value of the request.

If the `$http_user_agent` is looking like a bot, send the request to Rendertron, otherwise send it to your web application directly.

Example configuration that uses Rendertron for every user agent that contains "bot" (case insensitive):

```
server {
  listen 80;
  server_name example.com;
  # ...other configuration...

  location ~ \.*$ {
    # only send requests from user agents containing the word "bot" to Rendertron
    if ($http_user_agent ~* 'bot') {
      proxy_set_header X-Real-IP  $remote_addr;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_set_header Host $host;
      # replace PUT-YOUR-RENDERTRON-URL-HERE with your rendertron server address below:
      proxy_pass http://PUT-YOUR-RENDERTRON-URL-HERE/render; 
    }
  }
}
```

### Setting up Rendertron for multiple bot user agents:

```
server {
  listen 80;
  server_name example.com;
  # ...other configuration...

  # Create $is_bot variable and match user agents
  map $http_user_agent $is_bot {
    default 'no';
    ~*(googlebot) yes;
    ~*(bingbot) yes;
  }

  location ~ \.*$ {
    # only send requests that we know to come from bots to Rendertron
    if ($is_bot = 'yes') {
      proxy_set_header X-Real-IP  $remote_addr;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_set_header Host $host;
      # replace PUT-YOUR-RENDERTRON-URL-HERE with your rendertron server address below:
      proxy_pass http://PUT-YOUR-RENDERTRON-URL-HERE/render; 
    }
  }
}
```