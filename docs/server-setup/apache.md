## Set up Rendertron with Apache

For Apache you would configure Rendertron by configuring a conditional URL rewrite (using mod_rewrite) to send requests coming from the desired bots to Rendertron.

Example configuration that uses Rendertron for every useragent containing "bot":

```
RewriteEngine On
RewriteCond %{HTTP_USER_AGENT} bot
# Replace the PUT-YOUR-RENDERTRON-URL-HERE with the URL of your Rendertron instance
# Replace YOUR-WEBAPP-ROOT-URL with the base URL of your web application (e.g. example.com)
RewriteRule ^(.*)$ https://PUT-YOUR-RENDERTRON-URL-HERE/render/https://YOUR-WEBAPP-ROOT-URL$1 [P,L]
```

To make your Apache web server send requests from a list of bots to your Rendertron instance, use this syntax:

```
RewriteEngine On
RewriteCond %{HTTP_USER_AGENT} facebookexternalhit|linkedinbot|twitterbot
# Replace the PUT-YOUR-RENDERTRON-URL-HERE with the URL of your Rendertron instance
# Replace YOUR-WEBAPP-ROOT-URL with the base URL of your web application (e.g. example.com)
RewriteRule ^(.*)$ https://PUT-YOUR-RENDERTRON-URL-HERE/render/https://YOUR-WEBAPP-ROOT-URL$1 [P,L]
```
