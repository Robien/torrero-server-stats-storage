var http = require('http')
var url = require('url')
var fs = require('fs')
var corser = require('corser')
var corserRequestListener = corser.create({
  requestHeaders: corser.simpleRequestHeaders.concat(['X-Requested-With'])
})

var port = process.argv[2] || 8764

var signing = require('eth-lightwallet').signing // it might be overkill to use this lib just to check signature
var ethUtil = require('ethereumjs-util')

var Web3 = require('web3') // web3 just for sha3 ? really ?
var web3 = new Web3()

http.createServer(function (request, response) {
  corserRequestListener(request, response, function () {
    var urlPathName = url.parse(request.url).pathname
    console.log('URL : ' + urlPathName)
    var urlPathNameArray = urlPathName.split('/')
    console.log('url path ' + JSON.stringify(urlPathNameArray))
    var command = urlPathNameArray[1]
    if (!command) {
            // write error no command
      sendError(response, 404, 'API error : no command. Use host/get or host/set')
      console.log('error 404 no command')
      return
    }
    var address = urlPathNameArray[2]
    if (!address) {
            // write error no address
      sendError(response, 404, 'API error : no address specified. Use host/get/address or host/set/address')
      console.log('error 404 no command')
      return
    }

    address = new Buffer(address, 'base64').toString('hex')
    var filename = '/home/debugs/deamons/statsServer/database/' + address
    if (command === 'get') {
      fs.exists(filename, function (exists) {
        if (!exists) {
          console.log('error 404 address unknown')
          sendError(response, 404, 'address unknown in database')
          return
        }

        fs.readFile(filename, 'binary', function (err, file) {
          if (err) {
            sendError(response, 500, err)
            console.log('error 500 ' + err)
            return
          }

          response.writeHead(200)
          response.write(file, 'binary')
          console.log('200')
          response.end()
        })
      })
    } else if (command === 'set') {
            // check signature
      var data = urlPathNameArray[3]
      var signature = urlPathNameArray[4]
      if (!data) {
                // write error no data to set
        sendError(response, 404, 'no data to set')
        return
      }

      if (!signature) {
                // error no signature
        sendError(response, 403, 'you should provide a signature for your data')
        return
      }

      try {
        var s = ethUtil.fromRpcSig(signature)
        var addressRecovered = signing.recoverAddress(web3.sha3(data), s.v, s.r, s.s).toString('hex')
      } catch (error) {
                // error with signature
        sendError(response, 404, error)
        return
      }
      if (addressRecovered !== address) {
        sendError(response, 403, 'signature check failed. (address = ' + address + ' / signature address = ' + addressRecovered + ')')
        return
      }

      fs.writeFile(filename, data, function (err) {
        if (err) {
          return console.log(err)
        }

        console.log('File ' + filename + ' updated')
                // sending eth address, maybe he will be good enought to send us a tip
        response.write('0x697c59110c259744144a1e14cfdb0f488f70dddb')
        response.end()
      })
    } else {
      sendError(response, 404, 'command ' + command + ' unknown!')
      return
    }
  })
}).listen(parseInt(port, 10))

function sendError (response, code, message) {
  response.writeHead(code, {
    'Content-Type': 'text/plain'
  })
  response.write(message + '\n')
  response.end()
  return
}

console.log('stats server running at  http://localhost:' + port + '/\nCTRL + C to shutdown')
