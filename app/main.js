const net = require("net");
const fs = require("fs")
// You can use print statements as follows for debugging, they'll be visible when running tests.

const respConverter = (buffer) => {
  stringArray = buffer.toString().slice(0,-1).split(" ")
  inputConverted = stringArray.map(e => `$${e.length}\r\n${e.toLowerCase()}\r\n`)
  return `*${stringArray.length}\r\n${inputConverted.join("")}`
}

const storage = {}

const arguments = process.argv;

const portId = arguments.indexOf("--port")
const PORT = portId == -1 ? 6379 : process.argv[portId + 1]

const replicaofId = arguments.indexOf("--replicaof")
const role = replicaofId == -1 ? "master" : "slave"
const masterServerConf = process.argv[replicaofId + 1].split(" ")

const portArray = [PORT, masterServerConf[1]].filter(e=> e!=undefined)
const hostArray = ["127.0.0.1", masterServerConf[0]].filter(e=> e!=undefined)

const config = {
  "hosts":hostArray,
  "ports":portArray,
  "info":{
    "replication":{
      "role":role,
      "connected_slaves":0,
      "master_replid":"8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb",
      "master_repl_offset":0,
      "second_repl_offset":-1,
      "repl_backlog_active":0,
      "repl_backlog_size":1048576,
      "repl_backlog_first_byte_offset":0,
      "repl_backlog_histlen":null
    }
  }
}

const dirId = arguments.indexOf("--dir")
const dbfilenameId = arguments.indexOf("--dbfilename")

config["dir"] = dirId == -1 ? null : process.argv[dir + 1]
config["dbfilename"] = dbfilenameId == -1 ? null : process.argv[dbfilenameId + 1]
const path = `${config["dir"]}/${config["dbfilename"]}`

console.log(config["ports"])
config["ports"].forEach((port,i) => {

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
      
      // ECHO configuration
      const echo = inputArray[2] == "echo"
      if(echo){
        const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
        return connection.write(res)
      }      

      // Default CONFIG GET configuration
      const confGet = (inputArray[2]=="config") && (inputArray[4] == "get")
      
      if(confGet) {
        if((config[inputArray[6]]== null) || (config[inputArray[6]]== undefined) ){
          return connection.write('$-1\r\n') 
        }
        return connection.write(`*2\r\n$${inputArray[6].length}\r\n${inputArray[6]}\r\n$${config[inputArray[6]].length}\r\n${config[inputArray[6]]}\r\n`)
      }
      
      // SET and GET configuration with expirity
      const set = inputArray[2] == "set"
      const get = inputArray[2] == "get"
      const pxConf = inputArray[8] == "px"

      if (set) {
      storage[inputArray[4]] = {"value":inputArray[6], "expirity":+inputArray[10]}
      if (!pxConf) {    
        return connection.write("+OK\r\n")
      }
        
      setTimeout( ()=>{ 
          delete storage[inputArray[4]] 
        }, storage[inputArray[4]].expirity)    
        return connection.write("+OK\r\n")
      }
          
      if (get) {
        if(storage[inputArray[4]]!=undefined) return connection.write(`$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`)
      }
      
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

      const infoRep = inputArray[2] == "info"
      const especifics = "replication"

      if(infoRep){
        
        // const resWithoutResp = Object.keys(config["info"][especifics]).map( property => `${property}:${config["info"][especifics][property]}` )
        // const resArray = resWithoutResp.map(e=>`$${e.length}\r\n${e}\r\n`)
        // const res = `*${resArray.length}\r\n${resArray.join("")}`
        // console.log(resArray)      
        
        return connection.write(`$11\r\nrole:${config["info"][especifics]['role']}\r\n`)
      }
      
      // Default response to something wrong
      return connection.write('$-1\r\n') 
    })
      
      connection.on("end", ()=>{
        console.log("Someone out")
      })
    });

  server.listen(port, config["hosts"][i], ()=>{
    console.log("Server connected")
  });
})
