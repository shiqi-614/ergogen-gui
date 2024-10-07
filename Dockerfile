# FROM shiqi614/ergogen-gui
FROM node:18

WORKDIR /usr/src

ADD https://api.github.com/repos/shiqi-614/ergogen-gui/git/refs/heads/main version.json

WORKDIR /usr/src/app

RUN git clone https://github.com/shiqi-614/ergogen-gui .
# COPY . .

RUN npm install -g serve 
RUN yarn install 
RUN yarn run build

EXPOSE 3000

CMD ["serve", "-s", "build"]

# docker build -t ergogen .
# docker run -p 3001:3001 ergogen
