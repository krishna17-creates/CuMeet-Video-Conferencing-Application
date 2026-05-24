/**
 * Room Management Service
 * Handles room creation, cleanup, and participant management
 */

const rooms = new Map();

/**
 * Get or create a room
 */
const getOrCreateRoom = async (roomId, worker, mediaCodecs) => {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  const router = await worker.createRouter({ mediaCodecs });
  const roomData = {
    roomId,
    router,
    participants: new Set(),
    createdAt: Date.now(),
  };

  rooms.set(roomId, roomData);
  console.log(`[RoomService] Room created: ${roomId}`);
  return roomData;
};

/**
 * Get room by ID
 */
const getRoom = (roomId) => {
  return rooms.get(roomId);
};

/**
 * Add participant to room
 */
const addParticipant = (roomId, participant) => {
  const room = rooms.get(roomId);
  if (!room) return false;

  room.participants.add(participant);
  console.log(
    `[RoomService] Participant ${participant.userName} added to room ${roomId}. Total: ${room.participants.size}`
  );
  return true;
};

/**
 * Remove participant from room
 */
const removeParticipant = (roomId, socketId) => {
  const room = rooms.get(roomId);
  if (!room) return null;

  const participant = [...room.participants].find((p) => p.socketId === socketId);
  if (!participant) return null;

  // Clean up participant resources
  participant.transports?.forEach((transport) => {
    try {
      transport.close();
    } catch (e) {
      console.error(`[RoomService] Error closing transport:`, e.message);
    }
  });

  room.participants.delete(participant);
  console.log(
    `[RoomService] Participant ${participant.userName} removed from room ${roomId}. Remaining: ${room.participants.size}`
  );

  return participant;
};

/**
 * Get all participants in room
 */
const getParticipants = (roomId) => {
  const room = rooms.get(roomId);
  return room ? [...room.participants] : [];
};

/**
 * Get participant by socket ID
 */
const getParticipant = (roomId, socketId) => {
  const room = rooms.get(roomId);
  if (!room) return null;
  return [...room.participants].find((p) => p.socketId === socketId) || null;
};

/**
 * Check if room is empty
 */
const isRoomEmpty = (roomId) => {
  const room = rooms.get(roomId);
  return !room || room.participants.size === 0;
};

/**
 * Clean up and close a room
 */
const closeRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return false;

  try {
    // Close all participant resources
    room.participants.forEach((participant) => {
      participant.transports?.forEach((transport) => {
        try {
          transport.close();
        } catch (e) {}
      });
    });

    // Close router
    if (room.router) {
      room.router.close();
    }

    rooms.delete(roomId);
    console.log(`[RoomService] Room closed: ${roomId}`);
    return true;
  } catch (error) {
    console.error(`[RoomService] Error closing room ${roomId}:`, error.message);
    return false;
  }
};

/**
 * Get room statistics
 */
const getRoomStats = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return null;

  return {
    roomId,
    participantCount: room.participants.size,
    createdAt: room.createdAt,
    uptime: Date.now() - room.createdAt,
  };
};

module.exports = {
  getOrCreateRoom,
  getRoom,
  addParticipant,
  removeParticipant,
  getParticipants,
  getParticipant,
  isRoomEmpty,
  closeRoom,
  getRoomStats,
};
