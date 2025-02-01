const net = require("net");
const fs = require("fs");
// You can use print statements as follows for debugging, they'll be visible when running tests.

const respConverter = (buffer) => {
  stringArray = buffer.toString().slice(0,-1).split(" ")
  inputConverted = stringArray.map(e => `$${e.length}\r\n${e.toLowerCase()}\r\n`)
  return `*${stringArray.length}\r\n${inputConverted.join("")}`
}

const storage = {}
const arguments = process.argv;
const replicas = []

const portId = arguments.indexOf("--port")
const PORT = portId == -1 ? 6379 : process.argv[portId + 1]

const replicaofId = arguments.indexOf("--replicaof")
const replicaofBool = replicaofId != -1
const role = replicaofBool ? "slave" : "master"

if(replicaofBool){

  const masterConf = process.argv[replicaofId + 1].split(" ")

  const master = net.createConnection({host:masterConf[0], port:masterConf[1]}, ()=>{
    console.log("Connected to master")
    master.write("*1\r\n$4\r\nPING\r\n")
  })
  
  let actualCommandIndex = 0
  const command = ["*3\r\n$8\r\nREPLCONF\r\n$14\r\nlistening-port\r\n$4\r\n6380\r\n",
                   "*3\r\n$8\r\nREPLCONF\r\n$4\r\ncapa\r\n$6\r\npsync2\r\n",
                   "*3\r\n$5\r\nPSYNC\r\n$1\r\n?\r\n$2\r\n-1\r\n"]

  const sendNextCommand = (connection, commands) => {
    if(actualCommandIndex<commands.length){
      connection.write(commands[actualCommandIndex])
      actualCommandIndex++
      return 
    }
    return connection.end()
  }

  master.on("data", (data)=>{
    
    if(actualCommandIndex<3){
      return sendNextCommand(master,command)
    } 
    
    const input = data.toString().toLowerCase()
    const inputArray =  input.split("\r\n")  

    console.log(inputArray)

    const indexGetack = inputArray.indexOf("getack") == -1 ? -1 : (inputArray.indexOf("getack") - 4)
    const fileIncluded = input.indexOf("+fullresync") != -1    

    if(!fileIncluded){
      if(inputArray.indexOf("getack")==-1){
        config["info"]["replication"]["master_repl_offset"]+=new TextEncoder().encode(inputArray.join("\r\n") + "\r\n").byteLength  
      }else{
        config["info"]["replication"]["master_repl_offset"]+=new TextEncoder().encode(inputArray.slice(0,indexGetack).join("\r\n") + "\r\n").byteLength
      }
    }    
    
    // SET and GET configuration with expirity
    const set = inputArray[2] == "set"
    const get = inputArray[2] == "get"
    const pxConf = inputArray[8] == "px"
    if (set) {
      const eachSet = []

      for(i=0;i<inputArray.length;i+=7){
        eachSet.push(inputArray.slice(i,i + 7))
      }
      // console.log(inputArray)
      eachSet.pop()
      eachSet.forEach(request =>{
        
        storage[request[4]] = {"value":request[6], "expirity":+request[10]}
        
        if (!pxConf) {    
          master.write(`*3\r\n$8\r\nREPLCONF\r\n$3\r\nACK\r\n$${config["info"]["replication"]["master_repl_offset"].toString().length}\r\n${config["info"]["replication"]["master_repl_offset"]}\r\n`)
        }else{ 
          setTimeout( ()=>{ 
            delete storage[request[4]] 
          }, storage[request[4]].expirity)
          master.write(`*3\r\n$8\r\nREPLCONF\r\n$3\r\nACK\r\n$${config["info"]["replication"]["master_repl_offset"].toString().length}\r\n${config["info"]["replication"]["master_repl_offset"]}\r\n`)
        }
      })
      
    }
    
    if (get) {
      if(storage[inputArray[4]]!=undefined) master.write(`$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`)
    }

    const getackfId = inputArray.indexOf("getack")

    if (getackfId!=-1){
      master.write(`*3\r\n$8\r\nREPLCONF\r\n$3\r\nACK\r\n$${config["info"]["replication"]["master_repl_offset"].toString().length}\r\n${config["info"]["replication"]["master_repl_offset"]}\r\n`)
      config["info"]["replication"]["master_repl_offset"]+=37 
    }
    //   // Default response to something wrong
    // return master.write('$-1\r\n') 
    

    
  })
}

const config = {
  "port":PORT,
  "info":{
    "replication":{
      "role":role,
      "connected_slaves":0,
      "master_replid":"8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb",
      "master_repl_offset":0,
      // "second_repl_offset":-1,
      // "repl_backlog_active":0,
      // "repl_backlog_size":1048576,
      // "repl_backlog_first_byte_offset":0,
      // "repl_backlog_histlen":null
    }
  },
  "conn":0
}

const dirId = arguments.indexOf("--dir")
const dbfilenameId = arguments.indexOf("--dbfilename")

config["dir"] = dirId == -1 ? null : process.argv[dirId + 1]
config["dbfilename"] = dbfilenameId == -1 ? null : process.argv[dbfilenameId + 1]
const path = `${config["dir"]}/${config["dbfilename"]}`

const server = net.createServer((connection) => {
  // Setting of the default paths of execution passing in the terminal for tests  
  connection.on("data", (clientInput)=>{
    
    const existFile = fs.existsSync(path)
    if(config["dir"]!=null && existFile){
      
      const file = fs.readFileSync(`${config["dir"]}/${config["dbfilename"]}`)
      // const file = fs.readFileSync(`/home/jmoc/Desktop/codecrafters-redis-javascript/app/regular_set.rdb`)
      let fbFound = false
      let hashTableSize = false
      let keysWithExpirity = false
      let spaceBewtweenWords = false

      let indexStringEnd = 0
      let indexExpirityEnd = 0
      let keyString = ""
      let expirity = ""
      let pair = []
      
      for(i=0;i<file.length;i++){
        const hexValue =  file[i].toString(16).padStart(2,"0")
        if(hexValue == "ff") { break }
        if(hexValue == "fb") { fbFound = true; continue }
        if(!fbFound) continue        
        
        if(!hashTableSize){
          config["hashTableSize"] = String.fromCharCode(hexValue).charCodeAt(0)
          hashTableSize = true
          continue
        }
        
        if(!keysWithExpirity){
          config["keysWithExpirity"] = String.fromCharCode(hexValue).charCodeAt(0)
          keysWithExpirity = true
          continue
        }
        
        if(hexValue=="fc"){ indexExpirityEnd = i+9; continue} 
        
        if(i<indexExpirityEnd){
          expirity += hexValue
          continue
        }
        
        if(i==indexExpirityEnd) {pair[2] = expirity; expirity = "";continue}
        
        if(hexValue=="00") { continue }

        if (file[i-1].toString(16).padStart(2,"0") == "00") {
          spaceBewtweenWords = true
        }
        
        if(spaceBewtweenWords){
          indexStringEnd = i + String.fromCharCode(file[i]).charCodeAt(0)

          spaceBewtweenWords = false
          continue
        }

        keyString += String.fromCharCode(file[i])
        
        if (i==indexStringEnd){
          
          if (pair[0]==undefined) { pair[0] = keyString }
          else { 
            pair[1] = keyString 
            if(pair[2]!=undefined){
              pair[2] = new Date(Number(BigInt("0x" + pair[2].match(/../g).reverse().join("")))) ?? ""

              if(Date.now() < pair[2]){
                storage[pair[0]] = {"value":pair[1], "expirity":pair[2]}
              }
            }else{
              storage[pair[0]] = {"value":pair[1], "expirity":""}
            }

            pair=[] 
          }
          
          keyString = ""
          spaceBewtweenWords = true
          continue
        }  
              
      }
      console.log(config, storage)
    } 
    // PING configuration
    // const input = respConverter(clientInput)
    const input = clientInput.toString().toLowerCase()
    if (input=="*1\r\n$4\r\nping\r\n") return connection.write("$4\r\nPONG\r\n")
      const inputArray =  input.split("\r\n")   

    // console.log(inputArray)
    // Default CONFIG GET configuration
    const confGet = (inputArray[2]=="config") && (inputArray[4] == "get")
     
    if(confGet) {
      if((config[inputArray[6]]== null) || (config[inputArray[6]]== undefined) ){
        return connection.write('$-1\r\n') 
      }
      return connection.write(`*2\r\n$${inputArray[6].length}\r\n${inputArray[6]}\r\n$${config[inputArray[6]].length}\r\n${config[inputArray[6]]}\r\n`)
    }
    
    // KEYS configuration
    const keys = inputArray[2] == "keys"
    if(keys){
      const keyWords = Object.keys(storage) 
      const lenKeyWords = keyWords.map(e => e.length) 
      let res = ""
      for(i=0;i<keyWords.length;i++){
        res += `$${lenKeyWords[i]}\r\n${keyWords[i]}\r\n`
      }

      return connection.write(`*${keyWords.length}\r\n${res}`)
    }
    
    // INFO configuration
    const infoRep = inputArray[2] == "info"
    const especifics = "replication"

    if(infoRep){
      const resWithoutResp = Object.keys(config["info"][especifics]).map( property => `${property}:${config["info"][especifics][property]}` )
      const resArray = resWithoutResp.map(e=>`+${e}`)
      const res = `*${resArray.length}\r\n${resArray.join("")}`
      
      return connection.write(`${resArray.join("")}\r\n`)
    }

    // REPLCONF configuration
    const replconfList = (inputArray[2] == "replconf") && (inputArray[4] == "listening-port")
    const replconfCapa = (inputArray[2] == "replconf") && (inputArray[4] == "capa")

    if(replconfList || replconfCapa){
      return connection.write("+OK\r\n")
    }

    // PSYNC configuration
    const psync = inputArray[2] == "psync"
    if(psync){

      connection.write(`+FULLRESYNC ${config["info"]["replication"]["master_replid"]} ${config["info"]["replication"]["master_repl_offset"]}\r\n`)
      const base = "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog=="
      const buffer = Buffer.from(base,"base64")
      const bufferHeader = Buffer.from(`$${buffer.length}\r\n`)  
       
      replicas.push(connection)
      return connection.write(Buffer.concat([bufferHeader,buffer]))
    }

    // ECHO configuration
    const echo = inputArray[2] == "echo"
    if(echo){
      const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
      return connection.write(res)
    }   

    // SET and GET configuration with expirity
    const set = inputArray[2] == "set"
    const get = inputArray[2] == "get"
    const pxConf = inputArray[8] == "px"
    if (set) {
      storage[inputArray[4]] = {"value":inputArray[6], "expirity":+inputArray[10]}
      
      if (!pxConf) {
        for(i=0;i<(replicas.length*2);i++){
          if(i==0){
            replicas[0].write(clientInput.toString())
            continue
          }

          if(0%2==0){
            console.log(i)
            replicas[i/2].write(clientInput.toString())
          }else{
            replicas[Math.floor((i/2))-0.5].write(clientInput.toString())
            
          }
        }    
        replicas.forEach(socket => {
          socket.write(clientInput.toString())
        })
        connection.write("+OK\r\n")
      }else{
        setTimeout( ()=>{ 
          delete storage[inputArray[4]] 
        }, storage[inputArray[4]].expirity)
        
        connection.write("+OK\r\n")
      }
    }
      
    if (get) {
      if(storage[inputArray[4]]!=undefined) return connection.write(`$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`)
    }
    
    // WAIT configuration
    const wait = inputArray[2] == "wait"
    const replconfGetack = (inputArray[2] == "replconf") && (inputArray[4] == "ack")
    if(replconfGetack) { config["conn"] += 1 }

    if(wait){

      replicas.forEach(replica => {
        replica.write("*3\r\n$8\r\nREPLCONF\r\n$6\r\nGETACK\r\n$1\r\n*\r\n")
      })
      
      // replicas[+inputArray[4]-1].write("*3\r\n$8\r\nREPLCONF\r\n$6\r\nGETACK\r\n$1\r\n*\r\n")
      connection.write(`:${config["conn"]}\r\n`)

    }

    // Default response to something wrong
    // return connection.write('$-1\r\n') 
    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(config["port"], "127.0.0.1", ()=>{
    console.log("Server connected")
   
});
