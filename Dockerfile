# docker build -t yogaeasy/rendertron:0.0.4 -t yogaeasy/rendertron:latest .
FROM centos
ARG OPT_DIR=/opt/rendertron
RUN mkdir -p $OPT_DIR
WORKDIR $OPT_DIR
RUN yum install -y epel-release && \
        yum install -y python36 && \
	yum -y install nodejs chromium
COPY package*.json ./
RUN npm install --unsafe && \
	rm -rf ~/.cache/node-gyp
COPY config.json /usr/lib/node_modules/rendertron
COPY config.json ./
RUN mkdir -p build
COPY build/ ./build/
EXPOSE 4000
ENTRYPOINT ["node", "build/rendertron.js"]
