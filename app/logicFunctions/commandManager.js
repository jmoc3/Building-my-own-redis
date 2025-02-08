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
    const milliSecondsTime = +fragments[0]

    if(inputArray[6]=="0-0"){
      conn.write("-ERR The ID specified in XADD must be greater than 0-0\r\n")
    }
    const autoId = fragments[1]=="*"
    
    if(inputArray[6]=="*"){
      const unixTime = Date.now()
      storage[inputArray[4]] = {"value":[[`${unixTime}-0`,inputArray[8],inputArray[10]]],"expirity":"","type":"stream"}
      conn.write(`$${`${unixTime}-0`.length }\r\n${unixTime}-0\r\n`)
      return
    }
    
    let id;
    if(storage[inputArray[4]]==undefined){
      autoId ? id=0 : id=inputArray[6].split("-")[1]
      fragments[0]=="0" ? id=1 : id=id
      console.log(milliSecondsTime, id)
      storage[inputArray[4]] = {"value":[[`${milliSecondsTime}-${id}`,inputArray[8],inputArray[10]]],"expirity":"","type":"stream"}
      conn.write(`$${`${milliSecondsTime}-${id}`.length}\r\n${milliSecondsTime}-${id}\r\n`)
      return
    }
    
    const xaddIds = storage[inputArray[4]].value.map(info => info[0])   
    if((xaddIds[xaddIds.length-1] == inputArray[6]) || (+xaddIds[xaddIds.length-1].split("-")[0] > milliSecondsTime)){ 
      conn.write("-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n")
      return
    }

    autoId ? id=0 : id=inputArray[6].split("-")[1]
    xaddIds[xaddIds.length-1].split("-")[0]==fragments[0] ? id=(+xaddIds[xaddIds.length-1].split("-")[1]+1) : id=id

    storage[inputArray[4]].value.push([`${milliSecondsTime}-${id}`,inputArray[8],inputArray[10]])  
      conn.write(`$${`${milliSecondsTime}-${id}`.length}\r\n${milliSecondsTime}-${id}\r\n`)
    
  }

  const xrange = inputArray[2]=="xrange"
  if(xrange){
    const start = inputArray[6] == "-" ? "0-0" : inputArray[6]
    const end = inputArray[8] == "+" ? `${storage[inputArray[4]].value.length}-0` : inputArray[8] 

    const resObject = storage[inputArray[4]].value.filter(object => {
      if((object[0]>=start) && (object[0]<=end)){
        return object
      }
    })

    const resFormat = resObject.map(array => 
      [`$${array[0].length}\r\n${array[0]}\r\n`, `*${array.slice(1).length}\r\n${array.slice(1).map(element => `$${element.length}\r\n${element}\r\n`).join("")}`]
    )

    const resFormatProtocol = resFormat.map(array => `*${array.length}\r\n${array.join("")}` )
    const res = `*${resFormat.length}\r\n${resFormatProtocol.join("")}`
    
    conn.write(res)
  }

  const xread = inputArray[2]=="xread"
  if(xread){
    // const start = inputArray[6] == "-" ? "0-0" : inputArray[8]

    const resObject = storage[inputArray[6]].value.filter(object => {
      if((object[0]>=inputArray[8])){
        return object
      }
    })

    const resFormat = resObject.map(array => 
      [`$${array[0].length}\r\n${array[0]}\r\n`, `*${array.slice(1).length}\r\n${array.slice(1).map(element => `$${element.length}\r\n${element}\r\n`).join("")}`]
    )

    const resFormatProtocol = resFormat.map(array => `$${inputArray[6].length}\r\n${inputArray[6]}\r\n*${array.length}\r\n${array.join("")}` )
    const res = `*1\r\n*2\r\n${resFormatProtocol.join("")}`
    console.log(res,resFormatProtocol)
    conn.write(res)

  }

}