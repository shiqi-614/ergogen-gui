FROM node:14

WORKDIR /usr/src

ADD https://api.github.com/repos/shiqi-614/ergogen-gui/git/refs/heads/main version.json

WORKDIR /usr/src/app

RUN git clone https://github.com/shiqi-614/ergogen-gui .

RUN npm install -g yarn & yarn install

EXPOSE 3000

CMD ["yarn", "start"]

# docker build -t ergogen .
# docker run -p 3001:3001 ergogen
