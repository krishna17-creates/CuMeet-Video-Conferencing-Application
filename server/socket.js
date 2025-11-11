const { Server } = require('socket.io');

const users = {}; // In-memory store for users in rooms

function initializeSocket(server) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userId, userName }) => {
      console.log(`[Socket] User ${userName} (${userId}) joining room ${roomId} with socket ${socket.id}`);

      // Find existing users in the room
      const existingUsers = [];
      if (users[roomId]) {
        for (const [socketId, user] of Object.entries(users[roomId])) {
          if (socketId !== socket.id) {
            existingUsers.push({ socketId, ...user });
          }
        }
      }

      // Add the new user to the room
      if (!users[roomId]) {
        users[roomId] = {};
      }
      users[roomId][socket.id] = { userId, userName };
      socket.join(roomId);

      // Acknowledge join and send list of existing users to the new user
      console.log(`[Socket] Sending 'existing-users' to ${socket.id}:`, existingUsers.map(u => u.userName));
      socket.emit('existing-users', existingUsers);

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

    socket.on('signal', ({ targetSocketId, signal, userId }) => {
      console.log(`[Socket] Relaying signal from ${userId} to ${targetSocketId}`);
      io.to(targetSocketId).emit('signal', {
        signal,
        fromSocketId: socket.id,
        fromUserId: userId
      });
    });

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
            delete users[room];
          }
        }
      }
    });

    // --- SFU/Topology logic can be added here later ---
    socket.on('getRouterRtpCapabilities', (roomId, callback) => {
        // This is a placeholder for future SFU implementation
        console.log(`[Socket] Received getRouterRtpCapabilities for room ${roomId}`);
        // In a real SFU, you would get this from your mediasoup router
        callback({ error: 'SFU not implemented' });
    });

    socket.on('createWebRtcTransport', (data, callback) => {
        console.log(`[Socket] Received createWebRtcTransport`);
        callback({ error: 'SFU not implemented' });
    });

    socket.on('connectTransport', (data, callback) => {
        console.log(`[Socket] Received connectTransport`);
        callback();
    });

    socket.on('produce', (data, callback) => {
        console.log(`[Socket] Received produce`);
        callback({ error: 'SFU not implemented' });
    });

    socket.on('consume', (data, callback) => {
        console.log(`[Socket] Received consume`);
        callback({ error: 'SFU not implemented' });
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

  return io;
}

module.exports = initializeSocket;