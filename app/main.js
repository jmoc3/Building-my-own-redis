import net from "net"
import fs from "fs"

import { config } from "./dbConfig.js";
import { slaveConnect } from "./slaveConnection.js";
import { fileReader } from "./fileReader.js";
import { commandManager } from "./commandManager.js";
// You can use print statements as follows for debugging, they'll be visible when running tests.

const args = process.argv;
const portId = args.indexOf("--port")
const PORT = portId == -1 ? 6379 : process.argv[portId + 1]

const replicaofId = args.indexOf("--replicaof")
const replicaofBool = replicaofId != -1

const role = replicaofBool ? "slave" : "master"
config["info"]["replication"]["role"] = role

if(replicaofBool){
  const slaveConf = process.argv[replicaofId + 1].split(" ")
  slaveConnect({ host:slaveConf[0], port:slaveConf[1] })
}

const dirId = args.indexOf("--dir")
const dbfilenameId = args.indexOf("--dbfilename")

config["dir"] = dirId == -1 ? null : process.argv[dirId + 1]
config["dbfilename"] = dbfilenameId == -1 ? null : process.argv[dbfilenameId + 1]
const path = `${config["dir"]}/${config["dbfilename"]}`

const server = net.createServer((connection) => {

  connection.on("data", (data)=>{
    const existFile = fs.existsSync(path)
    if(config["dir"]!=null && existFile){
      fileReader(path)
    }
    commandManager({conn: connection, data})
  })

  connection.on("end", ()=>{
      console.log("Someone out")
  })

});

server.listen(PORT, "127.0.0.1", ()=>{
    console.log("Server connected")
});
