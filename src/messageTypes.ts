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
  role: "good" | "evil" | "Merlin" | "Percival" | "a helmet lover" | "the assassin" | "Mordred" | "Morgana" | "Oberon"
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

type ClientToServerMessage = LoginRequest | SetReadyState | RequestGameStart | PickQuest | QuestChoice | RequestGameEnd

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
  percival: boolean
  mordred: boolean
  morgana: boolean
  oberon: boolean
  helmetLovers: boolean
}

interface PickQuest {
  type: "pickQuest"
  players: string[]
}

interface QuestChoice {
  type: "questChoice"
  choice: "success" | "failure"
}

interface RequestGameEnd {
  type: "requestGameEnd"
}
