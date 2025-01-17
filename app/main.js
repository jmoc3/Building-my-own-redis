const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {

    connection.on("data", (data)=>{
        console.log(data.toString())
        if (data.toString()=="*1\r\n$4\r\nPING\r\n") return connection.write("$2\r\nPONG\r\n")

        const input = Buffer.from(data).toString().toLowerCase()
        const inputArray =  input.split("\r\n")
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
