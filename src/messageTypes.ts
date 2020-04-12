// Server to client messages

type ServerToClientMessage =
  LoginAccepted | LoginRejected | BadRequest |
  ReadyStateChange | StartGame |
  RequestQuestChoice | QuestChoiceReceived | QuestResults

interface LoginAccepted {
  type: "loginAccepted"
  username: string
  admin: boolean
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

interface QuestChoiceReceived {
  type: "questChoiceReceived"
}

interface QuestResults {
  type: "questResults"
  successes: number
  failures: number
}

// Client to server messages

type ClientToServerMessage = LoginRequest | SetReadyState | RequestGameStart | PickQuest | QuestChoice

interface LoginRequest {
  type: "loginRequest"
  username: string
}

interface SetReadyState {
  type: "setReadyState"
  ready: boolean
}

interface RequestGameStart {
  type: "requestGameStart"
}

interface PickQuest {
  type: "pickQuest"
  players: string[]
}

interface QuestChoice {
  type: "questChoice"
  choice: "success" | "failure"
}
