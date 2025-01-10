FROM node:18

WORKDIR /app

COPY . /app

RUN npm install -g serve 
RUN yarn install 
RUN yarn run build

EXPOSE 3000

CMD ["serve", "-s", "build"]

# docker build -t ergogen .
# docker run -p 3001:3001 ergogen
