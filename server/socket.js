const { Server } = require('socket.io');

const users = {}; // In-memory store for users in rooms
const rooms = {}; // In-memory store for mediasoup rooms

function initializeSocket(io, worker) {
  // This function now receives the io instance and mediasoup worker
  // The original server.js was already updated to pass these.

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, userId, userName }) => {
      console.log(`[Socket] User ${userName} (${userId}) joining room ${roomId} with socket ${socket.id}`);

      // Add the new user to the room
      if (!users[roomId]) {
        users[roomId] = {};
      }
      users[roomId][socket.id] = { userId, userName };
      socket.join(roomId);

      const existingUsers = [];
      for (const id in users[roomId]) {
        // Find everyone who is NOT the current socket
        if (id !== socket.id) {
          existingUsers.push({
            socketId: id,
            ...users[roomId][id] // { userId, userName }
          });
        }
      }

      if (existingUsers.length > 0) {
        console.log(`[Socket] Sending 'existing-users' list to ${userName} (${socket.id})`);
        socket.emit('existing-users', existingUsers);
      }
      // Notify existing users that a new user has joined
      console.log(`[Socket] Broadcasting 'user-joined' for ${userName} to room ${roomId}`);
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
        userName
      });

      // Acknowledge the join
      socket.emit('joined', { roomId, socketId: socket.id });
    });

    // --- P2P 'signal' relay logic is now removed ---

    socket.on('chat-message', (msg) => {
        const room = findRoomBySocketId(socket.id);
        if (room) {
            console.log(`[Socket] Broadcasting chat message to room ${room}`);
            socket.to(room).emit('chat-message', msg);
        }
    });

    socket.on('update-name', ({ name }) => {
        const room = findRoomBySocketId(socket.id);
        if (room && users[room] && users[room][socket.id]) {
            users[room][socket.id].userName = name;
            console.log(`[Socket] User ${socket.id} updated name to ${name}`);
        }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.id}`);
      const room = findRoomBySocketId(socket.id);
      if (room) {
        const user = users[room][socket.id];
        if (user) {
          console.log(`[Socket] Broadcasting 'user-left' for ${user.userName} to room ${room}`);
          socket.to(room).emit('user-left', { socketId: socket.id, userId: user.userId });
          delete users[room][socket.id];
          if (Object.keys(users[room]).length === 0) {
            console.log(`[Socket] Room ${room} is now empty. Cleaning up.`);
            // This is the fix: Close the mediasoup router and delete the room.
            if (rooms[room]) {
              rooms[room].router.close(); // Shut down the mediasoup router
              delete rooms[room];       // Delete from our 'rooms' object
            }
            delete users[room];
          }
        }
      }
    });

    // --- SFU Logic ---
    const createRoom = async (roomId) => {
        let router = await worker.createRouter({
            mediaCodecs: [
                { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
                { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } }
            ]
        });
        rooms[roomId] = { router, transports: {}, producers: {}, consumers: {} };
        return router;
    };

    socket.on('getRouterRtpCapabilities', async (roomId, callback) => {
        console.log(`[Socket] Received getRouterRtpCapabilities for room ${roomId}`);
        let router = rooms[roomId]?.router;
        if (!router) {
            try {
                router = await createRoom(roomId);
            } catch (e) {
                return callback({ error: e.message });
            }
        }
        callback(router.rtpCapabilities);
    });

    socket.on('createWebRtcTransport', async ({ type }, callback) => {
        console.log(`[Socket] Received createWebRtcTransport for type: ${type}`);
        const room = findRoomBySocketId(socket.id);
        if (!room || !rooms[room]) return callback({ error: 'Room not found' });

        try {
            const transport = await rooms[room].router.createWebRtcTransport({
                listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP || null }],
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
            });
            rooms[room].transports[transport.id] = transport;
            callback({ id: transport.id, iceParameters: transport.iceParameters, iceCandidates: transport.iceCandidates, dtlsParameters: transport.dtlsParameters });
        } catch (e) {
            callback({ error: e.message });
        }
    });

    socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
        console.log(`[Socket] Received connectTransport for transportId: ${transportId}`);
        const room = findRoomBySocketId(socket.id);
        if (!room || !rooms[room]?.transports[transportId]) return callback({ error: 'Transport not found' });

        try {
            await rooms[room].transports[transportId].connect({ dtlsParameters });
            callback();
        } catch (e) {
            callback({ error: e.message });
        }
    });

    socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
        console.log(`[Socket] Received produce for kind: ${kind}`);
        const roomName = findRoomBySocketId(socket.id);
        const room = rooms[roomName];
        const transport = room?.transports[transportId];
        if (!transport) return callback({ error: 'Transport not found' });

        try {
            const producer = await transport.produce({ kind, rtpParameters, appData: { ...appData, userId: users[roomName][socket.id].userId, userName: users[roomName][socket.id].userName } });
            room.producers[producer.id] = producer;

            // Inform other users
            socket.to(roomName).emit('new-producer', { producerId: producer.id, userId: producer.appData.userId, userName: producer.appData.userName, kind });

            // Send existing producers to the new producer
            const existingProducers = Object.values(room.producers)
                .filter(p => p.id !== producer.id)
                .map(p => ({ producerId: p.id, userId: p.appData.userId, userName: p.appData.userName, kind: p.kind }));
            socket.emit('sfu-existing-producers', existingProducers);

            callback({ id: producer.id });
        } catch (e) {
            callback({ error: e.message });
        }
    });

    socket.on('consume', async ({ rtpCapabilities, producerId, transportId }, callback) => {
        console.log(`[Socket] Received consume for producerId: ${producerId}`);
        const roomName = findRoomBySocketId(socket.id);
        const room = rooms[roomName];
        const transport = room?.transports[transportId];
        const producer = room?.producers[producerId];

        if (!transport || !producer || !room.router.canConsume({ producerId, rtpCapabilities })) {
            return callback({ error: 'Cannot consume' });
        }

        try {
            const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
            room.consumers[consumer.id] = consumer;
            // We start paused and resume on the client
            callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
        } catch (e) {
            callback({ error: e.message });
        }
    });

    // This listens for the client's request to resume a consumer
    socket.on('resume-consumer', async ({ consumerId }, callback) => {
      console.log(`[Socket] Received resume-consumer for consumerId: ${consumerId}`);
      const roomName = findRoomBySocketId(socket.id);
      const room = rooms[roomName];
      if (!room) {
        return callback && callback({ error: 'Room not found' });
      }

      const consumer = room.consumers[consumerId];
      if (!consumer) {
        return callback && callback({ error: 'Consumer not found' });
      }

      try {
        await consumer.resume();
        callback && callback();
      } catch (e) {
        console.error(`[Socket] Error resuming consumer: ${e.message}`);
        callback && callback({ error: e.message });
      }
    });

  });

  // Helper to find which room a socket is in
  function findRoomBySocketId(socketId) {
    for (const roomId in users) {
      if (users[roomId][socketId]) {
        return roomId;
      }
    }
    return null;
  }

}

module.exports = initializeSocket;