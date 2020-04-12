// Server to client messages

type ServerToClientMessage = LoginAccepted | LoginRejected | BadRequest | ReadyStateChange | StartGame

interface LoginAccepted {
  type: "loginAccepted"
}

interface LoginRejected {
  type: "loginRejected"
  reason: string
}

interface BadRequest {
  type: "badRequest"
  error: string
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

type ClientToServerMessage = LoginRequest | SetReadyState

interface LoginRequest {
  type: "loginRequest"
  username: string
}

interface SetReadyState {
  type: "setReadyState"
  ready: boolean
}
