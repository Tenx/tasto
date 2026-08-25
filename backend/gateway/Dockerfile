FROM ghcr.io/directus/directus:12.2.0

WORKDIR /app
COPY server.mjs /app/server.mjs

USER root
RUN mkdir -p /app/node_modules \
    && ln -s /directus/node_modules/.pnpm/pg@8.16.3/node_modules/pg /app/node_modules/pg \
    && ln -s /directus/node_modules/.pnpm/sharp@0.35.3_@types+node@26.1.2/node_modules/sharp /app/node_modules/sharp

USER node
EXPOSE 8060
CMD ["node", "/app/server.mjs"]
