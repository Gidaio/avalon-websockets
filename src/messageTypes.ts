// Server to client messages

type ServerToClientMessage = LoginAccepted | LoginRejected | BadRequest | ReadyStateChange | StartGame

interface LoginAccepted {
  type: "loginAccepted"
  username: string
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
  role: "good" | "evil" | "Merlin" | "the assassin"
  knowledge?: {
    [username: string]: string
  }
}

interface RequestQuestChoice {
  type: "requestQuestChoice"
}

interface QuestResults {
  type: "questResults"
  successes: number
  failures: number
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

interface SendQuest {
  type: "sendQuest"
  players: string[]
}

interface SendQuestChoice {
  type: "sendQuestChoice"
  choice: "success" | "failure"
}
