import { config } from "../dbConfig.js"
import { storage } from "../storage.js"
import fs from "fs"

export const fileReader = (path) =>{

  const file = fs.readFileSync(path)

  let fbFound = false
  let hashTableSize = false
  let keysWithExpirity = false
  let spaceBewtweenWords = false

  let indexStringEnd = 0
  let indexExpirityEnd = 0
  let keyString = ""
  let expirity = ""
  let pair = []
  
  for(let i=0;i<file.length;i++){
    const hexValue =  file[i].toString(16).padStart(2,"0")
    if(hexValue == "ff") { break }
    if(hexValue == "fb") { fbFound = true; continue }
    if(!fbFound) continue        
    
    if(!hashTableSize){
      config["hashTableSize"] = String.fromCharCode(hexValue).charCodeAt(0)
      hashTableSize = true
      continue
    }
    
    if(!keysWithExpirity){
      config["keysWithExpirity"] = String.fromCharCode(hexValue).charCodeAt(0)
      keysWithExpirity = true
      continue
    }
    
    if(hexValue=="fc"){ indexExpirityEnd = i+9; continue } 
    if(i<indexExpirityEnd){ expirity += hexValue; continue }
    if(i==indexExpirityEnd) { pair[2] = expirity; expirity = ""; continue }
    if(hexValue=="00") { continue }
    if (file[i-1].toString(16).padStart(2,"0") == "00") { spaceBewtweenWords = true }
    
    if(spaceBewtweenWords){
      indexStringEnd = i + String.fromCharCode(file[i]).charCodeAt(0)
      spaceBewtweenWords = false
      continue
    }

    keyString += String.fromCharCode(file[i])
    
    if (i==indexStringEnd){
      if (pair[0]!=undefined) { 
        
        pair[1] = keyString 
        if(pair[2]!=undefined){

          pair[2] = new Date(Number(BigInt("0x" + pair[2].match(/../g).reverse().join("")))) ?? ""
          if(Date.now() < pair[2]){ storage[pair[0]] = {"value":pair[1], "expirity":pair[2]} }

        }else{ storage[pair[0]] = {"value":pair[1], "expirity":""}}
  
        pair=[] 

      } else { pair[0] = keyString }
      
      keyString = ""
      spaceBewtweenWords = true
      continue
    }            
  }
} 
