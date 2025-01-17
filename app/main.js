const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {

    connection.on("data", (data)=>{
        const input = Buffer.from(data).toString().toLowerCase() 
        const echoTrue = input.split("\r\n").includes("echo")
        console.log(input.split("\r\n").slice(0,-1))
        if(echoTrue){
            const res = input.split("\r\n").filter((_,i)=>i>input.split("\r\n").indexOf("echo")).join("\r\n")
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
