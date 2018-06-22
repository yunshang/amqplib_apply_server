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
// const QueueSend = new queueService('wallet.sending.command', {})
// const QueueReceive = new queueService('wallet.receive.command', {})
const QueueSend = new queueService('hello', {durable:false})
const QueueReceive = new queueService('hello2', {durable:false})

async function actMqTask() {
  // QueueSend.consume((data) => {
  //   if (!data) {
  //     console.log('队列绑定失败！')
  //   }
  //   let msg = {}
  //   switch (parseInt(data.commandId)) {
  //     case 300100:
  //       msg = address(data)
  //       break;
  //     case 300200:
  //       msg = pre_transaction(data)
  //       break;
  //     default:
  //       break;
  //   }
  //   return QueueReceive.sendToQueue(msg).then(function (data) {
  //     console.log(msg)
  //     if (!data) {
  //       throw ('消息发送失败！')
  //     }
  //     console.log('消息发送成功！')
  //     return
  //   })
  // })
  const data = await pify(QueueSend.consume.bind(QueueSend), {errorFirst: false})()
  console.log(data)
}
async function main () {
  console.log('[*] Waiting for message. To exit press CRTL+C')
  await actMqTask()
}

async function address(msg) {
  const identity = EthCrypto.createIdentity()
  let data = {}
  data.data = identity
  data.data.privateKey = identity.privateKey.slice(2)
  data.data.accountId = msg.data.user_id
  data.commandId = 300100

  return data
}

async function pre_transaction(msg) {
  const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl))
  let contract = msg.data.contract_address
  let from_user_address = msg.data.from_user_address
  let to_user_address = msg.data.to_user_address
  let value = msg.data.value
  let decimals = msg.data.decimals
  let no = await getTransactionCount(from_user_address)
  let abi = JSON.parse(fs.readFileSync('coin.json', 'utf-8'))
  let abiArray = abi
  let con =  new web3.eth.Contract(abiArray, contract, {
    from: from_user_address
  })

  await con.methods.balanceOf(from_user_address).call().then((balance) => {
    if(balance == 0) {
      // response.send({code: 404, message: '查询不到 token'})
    }
  })

  value = parseInt(value * 10 ** decimals)
  let data = con.methods.transfer(to_user_address, value).encodeABI()

  await transaction(no, msg, web3, data)
}

async function getTransactionCount(deployAddr) {
  try {
    const response = await axios.post(providerUrl, {
      jsonrpc: '2.0',
      method: 'eth_getTransactionCount',
      params: [deployAddr, "latest"],
      id: 1
    });
    return response.data.result
  } catch (error) {
    console.error(error);
  }
}

async function erc20_txData(no, msg, web3, data) {
  let rawTx = {
    from: msg.data.from_user_address,
    nonce: no,
    to: msg.data.contract_address,
    gasLimit: '0x2dc6c0',
    gasPrice: 0,
    data: data,
    value: '0x0'
  }

  return rawTx
}

async function transaction(no, msg, web3, data) {
  let rawTx = await erc20_txData(no, msg, web3, data)
  var privateKey = new Buffer(msg.data.from_user_privateKey, 'hex');
  var tx = new Tx(rawTx)
  tx.sign(privateKey)
  var serializedTx = tx.serialize();
  var hash = '0x' + serializedTx.toString('hex')
  try {
    const res = await axios.post(providerUrl, {
      jsonrpc: '2.0',
      method: 'eth_sendRawTransaction',
      params: [hash],
      id: 1
    })
    let result = {}
    result.data = {}
    if (res.data.error) {
      result.data.error = res.data.error
    } else {
      result.data.txId = res.data.result
    }
    result.data.dataId = msg.data.dataId
    result.commandId = 300200
    console.log(result)
    return result
  } catch (error) {
    console.error(error)
  }
}

main()
