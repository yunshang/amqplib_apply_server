'use strict'
const Web3 = require('web3')
const providerUrl = 'http://10.35.11.56:18540'
const EthCrypto = require('eth-crypto')
const amqp = require('amqplib')
const fs = require('fs')
const axios = require('axios')
const Tx = require('ethereumjs-tx')
const pify = require('pify')

const queueService = require('./service/mq')
const Transaction = require('./service/transaction')
// const QueueSend = new queueService('wallet.sending.command', {})
// const QueueReceive = new queueService('wallet.receive.command', {})
const QueueSend = new queueService('hello', {durable:false})
const QueueReceive = new queueService('hello2', {durable:false})

async function actMqTask() {
  QueueSend.consume(async (data) => {
    if (!data) {
      console.log('队列绑定失败！')
    }
    let msg = {}
    switch (parseInt(data.commandId)) {
      case 300100:
        msg = await Transaction.address(data)
        break;
      case 300200:
        msg = await Transaction.transaction(data)
        console.log(msg)
        break;
      default:
        break;
    }
    const res = await QueueReceive.sendToQueue(msg)
    if (!res) {
      throw ('消息发送失败！')
    }
    console.log('消息发送成功！')
    return
  })
}

async function main () {
  console.log('[*] Waiting for message. To exit press CRTL+C')
  await actMqTask()
}

main()
