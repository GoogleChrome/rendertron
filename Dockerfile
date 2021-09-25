FROM node:14.11.0-stretch



RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && sh -c 'echo "deb [arch=amd64] http://deb.debian.org/debian/ stretch main contrib non-free" >> /etc/apt/sources.list.d/contrib.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable ttf-mscorefonts-installer fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY fonts/opentype/* /usr/share/fonts/opentype/
COPY fonts/truetype/* /usr/share/fonts/truetype/

RUN fc-cache -f -v

# This directoty will store cached files as specified in the config.json.
# If you haven't defined the cacheConfig.snapshotDir property you can remove the following line
RUN mkdir /cache && mkdir /rendertron

COPY . /rendertron

WORKDIR /rendertron

RUN npm install && npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
