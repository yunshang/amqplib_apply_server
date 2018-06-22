const Web3 = require('web3')
const providerUrl = 'http://10.35.11.56:18540'
const EthCrypto = require('eth-crypto')
const amqp = require('amqplib')
const fs = require('fs')
const axios = require('axios')
const Tx = require('ethereumjs-tx')
const amqp_url = 'amqp://whl:123456@10.35.11.134:5672' 
// const amqp_url = 'amqp://test:test@127.0.0.1:5672' 

main()

async function main () {
  amqp.connect(amqp_url).then((conn) => {
    process.once('SIGN',() => {
      conn.close()
    });
    return conn.createChannel().then((ch) => {
      var ok = ch.assertQueue('wallet.sending.command',{durable:true}).then((_qok) => {
        return ch.consume('wallet.sending.command',(msg) => {
          console.log("[x] Received '%s'",msg.content.toString())
          msg = JSON.parse(msg.content.toString())
          switch (parseInt(msg.commandId))
           {
             case 300100:
               address(msg)
               break;
             case 300200:
               pre_transaction(msg)
               break;
             default:
               break;
           }
        },{noAck:true})
      })
  
      return ok.then((_consumeOk) => {
        console.log('[*] Waiting for message. To exit press CRTL+C');
      })
    })
  }).then(null,console.warn)
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

// async function txData(no, msg, web3, value) {
//   let rawTx = {
//     from: msg.data.from_user_address,
//     nonce: no,
//     to: msg.data.from_user_address,
//     gasLimit: web3.utils.toHex(3000000),
//     // gasPrice: web3.utils.toHex(10 * 1e9),
//     gasPrice: 0,
//     data: '',
//     value: web3.utils.toHex(value) 
//   }

//   return rawTx
// }

async function transaction(no, msg, web3, data) {
  let rawTx = await erc20_txData(no, msg, web3, data)
  console.log(rawTx)
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
    await mqTask(JSON.stringify(result))
    console.log(res)
  } catch (error) {
    console.error(error)
  }
}

async function address(msg) {
  const identity = EthCrypto.createIdentity()
  let data = {}
  data.data = identity
  data.data.privateKey = identity.privateKey.slice(2)
  data.data.accountId = msg.data.user_id
  data.commandId = 300100
  await mqTask(JSON.stringify(data))
  console.log(data)
}

async function mqTask(msg) {
  let q = 'wallet.receive.command'
  let open = require('amqplib').connect(amqp_url)
  try {
    const conn = await open
    console.log(conn)
    const ch = await conn.createChannel()
    const ok = await ch.assertQueue(q, {durable: true})
    const result = await ch.sendToQueue(q, new Buffer(msg))
    await ch.close()
  } catch (err) {
    this.info(err)
  }
}