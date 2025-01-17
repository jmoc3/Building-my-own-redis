const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {

    const data = {}

    connection.on("data", (clientInput)=>{

        if (clientInput.toString()=="*1\r\n$4\r\nPING\r\n") return connection.write("$4\r\nPONG\r\n")

        const input = Buffer.from(clientInput).toString().toLowerCase()
        const inputArray =  input.split("\r\n")
        console.log(inputArray)
        const echoTrue = inputArray[3] == "echo"

        if(echoTrue){
            const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
            return connection.write(res)
        }

        const setTrue = inputArray[3] == "set"
        const getTrue = inputArray[3] == "get"
        
        if (setTrue) {
            data[inputArray[5]] = inputArray[7]
            return connection.write("+OK\r\n")
        }
        if (getTrue) return connection.write(`$${data[inputArray[5]].length}\r\n${data[inputArray[5]]}\r\n`)



    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(6379, "127.0.0.1", ()=>{
    console.log("Server connected")
});
