/**
 * Socket Handler (Refactored)
 * Uses roomService and sfuService for clean separation of concerns
 */

const roomService = require('../services/roomService');
const sfuService = require('../services/sfuService');
const { mediaCodecs } = require('../sfu/mediaCodecs');

const socketHandler = (io, worker) => {
  io.on('connection', (socket) => {
    console.log(`[SocketHandler] User connected: ${socket.id}`);

    let currentRoomId = null;
    let currentParticipant = null;

    // ========== ROOM MANAGEMENT ==========

    socket.on('join-room', async ({ roomId, userId, userName }) => {
      try {
        currentRoomId = roomId;

        // Get or create room
        await roomService.getOrCreateRoom(
          roomId,
          worker,
          mediaCodecs
        );

        // Create participant object
        const participant = {
          socketId: socket.id,
          userId,
          userName,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };

        currentParticipant = participant;
        roomService.addParticipant(roomId, participant);
        socket.join(roomId);

        // Send existing users to new participant
        const existingUsers = roomService
          .getParticipants(roomId)
          .filter((p) => p.socketId !== socket.id)
          .map((p) => ({
            socketId: p.socketId,
            userId: p.userId,
            userName: p.userName,
          }));

        socket.emit('existing-users', existingUsers);

        // Send existing producers to new participant
        const existingProducers = roomService
          .getParticipants(roomId)
          .filter((p) => p.socketId !== socket.id)
          .flatMap((p) =>
            [...p.producers.values()].map((prod) => ({
              producerId: prod.producerId,
              userId: prod.userId,
              userName: prod.userName,
              kind: prod.kind,
            }))
          );

        socket.emit('sfu-existing-producers', existingProducers);

        // Notify others
        socket.to(roomId).emit('user-joined', {
          userId,
          userName,
          socketId: socket.id,
        });

        // Acknowledge join
        socket.emit('joined', { roomId, socketId: socket.id });

        console.log(
          `[SocketHandler] User ${userName} joined room ${roomId}`
        );
      } catch (error) {
        console.error('[SocketHandler] Error joining room:', error.message);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ========== SFU: TRANSPORT ==========

    socket.on('getRouterRtpCapabilities', (roomId, callback) => {
      try {
        const room = roomService.getRoom(roomId);
        if (room && room.router) {
          callback(room.router.rtpCapabilities);
        } else {
          callback({ error: 'Room not found' });
        }
      } catch (error) {
        console.error(
          '[SocketHandler] Error getting router capabilities:',
          error.message
        );
        callback({ error: error.message });
      }
    });

    socket.on('createWebRtcTransport', async (_payload, callback) => {
      try {
        if (!currentRoomId) {
          return callback({ error: 'Not in a room' });
        }

        const room = roomService.getRoom(currentRoomId);
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        const { transport, params } = await sfuService.createWebRtcTransport(
          room.router,
          process.env.MEDIASOUP_LISTEN_IP,
          process.env.MEDIASOUP_ANNOUNCED_IP
        );

        currentParticipant.transports.set(params.id, transport);

        callback(params);
      } catch (error) {
        console.error(
          '[SocketHandler] Error creating transport:',
          error.message
        );
        callback({ error: error.message });
      }
    });

    socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
      try {
        const transport = currentParticipant?.transports.get(transportId);
        if (!transport) {
          return callback({ error: 'Transport not found' });
        }

        await sfuService.connectTransport(transport, dtlsParameters);
        callback();
      } catch (error) {
        console.error(
          '[SocketHandler] Error connecting transport:',
          error.message
        );
        callback({ error: error.message });
      }
    });

    // ========== SFU: PRODUCER ==========

    socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
      try {
        if (!currentRoomId || !currentParticipant) {
          return callback({ error: 'Not in a room' });
        }

        const transport = currentParticipant.transports.get(transportId);
        if (!transport) {
          return callback({ error: 'Transport not found' });
        }

        const producer = await sfuService.produceTrack(
          transport,
          kind,
          rtpParameters,
          appData
        );

        // Store producer info
        currentParticipant.producers.set(producer.id, {
          producerId: producer.id,
          producer,
          userId: currentParticipant.userId,
          userName: currentParticipant.userName,
          kind,
        });

        producer.on('transportclose', () => {
          currentParticipant?.producers.delete(producer.id);
          socket.to(currentRoomId).emit('producer-closed', {
            producerId: producer.id,
            userId: currentParticipant?.userId,
            kind,
          });
        });

        producer.on('close', () => {
          currentParticipant?.producers.delete(producer.id);
          socket.to(currentRoomId).emit('producer-closed', {
            producerId: producer.id,
            userId: currentParticipant?.userId,
            kind,
          });
        });

        // Notify others
        socket.to(currentRoomId).emit('new-producer', {
          producerId: producer.id,
          socketId: socket.id,
          userId: currentParticipant.userId,
          userName: currentParticipant.userName,
          kind,
        });

        callback({ id: producer.id });
      } catch (error) {
        console.error('[SocketHandler] Error producing:', error.message);
        callback({ error: error.message });
      }
    });

    // ========== SFU: CONSUMER ==========

    socket.on('consume', async ({ producerId, rtpCapabilities, transportId }, callback) => {
      try {
        if (!currentRoomId || !currentParticipant) {
          return callback({ error: 'Not in a room' });
        }

        const room = roomService.getRoom(currentRoomId);
        if (!room) {
          return callback({ error: 'Room not found' });
        }

        // Check if can consume
        if (!sfuService.canConsume(room.router, producerId, rtpCapabilities)) {
          return callback({ error: 'Cannot consume' });
        }

        const transport = currentParticipant.transports.get(transportId);
        if (!transport) {
          return callback({ error: 'Transport not found' });
        }

        const consumer = await sfuService.consumeProducer(
          transport,
          producerId,
          rtpCapabilities
        );

        // Store consumer
        currentParticipant.consumers.set(consumer.id, consumer);

        // Auto-close on events
        consumer.on('transportclose', () => {
          currentParticipant?.consumers.delete(consumer.id);
        });

        consumer.on('producerclose', () => {
          currentParticipant?.consumers.delete(consumer.id);
          socket.emit('producer-closed', { producerId });
        });

        callback({
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        });
      } catch (error) {
        console.error('[SocketHandler] Error consuming:', error.message);
        callback({ error: error.message });
      }
    });

    socket.on('resume-consumer', async ({ consumerId }, callback) => {
      try {
        const consumer = currentParticipant?.consumers.get(consumerId);
        if (!consumer) {
          return callback({ error: 'Consumer not found' });
        }

        await sfuService.resumeConsumer(consumer);
        if (callback) callback();
      } catch (error) {
        console.error('[SocketHandler] Error resuming consumer:', error.message);
        if (callback) callback({ error: error.message });
      }
    });

    // ========== CHAT ==========

    socket.on('chat-message', (msg) => {
      if (currentRoomId) {
        socket.to(currentRoomId).emit('chat-message', msg);
      }
    });

    socket.on('update-name', ({ name }) => {
      if (currentParticipant) {
        currentParticipant.userName = name;
        if (currentRoomId) {
          socket.to(currentRoomId).emit('user-name-updated', {
            socketId: socket.id,
            userName: name,
          });
        }
      }
    });

    socket.on('end-room', (callback) => {
      try {
        if (!currentRoomId || !currentParticipant) {
          return callback?.({ error: 'Not in a room' });
        }

        socket.to(currentRoomId).emit('room-ended', {
          roomId: currentRoomId,
          endedBy: currentParticipant.userId,
          endedByName: currentParticipant.userName,
        });

        roomService.closeRoom(currentRoomId);
        callback?.({ success: true });
      } catch (error) {
        console.error('[SocketHandler] Error ending room:', error.message);
        callback?.({ error: error.message });
      }
    });

    // ========== DISCONNECT ==========

    socket.on('disconnect', () => {
      console.log(`[SocketHandler] User disconnected: ${socket.id}`);

      if (currentRoomId && currentParticipant) {
        // Remove participant
        const removedParticipant = roomService.removeParticipant(
          currentRoomId,
          socket.id
        );

        if (removedParticipant) {
          // Notify others
          socket.to(currentRoomId).emit('user-left', {
            socketId: socket.id,
            userId: removedParticipant.userId,
          });

          // Clean up room if empty
          if (roomService.isRoomEmpty(currentRoomId)) {
            roomService.closeRoom(currentRoomId);
          }
        }
      }
    });
  });
};

module.exports = socketHandler;
