const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
const storage = {}

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {


  connection.on("data", (clientInput)=>{

    if (clientInput.toString()=="*1\r\n$4\r\nPING\r\n") return connection.write("$4\r\nPONG\r\n")

      const input = Buffer.from(clientInput).toString().toLowerCase()
      const inputArray =  input.split("\r\n")
      const echo = inputArray[2] == "echo"

      if(echo){
        const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
        return connection.write(res)
      }

      const set = inputArray[2] == "set"
      const get = inputArray[2] == "get"
      if (set) {

        storage[inputArray[4]] = inputArray[6]
        return connection.write("+OK\r\n")

      }

      if (get) return connection.write(`$${storage[inputArray[4]].length}\r\n${storage[inputArray[4]]}\r\n` || '$-1\r\n')

      const pxConf = inputArray[8] == "px"

    
      if (pxConf) {
        console.log(storage[inputArray[4]])
        setTimeout( ()=>{ 
            delete storage[inputArray[4]] 
            console.log(storage[inputArray[4]])
        }, +inputArray[10])
    }

    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(6379, "127.0.0.1", ()=>{
    console.log("Server connected")
});
