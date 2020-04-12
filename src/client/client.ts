const loginSection = document.getElementById("login-section")! as HTMLDivElement
const loginUsernameInput = document.getElementById("login-username")! as HTMLInputElement
const loginButton = document.getElementById("login-button")! as HTMLButtonElement
const loginServerMessagesDiv = document.getElementById("login-server-messages")! as HTMLDivElement

const waitingRoomSection = document.getElementById("waiting-room-section")! as HTMLDivElement
const waitingRoomUsersDiv = document.getElementById("waiting-room-users")! as HTMLDivElement
const waitingRoomReadyButton = document.getElementById("waiting-room-ready")! as HTMLButtonElement
const waitingRoomRolesDiv = document.getElementById("waiting-room-roles")! as HTMLDivElement
const usePercivalInput = document.getElementById("use-percival")! as HTMLInputElement
const useMordredInput = document.getElementById("use-mordred")! as HTMLInputElement
const useMorganaInput = document.getElementById("use-morgana")! as HTMLInputElement
const useOberonInput = document.getElementById("use-oberon")! as HTMLInputElement
const useHelmetLoversInput = document.getElementById("use-helmet-lovers")! as HTMLInputElement
const waitingRoomStartGameButton = document.getElementById("waiting-room-start-game")! as HTMLButtonElement

const pickQuestSection = document.getElementById("pick-quest-section")! as HTMLDivElement
const pickQuestResultsDiv = document.getElementById("pick-quest-results")! as HTMLDivElement
const pickQuestPlayersDiv = document.getElementById("pick-quest-players")! as HTMLDivElement
const pickQuestButton = document.getElementById("pick-quest-button")! as HTMLButtonElement
const pickQuestKnowledgeDiv = document.getElementById("pick-quest-knowledge")! as HTMLDivElement
const pickQuestEndGameButton = document.getElementById("pick-quest-end-game")! as HTMLButtonElement

const questChoiceSection = document.getElementById("quest-choice-section")! as HTMLDivElement
const questChoiceSuccessButton = document.getElementById("quest-choice-success")! as HTMLButtonElement
const questChoiceFailureButton = document.getElementById("quest-choice-failure")! as HTMLButtonElement


type CurrentState = "login" | "waitingRoom" | "pickQuest" | "questChoice"

interface AppState {
  currentState: CurrentState
  username: string
  socket: WebSocket | null
  isAdmin: boolean
  loginState?: {
    loginErrorMessage?: string
  }
  waitingRoomState?: {
    ready: boolean
    readyStates: {
      [username: string]: boolean
    }
  }
  pickQuestState?: {
    players: string[]
    role: "good" | "evil" | "Merlin" | "Percival" | "a helmet lover" | "the assassin" | "Mordred" | "Morgana" | "Oberon"
    knowledge?: {
      [username: string]: string
    }
    previousResolution?: {
      successes: number
      failures: number
    }
  }
}

const appState: AppState = {
  currentState: "login",
  username: "",
  socket: null,
  isAdmin: false
}


render()


loginButton.addEventListener("click", () => {
  if (appState.currentState !== "login") {
    console.warn("Wrong state for login button!")
    return
  }

  const username = loginUsernameInput.value
  const socket = new WebSocket(`ws://${location.host}`)

  socket.addEventListener("error", () => {
    console.error("Couldn't connect!")
  })

  socket.addEventListener("close", () => {
    console.warn("Server closed the socket!")
    appState.currentState = "login"
    appState.username = ""
    appState.socket = null
    appState.isAdmin = false
    delete appState.loginState
    delete appState.waitingRoomState
    delete appState.pickQuestState

    render()
  })

  socket.addEventListener("open", () => {
    console.info("Connected!")
    socket.addEventListener("message", handleSocketMessages)
    appState.socket = socket
    send<LoginRequest>({ type: "loginRequest", username })
  })
})


waitingRoomReadyButton.addEventListener("click", () => {
  if (appState.currentState !== "waitingRoom") {
    console.warn("Wrong state for ready button!")
    return
  }

  console.info("Toggling ready state!")
  send<SetReadyState>({
    type: "setReadyState", ready: !appState.waitingRoomState!.ready
  })
})


waitingRoomStartGameButton.addEventListener("click", () => {
  if (appState.currentState !== "waitingRoom") {
    console.warn("Wrong state for starting the game!")
    return
  }

  if (appState.isAdmin === false) {
    console.warn("You're not an admin!")
    return
  }

  send<RequestGameStart>({
    type: "requestGameStart",
    percival: usePercivalInput.checked,
    mordred: useMordredInput.checked,
    morgana: useMorganaInput.checked,
    oberon: useOberonInput.checked,
    helmetLovers: useHelmetLoversInput.checked
  })
})


pickQuestButton.addEventListener("click", () => {
  if (appState.currentState !== "pickQuest") {
    console.warn("Wrong state for pick quest button!")
    return
  }

  const selectedPlayers = Array.from(pickQuestPlayersDiv.children).map(child => {
    const input = child.firstElementChild! as HTMLInputElement
    return { username: input.name, selected: input.checked }
  }).filter(user => user.selected).map(user => user.username)

  console.log(JSON.stringify(selectedPlayers))

  send<PickQuest>({ type: "pickQuest", players: selectedPlayers })
})


questChoiceSuccessButton.addEventListener("click", () => {
  if (appState.currentState !== "questChoice") {
    console.warn("Wrong state for succeeding a quest!")
    return
  }

  send<QuestChoice>({ type: "questChoice", choice: "success" })
})


questChoiceFailureButton.addEventListener("click", () => {
  if (appState.currentState !== "questChoice") {
    console.warn("Wrong state for failing a quest!")
    return
  }

  send<QuestChoice>({ type: "questChoice", choice: "failure" })
})


pickQuestEndGameButton.addEventListener("click", () => {
  if (appState.currentState !== "pickQuest") {
    console.warn("Invalid state to end the game!")
  }

  if (!appState.isAdmin) {
    console.warn("Only the admin can end the game!")
  }

  send<RequestGameEnd>({ type: "requestGameEnd" })
})


function handleSocketMessages(event: MessageEvent): void {
  const message: ServerToClientMessage = JSON.parse(event.data)

  switch (appState.currentState) {
    case "login":
      handleLoginMessage(message)
      break

    case "waitingRoom":
      handleWaitingRoomMessage(message)
      break

    case "pickQuest":
      handlePickQuestMessage(message)
      break

    case "questChoice":
      handleQuestChoiceMessage(message)
      break
  }

  render()


  function handleLoginMessage(message: ServerToClientMessage): void {
    switch (message.type) {
      case "loginAccepted":
        console.info("Login accepted!")
        appState.currentState = "waitingRoom"
        appState.username = message.username
        appState.isAdmin = message.admin
        send<SetReadyState>({ type: "setReadyState", ready: false })
        break

      case "loginRejected":
        console.warn("Login rejected!")
        appState.loginState = {
          loginErrorMessage: message.reason
        }
        break
    }
  }

  function handleWaitingRoomMessage(message: ServerToClientMessage): void {
    switch (message.type) {
      case "readyStateChange":
        console.info("Got a ready state change!")
        appState.waitingRoomState = {
          ready: message.readyStates[appState.username],
          readyStates: message.readyStates
        }
        break

      case "startGame":
        console.info("Game beginning!")
        appState.pickQuestState = {
          players: message.players,
          role: message.role,
          knowledge: message.knowledge
        }
        appState.currentState = "pickQuest"
        break
    }
  }

  function handlePickQuestMessage(message: ServerToClientMessage): void {
    switch (message.type) {
      case "requestQuestChoice":
        appState.currentState = "questChoice"
        break

      case "questResults":
        appState.currentState = "pickQuest"
        appState.pickQuestState = {
          ...appState.pickQuestState!,
          previousResolution: {
            successes: message.successes,
            failures: message.failures
          }
        }
        break
    }
  }

  function handleQuestChoiceMessage(message: ServerToClientMessage): void {
    switch (message.type) {
      case "questChoiceReceived":
        appState.currentState = "pickQuest"
        break

      case "questResults":
        appState.currentState = "pickQuest"
        appState.pickQuestState = {
          ...appState.pickQuestState!,
          previousResolution: {
            successes: message.successes,
            failures: message.failures
          }
        }
        break
    }
  }
}


function render(): void {
  loginSection.hidden = true
  waitingRoomSection.hidden = true
  waitingRoomStartGameButton.hidden = true
  waitingRoomRolesDiv.hidden = true
  pickQuestSection.hidden = true
  pickQuestEndGameButton.hidden = true
  questChoiceSection.hidden = true

  switch (appState.currentState) {
    case "login":
      loginSection.hidden = false
      if (appState.loginState?.loginErrorMessage) {
        loginServerMessagesDiv.innerHTML = `<p>${appState.loginState.loginErrorMessage}</p>`
      }
      break

    case "waitingRoom":
      waitingRoomSection.hidden = false
      if (appState.isAdmin) {
        waitingRoomStartGameButton.hidden = false
        waitingRoomRolesDiv.hidden = false
      }
      if (appState.waitingRoomState) {
        const readyStates = appState.waitingRoomState.readyStates
        const readyStateHTML = Object.keys(readyStates)
          .reduce<string>(
            (html, username) => html + `<p>${username}: ${readyStates[username] ? "Ready" : "Not Ready"}</p>`,
            ""
          )

        waitingRoomUsersDiv.innerHTML = readyStateHTML
        waitingRoomReadyButton.innerHTML = readyStates[appState.username] ? "I'm Not Ready!" : "I'm Ready!"
      }
      break

    case "pickQuest":
      pickQuestSection.hidden = false
      if (appState.isAdmin) {
        pickQuestEndGameButton.hidden = false
      }
      if (appState.pickQuestState) {
        const pickQuestHTML = appState.pickQuestState.players
          .map(username => `<p><input type="checkbox" name="${username}">${username}</p>`)
          .join("")

        pickQuestPlayersDiv.innerHTML = pickQuestHTML

        let pickQuestKnowledge = `<p>You are ${appState.pickQuestState.role}.</p>`
        if (appState.pickQuestState.knowledge) {
          for (const username in appState.pickQuestState.knowledge) {
            pickQuestKnowledge += `<p>${username} is ${appState.pickQuestState.knowledge[username]}</p>`
          }
        }

        pickQuestKnowledgeDiv.innerHTML = pickQuestKnowledge

        let pickQuestResults = ""
        if (appState.pickQuestState.previousResolution) {
          const { successes, failures } = appState.pickQuestState.previousResolution
          pickQuestResults += `<p>Successes: ${successes}<br />Failures: ${failures}</p>`
        }
        pickQuestResultsDiv.innerHTML = pickQuestResults
      }
      break

    case "questChoice":
      questChoiceSection.hidden = false
      break
  }
}


function send<T extends ClientToServerMessage>(message: T): void {
  if (!appState.socket) {
    throw new Error("No socket!")
  }

  if (appState.socket.readyState !== WebSocket.OPEN) {
    throw new Error(`Socket isn't open! State: ${appState.socket.readyState}`)
  }

  appState.socket.send(JSON.stringify(message))
}
