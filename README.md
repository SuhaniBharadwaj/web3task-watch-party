# YouTube Watch Party - Stage 1

A simple learning project demonstrating WebSocket communication between a React client and a Node.js Express server using Socket.IO.

## Setup Instructions

### 1. Install Dependencies

Open a terminal and run:

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

---

## Running the Application

You will need two separate terminal windows (one for the server, one for the client).

### Terminal 1: Run Server

```bash
cd server
npm run dev
```

* The server runs on `http://localhost:3001`.
* It exposes a health check endpoint at `http://localhost:3001/health`.
* It listens for WebSocket connections via Socket.IO.

### Terminal 2: Run Client

```bash
cd client
npm run dev
```

* The client runs on `http://localhost:5173`.
* Open your browser and navigate to `http://localhost:5173`.

---

## Verifying the Setup

1. Open `http://localhost:5173` in your browser.
2. The page should show **Status: Connected** along with a unique **Socket ID**.
3. In the server terminal, you will see `client connected: <socket.id>`.
4. Click the **Send ping** button.
5. The client will display the **Last Pong Reply** with the server message and timestamp.
6. When you close or refresh the browser tab, the server terminal will log `client disconnected: <socket.id>`.
