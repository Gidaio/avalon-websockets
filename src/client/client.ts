const loginSection = document.getElementById("login-section")! as HTMLDivElement
const loginUsernameInput = document.getElementById("login-username")! as HTMLInputElement
const loginButton = document.getElementById("login-button")! as HTMLButtonElement
const loginServerMessagesDiv = document.getElementById("login-server-messages")! as HTMLDivElement

const readySection = document.getElementById("ready-section")! as HTMLDivElement
const readyUsersDiv = document.getElementById("ready-users")! as HTMLDivElement
const readyToggleButton = document.getElementById("ready-toggle") as HTMLButtonElement


interface State {
  username: string
  socket: WebSocket | null
  ready: boolean
}
const state: State = {
  username: "",
  socket: null,
  ready: false
}


handleLogin()


function handleLogin(): void {
  loginSection.hidden = false
  readySection.hidden = true

  let loggingIn = false

  loginButton.addEventListener("click", handleLoginButtonClick)

  function handleLoginButtonClick(): void {
    if (loggingIn) { return }
    loggingIn = true

    const username = loginUsernameInput.value

    const socket = new WebSocket(`ws://${location.host}`)

    socket.addEventListener("error", () => {
      console.error("Couldn't connect via WebSocket!")
      loggingIn = false
    })

    socket.addEventListener("close", () => {
      console.warn("Server closed the WebSocket!")
      loggingIn = false
    })

    socket.addEventListener("open", () => {
      console.info("Connected!")
    })

    socket.addEventListener("message", handleLoginMessages)

    function handleLoginMessages(event: MessageEvent): void {
      const message: ServerToClientMessage = JSON.parse(event.data)

      switch (message.type) {
        case "usernameRequest": {
          console.info(`Server requesting username, sending ${username}...`)
          send<UsernameResponse>(socket, { type: "usernameResponse", username })
          break
        }

        case "loginAccepted": {
          console.info("Login accepted!")
          loginButton.removeEventListener("click", handleLoginButtonClick)
          socket.removeEventListener("message", handleLoginMessages)
          state.username = username
          state.socket = socket
          handleReadyRoom()
          break
        }
      }
    }
  }
}


function handleReadyRoom(): void {
  loginSection.hidden = true
  readySection.hidden = false

  readyToggleButton.addEventListener("click", toggleReadyState)
  state.socket!.addEventListener("message", handleReadyRoomMessages)
  console.info("Sending initial ready state...")
  send<SetReadyState>(state.socket!, {
    type: "setReadyState",
    ready: state.ready
  })

  function toggleReadyState() {
    console.info("Toggling ready state...")
    send<SetReadyState>(state.socket!, {
      type: "setReadyState",
      ready: !state.ready
    })
  }

  function handleReadyRoomMessages(event: MessageEvent): void {
    const message: ServerToClientMessage = JSON.parse(event.data)

    switch (message.type) {
      case "readyStateChange": {
        console.info("Got a ready state change!")

        const readyStateHTML = Object.keys(message.readyStates).reduce<string>((html, username) => {
          if (username === state.username) {
            return html
          } else {
            return html + `<p>${username}: ${message.readyStates[username]}</p>`
          }
        }, "")

        state.ready = message.readyStates[state.username]
        readyToggleButton.innerHTML = state.ready ? "Not Ready" : "Ready"
        readyUsersDiv.innerHTML = readyStateHTML
        break
      }
    }
  }
}


function send<T extends ClientToServerMessage>(socket: WebSocket, message: T): void {
  socket.send(JSON.stringify(message))
}
