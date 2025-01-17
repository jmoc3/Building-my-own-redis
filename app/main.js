const net = require("net");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {

    connection.on("data", (data)=>{
        
        const request = data.toString()
        const requestFormatted = JSON.stringify(request)
        const command = request.split("\r\n")
        console.log({command})
        switch (command[2]) {
            case "PING":
                return connection.write(`+PONG\r\n`);
            case "ECHO":
                const value = command[4]
                return connection.write(`$${value.length}\r\n${value}\r\n`);
            
            default:
                throw new Error(`Not implement ${requestFormatted}`)
        }
    
    })

    connection.on("end", ()=>{
        console.log("Someone out")
    })

});

server.listen(6379, "127.0.0.1", ()=>{
    console.log("Server connected")
});
