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
        const echoTrue = inputArray.includes("echo")

        if(echoTrue){
            const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
            connection.write(res)
        }

        
        

    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(6379, "127.0.0.1", ()=>{
    console.log("Server connected")
});
