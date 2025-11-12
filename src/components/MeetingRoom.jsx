import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios"; // Use the new centralized instance
import io from "socket.io-client";
import { Device } from "mediasoup-client";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiPhone,
  FiShare,
  FiUsers,
  FiMessageSquare,
  FiSettings,
  FiMonitor,
} from "react-icons/fi";

import "../styles/meetingRoom.css";

const MeetingRoom = () => {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [hasJoined, setHasJoined] = useState(false);
  const [previewAudioOn, setPreviewAudioOn] = useState(true);
  const [previewVideoOn, setPreviewVideoOn] = useState(true);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const settingsInitializedRef = useRef(false);

  const [pendingProducers, setPendingProducers] = useState([]);
  const sfuRecvTransportReadyRef = useRef(false);
  // --- Refactored: Error state is now a single string ---
  const [error, setError] = useState("");

  // --- General Refs ---
  const socketRef = useRef();
  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const screenStreamRef = useRef();

  // Refs for SFU connection
  const sfuDeviceRef = useRef();
  const sfuSendTransportRef = useRef();
  const sfuRecvTransportRef = useRef();
  const sfuProducersRef = useRef(new Map());
  const sfuConsumersRef = useRef(new Map());

  const fetchMeetingDetails = useCallback(async () => {
    try {
      // Use the new instance. The URL is now relative to '/api'
      const response = await api.get(`/meetings/${meetingId}`);
      setMeeting(response.data.meeting);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 410) {
        setError("This meeting has expired");
      } else {
        setError("Meeting not found or you do not have access to this meeting");
      }
      setLoading(false);
    }
  }, [meetingId]);

  // Initialize local media for preview or join
  const initializeMedia = useCallback(
    async (forPreview = true) => {
      try {
        // Use selected device IDs if available
        const videoConstraints = selectedCameraId
          ? {
              deviceId: { exact: selectedCameraId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            };
        const audioConstraints = selectedMicId
          ? {
              deviceId: { exact: selectedMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });

        // Apply preview preferences
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        if (audioTrack) audioTrack.enabled = previewAudioOn;
        if (videoTrack) videoTrack.enabled = previewVideoOn;

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          try {
            // mute local preview playback to avoid echo and trigger playback
            localVideoRef.current.muted = true;
            localVideoRef.current.playsInline = true;
            const p =
              localVideoRef.current.play && localVideoRef.current.play();
            if (p && p.catch) p.catch(() => {});
          } catch (e) {
            // ignore autoplay errors
          }
          // ensure metadata loads then play
          localVideoRef.current.onloadedmetadata = () => {
            try {
              localVideoRef.current.play().catch(() => {});
            } catch (e) {}
          };
        }

        setLoading(false);
        setConnectionStatus("Preview ready");
        return stream;
      } catch (error) {
        console.error("Error accessing media devices:", error);
        setError(
          "Unable to access camera or microphone. Please check permissions."
        );
        setLoading(false);
        throw error;
      }
    },
    [previewAudioOn, previewVideoOn, selectedCameraId, selectedMicId]
  );

  useEffect(() => {
    if (hasJoined && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      try {
        localVideoRef.current.play().catch(() => {});
      } catch (e) {
        // ignore
      }
    }
  }, [hasJoined]);

  const cleanup = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    destroySfuConnection();
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  useEffect(() => {
    // Fetch meeting details and initialize media for preview
    const init = async () => {
      try {
        await fetchMeetingDetails();
        // Automatically initialize media for the preview
        await initializeMedia(true);
      } catch (err) {
        // Errors are set by the individual functions
        console.error("Initialization failed:", err);
      }
    };

    init();

    return () => {
      cleanup();
    };
  }, [meetingId, fetchMeetingDetails, initializeMedia]);

  // enumerate devices (cameras & mics)
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      setAvailableCameras(cameras);
      setAvailableMics(mics);
      if (!selectedCameraId && cameras[0])
        setSelectedCameraId(cameras[0].deviceId);
      if (!selectedMicId && mics[0]) setSelectedMicId(mics[0].deviceId);
    } catch (e) {
      console.warn("Could not enumerate devices", e);
    }
  }, [selectedCameraId, selectedMicId]);

  // initialize device list once when settings are first shown
  useEffect(() => {
    if (!settingsInitializedRef.current) {
      enumerateDevices();
      settingsInitializedRef.current = true;
    }
  }, [enumerateDevices]);

  const copyMeetingLink = () => {
    const url = window.location.href;
    try {
      navigator.clipboard.writeText(url);
      // small in-memory toast could be added later
    } catch (e) {
      console.error("Copy failed", e);
    }
  };

  const initializeSocket = useCallback(() => {
    // When served via the Vite proxy, we can use a relative path.
    // The `path` option is important for the proxy to work correctly.
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    socketRef.current = io(backendUrl, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server");
      setConnectionStatus("Connected");

      // Join the meeting room
      socketRef.current.emit("join-room", {
        roomId: meetingId,
        userId: user.id,
        userName: user.name,
      });
    });

    // Server acknowledgement that join processing completed
    socketRef.current.on("joined", ({ roomId: rId, socketId }) => {
      console.log(
        "Server acknowledged join for room:",
        rId,
        "socketId:",
        socketId
      );
      // If media isn't initialized yet, initialize it; otherwise clear loading
      initializeSfuConnection();

      if (!localStreamRef.current) {
        initializeMedia(false).catch(() => {});
      } else {
        setLoading(false);
        setConnectionStatus("Connected");
      }
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setConnectionStatus("Connection failed");
    });

    // (1) This fires for YOU when you join, listing everyone already there
    socketRef.current.on("existing-users", (users) => {
      console.log(
        `%c[Socket] Found ${users.length} existing users:`,
        "color: blue; font-weight: bold;",
        users
      );
      // In a real app, you'd setParticipants(users) here
      // For now, we'll just log it.
    });

    // (2) This fires for OTHERS when YOU join
    socketRef.current.on("user-joined", ({ userName, userId, socketId }) => {
      console.log(
        `%c[Socket] New user joined: ${userName} (ID: ${userId})`,
        "color: green; font-weight: bold;"
      );
      // In a real app, you'd setParticipants(prev => [...prev, newUser]) here
      // For now, we'll just log it.
    });

    // --- SFU Specific Listeners ---
    socketRef.current.on("sfu-existing-producers", (producers) => {
      console.log("Received existing producers:", producers);
      // --- FIX: Check if transport is ready before consuming ---
      if (sfuRecvTransportReadyRef.current) {
        console.log("Recv transport ready, consuming immediately.");
        producers.forEach((producerInfo) => consumeSfuStream(producerInfo));
      } else {
        // If not ready, buffer them
        console.log("Recv transport NOT ready, buffering producers.");
        setPendingProducers(producers);
      }
    });

    socketRef.current.on("new-producer", (producerInfo) => {
      console.log("A new producer has joined:", producerInfo);
      consumeSfuStream(producerInfo);
    });

    socketRef.current.on("producer-closed", ({ producerId }) => {
      // This event would be sent from the server when a producer is closed
      // For simplicity, we handle this via 'user-left' for now.
      // A more robust implementation would handle this to remove a single stream
      // from a participant (e.g., they stop their video but not audio).
      console.log("A producer has left:", producerId);
      // To implement: find participant by producerId and remove their stream.
    });

    // Chat messages
    socketRef.current.on("chat-message", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socketRef.current.on("user-left", ({ socketId, userId }) => {
      console.log("User left:", userId);
      // Remove participant from the list
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      // Consumers associated with this user will be closed by the server,
      // and their tracks will end, which should be handled gracefully.
    });

    socketRef.current.on("disconnect", () => {
      console.log("Disconnected from signaling server");
      setConnectionStatus("Disconnected");
    });
  }, [user]);

  const initializeSfuConnection = useCallback(async () => {
    console.log("Initializing SFU connection...");
    setParticipants([]); // Clear P2P participants

    // 1. Get Router RTP capabilities from server
    socketRef.current.emit(
      "getRouterRtpCapabilities",
      meetingId,
      async (routerRtpCapabilities) => {
        if (routerRtpCapabilities && !routerRtpCapabilities.error) {
          // 2. Create a mediasoup-client Device
          const device = new Device();
          sfuDeviceRef.current = device;

          // 3. Load capabilities into the device
          await device.load({ routerRtpCapabilities });
          console.log("SFU Device loaded");

          // 4. Create a "send" transport to send our media
          socketRef.current.emit(
            "createWebRtcTransport",
            { type: "send" },
            async (params) => {
              if (params.error)
                return setError(
                  `Error creating send transport: ${params.error}`
                );

              const transport = device.createSendTransport(params);
              sfuSendTransportRef.current = transport;

              transport.on(
                "connect",
                ({ dtlsParameters }, callback, errback) => {
                  socketRef.current.emit(
                    "connectTransport",
                    { transportId: transport.id, dtlsParameters },
                    () => callback()
                  );
                }
              );

              transport.on(
                "produce",
                async ({ kind, rtpParameters, appData }, callback, errback) => {
                  if (!socketRef.current)
                    return errback(new Error("Socket not connected"));
                  socketRef.current.emit(
                    "produce",
                    { transportId: transport.id, kind, rtpParameters, appData },
                    ({ id }) => {
                      callback({ id });
                    }
                  );
                }
              );

              // 5. Create producers for our local video and audio tracks
              const audioTrack = localStreamRef.current.getAudioTracks()[0];
              if (audioTrack) {
                const audioProducer = await transport.produce({
                  track: audioTrack,
                });
                sfuProducersRef.current.set("audio", audioProducer);
              }
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              if (videoTrack) {
                const videoProducer = await transport.produce({
                  track: videoTrack,
                });
                sfuProducersRef.current.set("video", videoProducer);
              }
            }
          );

          // 6. Create a "receive" transport to receive media from others
          socketRef.current.emit(
            "createWebRtcTransport",
            { type: "recv" },
            async (params) => {
              if (params.error)
                return setError(
                  `Error creating recv transport: ${params.error}`
                );

              const transport = device.createRecvTransport(params);
              sfuRecvTransportRef.current = transport;

              transport.on(
                "connect",
                ({ dtlsParameters }, callback, errback) => {
                  socketRef.current.emit(
                    "connectTransport",
                    { transportId: transport.id, dtlsParameters },
                    () => callback()
                  );
                }
              );
              sfuRecvTransportReadyRef.current = true;
     console.log('Recv transport created. Checking for buffered producers.');

     // Use the setPendingProducers callback to get the latest state
     setPendingProducers(prevPendingProducers => {
      if (prevPendingProducers.length > 0) {
          console.log(`Consuming ${prevPendingProducers.length} buffered producers.`);
       prevPendingProducers.forEach(producerInfo => consumeSfuStream(producerInfo));
       return []; // Clear the buffer
      }
      return []; // No producers, just return empty
       });
            }
          );
        } else {
          setError(
            `Could not get router capabilities: ${
              routerRtpCapabilities?.error || "Unknown error"
            }`
          );
        }
      }
    );
  }, [meetingId]);

const consumeSfuStream = useCallback(async ({ producerId, userId, userName, kind }) => {
    console.log(`%c[SFU] Attempting to consume producer: ${producerId} (kind: ${kind}, user: ${userName})`, 'color: #0088cc');

    if (!sfuDeviceRef.current || !sfuRecvTransportRef.current) {
      console.error('[SFU] Consume failed: SFU device or receive transport is not ready.');
      return;
    }

    const { rtpCapabilities } = sfuDeviceRef.current;
    if (!socketRef.current) {
      console.error('[SFU] Consume failed: Socket is not connected.');
      return;
    }

    const transportId = sfuRecvTransportRef.current.id;
    console.log(`[SFU] Emitting 'consume' to server for producer ${producerId} on transport ${transportId}`);

    // This is the async callback we need to wrap
    socketRef.current.emit('consume', { rtpCapabilities, producerId, transportId }, async (params) => {
      try {
        console.log(`[SFU] Server sent back 'consume' params for ${producerId}:`, params);

        if (params.error) {
          console.error(`[SFU] Server 'consume' error for ${producerId}:`, params.error);
          return;
        }

        // --- This is the most likely point of failure ---
        console.log(`[SFU] Calling sfuRecvTransport.consume() for ${producerId}`);
        const consumer = await sfuRecvTransportRef.current.consume(params);
        console.log(`[SFU] Consume successful. Created consumer ${consumer.id} for producer ${producerId}`);
        // --- End of failure point ---

        sfuConsumersRef.current.set(consumer.id, consumer);

        // Resume the consumer on the server
        console.log(`[SFU] Emitting 'resume-consumer' for ${consumer.id}`);
        socketRef.current.emit('resume-consumer', { consumerId: consumer.id });

        const { track } = consumer;
        console.log(`[SFU] Got track ${track.kind} (${track.id}) for consumer ${consumer.id}`);

        // Update React state
        console.log(`[SFU] Updating participants state for userId: ${userId}`);
        setParticipants(prev => {
     const existingParticipant = prev.find(p => p.userId === userId);
     
     if (existingParticipant) {
      console.log(`[SFU] State: Adding track to existing participant ${userName}`);
      
      // 1. Get all *current* tracks from the old stream
      const oldStream = existingParticipant.stream;
      const allTracks = [...oldStream.getTracks(), track]; // Add the new track
      
      // 2. Create a brand new MediaStream object
      const newStream = new MediaStream(allTracks);

      // 3. Return a new participant map
      return prev.map(p => 
       p.userId === userId 
        ? { 
         ...p, 
         stream: newStream, // <-- Assign the NEW stream object
         audioOn: (kind === 'audio' ? true : p.audioOn),
          videoOn: (kind === 'video' ? true : p.videoOn),
        } 
       : p
     );
     } else {
      // This is the first track, create the participant
      console.log(`[SFU] State: Creating new participant ${userName} with first track`);
      return [...prev, {
       socketId: `sfu-${userId}`,
       userId,
       userName,
       stream: new MediaStream([track]), // Create the stream
       audioOn: kind === 'audio',
       videoOn: kind === 'video',
      }];
     }
    });
        console.log(`[SFU] Participant state update complete for ${userId}`);

      } catch (error) {
        console.error(`[SFU] CRITICAL FAILURE in consume callback for producer ${producerId}:`, error);
      }
    });
  }, []);

  const destroySfuConnection = useCallback(() => {
    console.log("Tearing down SFU connection.");
    if (sfuSendTransportRef.current) {
      sfuSendTransportRef.current.close();
      sfuSendTransportRef.current = null;
    }
    if (sfuRecvTransportRef.current) {
      sfuRecvTransportRef.current.close();
      sfuRecvTransportRef.current = null;
    }
    if (sfuDeviceRef.current) {
      sfuDeviceRef.current = null;
    }
    if (sfuProducersRef.current.size > 0) {
      sfuProducersRef.current.forEach((producer) => producer.close());
      sfuProducersRef.current.clear();
    }
    if (sfuConsumersRef.current.size > 0) {
      sfuConsumersRef.current.forEach((consumer) => consumer.close());
      sfuConsumersRef.current.clear();
    }
    setParticipants([]);
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
        const audioProducer = sfuProducersRef.current.get("audio");
        if (audioProducer) {
          audioTrack.enabled ? audioProducer.resume() : audioProducer.pause();
        }
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
        const videoProducer = sfuProducersRef.current.get("video");
        if (videoProducer) {
          videoTrack.enabled ? videoProducer.resume() : videoProducer.pause();
        }
      }
    }
  }, []);

  const handleDeviceChange = async () => {
  console.log('Applying new devices...');
  try {
   // 1. Get a new stream with the new device IDs
   // We use initializeMedia's logic but don't set state yet
   const videoConstraints = selectedCameraId
    ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
   const audioConstraints = selectedMicId
    ? { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

   console.log('[DeviceChange] Getting new media with constraints:', { video: videoConstraints, audio: audioConstraints });
   const newStream = await navigator.mediaDevices.getUserMedia({ 
    video: videoConstraints, 
    audio: audioConstraints 
   });
   console.log('[DeviceChange] Got new stream:', newStream.id);

   // Get new tracks
   const newAudioTrack = newStream.getAudioTracks()[0];
   const newVideoTrack = newStream.getVideoTracks()[0];
   console.log('[DeviceChange] New tracks:', { audio: newAudioTrack?.label, video: newVideoTrack?.label });

   const audioProducer = sfuProducersRef.current.get('audio');
   if (audioProducer && newAudioTrack) {
    console.log('[DeviceChange] Replacing audio track...');
    await audioProducer.replaceTrack({ track: newAudioTrack });
    console.log('[DeviceChange] Audio track replaced.');
   }
   
   const videoProducer = sfuProducersRef.current.get('video');
   if (videoProducer && newVideoTrack) {
    console.log('[DeviceChange] Replacing video track...');
    await videoProducer.replaceTrack({ track: newVideoTrack });
    console.log('[DeviceChange] Video track replaced.');
   }

   // 3. Update local stream ref with the new stream
   // Stop the OLD stream tracks
   if (localStreamRef.current) {
    console.log('[DeviceChange] Stopping old stream tracks...');
    localStreamRef.current.getTracks().forEach(track => track.stop());
   }
   
   // 4. Apply new stream
   localStreamRef.current = newStream;
   if (localVideoRef.current) {
    localVideoRef.current.srcObject = newStream;
   }
   
   // new tracks respect current mute state
   if (newAudioTrack) newAudioTrack.enabled = isAudioOn;
   if (newVideoTrack) newVideoTrack.enabled = isVideoOn;

   console.log('[DeviceChange] Devices updated successfully');
   setShowSettings(false); // Close settings panel

  } catch (err) {
   console.error('[DeviceChange] FAILED to apply new devices:', err);
   // Log the error name specifically for mobile debugging
   if (err && err.name) {
    console.error('[DeviceChange] Error name:', err.name);
   }
   setError('Failed to switch devices. Please check permissions.');
  }
 };

  const shareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setIsScreenSharing(true);
      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => stopScreenShare();

      // Replace video track with screen track in SFU
      const videoProducer = sfuProducersRef.current.get("video");
      if (videoProducer)
        await videoProducer.replaceTrack({ track: screenTrack });

      // Update local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
    } catch (error) {
      console.error("Error sharing screen:", error);
      setIsScreenSharing(false);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    const cameraTrack = localStreamRef.current.getVideoTracks()[0];

    // Replace screen track with camera track in SFU
    const videoProducer = sfuProducersRef.current.get("video");
    if (videoProducer && cameraTrack)
      await videoProducer.replaceTrack({ track: cameraTrack });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, []);

  const handleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      shareScreen();
    }
  }, [isScreenSharing, shareScreen, stopScreenShare]);

  const leaveMeeting = async () => {
    try {
      // Use the new instance. The URL is now relative to '/api'
      await api.post(`/meetings/${meetingId}/leave`);
    } catch (error) {
      console.error("Error leaving meeting:", error);
    }

    cleanup();
    // restore scrolling
    try {
      document.body.style.overflow = "";
    } catch (e) {}
    setHasJoined(false);
    navigate("/dashboard");
  };

  const handleJoin = async () => {
    setError("");
    setLoading(true);
    try {
      // Ensure we have a stream (preview may have already set it)
      if (!localStreamRef.current) {
        await initializeMedia(false);
      }

      // Apply preview toggles to tracks (if any)
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (audioTrack) audioTrack.enabled = previewAudioOn;
      if (videoTrack) videoTrack.enabled = previewVideoOn;

      setIsAudioOn(previewAudioOn);
      setIsVideoOn(previewVideoOn);
      // Tell server we join
      // Use the new instance. The URL is now relative to '/api'
      await api.post(`/meetings/${meetingId}/join`, { displayName });

      // Init socket and join signaling
      if (!socketRef.current) {
        initializeSocket();
        // initializeSfuConnection();
      }

      // prevent background scroll and make full-screen
      try {
        document.body.style.overflow = "hidden";
      } catch (e) {}
      setHasJoined(true);
      setLoading(false);
    } catch (err) {
      console.error("Error during join:", err);
      setError("Failed to join meeting. See console for details.");
      setLoading(false);
    }
  };

  const togglePreviewAudio = () => {
    setPreviewAudioOn((v) => {
      const next = !v;
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = next;
      return next;
    });
  };

  const togglePreviewVideo = () => {
    setPreviewVideoOn((v) => {
      const next = !v;
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = next;
      return next;
    });
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = {
      from: displayName || user?.name,
      text: chatInput.trim(),
      ts: Date.now(),
    };
    setChatMessages((prev) => [...prev, msg]);
    setChatInput("");
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat-message", msg);
    }
  };

  const updateDisplayName = (e) => {
    setDisplayName(e.target.value);
    if (socketRef.current?.connected) {
      socketRef.current.emit("update-name", { name: e.target.value });
    }
  };

  // ... after your updateDisplayName function

  const toggleChat = () => {
    setShowChat((s) => !s);
    setShowSettings(false); // Close settings when opening chat
  };

  const toggleSettings = () => {
    setShowSettings((s) => !s);
    setShowChat(false); // Close chat when opening settings
  };

  if (loading) {
    return (
      <div className="meeting-loading">
        <div className="loading-spinner"></div>
        <p>Joining meeting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="meeting-error">
        <div className="error-content">
          <h2>Unable to Join Meeting</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  // If user hasn't formally joined, show pre-join preview UI
  // If user hasn't formally joined, show pre-join preview UI
  if (!hasJoined) {
    return (
      <div className="meeting-room prejoin-container">
        {/* This is the new card layout */}
        <div className="prejoin-card">
          {/* --- LEFT COLUMN (VIDEO) --- */}
          <div className="prejoin-video-col">
            <div className="video-container local-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="video-stream"
              />
              {/* This overlay logic fixes the squeezed icon bug */}
              <div className="video-overlay">
                <span className="participant-name">
                  {!hasJoined
                    ? `Preview: ${displayName || user?.name}`
                    : `${displayName || user?.name} (You)`}
                </span>

                {/* --- THIS IS THE NEW, CORRECTED LOGIC --- */}
                <div className="video-controls">
                  {!hasJoined ? (
                    <>
                      {!previewAudioOn && (
                        <FiMicOff className="muted-indicator" />
                      )}
                      {!previewVideoOn && (
                        <FiVideoOff className="video-off-indicator" />
                      )}
                    </>
                  ) : (
                    <>
                      {!isAudioOn && <FiMicOff className="muted-indicator" />}
                      {!isVideoOn && (
                        <FiVideoOff className="video-off-indicator" />
                      )}
                      {isScreenSharing && (
                        <FiMonitor className="screen-sharing-indicator" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN (CONTROLS) --- */}
          <div className="prejoin-controls-col">
            <h3 className="prejoin-title">
              {meeting?.title || "Instant Meeting"}
            </h3>

            {/* Name Input */}
            <div className="form-group">
              <label htmlFor="name-input">Your name</label>
              <input
                id="name-input"
                value={displayName}
                onChange={updateDisplayName}
                className="form-input"
                placeholder="Enter your name"
              />
            </div>

            {/* Media Toggles */}
            <div className="prejoin-media-toggles">
              <button
                className={`btn btn-secondary ${
                  !previewAudioOn ? "disabled" : ""
                }`}
                onClick={togglePreviewAudio}
              >
                {previewAudioOn ? <FiMic /> : <FiMicOff />}
                {previewAudioOn ? "Mic On" : "Mic Off"}
              </button>
              <button
                className={`btn btn-secondary ${
                  !previewVideoOn ? "disabled" : ""
                }`}
                onClick={togglePreviewVideo}
              >
                {previewVideoOn ? <FiVideo /> : <FiVideoOff />}
                {previewVideoOn ? "Cam On" : "Cam Off"}
              </button>
            </div>

            {/* Join Button */}
            <button
              className="btn btn-primary btn-join"
              onClick={handleJoin}
              disabled={!displayName}
            >
              Join Meeting
            </button>

            <hr className="divider" />

            {/* Meeting Details */}
            <div className="prejoin-details">
              <h4>Meeting details</h4>
              <div>
                <strong>ID:</strong> {meetingId}
              </div>
              <div>
                <strong>Scheduled:</strong> {meeting?.scheduledAt || "N/A"}
              </div>
            </div>

            <p className="prejoin-helper-text">
              You can preview camera & mic before joining. If you turn mic off
              here, you'll join muted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalParticipants = participants.length + 1; // +1 for local user

  return (
    <div className="meeting-room">
      {/* Wrapper for main content to ensure footer is positioned correctly */}
      <div className="meeting-content-wrapper">
        <div className="meeting-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2>{meeting?.title}</h2>
          </div>
          <div className="meeting-info">
            <div className="meeting-participants-count">
              <FiUsers />
              {totalParticipants} participant
              {totalParticipants !== 1 ? "s" : ""}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginLeft: 12,
              }}
            >
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                ID: {meetingId}
              </div>
              <button
                className="btn btn-secondary"
                onClick={copyMeetingLink}
                style={{ padding: "6px 8px" }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* --- NEW MAIN BODY WRAPPER --- */}
        <div className="meeting-body">
          {/* 1. CHAT PANEL (NOW IN THE FLOW) */}
          {showChat && (
            <div className="side-drawer">
              <div className="panel-header">
                <strong>Chat</strong>
                <button
                  className="btn btn-secondary btn-close"
                  onClick={toggleChat}
                >
                  Close
                </button>
              </div>
              <div className="chat-messages">
                {chatMessages.map((m, idx) => (
                  <div key={idx} className="chat-message-item">
                    <div className="chat-message-header">
                      {m.from} • {new Date(m.ts).toLocaleTimeString()}
                    </div>
                    <div>{m.text}</div>
                  </div>
                ))}
              </div>
              <div className="chat-input">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Message"
                  className="form-input"
                />
                <button className="btn btn-primary" onClick={sendChatMessage}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* 2. VIDEO GRID (WILL NOW SQUISH) */}
          <div
            className={`video-grid ${
              totalParticipants === 1
                ? "single"
                : totalParticipants === 2
                ? "two"
                : totalParticipants <= 4
                ? "four"
                : "many"
            }`}
          >
            {/* Local Video */}
            <div className="video-container local-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="video-stream"
              />
              {/* This overlay logic fixes the squeezed icon bug */}
              <div className="video-overlay">
                <span className="participant-name">
                  {!hasJoined
                    ? `Preview: ${displayName || user?.name}`
                    : `${displayName || user?.name} (You)`}
                </span>

                {/* --- THIS IS THE NEW, CORRECTED LOGIC --- */}
                <div className="video-controls">
                  {!hasJoined ? (
                    <>
                      {!previewAudioOn && (
                        <FiMicOff className="muted-indicator" />
                      )}
                      {!previewVideoOn && (
                        <FiVideoOff className="video-off-indicator" />
                      )}
                    </>
                  ) : (
                    <>
                      {!isAudioOn && <FiMicOff className="muted-indicator" />}
                      {!isVideoOn && (
                        <FiVideoOff className="video-off-indicator" />
                      )}
                      {isScreenSharing && (
                        <FiMonitor className="screen-sharing-indicator" />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Remote Videos */}
            {participants.map((participant) => (
              <RemoteVideo
                key={participant.socketId}
                participant={participant}
              />
            ))}
          </div>
        </div>
      </div>
      {/* --- END OF NEW MAIN BODY WRAPPER --- */}

      {/* 3. SETTINGS PANEL (STILL AN OVERLAY) */}
      {showSettings && (
        <div className="settings-panel">
          <div className="panel-header">
            <strong>Settings</strong>
            <button
              className="btn btn-secondary btn-close"
              onClick={toggleSettings}
            >
              Close
            </button>
          </div>
          <div className="panel-content">
            <div className="form-group">
              <label htmlFor="settings-name">Display Name</label>
              <input
                id="settings-name"
                value={displayName}
                onChange={updateDisplayName}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="settings-cam">Camera</label>
              <select
                id="settings-cam"
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="form-input"
              >
                {availableCameras.map((cam) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera ${cam.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="settings-mic">Microphone</label>
              <select
                id="settings-mic"
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="form-input"
              >
                {availableMics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label || `Mic ${m.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-actions">
              <button
                className="btn btn-secondary"
                onClick={enumerateDevices}
                title="Refresh devices"
              >
                Refresh
              </button>
              <button className="btn btn-primary" onClick={handleDeviceChange}>
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MEETING CONTROLS (FIXED TO BOTTOM) */}
      <div className="meeting-controls">
        <div className="control-group">
          <button
            onClick={toggleAudio}
            className={`control-btn ${!isAudioOn ? "disabled" : ""}`}
            title={isAudioOn ? "Mute" : "Unmute"}
          >
            {isAudioOn ? <FiMic /> : <FiMicOff />}
          </button>

          <button
            onClick={toggleVideo}
            className={`control-btn ${!isVideoOn ? "disabled" : ""}`}
            title={isVideoOn ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoOn ? <FiVideo /> : <FiVideoOff />}
          </button>

          <button
            onClick={handleScreenShare}
            className={`control-btn ${isScreenSharing ? "active" : ""}`}
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <FiShare />
          </button>

          {/* USE THE NEW TOGGLE FUNCTIONS */}
          <button className="control-btn" onClick={toggleChat} title="Chat">
            <FiMessageSquare />
          </button>

          <button
            className="control-btn"
            onClick={toggleSettings}
            title="Settings"
          >
            <FiSettings />
          </button>
        </div>

        <button
          onClick={leaveMeeting}
          className="control-btn leave-btn"
          title="Leave meeting"
        >
          <FiPhone />
        </button>
      </div>
    </div>
  );
};

// Remote Video Component
// Remote Video Component
const RemoteVideo = ({ participant }) => {
  const videoRef = useRef();

  // This hook will now run correctly when the stream is first created (with audio)
  // and again when it's replaced (with audio + video).
  useEffect(() => {
    console.log(`[RemoteVideo] useEffect running for ${participant.userName}. Stream:`, participant.stream);
    
    if (participant.stream && videoRef.current) {
      // Attach the stream (which has both audio and video) directly
      videoRef.current.srcObject = participant.stream;
      
      // Attempt to play.
      videoRef.current.play().catch(e => {
        console.warn(`[RemoteVideo] Autoplay was prevented for ${participant.userName}.`, e.name);
        // This is a common browser restriction.
        // The user may need to click the screen to enable audio.
      });
    }
  }, [participant.stream]); // Depend only on the stream object itself

  return (
    <div className="video-container remote-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={true}
        // NOTE: We DO NOT MUTE the remote stream, because we want to hear the user.
        className="video-stream"
      />
      {/* No separate audio element needed */}

      <div className="video-overlay">
        <span className="participant-name">{participant.userName}</span>
        <div className="video-controls">
          {!participant.audioOn && <FiMicOff className="muted-indicator" />}
          {!participant.videoOn && <FiVideoOff className="video-off-indicator" />}
        </div>
      </div>
    </div>
  );
};


export default MeetingRoom;
