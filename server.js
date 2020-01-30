/*
 * Copyright (c) 2012-2020 Yoshitaka Kawashima
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */
const url  = require('url');
const http = require('http');
const crypto = require('crypto');

const transmitterPort = process.env.TRANSMITTER_PORT || 8081
const io = require('socket.io').listen(transmitterPort);
const responses = {};

const wsServer = io.sockets.on('connection', function (socket) {
  socket.on('response header', function (data) {
    const response = responses[data.requestId];
    response.writeHead(data.statusCode, data.headers);
  });

  socket.on('response data', function (data) {
    const buf = new Buffer(data.data, 'base64');
    const response = responses[data.requestId];
    response.write(buf);
  });

  socket.on('response end', function (data) {
    const response = responses[data.requestId];
    response.end();
    delete responses[data.requestId];
  });
});

const delegateRequest = function (options, res) {
  for (let i in wsServer.sockets) {
    const socket = wsServer.sockets[i];

    const requestId = crypto.randomBytes(64).toString('hex');
    responses[requestId] = res;
    options["requestId"] = requestId;
    socket.emit('delegate request', options);
  }
};


const proxyServer = http.createServer(function (req, res) {
  var headers = req.headers;
  if('proxy-connection' in headers){
    headers['connection'] = 'close';
    delete headers['proxy-connection'];
  }
  if('cache-control' in headers){
    delete headers['cache-control'];
  }

  const targetUrl = url.parse(req.url, false);

  if (!targetUrl.pathname) { targetUrl.pathname = '/'; }
  if (!targetUrl.search) { targetUrl.search = ''; }
  if (!targetUrl.port) { targetUrl.port = 80; }

  const options = {
    host: targetUrl.hostname,
    port: targetUrl.port,
    method: req.method,
    path: targetUrl.path,
    headers: req.headers
  };

  if (req.method === 'POST') {
    console.log("POST");
    let body='';
    req.on('data', function (data) {
      body +=data;
    });
    req.on('end',function(){
      options["postdata"] = body;
      delegateRequest(options, res);
    });
  }
  else if(req.method === 'GET') {
    delegateRequest(options, res);
  }
});

proxyServer.listen((process.env.PORT || 8080), () => {
  console.log(`Start proxy`);
});
