import express from "express"
import { createServer } from "http"
import WebSocket from "ws"

const app = express()
const server = createServer(app)
const wsServer = new WebSocket.Server({ server })

app.use("/", express.static("out/client"))
app.use("/", express.static("html"))

server.listen(8000, () => {
  console.info("HTTP listening!")
})

wsServer.on("listening", () => {
  console.info("WebSockets listening!")
})


interface Users {
  [username: string]: {
    socket: WebSocket
    isReady: boolean
  }
}

const users: Users = {}


wsServer.on("connection", socket => {
  handleNewConnection(socket)
})


function handleNewConnection(socket: WebSocket): void {
  console.info("New connection")
  send<UsernameRequest>(socket, { type: "usernameRequest" })

  socket.on("message", data => {
    const message: ClientToServerMessage = JSON.parse(data.toString())

    switch (message.type) {
      case "usernameResponse": {
        console.info(`Accepting login for ${message.username}`)
        send<LoginAccepted>(socket, { type: "loginAccepted" })
        socket.removeAllListeners()
        users[message.username] = {
          socket,
          isReady: false
        }
        handleReadyEvents(message.username)
        break
      }
    }
  })
}


function handleReadyEvents(username: string): void {
  users[username].socket.on("message", data => {
    const message: ClientToServerMessage = JSON.parse(data.toString())

    switch (message.type) {
      case "setReadyState": {
        users[username].isReady = message.ready
        sendToAll<ReadyStateChange>({
          type: "readyStateChange",
          readyStates: Object.keys(users).reduce<{ [username: string]: boolean }>((allUsers, username) => {
            return {
              ...allUsers,
              [username]: users[username].isReady
            }
          }, {})
        })

        const everyoneReady = Object.values(users).every(({ isReady }) => isReady)
        if (everyoneReady) {
          console.info("Everyone's ready!")
        }
      }
    }
  })
}


function sendToAll<T extends ServerToClientMessage>(message: T): void {
  Object.values(users).forEach(({ socket }) => {
    send<T>(socket, message)
  })
}


function send<T extends ServerToClientMessage>(socket: WebSocket, message: T): void {
  if (socket.readyState !== WebSocket.OPEN) {
    console.warn("Socket not open; state:", socket.readyState)
    return
  }

  socket.send(JSON.stringify(message))
}
