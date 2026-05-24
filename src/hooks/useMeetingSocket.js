import { useState, useRef, useCallback } from "react";
import io from "socket.io-client";

/**
 * useMeetingSocket Hook
 * Manages Socket.IO connection for real-time signaling and chat
 * Handles: connection lifecycle, chat messages, user presence events
 */
export const useMeetingSocket = (meetingId, user) => {
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [chatMessages, setChatMessages] = useState([]);
  const [participants, setParticipants] = useState([]);

  const socketRef = useRef();
  const sfuExistingProducersHandlerRef = useRef(null);
  const newProducerHandlerRef = useRef(null);
  const producerClosedHandlerRef = useRef(null);
  const roomEndedHandlerRef = useRef(null);
  const userLeftHandlerRef = useRef(null);

  /**
   * Initialize socket connection and set up listeners
   */
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) {
      return Promise.resolve(socketRef.current);
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    setConnectionStatus("Connecting...");

    return new Promise((resolve, reject) => {
      const socket = io(backendUrl, {
        transports: ["websocket", "polling"],
        path: "/socket.io",
      });
      socketRef.current = socket;

      const cleanupStartupListeners = () => {
        socket.off("connect_error", handleConnectError);
        socket.off("joined", handleJoined);
      };

      const startupTimeout = setTimeout(() => {
        cleanupStartupListeners();
        setConnectionStatus("Connection failed");
        reject(new Error("Timed out while joining the meeting room"));
      }, 12000);

      const handleConnectError = (error) => {
        clearTimeout(startupTimeout);
        cleanupStartupListeners();
        console.error("Socket connection error:", error);
        setConnectionStatus("Connection failed");
        reject(error);
      };

      const handleJoined = ({ roomId: rId, socketId }) => {
        clearTimeout(startupTimeout);
        cleanupStartupListeners();
        console.log(
          "Server acknowledged join for room:",
          rId,
          "socketId:",
          socketId
        );
        resolve(socket);
      };

      socket.on("connect", () => {
        console.log("Connected to signaling server");
        setConnectionStatus("Connected");

        socket.emit("join-room", {
          roomId: meetingId,
          userId: user.id,
          userName: user.name,
        });
      });

      socket.on("joined", handleJoined);
      socket.on("connect_error", handleConnectError);

      socket.on("existing-users", (users) => {
        console.log(
          `%c[Socket] Found ${users.length} existing users:`,
          "color: blue; font-weight: bold;",
          users
        );
      });

      socket.on("sfu-existing-producers", (producers) => {
        sfuExistingProducersHandlerRef.current?.(producers);
      });

      socket.on("new-producer", (producerInfo) => {
        newProducerHandlerRef.current?.(producerInfo);
      });

      socket.on("producer-closed", (payload) => {
        producerClosedHandlerRef.current?.(payload);
      });

      socket.on("room-ended", (payload) => {
        roomEndedHandlerRef.current?.(payload);
      });

      socket.on("user-joined", ({ userName, userId }) => {
        console.log(
          `%c[Socket] New user joined: ${userName} (ID: ${userId})`,
          "color: green; font-weight: bold;"
        );
      });

      socket.on("chat-message", (msg) => {
        setChatMessages((prev) => [...prev, msg]);
      });

      socket.on("user-left", ({ socketId, userId }) => {
        console.log("User left:", userId);
        setParticipants((prev) => prev.filter((p) => p.userId !== userId));
        userLeftHandlerRef.current?.({ socketId, userId });
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from signaling server");
        setConnectionStatus("Disconnected");
      });
    });
  }, [meetingId, user]);

  /**
   * Send chat message
   */
  const sendChatMessage = useCallback((displayName, chatInput) => {
    if (!chatInput.trim()) return;

    const msg = {
      from: displayName || user?.name,
      text: chatInput.trim(),
      ts: Date.now(),
    };

    setChatMessages((prev) => [...prev, msg]);

    if (socketRef.current?.connected) {
      socketRef.current.emit("chat-message", msg);
    }

    return msg;
  }, [user]);

  /**
   * Update display name via socket
   */
  const updateDisplayName = useCallback((name) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("update-name", { name });
    }
  }, []);

  /**
   * Emit event for SFU (getRouterRtpCapabilities)
   */
  const emitGetRouterRtpCapabilities = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not connected"));
        return;
      }

      socketRef.current.emit("getRouterRtpCapabilities", meetingId, (caps) => {
        resolve(caps);
      });
    });
  }, [meetingId]);

  /**
   * Emit event for SFU (createWebRtcTransport)
   */
  const emitCreateWebRtcTransport = useCallback((transportType) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not connected"));
        return;
      }

      socketRef.current.emit(
        "createWebRtcTransport",
        { type: transportType },
        (params) => {
          resolve(params);
        }
      );
    });
  }, []);

  /**
   * Emit event for SFU (connectTransport)
   */
  const emitConnectTransport = useCallback((transportId, dtlsParameters) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not connected"));
        return;
      }

      socketRef.current.emit(
        "connectTransport",
        { transportId, dtlsParameters },
        (result) => {
          resolve(result);
        }
      );
    });
  }, []);

  /**
   * Emit event for SFU (produce)
   */
  const emitProduce = useCallback(
    (transportId, kind, rtpParameters, appData) => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error("Socket not connected"));
          return;
        }

        socketRef.current.emit(
          "produce",
          { transportId, kind, rtpParameters, appData },
          ({ id, error }) => {
            if (error) {
              reject(new Error(error));
              return;
            }
            resolve(id);
          }
        );
      });
    },
    []
  );

  /**
   * Emit event for SFU (consume)
   */
  const emitConsume = useCallback(
    (rtpCapabilities, producerId, transportId) => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error("Socket not connected"));
          return;
        }

        socketRef.current.emit(
          "consume",
          { rtpCapabilities, producerId, transportId },
          (params) => {
            resolve(params);
          }
        );
      });
    },
    []
  );

  /**
   * Emit event for SFU (resume-consumer)
   */
  const emitResumeConsumer = useCallback((consumerId) => {
    if (!socketRef.current) return;
    socketRef.current.emit("resume-consumer", { consumerId });
  }, []);

  const emitEndRoom = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error("Socket not connected"));
        return;
      }

      socketRef.current.emit("end-room", (result = {}) => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result);
      });
    });
  }, []);

  /**
   * Register SFU producer listener
   */
  const onSfuExistingProducers = useCallback((callback) => {
    sfuExistingProducersHandlerRef.current = callback;
  }, []);

  /**
   * Register new producer listener
   */
  const onNewProducer = useCallback((callback) => {
    newProducerHandlerRef.current = callback;
  }, []);

  /**
   * Register producer closed listener
   */
  const onProducerClosed = useCallback((callback) => {
    producerClosedHandlerRef.current = callback;
  }, []);

  const onRoomEnded = useCallback((callback) => {
    roomEndedHandlerRef.current = callback;
  }, []);

  const onUserLeft = useCallback((callback) => {
    userLeftHandlerRef.current = callback;
  }, []);

  /**
   * Disconnect socket
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  return {
    // State
    socketRef,
    connectionStatus,
    chatMessages,
    participants,

    // Methods
    initializeSocket,
    sendChatMessage,
    updateDisplayName,
    emitGetRouterRtpCapabilities,
    emitCreateWebRtcTransport,
    emitConnectTransport,
    emitProduce,
    emitConsume,
    emitResumeConsumer,
    emitEndRoom,
    onSfuExistingProducers,
    onNewProducer,
    onProducerClosed,
    onRoomEnded,
    onUserLeft,
    disconnect,

    // Setters
    setConnectionStatus,
    setChatMessages,
    setParticipants,
  };
};
