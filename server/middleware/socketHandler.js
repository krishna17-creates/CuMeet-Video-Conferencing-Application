const mediasoup = require('mediasoup');
const { mediaCodecs } = require('../sfu/mediaCodecs');

const rooms = new Map();

/**
 * Manages all socket.io events for the application.
 * @param {import('socket.io').Server} io - The Socket.IO server instance.
 * @param {mediasoup.Worker} worker - The Mediasoup worker instance.
 */
const socketHandler = (io, worker) => {
    const createRouter = async (roomId) => {
        const router = await worker.createRouter({ mediaCodecs });
        rooms.set(roomId, {
            router,
            participants: new Set()
        });
        return router;
    };

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        let currentRoomId = null;

        const leaveRoom = () => {
            if (!currentRoomId) return;

            const roomData = rooms.get(currentRoomId);
            if (!roomData) return;

            const { participants, router } = roomData;
            const participant = [...participants].find(p => p.socketId === socket.id);

            if (participant) {
                console.log(`Participant ${participant.userName} leaving room ${currentRoomId}`);
                // Clean up transports for this participant
                participant.transports?.forEach(transport => transport.close());
                participants.delete(participant);

                socket.to(currentRoomId).emit('user-left', { socketId: socket.id, userId: participant.userId });

                if (participants.size === 0) {
                    console.log(`Room ${currentRoomId} is empty, closing router.`);
                    router.close();
                    rooms.delete(currentRoomId);
                }
            }
        };

        socket.on('join-room', async ({ roomId, userId, userName }) => {
            currentRoomId = roomId;
            if (!roomId || !userId) return;

            // Get or create the room
            if (!rooms.has(roomId)) {
                await createRouter(roomId);
            }
            const room = rooms.get(roomId);
            if (!room) return; // Should not happen

            const { participants } = room;

            // Prepare user data
            const currentUser = { socketId: socket.id, userId, userName, transports: new Map(), producers: new Map(), consumers: new Map() };

            // Send existing users and producers to the new user
            const existingUsers = [...participants].map(p => ({ socketId: p.socketId, userId: p.userId, userName: p.userName }));
            socket.emit('existing-users', existingUsers);

            const producers = [...participants].flatMap(p => [...p.producers.values()]);
            socket.emit('existing-producers', producers);

            // Add new user and notify others
            participants.add(currentUser);
            socket.join(roomId);
            socket.to(roomId).emit('user-joined', {
                userId,
                userName,
                socketId: socket.id
            });

            console.log(`User ${userName} (${userId}) joined room ${roomId}. New size: ${participants.size}`);
        });

        // --- SFU Specific Events ---

        socket.on('getRouterRtpCapabilities', (roomId, callback) => {
            const room = rooms.get(roomId);
            if (room && room.router) {
                callback(room.router.rtpCapabilities);
            } else {
                callback(null); // Explicitly callback with null on failure
            }
        });

        socket.on('createWebRtcTransport', async ({ type }, callback) => {
            if (!currentRoomId) return callback({ error: 'Not in a room' });
            const room = rooms.get(currentRoomId);
            if (!room) return callback({ error: 'Room not found' });

            try {
                const transport = await room.router.createWebRtcTransport({
                    listenIps: [{ ip: process.env.MEDIASOUP_LISTEN_IP || '127.0.0.1', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null }],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                });

                const participant = [...room.participants].find(p => p.socketId === socket.id);
                if (participant) {
                    participant.transports.set(transport.id, transport);
                }

                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters,
                });
            } catch (error) {
                console.error('Error creating transport:', error);
                callback({ error: error.message });
            }
        });

        socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            const participant = room && [...room.participants].find(p => p.socketId === socket.id);
            const transport = participant && participant.transports.get(transportId);

            if (!transport) {
                console.error(`connectTransport: transport with id "${transportId}" not found`);
                return;
            }
            await transport.connect({ dtlsParameters });
            callback();
        });

        socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            const participant = room && [...room.participants].find(p => p.socketId === socket.id);
            const transport = participant && participant.transports.get(transportId);

            if (!transport) {
                console.error(`produce: transport with id "${transportId}" not found`);
                return;
            }

            const producer = await transport.produce({ kind, rtpParameters, appData });
            participant.producers.set(producer.id, { producerId: producer.id, userId: participant.userId, userName: participant.userName, kind });

            // Inform other participants
            socket.to(currentRoomId).emit('new-producer', { producerId: producer.id, socketId: socket.id, userId: participant.userId, userName: participant.userName, kind });

            callback({ id: producer.id });
        });

        socket.on('consume', async ({ producerId, rtpCapabilities, transportId }, callback) => {
            if (!currentRoomId) return callback({ error: 'Not in a room' });
            const room = rooms.get(currentRoomId);
            if (!room) return callback({ error: 'Room not found' });
            if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                console.error('can not consume');
                return callback({ error: 'Cannot consume' });
            }

            const participant = [...room.participants].find(p => p.socketId === socket.id);
            const transport = participant && participant.transports.get(transportId);
            if (!transport) return callback({ error: 'Transport not found' });

            try {
                const consumer = await transport.consume({ producerId, rtpCapabilities, paused: false });
                participant.consumers.set(consumer.id, consumer);

                consumer.on('transportclose', () => {
                    participant.consumers.delete(consumer.id);
                });

                consumer.on('producerclose', () => {
                    participant.consumers.delete(consumer.id);
                    socket.emit('producer-closed', { producerId });
                });

                callback({ id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters });
            } catch (error) {
                console.error('consume failed', error);
                return callback({ error: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            leaveRoom();
        });

        // --- P2P signaling relay ---
        // Forward 'signal' messages between peers to support simple-peer negotiation
        socket.on('signal', ({ targetSocketId, signal, userId }) => {
            if (!targetSocketId) return;
            // Send the signal to the target socket
            io.to(targetSocketId).emit('signal', { signal, fromSocketId: socket.id, fromUserId: userId });
        });
    });
};

module.exports = socketHandler;
