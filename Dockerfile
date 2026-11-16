FROM node:20

WORKDIR /app

RUN npm install -g serve

# the site as built by yarn run build; CI builds it with CDN_BASE, so its index.html loads everything else from jsDelivr
COPY build /app/build

EXPOSE 3000

CMD ["serve", "-s", "build"]

# yarn run build && docker build -t ergogen-gui . && docker run -p 3000:3000 ergogen-gui
