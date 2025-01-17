const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {

    connection.on("data", (data)=>{
        const input = data.toString().toLowerCase().trim() 
        const echoTrue = input.split(" ").includes("echo")

        if(echoTrue){
            const res = input.split(" ").filter((_,i)=>i>input.split(" ").indexOf("echo")).join(" ")
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
