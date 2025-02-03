import net from "net"
import fs from "fs"

import { storage } from "./storage.js";
import { replicasStorage } from "./replicas.js";
import { config } from "./dbConfig.js";
import { slaveConnect } from "./slaveConnection.js";
import { fileReader } from "./fileReader.js";
// You can use print statements as follows for debugging, they'll be visible when running tests.

const respConverter = (buffer) => {
  stringArray = buffer.toString().slice(0,-1).split(" ")
  inputConverted = stringArray.map(e => `$${e.length}\r\n${e.toLowerCase()}\r\n`)
  return `*${stringArray.length}\r\n${inputConverted.join("")}`
}

const replicas = replicasStorage["list"]

const args = process.argv;
const portId = args.indexOf("--port")
const PORT = portId == -1 ? 6379 : process.argv[portId + 1]

const replicaofId = args.indexOf("--replicaof")
const replicaofBool = replicaofId != -1

const role = replicaofBool ? "slave" : "master"
config["info"]["replication"]["role"] = role

if(replicaofBool){
  const slaveConf = process.argv[replicaofId + 1].split(" ")
  slaveConnect({ host:slaveConf[0], port:slaveConf[1] })
}

const dirId = args.indexOf("--dir")
const dbfilenameId = args.indexOf("--dbfilename")

config["dir"] = dirId == -1 ? null : process.argv[dirId + 1]
config["dbfilename"] = dbfilenameId == -1 ? null : process.argv[dbfilenameId + 1]
const path = `${config["dir"]}/${config["dbfilename"]}`

const server = net.createServer((connection) => {

  connection.on("data", (clientInput)=>{
    const existFile = fs.existsSync(path)
    if(config["dir"]!=null && existFile){
      fileReader(path)
    }
    
    // const input = respConverter(clientInput)
    const input = clientInput.toString().toLowerCase()
    // PING configuration
    if (input=="*1\r\n$4\r\nping\r\n") return connection.write("$4\r\nPONG\r\n")
    
    const inputArray =  input.split("\r\n")   

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
      for(let i=0;i<keyWords.length;i++){
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
    
    const replconfGetack = (inputArray[2] == "replconf") && (inputArray[4] == "ack")
    
    if(replconfGetack){replicasStorage["replWithAck"]["quantity"]++}
    
    if (set) {
      storage[inputArray[4]] = {"value":inputArray[6], "expirity":+inputArray[10]}
      
      if (!pxConf) {
        
        replicas.forEach(replica=>{
          replica.write(clientInput.toString())
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
      console.log(inputArray)
      console.log(storage)

      if(storage[inputArray[4]]!=undefined) {
        connection.write(`$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`)
      }else{connection.write("$-1\r\n")}
    }
    
    // WAIT configuration
    const wait = inputArray[2] == "wait"

    if(wait){

      replicas.forEach(replica => {
        replica.write("*3\r\n$8\r\nREPLCONF\r\n$6\r\nGETACK\r\n$1\r\n*\r\n")
      })
      setTimeout(()=>{
        if(replicasStorage["replWithAck"]["quantity"]==0){
          connection.write(`:${replicas.length}\r\n`)
          return 
        }

        if((replicasStorage["replWithAck"]["quantity"]==(+inputArray[4]))){
          connection.write(`:${(replicasStorage["replWithAck"]["quantity"])}\r\n`)
          replicasStorage["replWithAck"]["quantity"] = 0
          return
        }else{ 
          setInterval(()=>{
            connection.write(`:${(replicasStorage["replWithAck"]["quantity"])}\r\n`)
            replicasStorage["replWithAck"]["quantity"] = 0
          }, (+inputArray[6]-1000))
        }
      },1000)
    }
  })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(PORT, "127.0.0.1", ()=>{
    console.log("Server connected")
   
});
