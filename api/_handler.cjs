const {createAppServer} = require('../server.cjs');

const app = createAppServer();

module.exports = function handler(request, response) {
  app.emit('request', request, response);
};
