const net = require("net");
const fs = require("fs")
// You can use print statements as follows for debugging, they'll be visible when running tests.

const storage = {}
const config = {}

const server = net.createServer((connection) => {

  // Setting of the default paths of execution passing in the terminal for tests
  const arguments = process.argv;

  config["dir"] = arguments[3] ?? null
  config["dbfilename"] = arguments[5] ?? null
  const path = `${config["dir"]}/${config["dbfilename"]}`
  
  console.log(config)
  connection.on("data", (clientInput)=>{

    const existFile = fs.existsSync(path)
    if(config["dir"]!=null && existFile){
        
      const file = fs.readFileSync(`${config["dir"]}/${config["dbfilename"]}`)
      // const file = fs.readFileSync(`/home/jmoc/Desktop/codecrafters-redis-javascript/app/regular_set.rdb`)
      let fbFound = false
      let hashTableSizeDefined = false
      let keysWithExpirityDefined = false
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
        
        if(!hashTableSizeDefined){
          config["hashTableSize"] = String.fromCharCode(hexValue).charCodeAt(0)
          hashTableSizeDefined = true
          continue
        }
        
        if(!keysWithExpirityDefined){
          config["keysWithExpirityDefined"] = String.fromCharCode(hexValue).charCodeAt(0)
          keysWithExpirityDefined = true
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
            pair[2] = new Date(Number(BigInt("0x" + pair[2].match(/../g).reverse().join(""))))

            console.log(Date.now() < pair[2], pair[2])
            if(Date.now() < pair[2]){
              storage[pair[0]] = {"value":pair[1], "expirity":pair[2]}
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
    if (clientInput.toString()=="*1\r\n$4\r\nPING\r\n") return connection.write("$4\r\nPONG\r\n")

    const input = Buffer.from(clientInput).toString().toLowerCase()
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
      console.log(config[inputArray[6]])
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

    // Default response to something wrong
    return connection.write('$-1\r\n') 
    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(6379, "127.0.0.1", ()=>{
    console.log("Server connected")
});
