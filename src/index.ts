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


interface State {
  state: "waiting" | "proposingQuest" | "resolvingQuest"
  users: Users
}

interface Users {
  [username: string]: {
    socket: WebSocket
    isReady: boolean
  }
}

const state: State = {
  state: "waiting",
  users: {}
}


wsServer.on("connection", socket => {
  handleNewConnection(socket)
})


function handleNewConnection(socket: WebSocket): void {
  console.info("New connection")
  let username = ""

  socket.on("message", data => {
    const message: ClientToServerMessage = JSON.parse(data.toString())

    if (message.type === "loginRequest") {
      if (state.state === "waiting") {
        console.info(`Accepting login for ${message.username}.`)
        username = message.username
        state.users[username] = { socket, isReady: false }
        send<LoginAccepted>(socket, { type: "loginAccepted" })
      } else {
        send<LoginRejected>(socket, { type: "loginRejected", reason: "Game has already begun." })
      }

      return
    } else if (username === "") {
      send<BadRequest>(socket, { type: "badRequest", error: "Not logged in!" })
    }

    switch (state.state) {
      case "waiting":
        handleWaitingRoomMessages(message)
        break

      case "proposingQuest":
        // handleQuestPropositionMessages(message)
        break

      case "resolvingQuest":
        // handleQuestResolutionMessages(message)
        break
    }
  })

  function handleWaitingRoomMessages(message: ClientToServerMessage) {
    switch (message.type) {
      case "setReadyState": {
        state.users[username].isReady = message.ready
        sendToAll<ReadyStateChange>({
          type: "readyStateChange",
          readyStates: Object.keys(state.users).reduce<{ [username: string]: boolean }>((allUsers, thisUsername) => {
            return {
              ...allUsers,
              [thisUsername]: state.users[thisUsername].isReady
            }
          }, {})
        })

        const everyoneReady = Object.values(state.users).every(({ isReady }) => isReady)
        if (everyoneReady) {
          console.info("Everyone's ready!")
          if (Object.keys(state.users).length >= 5) {
            sendToAll<StartGame>({ type: "startGame", players: Object.keys(state.users) })
            state.state = "proposingQuest"
          }
        }
      }
    }
  }
}


function sendToAll<T extends ServerToClientMessage>(message: T): void {
  Object.values(state.users).forEach(({ socket }) => {
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
