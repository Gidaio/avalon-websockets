// Server to client messages

type ServerToClientMessage = UsernameRequest | LoginAccepted | ReadyStateChange | StartGame

interface UsernameRequest {
  type: "usernameRequest"
}

interface LoginAccepted {
  type: "loginAccepted"
}

interface ReadyStateChange {
  type: "readyStateChange"
  readyStates: {
    [username: string]: boolean
  }
}

interface StartGame {
  type: "startGame"
  players: string[]
}

// Client to server messages

type ClientToServerMessage = UsernameResponse | SetReadyState

interface UsernameResponse {
  type: "usernameResponse"
  username: string
}

interface SetReadyState {
  type: "setReadyState"
  ready: boolean
}