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

const client = require('socket.io-client');
const http = require('http');
const host = process.env.TRANSMITTER_HOST || 'localhost';
const port = process.env.TRANSMITTER_PORT || 8081;

client.transports = ['xhr-polling'];

const socket = client.connect('http://' + host + ':' + port);

socket.on('delegate request', function (options) {
  delete options.headers["accept-encoding"];
  const postdata = options.postdata;
  delete options.postdata;

  const request = http.request(
    options,
    function (response) {
      socket.emit('response header', {
	requestId: options["requestId"],
	statusCode: response.statusCode,
	headers: response.headers
      });

      response.on('data', function(chunk){
	socket.emit('response data', {
	  requestId: options["requestId"],
	  data: chunk.toString('base64')
	});
      });

      response.on('end', function(){
	socket.emit('response end', {
	  requestId: options["requestId"]
	});
      });

    });

  request.on('error', function (error) {
    console.log('Error:' + error);
  });

  if (postdata) {
    request.write(postdata);
  }

  request.end();
});
