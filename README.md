

[![progress-banner](https://backend.codecrafters.io/progress/redis/b3622d92-558c-4b2c-8570-ccda1919109c)](https://app.codecrafters.io/users/codecrafters-bot?r=2qF)

> Todo esto es un proyecto hecho gracias a [codecrafters](https://app.codecrafters.io/), plataforma donde se ofrecen retos para desarrollar y adquirir conocimientos sobre temas fundamentales de computacion.

Redis es un almacén de estructuras de datos en memoria que se utiliza a menudo como base de datos, caché, corredor de mensajes y motor de streaming. En todo este documento se mostrara todas las instrucciones implementadas en el proyecto para la funcionalidad del servidor siguiendo protocolos de comunicacion y  una estructura modular.

## RESP
RESP (Redis Serialization Protocol) es un protocolo de comunicación para la transmisión de datos. Aunque fue realizado específicamente para Redis puede usarse en cualquier otro proyecto de software cliente-servidor y posee soporte para la serializacion de diferentes tipos de datos como enteros, cadenas de texto, arrays e inclusive caracteristicas para el manejo de errores, todos estos usados en este proyecto. [RESP](https://redis.io/docs/latest/develop/reference/protocol-spec/#resp-protocol-description)

## Implementaciones
Redis, por supuesto, es un sistema avanzado que lleva años en el mercado, por ende se hace tedioso replicar cada una de las funcionalidades disponibles dentro de este motor, sin embargo, a continuacion se presenta una lista de todo lo implementado en el proceso de creacion que permite a este motor ser totalmente capaz de manejar datos:
### [Comandos Basicos](https://github.com/jmoc3/Building-my-own-redis/blob/master/app/logicFunctions/commandManager.js)
#####  PING
Usado para validar el estado del servidor.
```bash
$ redis-cli PING
> PONG
```
##### ECHO
Recibe un solo argumento y lo retorna. Útil para pruebas y depuración.
```bash
$ redis-cli ECHO arroz
> Arroz
```
##### SET 
Define una llave a un valor.
```bash
$ redis-cli SET foo bar
> OK
```

###### PX ( Expirity )
Define un tiempo de vida a la llave definida.
```bash
$ redis-cli SET foo bar px 1000 # Expira en 1000 milisegundos
> OK
```

##### GET 
Retorna el valor de la llave especificada.
```bash
$ redis-cli GET foo 
> bar
```
##### Keys
Retorna todas las llaves existentes en la base de datos.
```bash
$ redis-cli KEYS *
1) foo
2) strawberry
```
##### Type
Retorna el tipo de valor almacenado en la llave especificada, puede retornar string, list, set, zset, hash, y stream.
```bash
$ redis-cli Type foo
> string
```
### Persistencia
Una de las caracteristicas de redis es la persistencia, referencia a la capacidad de escritura de datos en un almacenamiento duradero, como si se guardase dentro de un SSD. Por supuesto es una de las propiedades clave cuando se habla en una base de datos, por ende, propiedad incluida en este proyecto.

#### [RDB File config](https://github.com/jmoc3/Building-my-own-redis/blob/master/app/logicFunctions/fileReader.js)
Un archivo .rdb es un archivo de almacenamiento binario para datos tabulares (formato fila-columna) usada por redis para la importacion/exportacion de datos. Este archivo binarios suficiente para restaurar completamente el estado de redis.

Para la lectura solo se configura un par de parametros y se inicia el servidor de redis. 
```
--dir <dir> --dbfilename <filename>
```

### Replicacion
La replicación es la característica de redis que permite correr varias instancias de servidores redis con una actuando como "master" y las otras como "replicas". Todas las acciones realizadas por el master deberán ser replicadas hacia las réplicas, proporcionando así redundancia de datos, escalabilidad de lectura y una alta disponibilidad en caso de que el master falle.

##### ``--replicaof`` flag
El servidor creado asume el rol de "slave" y es identificado como réplica.
```
./your_program.sh --port 6380 --replicaof "localhost 6379"
```

##### INFO
Retorna información y estadísticas acerca del servidor de redis, información que puede ser selectiva si es pasada como parámetro.
```yaml
$ redis-cli INFO replication
# Replication
role:master
connected_slaves:0
master_replid:8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb
master_repl_offset:0
second_repl_offset:-1
repl_backlog_active:0
repl_backlog_size:1048576
repl_backlog_first_byte_offset:0
repl_backlog_histlen:
```
##### WAIT
Bloquea el cliente actual hasta que todos los comandos previos hayan sido exitosamente transferidos a al menos el mínimo de réplicas especificadas en los parámetros. En caso de que el tiempo especificado en el comando sea alcanzado, se retorna una respuesta, independientemente se hayan transferido o no los datos.
```
WAIT numreplicas timeout
```
### Redis Streams
Estructura de datos de redis que recibe varias entradas, se podria interpretar como un objeto de javascript o un diccionario en python. Un conjunto de pares llave-valor que es asignado a un unico ID.
```yaml
entries:
  - id: 1526985054069-0 # (ID of the first entry)
    temperature: 36 # (A key value pair in the first entry)
    humidity: 95 # (Another key value pair in the first entry)

  - id: 1526985054079-0 # (ID of the second entry)
    temperature: 37 # (A key value pair in the first entry)
    humidity: 94 # (Another key value pair in the first entry)

```

#### XADD
Agrega nuevos datos a un stream especifico. Si el stream no existe, lo crea.
```bash
$ redis-cli XADD stream_key 1526919030474-0 temperature 36 humidity 95
"1526919030474-0" # (ID of the entry created)
```
#### XRANGE
Toma dos argumentos: inicio y fin. Ambos son identificadores de entrada. El comando devuelve todas las entradas en el stream con IDs entre los IDs de inicio y fin. Este rango es «inclusivo», lo que significa que la respuesta incluirá entradas con IDs iguales a los IDs de inicio y fin.

```bash
$ redis-cli XADD some_key 1526985054069-0 temperature 36 humidity 95
"1526985054069-0" # (ID of the first added entry)
$ redis-cli XADD some_key 1526985054079-0 temperature 37 humidity 94
"1526985054079-0"
$ redis-cli XRANGE some_key 1526985054069 1526985054079
1) 1) 1526985054069-0
   2) 1) temperature
      2) 36
      3) humidity
      4) 95
2) 1) 1526985054079-0
   2) 1) temperature
      2) 37
      3) humidity
      4) 94
```
#### XREAD
Retorna los datos encontrados dentro de un stream desde un ID especificado, excluyendo este ID.

```bash
$ redis-cli XADD some_key 1526985054069-0 temperature 36 humidity 95
"1526985054069-0"
$ redis-cli XADD some_key 1526985054079-0 temperature 37 humidity 94
"1526985054079-0"
$ redis-cli XREAD streams some_key 1526985054069-0
1) 1) "some_key"
   2) 1) 1) 1526985054079-0
         2) 1) temperature
            2) 37
            3) humidity
            4) 94
```

#### BLOCK
Parametro opcional del comando XREAD que bloquea la instruccion por un tiempo para esperar nuevos datos de entrada.
```bash
$ redis-cli XREAD block 1000 streams some_key 1526985054069-0
```

### Transacciones
Las transacciones en redis permiten la ejecucion de un grupo de comandos en un solo paso. Cumple con ciertas reglas y esta centrado en un conjunto de comandos especificos para este funcionamiento:

 #### MULTI
Comando para iniciar una transacción. Cualquier instrucción posterior iniciada en la misma conexión estará en un estado "queue" hasta que la transacción sea ejecutada.
 ```bash
$ redis-cli 
> MULTI
OK
> SET foo 41
QUEUED
> INCR foo
QUEUED
```
 #### EXEC
 Ejecuta todas las instruccion puestas en "queue" en una transacción.
 ```bash
$ redis-cli
> MULTI
OK
> SET foo 41
QUEUED
> INCR foo
QUEUED
> EXEC
1) OK
2) (integer) 42
```
 #### DISCARD 
Descarta todos los comandos en "queue" de una transacción. 
```bash
$ redis-cli
> MULTI
OK
> SET foo 41
QUEUED
> DISCARD
OK
> DISCARD
(error) ERR DISCARD without MULTI
```
## Epílogo
Todo este proyecto fue hecho con JavaScript puro, 0 librerías, 0 frameworks, y es un gran reto personal que gracias a esfuerzo y cariño pude terminar, por supuesto, es bastante abierto a extensiones para implementaciones referentes a la manera en como internamente funciona y bastante abierto a retroalimentaciones que me permitan mejorar no solo como programador JavaScript/TypeScript sino también como programador de soluciones informáticas.

