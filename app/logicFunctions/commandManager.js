import { storage } from "../storage.js";
import { replicasStorage } from "../replicas.js";
import { config } from "../dbConfig.js";

const respConverter = (buffer) => {
    stringArray = buffer.toString().slice(0,-1).split(" ")
    inputConverted = stringArray.map(e => `$${e.length}\r\n${e.toLowerCase()}\r\n`)
    return `*${stringArray.length}\r\n${inputConverted.join("")}`
  }

const replicas = replicasStorage["list"]

export const commandManager = ({conn,data}) => {
  // const input = respConverter(clientInput)
  const input = data.toString().toLowerCase()
  const inputArray =  input.split("\r\n")   
  
  // PING configuration
  if (input=="*1\r\n$4\r\nping\r\n") return conn.write("$4\r\nPONG\r\n")
  
  // Default CONFIG GET configuration
  const confGet = (inputArray[2]=="config") && (inputArray[4] == "get")
    
  if(confGet) {
    if((config[inputArray[6]]== null) || (config[inputArray[6]]== undefined) ){
      return conn.write('$-1\r\n') 
    }
    return conn.write(`*2\r\n$${inputArray[6].length}\r\n${inputArray[6]}\r\n$${config[inputArray[6]].length}\r\n${config[inputArray[6]]}\r\n`)
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

    return conn.write(`*${keyWords.length}\r\n${res}`)
  }
  
  // INFO configuration
  const infoRep = inputArray[2] == "info"
  const especifics = "replication"

  if(infoRep){
    const resWithoutResp = Object.keys(config["info"][especifics]).map( property => `${property}:${config["info"][especifics][property]}` )
    const resArray = resWithoutResp.map(e=>`+${e}`)
    
    return conn.write(`${resArray.join("")}\r\n`)
  }

  // REPLCONF configuration
  const replconfList = (inputArray[2] == "replconf") && (inputArray[4] == "listening-port")
  const replconfCapa = (inputArray[2] == "replconf") && (inputArray[4] == "capa")

  if(replconfList || replconfCapa){
    return conn.write("+OK\r\n")
  }

  // PSYNC configuration
  const psync = inputArray[2] == "psync"
  if(psync){

    conn.write(`+FULLRESYNC ${config["info"]["replication"]["master_replid"]} ${config["info"]["replication"]["master_repl_offset"]}\r\n`)
    const base = "UkVESVMwMDEx+glyZWRpcy12ZXIFNy4yLjD6CnJlZGlzLWJpdHPAQPoFY3RpbWXCbQi8ZfoIdXNlZC1tZW3CsMQQAPoIYW9mLWJhc2XAAP/wbjv+wP9aog=="
    const buffer = Buffer.from(base,"base64")
    const bufferHeader = Buffer.from(`$${buffer.length}\r\n`)  
      
    replicas.push(conn)
    return conn.write(Buffer.concat([bufferHeader,buffer]))
  }

  // ECHO configuration
  const echo = inputArray[2] == "echo"
  if(echo){
    const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
    return conn.write(res)
  }   
  
  // SET and GET configuration with expirity
  const set = inputArray[2] == "set"
  const get = inputArray[2] == "get"
  const pxConf = inputArray[8] == "px"
  
  const replconfGetack = (inputArray[2] == "replconf") && (inputArray[4] == "ack")
  
  if(replconfGetack){replicasStorage["replWithAck"]["quantity"]++}
  
  if (set) {
    storage[inputArray[4]] = {"value":inputArray[6], "expirity":+inputArray[10], "type":"string"}
    
    if (!pxConf) {
      
      replicas.forEach(replica=>{
        replica.write(data.toString())
      })

      conn.write("+OK\r\n")
    }else{
      setTimeout( ()=>{ 
        delete storage[inputArray[4]] 
      }, storage[inputArray[4]].expirity)
      
      conn.write("+OK\r\n")
    }
  }
  
  if (get) {
    if(storage[inputArray[4]]!=undefined) {
      conn.write(`$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`)
    }else{conn.write("$-1\r\n")}
  }
  
  // WAIT configuration
  const wait = inputArray[2] == "wait"

  if(wait){

    replicas.forEach(replica => {
      replica.write("*3\r\n$8\r\nREPLCONF\r\n$6\r\nGETACK\r\n$1\r\n*\r\n")
    })
    setTimeout(()=>{
      if(replicasStorage["replWithAck"]["quantity"]==0){
        conn.write(`:${replicas.length}\r\n`)
        return 
      }

      if((replicasStorage["replWithAck"]["quantity"]==(+inputArray[4]))){
        conn.write(`:${(replicasStorage["replWithAck"]["quantity"])}\r\n`)
        replicasStorage["replWithAck"]["quantity"] = 0
      }else{ 
        setInterval(()=>{
          conn.write(`:${(replicasStorage["replWithAck"]["quantity"])}\r\n`)
          replicasStorage["replWithAck"]["quantity"] = 0
        }, (+inputArray[6]-1000))
      }
    },1000)
  }

  const type = inputArray[2]=="type"

  if(type){    
    let res = ``
    storage[inputArray[4]] != undefined ? res = `+${storage[inputArray[4]].type}\r\n` : res = `+none\r\n` 
    conn.write(res)
  }

  const xadd = inputArray[2]=="xadd"

  if(xadd){

    const fragments = inputArray[6].split("-")
    const milliSecondsTime = fragments[0]
    const sequenceNumber = fragments[1]

    if(inputArray[6]=="0-0"){
      conn.write("- ERR The ID specified in XADD must be greater than 0-0\r\n")
    }
    if(storage[inputArray[4]]!=undefined){
      storage[inputArray[4]].value.push([inputArray[6],inputArray[8],inputArray[10]])
    }else{
      storage[inputArray[4]] = {"value":[[inputArray[6],inputArray[8],inputArray[10]]],"expirity":"","type":"stream"}
    }

    const streamNames = Object.keys(storage).map(object=>{if(storage[object].type=="stream"){ return object }})
    const xaddIds = Object.values(storage).map(object=>{if(object.type=="stream"){ return object.value.map(info=> info[0] ) }})
    
    console.log(xaddIds, streamNames, storage)
    
    if((inputArray[4]==streamNames[-1])  && (milliSecondsTime==xaddIds[-1])) console.log(true)


    conn.write(`$${inputArray[6].length}\r\n${inputArray[6]}\r\n`)
  }

}