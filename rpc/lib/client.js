var jayson = require('jayson');
var client = jayson.client.http('http://localhost:3000');

client.request('eth_sendRawTransaction', [1, 2], function(err, response) {
  if(err) throw err;
  console.log('ok', err, response.result);
});