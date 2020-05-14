## Set up Rendertron with Apache

To use Rendertron with Apache, set up a conditional URL rewrite based on the user agent.
You can do this either in an `.htaccess` file, the `VirtualHost` configuration or the main configuration file.

### Prerequisites

Your Apache needs to have `mod_rewrite` and `mod_proxy_http` enabled for this configuration. On Debian and Ubuntu, run these commands to activate these modules:

```
sudo a2enmod rewrite proxy_http
sudo service apache2 restart
```

### Basic configuration
Use the following configuration to send all requests from user agents containing `bot` to Rendertron:

```
RewriteEngine On
RewriteCond %{HTTP_USER_AGENT} bot
# Replace the PUT-YOUR-RENDERTRON-URL-HERE with the URL of your Rendertron instance
# Replace YOUR-WEBAPP-ROOT-URL with the base URL of your web application (e.g. example.com)
RewriteRule ^(.*)$ https://PUT-YOUR-RENDERTRON-URL-HERE/render/https://YOUR-WEBAPP-ROOT-URL$1 [P,L]
```

### Sending multiple bot user agents to Rendertron

To make your Apache web server send requests from a list of bots to your Rendertron instance, use this syntax:

```
RewriteEngine On
RewriteCond %{HTTP_USER_AGENT} facebookexternalhit|linkedinbot|twitterbot
# Replace the PUT-YOUR-RENDERTRON-URL-HERE with the URL of your Rendertron instance
# Replace YOUR-WEBAPP-ROOT-URL with the base URL of your web application (e.g. example.com)
RewriteRule ^(.*)$ https://PUT-YOUR-RENDERTRON-URL-HERE/render/https://YOUR-WEBAPP-ROOT-URL$1 [P,L]
```

Separate the bot names with the pipe (`|`) character.
This configuration is case-sensitive, so `googlebot` works while `Googlebot` doesn't.
