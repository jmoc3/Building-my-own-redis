import net from "net"

import { config } from "../dbConfig.js"
import { storage } from "../storage.js"

export const slaveConnect = ({host, port}) => {
  const slave = net.createConnection({ host, port }, ()=>{
    console.log("Slave Up")
    slave.write("*1\r\n$4\r\nPING\r\n")
  })
        
  let actualCommandIndex = 0
  const command = ["*3\r\n$8\r\nREPLCONF\r\n$14\r\nlistening-port\r\n$4\r\n6380\r\n",
                  "*3\r\n$8\r\nREPLCONF\r\n$4\r\ncapa\r\n$6\r\npsync2\r\n",
                  "*3\r\n$5\r\nPSYNC\r\n$1\r\n?\r\n$2\r\n-1\r\n"]

  const sendNextCommand = (connection, commands) => {
    if(actualCommandIndex<commands.length){
      connection.write(commands[actualCommandIndex])
      actualCommandIndex++
      return 
    }
    return connection.end()
  }

  slave.on("data", (data)=>{   
    if(actualCommandIndex<3){ return sendNextCommand(slave,command) } 
          
    const input = data.toString().toLowerCase()
    const inputArray =  input.split("\r\n")  
          
    const indexGetack = inputArray.indexOf("getack") == -1 ? -1 : (inputArray.indexOf("getack") - 4)
    const fileIncluded = (input.indexOf("+fullresync") != -1 ) || (input.indexOf("redis")!=-1)
    console.log(inputArray, fileIncluded, "a")
    if(!fileIncluded){
      if(inputArray.indexOf("getack")==-1){
        config["info"]["replication"]["master_repl_offset"]+=new TextEncoder().encode(inputArray.join("\r\n")).byteLength  
      }else{
        if(inputArray.slice(0,indexGetack).length!=0){
          config["info"]["replication"]["master_repl_offset"]+=new TextEncoder().encode(inputArray.slice(0,indexGetack).join("\r\n") + "\r\n").byteLength
        }
      }
    }    
          
    // SET and GET configuration with expirity
    const set = inputArray[2] == "set"
    const get = inputArray[2] == "get"
    const pxConf = inputArray[8] == "px"
    if (set) {
      const eachSet = []

      for(let i=0;i<inputArray.length;i+=7){
        eachSet.push(inputArray.slice(i,i + 7))
      }

      eachSet.pop()
      eachSet.forEach(request =>{     
        storage[request[4]] = {"value":request[6], "expirity":+request[10], "type":"string"}
                  
        if (!pxConf) {    
        slave.write(`*3\r\n$8\r\nREPLCONF\r\n$3\r\nACK\r\n$${config["info"]["replication"]["master_repl_offset"].toString().length}\r\n${config["info"]["replication"]["master_repl_offset"]}\r\n`)
        }else{ 
          setTimeout( ()=>{ 
              delete storage[request[4]] 
              }, storage[request[4]].expirity)
          slave.write(`*3\r\n$8\r\nREPLCONF\r\n$3\r\nACK\r\n$${config["info"]["replication"]["master_repl_offset"].toString().length}\r\n${config["info"]["replication"]["master_repl_offset"]}\r\n`)
        }
      })
    }
        
    if (get) {
      if(storage[inputArray[4]]!=undefined) {
        slave.write(`$${storage[inputArray[4]].value.length}\r\n${storage[inputArray[4]].value}\r\n`)
      }else{ slave.write("$-1\r\n") }
    }
    const getackfId = inputArray.indexOf("getack")

    if (getackfId!=-1){
      slave.write(`*3\r\n$8\r\nREPLCONF\r\n$3\r\nACK\r\n$${config["info"]["replication"]["master_repl_offset"].toString().length}\r\n${config["info"]["replication"]["master_repl_offset"]}\r\n`)
      config["info"]["replication"]["master_repl_offset"]+=37 
    }  
  })
}