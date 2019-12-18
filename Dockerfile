FROM node:10.17-alpine

ARG APP_PATH=/app/

LABEL description="Jay"

COPY ./ ${APP_PATH} 
RUN cd ${APP_PATH}/ && npm install \
    && apk add --no-cache --virtual mypacks openssl

WORKDIR ${APP_PATH}

CMD [ "npm", "run", "dev" ]
