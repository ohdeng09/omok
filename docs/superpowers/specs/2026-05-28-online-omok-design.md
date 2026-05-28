# Online Omok Game Design

Date: 2026-05-28

## Goal

Build a browser-based Omok game that is fun with friends online first, while still being enjoyable alone through staged AI challenges. The first version should be playable quickly, easy to share with acquaintances, and structured so account, database, and larger ranking features can be added later.

Priority order:

1. Friend online matches
2. Solo staged play with scoring
3. Optional arcade rules and party elements

## First Release Scope

The first release is a deployable web game with a local development mode. Players can enter a nickname, create a room, share a room code, and play a real-time 1:1 Omok match. The game includes rematch flow, match results, basic group-friendly scoring, and solo play against level-based AI.

In scope:

- Nickname entry
- Create room and join room by code
- Real-time two-player Omok turns
- Server-side turn validation and win detection
- Rematch and room reset
- Local browser record for player stats
- Friend-focused league elements: streaks, rival record, revenge bonus
- Mission score system for online and solo play
- Solo AI levels: easy, normal, hard
- Stage map for solo progression
- Optional party mode room setting for special rules
- Responsive browser UI for desktop and mobile

Out of scope for the first release:

- Full account login
- Persistent cloud database
- Friend list management
- Global matchmaking
- Season-wide public leaderboard
- Paid items, cosmetics, or monetization
- Chat moderation and user reporting

## Gameplay

### Online Core

The online flow starts on a compact lobby screen. A player enters a nickname, then chooses either "Create Room" or "Join Room". Creating a room produces a short code that can be shared with friends. Joining requires that code.

When two players are present, the server assigns black and white. Black moves first. The board is locked for the player whose turn it is not. Each move is sent to the server, validated, applied to the shared game state, and broadcast to both clients.

The server is the authority for:

- Whether a move is legal
- Whose turn it is
- Whether five stones are connected
- Whether the board is full
- Whether a rematch has started

### Friend League Features

The game should make repeated matches between acquaintances feel meaningful without requiring accounts in the first release.

Features:

- Win and loss record stored locally by nickname and opponent nickname
- Current streak and best streak
- Rival display when the same two nicknames meet repeatedly
- Revenge bonus when a player wins immediately after losing to the same opponent
- Weekly-style session scoreboard for the current browser

Because there is no login or cloud database in the first release, these records are not authoritative. The UI should present them as lightweight fun stats, not official ranked data.

### Mission Scoring

Each match can award score beyond simply winning. The same mission engine supports online and solo play.

Example missions:

- Win the match
- Block an immediate four-in-a-row threat
- Create an open four
- Win after being behind in threat count
- Win within a target number of moves
- Force a rematch win after a loss

Mission scoring should be visible after each match. The result screen shows win/loss, score gained, completed missions, streak changes, and rematch controls.

### Solo Mode

Solo mode uses the same Omok rules and scoring system. It adds a stage map and AI difficulty progression.

Solo levels:

- Easy: prioritizes simple winning moves and blocks obvious threats
- Normal: evaluates short tactical lines and blocks common traps
- Hard: evaluates multiple candidate lines and prioritizes attack/defense balance

Solo progression:

- Stage map with unlocked levels
- Score targets per stage
- Bonus missions per stage
- Local progress saved in the browser
- "Today's Challenge" can be added as a deterministic daily board seed later

### Party Mode

Party mode is optional and selected when creating a room or starting a solo stage. It should never replace the fair default Omok mode.

First party rules:

- Hint: show one suggested move a limited number of times
- Forbidden cell event: one random empty cell is blocked for a turn
- Blind timer: briefly hides threat indicators, not stones

Party mode must remain understandable. It should add variety without making the board unreadable or making wins feel random.

## User Interface

The first screen should be the actual game lobby, not a marketing landing page. The game should feel practical and social, with the board always easy to read.

Main screens:

- Lobby: nickname, create room, join room, solo play
- Room: room code, player list, mode settings, ready/start state
- Game: board, turn indicator, players, timer/status, missions, score
- Result: winner, mission score, streak, rival stats, rematch
- Solo map: levels, difficulty, score goals, progress
- Settings: sound, board theme, party mode toggle

Visual direction:

- Clean board-first layout
- Warm wood board with high-contrast black and white stones
- Compact HUD that does not cover the board
- Friend stats shown as small panels, not large marketing cards
- Mobile layout stacks HUD below the board

## Architecture

Use a browser frontend plus a small real-time server.

Recommended first implementation stack:

- Frontend: Vite with plain TypeScript, HTML, and CSS
- Server: Node.js with Express and WebSocket
- Shared game logic: TypeScript modules used by both client and server where practical
- Storage: browser localStorage for first-release progress and fun stats

The game should separate simulation from rendering.

Core modules:

- `game/rules`: board representation, move validation, win detection
- `game/scoring`: mission detection and score calculation
- `game/ai`: solo AI move selection
- `server/rooms`: room lifecycle, player seats, rematch state
- `server/realtime`: WebSocket messages and broadcasts
- `client/ui`: screen transitions and DOM rendering
- `client/board`: board drawing and input mapping
- `client/storage`: local stats and solo progress

## Data Flow

### Online Match

1. Client connects to the server.
2. Player creates or joins a room.
3. Server sends room state to all clients in the room.
4. Player clicks an empty board cell.
5. Client sends `placeStone` with room id, player id, row, and column.
6. Server validates the move against authoritative room state.
7. Server updates the board, turn, missions, and result state.
8. Server broadcasts the new game state.
9. Clients render the board and HUD from the received state.

### Solo Match

1. Client creates a local game state.
2. Player places a stone.
3. Rules engine validates and applies the move.
4. AI chooses and applies a response move.
5. Scoring engine checks missions and result.
6. Client saves progress and stats locally.

## Error Handling

Expected cases:

- Room code not found: show a clear error and keep the player in the lobby.
- Room already full: show a clear error and offer to create a new room.
- Player disconnects: keep the room alive briefly and show reconnect/waiting state.
- Illegal move: server rejects it and client re-syncs from authoritative state.
- WebSocket failure: show offline state and allow return to lobby.
- Local storage unavailable: keep game playable but skip saved progress.

No first-release feature should require permanent account data to keep functioning.

## Testing

Unit tests:

- Win detection in all directions
- Illegal move rejection
- Board full draw
- Mission scoring cases
- AI returns legal moves
- Room state transitions

Integration tests:

- Create room and join room
- Two clients exchange turns
- Rematch resets the board
- Disconnect state is shown

Browser verification:

- Desktop board layout
- Mobile board layout
- Online lobby flow
- Solo stage flow
- Result and rematch flow

## Implementation Notes

Start with the minimum online loop: room creation, joining, placing stones, win detection, and rematch. Then add friend league stats, mission scoring, solo AI, and party mode in that order.

The first version should prefer working gameplay over permanent identity. Account login and cloud ranking can be added once the core friend loop is fun.
