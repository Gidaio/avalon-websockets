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
  state: "waiting" | "pickingQuest" | "resolvingQuest"
  usernames: string[]
  users: Users
  resolvingQuestState?: {
    successes: number
    failures: number
    waitingOn: string[]
  }
}

interface Users {
  [username: string]: {
    socket: WebSocket
    isReady: boolean
    alignment?: "good" | "evil"
    role?: "Merlin" | "the assassin"
  }
}

const PLAYER_DISTRIBUTIONS: { [playerCount: number]: [number, number] } = {
  5: [3, 2],
  6: [4, 2],
  7: [4, 3],
  8: [5, 3],
  9: [6, 3],
  10: [6, 4]
}

const state: State = {
  state: "waiting",
  usernames: [],
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
        if (state.usernames.length < 10) {
          console.info(`Accepting login for ${message.username}.`)
          username = message.username
          state.usernames.push(username)
          state.users[username] = { socket, isReady: false }
          send<LoginAccepted>(socket, { type: "loginAccepted", username })
        } else {
          send<LoginRejected>(socket, { type: "loginRejected", reason: "Too many players." })
        }
      } else {
        send<LoginRejected>(socket, { type: "loginRejected", reason: "Game has already begun." })
      }

      return
    } else if (username === "") {
      send<BadRequest>(socket, { type: "badRequest", error: "Not logged in!" })
      return
    }

    switch (state.state) {
      case "waiting":
        handleWaitingRoomMessage(message)
        break

      case "pickingQuest":
        handlePickingQuestMessage(message)
        break

      case "resolvingQuest":
        handleResolvingQuestMessage(message)
        break
    }
  })

  function handleWaitingRoomMessage(message: ClientToServerMessage) {
    switch (message.type) {
      case "setReadyState": {
        state.users[username].isReady = message.ready
        sendToAll<ReadyStateChange>({
          type: "readyStateChange",
          readyStates: state.usernames.reduce<{ [username: string]: boolean }>((allUsers, thisUsername) => {
            return {
              ...allUsers,
              [thisUsername]: state.users[thisUsername].isReady
            }
          }, {})
        })

        const everyoneReady = Object.values(state.users).every(({ isReady }) => isReady)
        if (everyoneReady) {
          console.info("Everyone's ready!")
          if (state.usernames.length >= 5) {
            startGame()
            state.state = "pickingQuest"
          }
        }
      }
    }

    function startGame() {
      const distribution = PLAYER_DISTRIBUTIONS[state.usernames.length]
      const alignments: Array<"good" | "evil"> = [...Array(distribution[0]).fill("good"), ...Array(distribution[1]).fill("evil")]

      for (const username in state.users) {
        const index = Math.floor(Math.random() * alignments.length)
        const alignment = alignments.splice(index, 1)[0]
        state.users[username].alignment = alignment
      }

      const goodPlayers = state.usernames.filter(username => state.users[username].alignment === "good")
      state.users[goodPlayers[Math.floor(Math.random() * goodPlayers.length)]].role = "Merlin"

      const evilPlayers = state.usernames.filter(username => state.users[username].alignment === "evil")
      state.users[evilPlayers[Math.floor(Math.random() * evilPlayers.length)]].role = "the assassin"

      for (const username in state.users) {
        const user = state.users[username]
        let knowledge
        if (user.role) {
          if (user.role === "Merlin") {
            knowledge = state.usernames.filter(username => state.users[username].alignment === "evil")
              .reduce<{ [username: string]: "evil" }>((players, username) => ({ ...players, [username]: "evil" }), {})
          }
        }

        const startGameMessage: StartGame = {
          type: "startGame",
          players: state.usernames,
          role: user.role! || user.alignment!,
          knowledge
        }

        send<StartGame>(state.users[username].socket, startGameMessage)
      }
    }
  }

  function handlePickingQuestMessage(message: ClientToServerMessage) {
    switch (message.type) {
      case "pickQuest":
        state.state = "resolvingQuest"
        state.resolvingQuestState = {
          successes: 0,
          failures: 0,
          waitingOn: message.players
        }

        for (const waitingOnUsername of message.players) {
          send<RequestQuestChoice>(state.users[waitingOnUsername].socket, { type: "requestQuestChoice" })
        }

        break
    }
  }

  function handleResolvingQuestMessage(message: ClientToServerMessage) {
    switch (message.type) {
      case "questChoice":
        if (!state.resolvingQuestState) {
          console.warn("State is bad somehow!")
          return
        }

        const usernameIndex = state.resolvingQuestState.waitingOn.findIndex(waitingOnUsername => waitingOnUsername === username)
        if (usernameIndex === -1) {
          console.warn(`We're not waiting on ${username}...?!`)
          return
        }

        send<QuestChoiceReceived>(state.users[username].socket, { type: "questChoiceReceived" })

        state.resolvingQuestState.waitingOn.splice(usernameIndex, 1)

        message.choice === "failure" ? state.resolvingQuestState.failures++ : state.resolvingQuestState.successes++

        if (state.resolvingQuestState.waitingOn.length === 0) {
          sendToAll<QuestResults>({
            type: "questResults",
            successes: state.resolvingQuestState.successes,
            failures: state.resolvingQuestState.failures
          })

          state.state = "pickingQuest"
          delete state.resolvingQuestState
        }

        break
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
