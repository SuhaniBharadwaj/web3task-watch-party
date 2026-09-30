# YouTube Watch Party

A real-time collaborative video watching web application where users can create or join synchronized watch rooms, enjoy synchronized YouTube video playback, and manage role-based permissions (Host, Moderator, Participant) over WebSockets.

**Live URL:** `<add after deployment>`

---

## Features

- **Real-Time Video Playback Synchronization**: Play, pause, seek, and video changes are broadcast instantaneously to all participants in a room.
- **Room-Based Architecture**: Unique, collision-free 6-character room codes with shareable invite links (`?room=CODE`) that automatically pre-fill the join form.
- **Role-Based Access Control**:
  - **Host**: Complete control over playback, loading videos, promoting/demoting moderators, removing participants, and transferring host privileges.
  - **Moderator**: Can play, pause, seek, and load new videos.
  - **Participant**: View-only mode with synchronized playback.
- **Authoritative Server Validation**: All permissions, payloads, and playback states are derived and verified on the server before state transitions. Client-sent roles are never trusted.
- **Late-Joiner Synchronization**: New participants automatically catch up to the current video and exact elapsed playback time upon joining.
- **Graceful Disconnect & Host Migration**: If a host leaves or disconnects, host status is automatically passed to the oldest moderator (or oldest participant), keeping the party alive.
- **Clean In-Memory Architecture**: No database dependencies for lightning-fast state transitions in server memory.
- **Zero Third-Party Wrapper Bloat**: Direct integration with the native YouTube IFrame Player API.

---

## Tech Stack

- **Frontend**: React (plain JavaScript / JSX), Vite.
- **Backend**: Node.js, Express.js (CommonJS `require`).
- **Real-Time Layer**: Socket.IO.
- **Video Player**: Native YouTube IFrame Player API.
- **Styling**: Modern, responsive plain CSS with CSS variables (no CSS framework).

---

## Folder Structure

```text
Web3Task-WatchParty/
├── package.json              # Root build & start scripts for Render deployment
├── README.md                 # Project documentation & architecture overview
├── AGENTS.md                 # Engineering guidelines & constraints
├── PROJECT_STATUS.md         # Milestone status tracking
├── server/
│   ├── package.json          # Express, Socket.IO, CORS, nodemon, socket.io-client (test)
│   ├── index.js              # Server entry point, HTTP server, Socket.IO event router
│   ├── rooms.js              # In-memory room store, state machine & playback calculations
│   ├── permissions.js        # Role capability definitions & can(role, action) helper
│   ├── validators.js         # Input sanitization and payload validation
│   └── tests/
│       └── socket-test.js    # Comprehensive automated test suite
└── client/
    ├── package.json          # React, Vite, Socket.IO client
    ├── vite.config.js        # Vite development server configuration
    ├── index.html            # Application entry mount point
    └── src/
        ├── main.jsx          # React DOM root
        ├── App.jsx           # App state & view router (Home vs. Room)
        ├── styles.css        # Responsive layout & design tokens
        ├── lib/
        │   ├── socket.js     # Shared Socket.IO client instance
        │   └── youtube.js    # URL parser & dynamic YouTube IFrame API loader
        ├── components/
        │   ├── VideoPlayer.jsx      # IFrame player with click-shield overlay
        │   ├── PlayerControls.jsx   # Custom controls with permission checks
        │   ├── ParticipantList.jsx  # Participant roster & host actions
        │   └── Toast.jsx            # Real-time event notifications
        └── pages/
            ├── Home.jsx      # Lobby: create room, join room, URL query handling
            └── Room.jsx      # Watch Party room: sync, controls, participants
```

---

## Local Setup and Running

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Install Dependencies

In the root directory, install server and client dependencies:

```bash
# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Run in Development Mode

Run the backend server and frontend development servers in two separate terminal windows:

#### Terminal 1 (Backend Server)
```bash
cd server
npm run dev
```
* Backend listens on `http://localhost:3001`
* Health check: `http://localhost:3001/health`

#### Terminal 2 (Frontend Client)
```bash
cd client
npm run dev
```
* Frontend runs on `http://localhost:5173`
* Open `http://localhost:5173` in multiple browser windows or incognito tabs to test.

### 3. Run Automated Tests

To execute the automated end-to-end socket test suite (runs on isolated test port `3101`):

```bash
cd server
npm test
```

---

## Environment Variables

### Backend (`/server/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Port the Express server listens on |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin in development |
| `NODE_ENV` | `development` | Set to `production` for unified static deployment |

### Frontend (`/client/.env`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_SERVER_URL` | `http://localhost:3001` | Socket.IO server URL (leave unset in production for same-origin) |

---

## Architecture Overview

```text
[ Browser 1 (Host) ]          [ Node.js + Socket.IO Server ]          [ Browser 2 (Participant) ]
        |                                    |                                    |
   (Clicks Play)                             |                                    |
        |--- emit('play', { time }) -------->|                                    |
        |                             (Validates role & room)                     |
        |                             (Updates video.playState)                   |
        |                             (Computes sync state)                       |
        |<-- emit('sync_state') -------------|--- emit('sync_state') ------------>|
        |                                    |                                    |
  (Video Plays)                              |                              (Video Plays)
```

### How WebSockets Fit the Flow
Traditional HTTP REST requests are unidirectional and polling-heavy. Real-time watch parties require millisecond-level synchronization across multiple concurrent participants. Socket.IO maintains a persistent full-duplex TCP WebSocket connection between each browser and the server.

#### Step-by-Step Flow: Host Clicks Play
1. **User Action**: The Host clicks the "Play" button in their custom controls.
2. **Client Event**: React reads the current local player timestamp and emits the `play` event with `{ currentTime }` over Socket.IO.
3. **Server Authentication & Permission**: The server retrieves the sender's session via `socket.id`, determines their current room, and checks `can(sender.role, 'play')`.
4. **State Transition**: The server validates the payload, updates the room's playback state to `'playing'`, records `baseTime` and `updatedAt: Date.now()`.
5. **Room Broadcast**: The server calculates the canonical current time and broadcasts the `sync_state` payload to all sockets in that room (`io.to(roomCode).emit('sync_state', ...)`).
6. **Remote Synchronization**: Both Host and Participant browsers receive `sync_state`. If the local player time drifts by $> 1.5$ seconds, it seeks to the authoritative time and invokes `player.playVideo()`.

### How Late Joiners Sync
When a new user joins an ongoing watch party via `join_room`:
1. The server calculates the video's effective current time in real time:
   $$\text{currentTime} = \text{baseTime} + \frac{\text{Date.now}() - \text{updatedAt}}{1000}$$
2. The server bundles this `syncState` directly into the `join_room` acknowledgement response.
3. The late joiner's browser receives the current video ID, exact elapsed time, and play state before the room view is even mounted, ensuring seamless catch-up with zero drift.

---

## Socket.IO Events Specification

| Event | Direction | Sender | Payload | Description |
| :--- | :--- | :--- | :--- | :--- |
| `create_room` | Client $\rightarrow$ Server | Anyone | `{ username }` | Creates room; sender becomes host; returns ack with `syncState`. |
| `join_room` | Client $\rightarrow$ Server | Anyone | `{ roomId, username }` | Joins room as participant; returns ack with current `syncState`. |
| `user_joined` | Server $\rightarrow$ Room | Server | `{ username, userId, role, participants }` | Broadcast to existing members when someone joins. |
| `leave_room` | Client $\rightarrow$ Server | Member | `{ roomId }` | Leaves room; triggers host migration if host leaves; ack `{ ok: true }`. |
| `user_left` | Server $\rightarrow$ Room | Server | `{ username, userId, participants }` | Broadcast when a user leaves or disconnects. |
| `sync_state` | Server $\rightarrow$ Room | Server | `{ playState, currentTime, videoId }` | Authoritative playback state broadcast on any change. |
| `play` | Client $\rightarrow$ Server | Host, Mod | `{ currentTime? }` | Resumes playback at specified or current elapsed time. |
| `pause` | Client $\rightarrow$ Server | Host, Mod | `{ currentTime? }` | Pauses playback at specified time. |
| `seek` | Client $\rightarrow$ Server | Host, Mod | `{ time }` | Seeks video to specified target timestamp (seconds). |
| `change_video` | Client $\rightarrow$ Server | Host, Mod | `{ videoId }` | Loads a new 11-char YouTube video ID (starts paused at 0:00). |
| `assign_role` | Client $\rightarrow$ Server | Host | `{ userId, role }` | Changes participant role between `moderator` and `participant`. |
| `role_assigned` | Server $\rightarrow$ Room | Server | `{ userId, username, role, participants }` | Broadcast when any participant's role changes. |
| `remove_participant` | Client $\rightarrow$ Server | Host | `{ userId }` | Ejects target user from the room. |
| `removed_from_room` | Server $\rightarrow$ Client | Server | `{ reason }` | Private notification to target user upon removal. |
| `participant_removed`| Server $\rightarrow$ Room | Server | `{ userId, username, participants }` | Broadcast to remaining members when someone is removed. |
| `transfer_host` | Client $\rightarrow$ Server | Host | `{ userId }` | Transfers host role to target member; host becomes moderator. |
| `room_error` | Server $\rightarrow$ Client | Server | `{ code, message }` | Private notification on validation or permission errors. |

---

## Role Permission Matrix

| Capability | Host | Moderator | Participant |
| :--- | :---: | :---: | :---: |
| Play / Pause | ✅ | ✅ | ❌ |
| Seek Position | ✅ | ✅ | ❌ |
| Change Video | ✅ | ✅ | ❌ |
| Promote / Demote Moderator | ✅ | ❌ | ❌ |
| Remove Participant | ✅ | ❌ | ❌ |
| Transfer Host Privileges | ✅ | ❌ | ❌ |
| Watch Synchronized Video | ✅ | ✅ | ✅ |

---

## Deployment (Render)

The application is configured to deploy as **a single unified Web Service** on Render, where Express serves the compiled React client build and handles Socket.IO on the same origin.

### Render Service Configuration:
- **Service Type**: Web Service
- **Environment**: Node
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `NODE_ENV`: `production`

---

## Known Limitations & Design Decisions

1. **In-Memory Volatility**: Room states are maintained in server memory (`Map`). Server restarts (or Render free-tier sleep cycles) will clear active rooms. This satisfies the MVP requirements while keeping performance optimal.
2. **Socket Session Identity**: A user's identity is tied to their `socket.id`. Refreshing the browser creates a new connection and counts as a new session.
3. **Direct YouTube API Integration**: To guarantee that participants cannot bypass playback permissions, the YouTube player controls are hidden (`controls: 0`) and protected by a transparent DOM shield, routing all actions through the server.
4. **Browser Autoplay Policies**: Modern browsers restrict unmuted autoplay without prior interaction. If a user joins an active party that is already playing, an unobtrusive "Click to sync playback" prompt enables immediate audio-video synchronization upon click.
