// Comprehensive socket test suite for Watch Party Server
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');

const TEST_PORT = 3101;
const TEST_URL = `http://localhost:${TEST_PORT}`;

let serverProcess = null;
const openSockets = [];

function connectSocket() {
  const socket = io(TEST_URL, {
    transports: ['websocket'],
    forceNew: true
  });
  openSockets.push(socket);
  return socket;
}

function waitForConnect(socket) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

function emitWithAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (response) => {
      resolve(response);
    });
  });
}

function waitForEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${event}"`));
    }, timeout);

    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function cleanup() {
  for (const s of openSockets) {
    if (s.connected) {
      s.disconnect();
    }
  }
  if (serverProcess) {
    serverProcess.kill();
  }
}

async function runTests() {
  console.log('--- Starting Watch Party Test Server on PORT', TEST_PORT, '---');

  // Spawn test server
  serverProcess = spawn('node', [path.join(__dirname, '../index.js')], {
    env: { ...process.env, PORT: String(TEST_PORT), NODE_ENV: 'test' }
  });

  serverProcess.stdout.on('data', (d) => {
    const msg = d.toString();
    if (process.env.DEBUG_TEST) console.log('[Server stdout]', msg.trim());
  });

  serverProcess.stderr.on('data', (d) => {
    console.error('[Server stderr]', d.toString().trim());
  });

  // Wait for server to start listening
  await new Promise((resolve) => setTimeout(resolve, 1200));

  try {
    console.log('\n[TEST 1] Create Room & Initial State');
    const hostSocket = connectSocket();
    await waitForConnect(hostSocket);

    const createRes = await emitWithAck(hostSocket, 'create_room', { username: 'HostAlice' });
    if (!createRes.ok || !createRes.roomId || createRes.you.role !== 'host') {
      throw new Error(`Failed to create room: ${JSON.stringify(createRes)}`);
    }
    const roomId = createRes.roomId;
    console.log('✔ Room created successfully with code:', roomId);

    console.log('\n[TEST 2] Second Participant Joins & Broadcast');
    const p1Socket = connectSocket();
    await waitForConnect(p1Socket);

    const joinPromise = waitForEvent(hostSocket, 'user_joined');
    const joinRes = await emitWithAck(p1Socket, 'join_room', {
      roomId: roomId,
      username: 'ParticipantBob'
    });
    if (!joinRes.ok || joinRes.you.role !== 'participant' || joinRes.participants.length !== 2) {
      throw new Error(`Failed to join room: ${JSON.stringify(joinRes)}`);
    }
    const joinedEvent = await joinPromise;
    if (joinedEvent.username !== 'ParticipantBob' || joinedEvent.role !== 'participant') {
      throw new Error(`Invalid user_joined event: ${JSON.stringify(joinedEvent)}`);
    }
    console.log('✔ Participant joined and user_joined broadcast verified.');

    console.log('\n[TEST 3] Video Loading & Playback Sync');
    const validVideoId = 'dQw4w9WgXcQ';
    const syncPromise = waitForEvent(p1Socket, 'sync_state');
    hostSocket.emit('change_video', { videoId: validVideoId });
    const syncAfterChange = await syncPromise;
    if (syncAfterChange.videoId !== validVideoId || syncAfterChange.playState !== 'paused') {
      throw new Error(`Invalid sync_state after change_video: ${JSON.stringify(syncAfterChange)}`);
    }
    console.log('✔ Host changed video and sync_state broadcast received.');

    // Host starts playback
    const playSyncPromise = waitForEvent(p1Socket, 'sync_state');
    hostSocket.emit('play', { currentTime: 10 });
    const playSync = await playSyncPromise;
    if (playSync.playState !== 'playing' || playSync.currentTime < 10) {
      throw new Error(`Invalid sync_state after play: ${JSON.stringify(playSync)}`);
    }
    console.log('✔ Host played video; sync_state shows playing at time >= 10.');

    console.log('\n[TEST 4] Late Joiner Receives Current State with Elapsed Time');
    await new Promise((r) => setTimeout(r, 600)); // Wait 600ms for playback time to elapse
    const p2Socket = connectSocket();
    await waitForConnect(p2Socket);
    const p2JoinRes = await emitWithAck(p2Socket, 'join_room', {
      roomId: roomId,
      username: 'LateCharlie'
    });
    if (!p2JoinRes.ok || p2JoinRes.syncState.playState !== 'playing' || p2JoinRes.syncState.currentTime <= 10.5) {
      throw new Error(`Late joiner did not receive updated elapsed time: ${JSON.stringify(p2JoinRes.syncState)}`);
    }
    console.log('✔ Late joiner received syncState with elapsed time:', p2JoinRes.syncState.currentTime);

    console.log('\n[TEST 5] Participant Permission Denied Checks');
    // Participant attempts play, pause, seek, change_video, assign_role, remove_participant
    const p1DeniedPromise = waitForEvent(p1Socket, 'room_error');
    p1Socket.emit('play', { currentTime: 20 });
    const errPlay = await p1DeniedPromise;
    if (errPlay.code !== 'PERMISSION_DENIED') {
      throw new Error(`Expected PERMISSION_DENIED on play, got: ${JSON.stringify(errPlay)}`);
    }

    const p1SeekDenied = waitForEvent(p1Socket, 'room_error');
    p1Socket.emit('seek', { time: 50 });
    const errSeek = await p1SeekDenied;
    if (errSeek.code !== 'PERMISSION_DENIED') {
      throw new Error(`Expected PERMISSION_DENIED on seek, got: ${JSON.stringify(errSeek)}`);
    }

    const p1RoleDenied = waitForEvent(p1Socket, 'room_error');
    p1Socket.emit('assign_role', { userId: p2Socket.id, role: 'moderator' });
    const errRole = await p1RoleDenied;
    if (errRole.code !== 'PERMISSION_DENIED') {
      throw new Error(`Expected PERMISSION_DENIED on assign_role, got: ${JSON.stringify(errRole)}`);
    }
    console.log('✔ Participant actions properly rejected with PERMISSION_DENIED.');

    console.log('\n[TEST 6] Host Promotes Participant to Moderator & Moderator Controls');
    const roleAssignedPromise = waitForEvent(p1Socket, 'role_assigned');
    hostSocket.emit('assign_role', { userId: p1Socket.id, role: 'moderator' });
    const roleEvent = await roleAssignedPromise;
    if (roleEvent.userId !== p1Socket.id || roleEvent.role !== 'moderator') {
      throw new Error(`Unexpected role_assigned payload: ${JSON.stringify(roleEvent)}`);
    }
    console.log('✔ Host promoted participant to moderator.');

    // Now newly promoted moderator can pause
    const modPauseSyncPromise = waitForEvent(hostSocket, 'sync_state');
    p1Socket.emit('pause', { currentTime: 15 });
    const modPauseSync = await modPauseSyncPromise;
    if (modPauseSync.playState !== 'paused' || modPauseSync.currentTime !== 15) {
      throw new Error(`Moderator pause failed: ${JSON.stringify(modPauseSync)}`);
    }
    console.log('✔ Moderator successfully paused playback.');

    // Moderator cannot assign roles or remove participants
    const modAssignDenied = waitForEvent(p1Socket, 'room_error');
    p1Socket.emit('assign_role', { userId: p2Socket.id, role: 'moderator' });
    const errModAssign = await modAssignDenied;
    if (errModAssign.code !== 'PERMISSION_DENIED') {
      throw new Error(`Moderator should not be able to assign roles: ${JSON.stringify(errModAssign)}`);
    }
    console.log('✔ Moderator blocked from assigning roles.');

    console.log('\n[TEST 7] Invalid Role Assignment Edge Cases');
    // Cannot assign 'host'
    const assignHostErr = waitForEvent(hostSocket, 'room_error');
    hostSocket.emit('assign_role', { userId: p2Socket.id, role: 'host' });
    const errHostAssign = await assignHostErr;
    if (errHostAssign.code !== 'INVALID_PAYLOAD') {
      throw new Error(`Expected INVALID_PAYLOAD when assigning host, got: ${JSON.stringify(errHostAssign)}`);
    }

    // Host cannot target themselves
    const assignSelfErr = waitForEvent(hostSocket, 'room_error');
    hostSocket.emit('assign_role', { userId: hostSocket.id, role: 'moderator' });
    const errSelf = await assignSelfErr;
    if (errSelf.code !== 'INVALID_PAYLOAD') {
      throw new Error(`Expected INVALID_PAYLOAD targeting self, got: ${JSON.stringify(errSelf)}`);
    }
    console.log('✔ Host assigning "host" and self-targeting safely rejected.');

    console.log('\n[TEST 8] Host Removes Participant');
    const p2RemovedPromise = waitForEvent(p2Socket, 'removed_from_room');
    const roomNotifiedPromise = waitForEvent(hostSocket, 'participant_removed');
    hostSocket.emit('remove_participant', { userId: p2Socket.id });
    const removedFromRoomMsg = await p2RemovedPromise;
    const participantRemovedMsg = await roomNotifiedPromise;
    if (!removedFromRoomMsg || participantRemovedMsg.userId !== p2Socket.id) {
      throw new Error('Remove participant event verification failed.');
    }
    console.log('✔ Participant removed and notifications received.');

    console.log('\n[TEST 9] Malformed Payloads & Robustness');
    // Null payload
    hostSocket.emit('play', null);
    // Invalid videoId
    const badVideoPromise = waitForEvent(hostSocket, 'room_error');
    hostSocket.emit('change_video', { videoId: 'too_short' });
    const errBadVideo = await badVideoPromise;
    if (errBadVideo.code !== 'INVALID_PAYLOAD') {
      throw new Error(`Expected INVALID_PAYLOAD for short videoId, got: ${JSON.stringify(errBadVideo)}`);
    }
    console.log('✔ Malformed payloads handled gracefully without server crash.');

    console.log('\n[TEST 10] Regression Test: Room Code Casing, Whitespace, & Room Not Found');
    // Test whitespace and lowercase room code joining
    const regSocket = connectSocket();
    await waitForConnect(regSocket);
    const regJoinRes = await emitWithAck(regSocket, 'join_room', {
      roomId: `  ${roomId.toLowerCase()}  `,
      username: 'RegressionTester'
    });
    if (!regJoinRes.ok) {
      throw new Error(`Case/whitespace insensitive join failed: ${JSON.stringify(regJoinRes)}`);
    }
    console.log('✔ Lowercase and padded room code successfully joins room.');

    // Wrong code returns ROOM_NOT_FOUND
    const regSocket2 = connectSocket();
    await waitForConnect(regSocket2);
    const wrongCodeRes = await emitWithAck(regSocket2, 'join_room', {
      roomId: 'ZZZZZZ',
      username: 'LostUser'
    });
    if (wrongCodeRes.ok || wrongCodeRes.code !== 'ROOM_NOT_FOUND') {
      throw new Error(`Expected ROOM_NOT_FOUND, got: ${JSON.stringify(wrongCodeRes)}`);
    }
    console.log('✔ Non-existent room code returns ROOM_NOT_FOUND.');

    console.log('\n[TEST 11] Host Disconnect & Auto-Promotion');
    // When host disconnects, the moderator (p1Socket) should be promoted to host
    const hostPromoPromise = waitForEvent(p1Socket, 'role_assigned');
    hostSocket.disconnect();
    const promoEvent = await hostPromoPromise;
    if (promoEvent.userId !== p1Socket.id || promoEvent.role !== 'host') {
      throw new Error(`Expected p1 to be auto-promoted to host, got: ${JSON.stringify(promoEvent)}`);
    }
    console.log('✔ Host disconnected; moderator was auto-promoted to host.');

    console.log('\n[TEST 12] Empty Room Cleanup');
    // Disconnect remaining users
    p1Socket.disconnect();
    regSocket.disconnect();
    await new Promise((r) => setTimeout(r, 500));

    // Try joining the abandoned room
    const afterDeleteSocket = connectSocket();
    await waitForConnect(afterDeleteSocket);
    const deadRoomRes = await emitWithAck(afterDeleteSocket, 'join_room', {
      roomId: roomId,
      username: 'Ghost'
    });
    if (deadRoomRes.ok || deadRoomRes.code !== 'ROOM_NOT_FOUND') {
      throw new Error(`Empty room was not deleted: ${JSON.stringify(deadRoomRes)}`);
    }
    console.log('✔ Empty room was successfully deleted from memory.');

    console.log('\n======================================');
    console.log('   ALL SERVER TESTS PASSED (12/12)   ');
    console.log('======================================\n');
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err.message);
    cleanup();
    process.exit(1);
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

runTests();
