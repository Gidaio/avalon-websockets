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
  optionalRoles: {
    percival: boolean
    mordred: boolean
    morgana: boolean
    oberon: boolean
    helmetLovers: boolean
  }
  resolvingQuestState?: {
    successes: number
    failures: number
    waitingOn: string[]
  }
}

interface Users {
  [username: string]: {
    socket: WebSocket
    isAdmin: boolean
    isReady: boolean
    alignment?: "good" | "evil"
    role?: "Merlin" | "Percival" | "the assassin" | "Mordred" | "Morgana" | "Oberon" | "a helmet lover"
    knowledge?: {
      [username: string]: string
    }
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
  users: {},
  optionalRoles: {
    percival: false,
    mordred: false,
    morgana: false,
    oberon: false,
    helmetLovers: false
  }
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
        if (!state.usernames.includes(message.username)) {
          if (state.usernames.length < 10) {
            console.info(`Accepting login for ${message.username}.`)
            username = message.username
            state.usernames.push(username)
            state.users[username] = { socket, isAdmin: state.usernames.length === 1, isReady: false }
            send<LoginAccepted>(socket, { type: "loginAccepted", username, admin: state.users[username].isAdmin })
          } else {
            send<LoginRejected>(socket, { type: "loginRejected", reason: "Too many players." })
          }
        } else {
          send<LoginRejected>(socket, { type: "loginRejected", reason: "Username taken." })
        }
      } else if (state.state === "pickingQuest" && state.usernames.includes(message.username)) {
        console.info(`Reconnecting ${message.username}...`)
        username = message.username
        const user = state.users[username]
        user.socket = socket
        send<LoginAccepted>(socket, { type: "loginAccepted", username, admin: state.users[username].isAdmin })
        send<StartGame>(socket, {
          type: "startGame",
          players: state.usernames,
          role: user.role || user.alignment!,
          knowledge: user.knowledge
        })
      } else {
        send<LoginRejected>(socket, { type: "loginRejected", reason: "Game has already begun." })
      }

      return
    } else if (username === "") {
      send<BadRequest>(socket, { type: "badRequest", error: "Not logged in!" })
      return
    }

    if (message.type === "requestGameEnd") {
      if (!state.users[username].isAdmin) {
        send<BadRequest>(socket, { type: "badRequest", error: "Admin only message." })
        return
      }

      state.state = "waiting"
      state.usernames = []
      state.users = {}

      wsServer.clients.forEach(socket => {
        socket.removeAllListeners()
        socket.close()
      })

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
          readyStates: state.usernames.reduce<{ [username: string]: boolean }>((allUsers, thisUsername) => ({
            ...allUsers,
            [thisUsername]: state.users[thisUsername].isReady
          }), {})
        })

        break
      }

      case "requestGameStart": {
        if (!state.users[username].isAdmin) {
          send<BadRequest>(state.users[username].socket, { type: "badRequest", error: "Not admin." })
          return
        }

        const everyoneReady = Object.values(state.users).every(({ isReady }) => isReady)
        if (everyoneReady) {
          console.info("Everyone's ready!")

          state.optionalRoles.percival = message.percival
          state.optionalRoles.mordred = message.mordred
          state.optionalRoles.morgana = message.morgana
          state.optionalRoles.oberon = message.oberon
          state.optionalRoles.helmetLovers = message.helmetLovers

          if (state.usernames.length >= 5) {
            startGame()
            state.state = "pickingQuest"
          }
        }

        break
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
      const merlinIndex = Math.floor(Math.random() * goodPlayers.length)
      const merlinUsername = goodPlayers.splice(merlinIndex, 1)[0]
      state.users[merlinUsername].role = "Merlin"

      if (state.optionalRoles.percival) {
        const percivalIndex = Math.floor(Math.random() * goodPlayers.length)
        const percivalUsername = goodPlayers.splice(percivalIndex, 1)[0]
        state.users[percivalUsername].role = "Percival"
      }

      const evilPlayers = state.usernames.filter(username => state.users[username].alignment === "evil")
      const assassinIndex = Math.floor(Math.random() * evilPlayers.length)
      const assassinUsername = evilPlayers.splice(assassinIndex, 1)[0]
      state.users[assassinUsername].role = "the assassin"

      if (state.optionalRoles.mordred) {
        const mordredIndex = Math.floor(Math.random() * evilPlayers.length)
        const mordredUsername = evilPlayers.splice(mordredIndex, 1)[0]
        state.users[mordredUsername].role = "Mordred"
      }

      if (state.optionalRoles.morgana) {
        const morganaIndex = Math.floor(Math.random() * evilPlayers.length)
        const morganaUsername = evilPlayers.splice(morganaIndex, 1)[0]
        state.users[morganaUsername].role = "Morgana"
      }

      if (state.optionalRoles.oberon) {
        const oberonIndex = Math.floor(Math.random() * evilPlayers.length)
        const oberonUsername = evilPlayers.splice(oberonIndex, 1)[0]
        state.users[oberonUsername].role = "Oberon"
      }

      for (const username in state.users) {
        const user = state.users[username]
        let knowledge
        if (user.role || user.alignment === "evil") {
          if (user.role === "Merlin") {
            knowledge = state.usernames
              .filter(knownUsername =>
                state.users[knownUsername].alignment === "evil" &&
                state.users[knownUsername].role !== "Mordred"
              )
              .reduce<{ [username: string]: "evil" }>(
                (players, knownUsername) => ({ ...players, [knownUsername]: "evil" }),
                {}
              )
          } else if (user.role === "Percival") {
            knowledge = state.usernames
              .filter(knownUsername =>
                state.users[knownUsername].role === "Merlin" ||
                state.users[knownUsername].role === "Morgana"
              )
              .reduce<{ [username: string]: "magical" }>(
                (players, knownUsername) => ({ ...players, [knownUsername]: "magical" }),
                {}
              )
          } else if (user.role === "Oberon") {
            console.info("Sucks to be you, Oberon!")
          } else {
            knowledge = state.usernames
              .filter(knownUsername =>
                state.users[knownUsername].alignment === "evil" &&
                state.users[knownUsername].role !== "Oberon" &&
                knownUsername !== username
              )
              .reduce<{ [username: string]: "evil" }>(
                (players, knownUsername) => ({ ...players, [knownUsername]: "evil" }),
                {}
              )
          }

          user.knowledge = knowledge
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
        if (message.players.length === 0) {
          send<BadRequest>(socket, { type: "badRequest", error: "You must specify some players!" })
        }

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
