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

  connection.on("data", (clientInput)=>{

    if(config["dir"]!=null){
      const file = fs.readFileSync(`${config["dir"]}/${config["dbfilename"]}`)
      // const file = fs.readFileSync(`/home/jmoc/Desktop/codecrafters-redis-javascript/app/regular_set.rdb`)
      let fbFound = false
      for(i=0;i<file.length;i++){
        const hexValue =  file[i].toString(16).padStart(2,"0")
        if(hexValue == "fb") { fbFound = true; continue }
        if(!fbFound) continue

        config["hashTableSize"] = String.fromCharCode(hexValue).charCodeAt(0)
        break
        console.log(hexValue)
      }

      console.log(config)
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
      storage[inputArray[4]] = inputArray[6]
      if (!pxConf) {    
        return connection.write("+OK\r\n")
      }
        
        setTimeout( ()=>{ 
            delete storage[inputArray[4]] 
        }, +inputArray[10])

        return connection.write("+OK\r\n")
      }
      
    if (get) {
      if(storage[inputArray[4]]!=undefined) return connection.write(`$${storage[inputArray[4]].length}\r\n${storage[inputArray[4]]}\r\n`)
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
