const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {

    connection.on("data", (data)=>{
        const input = Buffer.from(data).toString().toLowerCase()
        const inputArray =  input.split("\r\n").slice(0,-1) 
        const echoTrue = inputArray.includes("echo")
        console.log(inputArray)
        if(echoTrue){
            const res = inputArray.filter((_,i)=>i>inputArray.indexOf("echo")).join("\r\n")
            console.log(res)
            connection.write("$"+res.length+"\r\n"+res+"\r\n")
        }
    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(6379, "127.0.0.1", ()=>{
    console.log("Server connected")
});
