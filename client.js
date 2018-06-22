var amqp = require('amqplib')
var when = require('when')
const amqp_url = 'amqp://test:test@127.0.0.1:5672' 

amqp.connect(amqp_url).then((conn) => {
  return when(conn.createChannel().then((ch) => {
    var q = 'wallet.sending.command'
    var msg = {"commandId":300100,"data":{"accountId":"124","address":"0x1213","publicKey":"0x33333","privateKey":"0xlaslkdjfalsdf"}}
    msg = JSON.stringify(msg)
    return ch.assertQueue(q,{durable: false}).then((_qok) => {
      ch.sendToQueue(q,new Buffer(msg))
      console.log(" [x] Sent '%s'",msg)
      return ch.close()
    })
  })).ensure(() => { //ensure是promise.finally的别名，不管promise的状态如何都会执行的函数
    conn.close()
  })
}).then(null,console.warn)