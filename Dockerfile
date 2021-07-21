FROM node:14.11.0-stretch

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# This directoty will store cached files as specified in the config.json.
# If you haven't defined the cacheConfig.snapshotDir property you can remove the following line
# RUN mkdir /cache

RUN groupadd -g 999 rendertron && \
    useradd -r -m -u 999 -g rendertron rendertron

WORKDIR /rendertron

RUN chown -R rendertron:rendertron /rendertron
USER rendertron

COPY --chown=rendertron:rendertron ./ ./

RUN npm install && npm run build

EXPOSE 8090

CMD ["npm", "run", "start"]

