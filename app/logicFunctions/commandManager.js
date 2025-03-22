import { storage } from "../storage.js";
import { replicasStorage } from "../replicas.js";
import { config } from "../dbConfig.js";

const respConverter = (buffer) => {
    stringArray = buffer.toString().slice(0,-1).split(" ")
    inputConverted = stringArray.map(e => `$${e.length}\r\n${e.toLowerCase()}\r\n`)
    return `*${stringArray.length}\r\n${inputConverted.join("")}`
  }

  // Refactorizar el codigo!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const replicas = replicasStorage["list"]
export const commandManager = ({conn,data}) => {
  // const input = respConverter(clientInput)
  const input = data.toString().toLowerCase()
  const inputArray =  input.split("\r\n")   

  storage['history'].push(inputArray[2])
  if(((storage['multi'][0]==true) && (inputArray[2]!="exec")) && (storage['multi'][1]==conn)){
    storage['queue'].push(input)
    return "+QUEUED\r\n"
  }
  
  // PING configuration
  if (input=="*1\r\n$4\r\nping\r\n") return "$4\r\nPONG\r\n"
  
  // Default CONFIG GET configuration
  const confGet = (inputArray[2]=="config") && (inputArray[4] == "get")
    
  if(confGet) {
    if((config[inputArray[6]]== null) || (config[inputArray[6]]== undefined) ){
      return '$-1\r\n'
    }
    return `*2\r\n$${inputArray[6].length}\r\n${inputArray[6]}\r\n$${config[inputArray[6]].length}\r\n${config[inputArray[6]]}\r\n`
  }
  
  // KEYS configuration
  const keys = inputArray[2] == "keys"
  if(keys){
    const {history,queue, multi, ...restStorage} = storage
    const keyWords = Object.keys(restStorage)
    const lenKeyWords = keyWords.map(e => e.length) 
    let res = ""
    for(let i=0;i<keyWords.length;i++){
      res += `$${lenKeyWords[i]}\r\n${keyWords[i]}\r\n`
    }

    return `*${keyWords.length}\r\n${res}`
  }
  
  // INFO configuration
  const infoRep = inputArray[2] == "info"
  const especifics = "replication"

  if(infoRep){
    const resWithoutResp = Object.keys(config["info"][especifics]).map( property => `${property}:${config["info"][especifics][property]}` )
    const resArray = resWithoutResp.map(e=>`+${e}`)
    
    return `${resArray.join("")}\r\n`
  }

  // REPLCONF configuration
  const replconfList = (inputArray[2] == "replconf") && (inputArray[4] == "listening-port")
  const replconfCapa = (inputArray[2] == "replconf") && (inputArray[4] == "capa")

  if(replconfList || replconfCapa){
    return "+OK\r\n"
  }

  // PSYNC configuration
  const psync = inputArray[2] == "psync"
  if(psync){

    return `+FULLRESYNC ${config["info"]["replication"]["master_replid"]} ${config["info"]["replication"]["master_repl_offset"]}\r\n`
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
    return res
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

      return "+OK\r\n"
    }else{
      setTimeout( ()=>{ 
        delete storage[inputArray[4]] 
      }, storage[inputArray[4]].expirity)
      
      return "+OK\r\n"
    }
  }
  
  if (get) {
    if(storage[inputArray[4]]!=undefined) {
      return `$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`
    }else{ return "$-1\r\n" }
  }
  
  // WAIT configuration
  const wait = inputArray[2] == "wait"

  if(wait){

    replicas.forEach(replica => {
      replica.write("*3\r\n$8\r\nREPLCONF\r\n$6\r\nGETACK\r\n$1\r\n*\r\n")
    })
    setTimeout(()=>{
      if(replicasStorage["replWithAck"]["quantity"]==0){
        return `:${replicas.length}\r\n`
      }

      if((replicasStorage["replWithAck"]["quantity"]==(+inputArray[4]))){
        const res = `:${(replicasStorage["replWithAck"]["quantity"])}\r\n`
        replicasStorage["replWithAck"]["quantity"] = 0
        return res
      }else{ 
        setInterval(()=>{
          const res = `:${(replicasStorage["replWithAck"]["quantity"])}\r\n`
          replicasStorage["replWithAck"]["quantity"] = 0
          return res
        }, (+inputArray[6]-1000))
      }
    },1000)
  }

  const type = inputArray[2]=="type"

  if(type){    
    let res = ``
    storage[inputArray[4]] != undefined ? res = `+${storage[inputArray[4]].type}\r\n` : res = `+none\r\n` 
    return res
  }

  const xadd = inputArray[2]=="xadd"
  if(xadd){

    const fragments = inputArray[6].split("-")
    const milliSecondsTime = +fragments[0]

    if(inputArray[6]=="0-0"){ return "-ERR The ID specified in XADD must be greater than 0-0\r\n" }
    const autoId = fragments[1]=="*"

    if(inputArray[6]=="*"){
      const unixTime = Date.now()
      storage[inputArray[4]] = {"value":[[`${unixTime}-0`,inputArray[8],inputArray[10]]],"expirity":"","type":"stream"}
      return `$${`${unixTime}-0`.length }\r\n${unixTime}-0\r\n`
    }
    
    let id;
    if(storage[inputArray[4]]==undefined){
      autoId ? id=0 : id=inputArray[6].split("-")[1]
      if(fragments[0]=="0" && inputArray[6].includes("*")){
        id=1
      }else{
        id=id
      }
      storage[inputArray[4]] = {"value":[[`${milliSecondsTime}-${id}`,inputArray[8],inputArray[10]]],"expirity":"","type":"stream"}
      return `$${`${milliSecondsTime}-${id}`.length}\r\n${milliSecondsTime}-${id}\r\n`
    }

    const xaddIds = storage[inputArray[4]].value.map(info => info[0])   
    
    if((xaddIds[xaddIds.length-1] == inputArray[6]) || (+xaddIds[xaddIds.length-1].split("-")[0] > milliSecondsTime)){ 
      return "-ERR The ID specified in XADD is equal or smaller than the target stream top item\r\n"
    }
    autoId ? id=0 : id=inputArray[6].split("-")[1]
    xaddIds[xaddIds.length-1].split("-")[0]==fragments[0] ? id=(+xaddIds[xaddIds.length-1].split("-")[1]+1) : id=id
    
    storage[inputArray[4]].value.push([`${milliSecondsTime}-${id}`,inputArray[8],inputArray[10]])  
    return `$${`${milliSecondsTime}-${id}`.length}\r\n${milliSecondsTime}-${id}\r\n`
  }

  const xrange = inputArray[2]=="xrange"
  if(xrange){
    const start = inputArray[6] == "-" ? "0-0" : inputArray[6]
    const end = inputArray[8] == "+" ? `${storage[inputArray[4]].value.length}-${storage[inputArray[4]].value.length}` : inputArray[8] 

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
    
    return res
  }
  
  const xread = inputArray[2]=="xread"
  if(xread){
    // const start = inputArray[6] == "-" ? "0-0" : inputArray[8]
    if(inputArray[4]=="block"){
      let time = +inputArray[6]
      
      if(inputArray[6]=="0"){
        time = 2000
      }
      
      const lastLength = storage[inputArray[10]].value.length
      setTimeout(()=>{
        console.log("Founded", storage)
        const currentLength = storage[inputArray[10]].value.length
        // Error de Tiempo, Hacer algo con la funcion xadd
        if(lastLength==currentLength){ return "$-1\r\n" }
        
        if(storage[inputArray[10]]){
          const resObject = storage[inputArray[10]].value.slice(-1)
          const resFormat = resObject.map(array => 
            `*2\r\n$${array[0].length}\r\n${array[0]}\r\n*2\r\n$${array[1].length}\r\n${array[1]}\r\n$${array[2].length}\r\n${array[2]}\r\n`
          )

          const res = `*1\r\n*2\r\n$${inputArray[10].length}\r\n${inputArray[10]}\r\n*${resFormat.length}\r\n${resFormat.join("")}`

          return res
        }
      },time)
      return
    }

    if((inputArray.length%2)!=0){
      return "$-1\r\n"
    }

    const values = Object.keys(storage).map((element,index) => {
      if(inputArray.includes(element)){
        return [element,inputArray.indexOf(element)]
      }
    }).filter(element => element!=undefined)

    let res = ""
    values.forEach(key => {
      const resObject = storage[key[0]].value.filter(object => {
        if((object[0]>=inputArray[key[1]+1])){
          return object
        }
      })

      const resFormat = resObject.map(array => 
        [`$${array[0].length}\r\n${array[0]}\r\n`, `*${array.slice(1).length}\r\n${array.slice(1).map(element => `$${element.length}\r\n${element}\r\n`).join("")}`]
      )

      const resFormatProtocol = resFormat.map(array => `$${inputArray[key[1]].length}\r\n${inputArray[key[1]]}\r\n*1\r\n*${array.length}\r\n${array.join("")}` )
      res += `*2\r\n${resFormatProtocol.join("")}`
      
    })
    
    const finalRes = `*${values.length}\r\n${res}`
    return finalRes
  }

  const incr = inputArray[2]=="incr"
  if(incr){
    
    if(!Object.keys(storage).includes(inputArray[4])){
      storage[inputArray[4]] = {"value":"1", "expirity":"", "type":"string"}
      return ":1\r\n"
    }
    
    if(isNaN(storage[inputArray[4]].value)){
      return "-ERR value is not an integer or out of range\r\n"
    }

    storage[inputArray[4]].value =  `${+storage[inputArray[4]].value + 1}`
    return `:${storage[inputArray[4]].value}\r\n`
  }

  const multi = inputArray[2]=="multi"
  if(multi){
    storage['multi']=[true,conn]
    return "+OK\r\n"
  }

  const exec = inputArray[2]=="exec"
  if(exec){
    if(storage['multi'][0]==false){
      return "-ERR EXEC without MULTI\r\n"
    }
    
    if(storage['history'].slice(-2)[0]=="multi"){
      storage['multi'][0]=false
      return "*0\r\n"
    }

    storage['multi']=[false,conn]
    const queue = []
    storage['queue'].forEach(command =>{
      queue.push(commandManager({conn,data:command}))
    })
    console.log(queue)
    const res = `*${queue.length}\r\n${queue.join("")}`
    
    storage['queue'] = undefined
    return res
  }
}