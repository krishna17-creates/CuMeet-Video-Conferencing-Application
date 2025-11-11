import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios'; // Use the new centralized instance
import io from 'socket.io-client';
import { Device } from 'mediasoup-client';
import Peer from 'simple-peer';
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
  FiMonitor
} from 'react-icons/fi';

import '../styles/meetingRoom.css';

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
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [topology, setTopology] = useState('p2p'); // 'p2p' or 'sfu'
  const [hasJoined, setHasJoined] = useState(false);
  const [previewAudioOn, setPreviewAudioOn] = useState(true);
  const [previewVideoOn, setPreviewVideoOn] = useState(true);
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');
  const settingsInitializedRef = useRef(false);

  // --- General Refs ---
  const socketRef = useRef();
  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peersRef = useRef([]);
  const screenStreamRef = useRef();

  // Refs for SFU connection
  const sfuDeviceRef = useRef();
  const sfuSendTransportRef = useRef();
  const sfuRecvTransportRef = useRef();
  const sfuProducersRef = useRef(new Map());

  const fetchMeetingDetails = useCallback(async () => {
    try {
      // Use the new instance. The URL is now relative to '/api'
      const response = await api.get(`/meetings/${meetingId}`);
      setMeeting(response.data.meeting);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 410) {
        setError('This meeting has expired');
      } else {
        setError('Meeting not found or you do not have access to this meeting');
      }
      setLoading(false);
    }
  }, [meetingId]);

  // Initialize local media for preview or join
  const initializeMedia = useCallback(async (forPreview = true) => {
    try {
      // Use selected device IDs if available
      const videoConstraints = selectedCameraId
        ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
      const audioConstraints = selectedMicId
        ? { deviceId: { exact: selectedMicId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: audioConstraints });

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
          const p = localVideoRef.current.play && localVideoRef.current.play();
          if (p && p.catch) p.catch(() => {});
        } catch (e) {
          // ignore autoplay errors
        }
        // ensure metadata loads then play
        localVideoRef.current.onloadedmetadata = () => {
          try { localVideoRef.current.play().catch(()=>{}); } catch(e){}
        };
      }

      setLoading(false);
      setConnectionStatus('Preview ready');
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError('Unable to access camera or microphone. Please check permissions.');
      setLoading(false);
      throw error;
    }
  }, [previewAudioOn, previewVideoOn, selectedCameraId, selectedMicId]);

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
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (topology === 'p2p') destroyP2pConnections();
    if (topology === 'sfu') destroySfuConnection();
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
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAvailableCameras(cameras);
      setAvailableMics(mics);
      if (!selectedCameraId && cameras[0]) setSelectedCameraId(cameras[0].deviceId);
      if (!selectedMicId && mics[0]) setSelectedMicId(mics[0].deviceId);
    } catch (e) {
      console.warn('Could not enumerate devices', e);
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
      console.error('Copy failed', e);
    }
  };

  const initializeSocket = useCallback(() => {
    // When served via the Vite proxy, we can use a relative path.
    // The `path` option is important for the proxy to work correctly.
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    socketRef.current = io(backendUrl, {
      transports: ['websocket', 'polling'],
      path: '/socket.io'
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
      setConnectionStatus('Connected');

      // Join the meeting room
      socketRef.current.emit('join-room', {
        roomId: meetingId,
        userId: user.id,
        userName: user.name
      });
    });

    // Server acknowledgement that join processing completed
    socketRef.current.on('joined', ({ roomId: rId, socketId }) => {
      console.log('Server acknowledged join for room:', rId, 'socketId:', socketId);
      // If media isn't initialized yet, initialize it; otherwise clear loading
      if (!localStreamRef.current) {
        initializeMedia(false).catch(()=>{});
      } else {
        setLoading(false);
        setConnectionStatus('Connected');
      }
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionStatus('Connection failed');
    });

    // --- TOPOLOGY MIGRATION LOGIC (These need to be aware of current state) ---
    socketRef.current.on('migrate-to-sfu', () => {
      if (topology === 'sfu' && sfuDeviceRef.current) return; // Already in SFU mode
      console.log('%cSERVER COMMAND: MIGRATE TO SFU', 'color: orange; font-weight: bold;');
      setTopology('sfu');
      destroyP2pConnections();
      initializeSfuConnection();
    });

    socketRef.current.on('migrate-to-p2p', () => {
      if (topology === 'p2p') return; // Already in P2P mode
      console.log('%cSERVER COMMAND: MIGRATE TO P2P', 'color: green; font-weight: bold;');
      setTopology('p2p');
      destroySfuConnection();
      // The server will re-send 'existing-users' to re-establish P2P connections
      // For now, we just clean up the SFU side.
    });

    // --- SFU Specific Listeners (These need to be aware of current state) ---
    socketRef.current.on('sfu-existing-producers', (producers) => {
      if (topology !== 'sfu') return;
      console.log('Received existing producers:', producers);
      producers.forEach(producerInfo => consumeSfuStream(producerInfo));
    });
    
    socketRef.current.on('new-producer', (producerInfo) => {
      if (topology !== 'sfu') return;
      console.log('A new producer has joined:', producerInfo);
      consumeSfuStream(producerInfo);
    });

    socketRef.current.on('producer-closed', ({ producerId }) => {
      // This event would be sent from the server when a producer is closed
      // For simplicity, we handle this via 'user-left' for now.
      // A more robust implementation would handle this to remove a single stream
      // from a participant (e.g., they stop their video but not audio).
      console.log('A producer has left:', producerId);
      // To implement: find participant by producerId and remove their stream.
    });


    socketRef.current.on('existing-users', (existingUsers) => { // This needs to be aware of current state
      console.log('Existing users:', existingUsers);
      
      // Create peer connections for existing users
      existingUsers.forEach(existingUser => {
        if (topology === 'p2p') {
          createPeer(existingUser.socketId, existingUser.userId, existingUser.userName, true);
        }
      });
    });
    
    socketRef.current.on('user-joined', (userData) => {
      console.log('User joined:', userData);
      
      // Create peer connection for new user (they will initiate)
      if (topology === 'p2p') {
        createPeer(userData.socketId, userData.userId, userData.userName, false);
      }
    });

    // Chat messages
    socketRef.current.on('chat-message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });
    
    socketRef.current.on('signal', ({ signal, fromSocketId, fromUserId }) => {
      console.log('Received signal from:', fromUserId);
      
      const peerObj = peersRef.current.find(p => p.socketId === fromSocketId);
      if (peerObj && peerObj.peer) {
        try {
          peerObj.peer.signal(signal);
        } catch (error) {
          console.error('Error processing signal:', error);
        }
      }
    });
    
    socketRef.current.on('user-left', ({ socketId, userId }) => {
      console.log('User left:', userId);
      
      removePeer(socketId);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnectionStatus('Disconnected');
    });
  });

  const removePeer = (socketId) => {
    const peerObj = peersRef.current.find(p => p.socketId === socketId);
    if (peerObj) peerObj.peer?.destroy();
    peersRef.current = peersRef.current.filter(p => p.socketId !== socketId);
    setParticipants(prev => prev.filter(p => p.socketId !== socketId));
  };

  const createPeer = useCallback((socketId, userId, userName, initiator) => {
    const peer = new Peer({
      initiator,
      // enable trickle to exchange ICE candidates incrementally
      trickle: true,
      stream: localStreamRef.current,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
          // Add TURN server here if you have one
          // { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' }
        ]
      }
    });

    const peerObj = {
      peer,
      socketId,
      userId,
      userName,
      videoRef: null
    };

    peer.on('signal', (signal) => {
      console.log('Sending signal to:', userName, 'targetSocketId:', socketId, 'signal-type:', signal.type || 'unknown');
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('signal', {
          targetSocketId: socketId,
          signal,
          userId: user.id
        });
      }
    });

    // Attach low-level RTCPeerConnection state logs to help debug ICE/connectivity
    setTimeout(() => {
      try {
        const pc = peer._pc;
        if (pc) {
          pc.addEventListener('iceconnectionstatechange', () => {
            console.log(`Peer(${userName}) iceConnectionState:`, pc.iceConnectionState);
          });
          pc.addEventListener('icegatheringstatechange', () => {
            console.log(`Peer(${userName}) iceGatheringState:`, pc.iceGatheringState);
          });
          pc.addEventListener('signalingstatechange', () => {
            console.log(`Peer(${userName}) signalingState:`, pc.signalingState);
          });
        }
      } catch (e) {
        // ignore
      }
    }, 1000);

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream from:', userName);
      
      // Update participant with stream
      setParticipants(prev => {
        const updated = prev.filter(p => p.socketId !== socketId);
        return [...updated, {
          socketId,
          userId,
          userName,
          stream: remoteStream,
          audioOn: true,
          videoOn: true
        }];
      });
    });

    peer.on('connect', () => {
      console.log('Peer connection established with:', userName);
    });

    peer.on('error', (error) => {
      console.error('Peer connection error with', userName, ':', error);
    });

    peer.on('close', () => {
      console.log('Peer connection closed with:', userName);
    });

    peersRef.current.push(peerObj);
  }, [user?.id]);

  const destroyP2pConnections = useCallback(() => {
    console.log('Tearing down all P2P connections.');
    peersRef.current.forEach(peerObj => {
      if (peerObj.peer) {
        peerObj.peer.destroy();
      }
    });
    peersRef.current = [];
    setParticipants([]);
  }, []);

  const initializeSfuConnection = useCallback(async () => {
    console.log('Initializing SFU connection...');
    setParticipants([]); // Clear P2P participants

    // 1. Get Router RTP capabilities from server
    socketRef.current.emit('getRouterRtpCapabilities', meetingId, async (routerRtpCapabilities) => {
      try {
        // 2. Create a mediasoup-client Device
        const device = new Device();
        sfuDeviceRef.current = device;

        // 3. Load capabilities into the device
        await device.load({ routerRtpCapabilities });
        console.log('SFU Device loaded');

        // 4. Create a "send" transport to send our media
        socketRef.current.emit('createWebRtcTransport', { type: 'send' }, async (params) => {
          if (params.error) return console.error('Error creating send transport:', params.error);
          
          const transport = device.createSendTransport(params);
          sfuSendTransportRef.current = transport;

          transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socketRef.current.emit('connectTransport', { transportId: transport.id, dtlsParameters }, () => callback());
          });

          transport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            socketRef.current.emit('produce', { transportId: transport.id, kind, rtpParameters, appData }, ({ id }) => {
              callback({ id });
            });
          });

          // 5. Create producers for our local video and audio tracks
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            const audioProducer = await transport.produce({ track: audioTrack });
            sfuProducersRef.current.set('audio', audioProducer);
          }
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            const videoProducer = await transport.produce({ track: videoTrack });
            sfuProducersRef.current.set('video', videoProducer);
          }
        });

        // 6. Create a "receive" transport to receive media from others
        socketRef.current.emit('createWebRtcTransport', { type: 'recv' }, async (params) => {
          if (params.error) return console.error('Error creating recv transport:', params.error);

          const transport = device.createRecvTransport(params);
          sfuRecvTransportRef.current = transport;

          transport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socketRef.current.emit('connectTransport', { transportId: transport.id, dtlsParameters }, () => callback());
          });
        });

      } catch (err) {
        console.error('Error initializing SFU connection:', err);
        setError('Failed to connect to the media server.');
      }
    });
  }, [meetingId]);

  const consumeSfuStream = useCallback(async ({ producerId, userId, userName, kind }) => {
    if (!sfuDeviceRef.current || !sfuRecvTransportRef.current) return;

    const { rtpCapabilities } = sfuDeviceRef.current;
    socketRef.current.emit('consume', { rtpCapabilities, producerId, transportId: sfuRecvTransportRef.current.id }, async (params) => {
      if (params.error) {
        return console.error('Cannot consume', params.error);
      }

      const consumer = await sfuRecvTransportRef.current.consume(params);
      const { track } = consumer;

      setParticipants(prev => {
        const existingParticipant = prev.find(p => p.userId === userId);
        if (existingParticipant) {
          // Participant exists, add new stream track and update state
          const newStream = existingParticipant.stream;
          newStream.addTrack(track);
          return prev.map(p => 
            p.userId === userId 
              ? { 
                  ...p, 
                  stream: newStream,
                  audioOn: kind === 'audio' ? true : p.audioOn,
                  videoOn: kind === 'video' ? true : p.videoOn,
                } 
              : p
          );
        } else {
          // New participant
          return [...prev, {
            socketId: `sfu-${userId}`, // Create a stable ID for SFU participants
            userId,
            userName,
            stream: new MediaStream([track]),
            audioOn: kind === 'audio',
            videoOn: kind === 'video',
          }];
        }
      });
    });
  }, []);

  const destroySfuConnection = useCallback(() => {
    console.log('Tearing down SFU connection.');
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
      sfuProducersRef.current.forEach(producer => producer.close());
      sfuProducersRef.current.clear();
    }
    setParticipants([]);
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
        // Pause/resume SFU audio producer
        if (topology === 'sfu') {
          const audioProducer = sfuProducersRef.current.get('audio');
          if (audioProducer) {
            audioTrack.enabled ? audioProducer.resume() : audioProducer.pause();
          }
        }
      }
    }
  }, [topology]);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
        // Pause/resume SFU video producer
        if (topology === 'sfu') {
          const videoProducer = sfuProducersRef.current.get('video');
          if (videoProducer) {
            videoTrack.enabled ? videoProducer.resume() : videoProducer.pause();
          }
        }
      }
    }
  }, [topology]);

  // ... after toggleVideo function

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

      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints, 
        audio: audioConstraints 
      });

      // Get new tracks
      const newAudioTrack = newStream.getAudioTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      // 2. Replace tracks in all active connections
      if (topology === 'p2p') {
        peersRef.current.forEach(peerObj => {
          if (peerObj.peer && peerObj.peer._pc) {
            try {
              const audioSender = peerObj.peer._pc.getSenders().find(s => s.track && s.track.kind === 'audio');
              if (audioSender && newAudioTrack) audioSender.replaceTrack(newAudioTrack);

              const videoSender = peerObj.peer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
              if (videoSender && newVideoTrack) videoSender.replaceTrack(newVideoTrack);
            } catch (err) {
              console.error('Error replacing track for peer', peerObj.userName, err);
            }
          }
        });
      } else if (topology === 'sfu') {
        const audioProducer = sfuProducersRef.current.get('audio');
        if (audioProducer && newAudioTrack) await audioProducer.replaceTrack({ track: newAudioTrack });
        
        const videoProducer = sfuProducersRef.current.get('video');
        if (videoProducer && newVideoTrack) await videoProducer.replaceTrack({ track: newVideoTrack });
      }

      // 3. Update local stream ref with the new stream
      // Stop the OLD stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // 4. Apply new stream
      localStreamRef.current = newStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
      
 // new tracks respect current mute state
      newAudioTrack.enabled = isAudioOn;
      newVideoTrack.enabled = isVideoOn;

      console.log('Devices updated successfully');
      setShowSettings(false); // Close settings panel

    } catch (err) {
      console.error('Failed to apply new devices:', err);
      setError('Failed to switch devices. Please check permissions.');
    }
  };


  const shareScreen = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setIsScreenSharing(true);
      screenStreamRef.current = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => stopScreenShare();

      // Replace video track for all peers
      if (topology === 'p2p') {
        peersRef.current.forEach(peerObj => {
          if (peerObj.peer && peerObj.peer._pc) {
            try {
              const sender = peerObj.peer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
              if (sender) {
                sender.replaceTrack(screenTrack).then(() => {
                  console.log('Replaced video track with screen for peer', peerObj.userName);
                }).catch(err => {
                  console.error('Error replacing track with screen for peer', peerObj.userName, err);
                });
              }
            } catch (err) {
              console.error('Error accessing pc senders for screen share (p2p):', err);
            }
          }
        });
      } else if (topology === 'sfu') {
        const videoProducer = sfuProducersRef.current.get('video');
        if (videoProducer) await videoProducer.replaceTrack({ track: screenTrack });
      }

      // Update local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
    } catch (error) {
      console.error('Error sharing screen:', error);
      setIsScreenSharing(false);
    }
  }, [topology]);

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    const cameraTrack = localStreamRef.current.getVideoTracks()[0];

    if (topology === 'p2p') {
      peersRef.current.forEach(peerObj => {
        if (peerObj.peer && peerObj.peer._pc) {
          try {
            const sender = peerObj.peer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) {
              sender.replaceTrack(cameraTrack).then(() => {
                console.log('Restored camera track for peer', peerObj.userName);
              }).catch(err => {
                console.error('Error restoring camera track for peer', peerObj.userName, err);
              });
            }
          } catch (err) {
            console.error('Error accessing pc senders for restoring camera (p2p):', err);
          }
        }
      });
    } else if (topology === 'sfu') {
      const videoProducer = sfuProducersRef.current.get('video');
      if (videoProducer) await videoProducer.replaceTrack({ track: cameraTrack });
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [topology]);

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
      console.error('Error leaving meeting:', error);
    }
    
    cleanup();
    // restore scrolling
    try { document.body.style.overflow = ''; } catch(e){}
    setHasJoined(false);
    navigate('/dashboard');
  };

  const handleJoin = async () => {
    setError('');
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
      if (!socketRef.current) initializeSocket();

      // prevent background scroll and make full-screen
      try { document.body.style.overflow = 'hidden'; } catch(e){}
      setHasJoined(true);
      setLoading(false);
    } catch (err) {
      console.error('Error during join:', err);
      setError('Failed to join meeting. See console for details.');
      setLoading(false);
    }
  };

  const togglePreviewAudio = () => {
    setPreviewAudioOn(v => {
      const next = !v;
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = next;
      return next;
    });
  };

  const togglePreviewVideo = () => {
    setPreviewVideoOn(v => {
      const next = !v;
      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = next;
      return next;
    });
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const msg = { from: displayName || user?.name, text: chatInput.trim(), ts: Date.now() };
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat-message', msg);
    }
  };

  const updateDisplayName = (e) => {
    setDisplayName(e.target.value);
    if (socketRef.current?.connected) {
      socketRef.current.emit('update-name', { name: e.target.value });
    }
  };

  // ... after your updateDisplayName function

  const toggleChat = () => {
    setShowChat(s => !s);
    setShowSettings(false); // Close settings when opening chat
  };

  const toggleSettings = () => {
    setShowSettings(s => !s);
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
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
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
              <video ref={localVideoRef} autoPlay muted playsInline className="video-stream" />
              {/* This overlay logic fixes the squeezed icon bug */}
          <div className="video-overlay">
            <span className="participant-name">
              {!hasJoined ? `Preview: ${displayName || user?.name}` : `${displayName || user?.name} (You)`}
            </span>
            
            {/* --- THIS IS THE NEW, CORRECTED LOGIC --- */}
            <div className="video-controls">
              {!hasJoined ? (
                <>
                  {!previewAudioOn && <FiMicOff className="muted-indicator" />}
                  {!previewVideoOn && <FiVideoOff className="video-off-indicator" />}
                </>
              ) : (
                <>
                  {!isAudioOn && <FiMicOff className="muted-indicator" />}
                  {!isVideoOn && <FiVideoOff className="video-off-indicator" />}
                  {isScreenSharing && <FiMonitor className="screen-sharing-indicator" />}
                </>
              )}
            </div>
          </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN (CONTROLS) --- */}
          <div className="prejoin-controls-col">
            <h3 className="prejoin-title">{meeting?.title || 'Instant Meeting'}</h3>
            
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
                className={`btn btn-secondary ${!previewAudioOn ? 'disabled' : ''}`} 
                onClick={togglePreviewAudio}
              >
                {previewAudioOn ? <FiMic /> : <FiMicOff />}
                {previewAudioOn ? 'Mic On' : 'Mic Off'}
              </button>
              <button 
                className={`btn btn-secondary ${!previewVideoOn ? 'disabled' : ''}`} 
                onClick={togglePreviewVideo}
              >
                {previewVideoOn ? <FiVideo /> : <FiVideoOff />}
                {previewVideoOn ? 'Cam On' : 'Cam Off'}
              </button>
            </div>

            {/* Join Button */}
            <button className="btn btn-primary btn-join" onClick={handleJoin} disabled={!displayName}>
              Join Meeting
            </button>
            
            <hr className="divider" />

            {/* Meeting Details */}
            <div className="prejoin-details">
              <h4>Meeting details</h4>
              <div><strong>ID:</strong> {meetingId}</div>
              <div><strong>Scheduled:</strong> {meeting?.scheduledAt || 'N/A'}</div>
            </div>

            <p className="prejoin-helper-text">
              You can preview camera & mic before joining. If you turn mic off here, you'll join muted.
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
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <h2>{meeting?.title}</h2>
        </div>
        <div className="meeting-info">
          <div className="meeting-participants-count">
            <FiUsers />
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:12}}>
            <div style={{color:'var(--muted)',fontSize:12}}>ID: {meetingId}</div>
            <button className="btn btn-secondary" onClick={copyMeetingLink} style={{padding:'6px 8px'}}>Copy</button>
          </div>
          {/* <div className={`topology-indicator ${topology}`}>
            Topology: {topology.toUpperCase()}
          </div> */}
        </div>
      </div>

      {/* --- NEW MAIN BODY WRAPPER --- */}
      <div className="meeting-body">
        
        {/* 1. CHAT PANEL (NOW IN THE FLOW) */}
        {showChat && (
          <div className="side-drawer">
            <div className="panel-header">
              <strong>Chat</strong>
              <button className="btn btn-secondary btn-close" onClick={toggleChat}>Close</button>
            </div>
            <div className="chat-messages">
              {chatMessages.map((m, idx) => (
                <div key={idx} className="chat-message-item">
                  <div className="chat-message-header">{m.from} • {new Date(m.ts).toLocaleTimeString()}</div>
                  <div>{m.text}</div>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input 
                value={chatInput} 
                onChange={(e)=>setChatInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Message" 
                className="form-input"
              />
              <button className="btn btn-primary" onClick={sendChatMessage}>Send</button>
            </div>
          </div>
        )}

        {/* 2. VIDEO GRID (WILL NOW SQUISH) */}
        <div className={`video-grid ${totalParticipants === 1 ? 'single' : totalParticipants === 2 ? 'two' : totalParticipants <= 4 ? 'four' : 'many'}`}>
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
                {!hasJoined ? `Preview: ${displayName || user?.name}` : `${displayName || user?.name} (You)`}
              </span>
              
              {/* --- THIS IS THE NEW, CORRECTED LOGIC --- */}
              <div className="video-controls">
                {!hasJoined ? (
                  <>
                    {!previewAudioOn && <FiMicOff className="muted-indicator" />}
                    {!previewVideoOn && <FiVideoOff className="video-off-indicator" />}
                  </>
                ) : (
                  <>
                    {!isAudioOn && <FiMicOff className="muted-indicator" />}
                    {!isVideoOn && <FiVideoOff className="video-off-indicator" />}
                    {isScreenSharing && <FiMonitor className="screen-sharing-indicator" />}
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
            <button className="btn btn-secondary btn-close" onClick={toggleSettings}>Close</button>
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
              <select id="settings-cam" value={selectedCameraId} onChange={(e)=>setSelectedCameraId(e.target.value)} className="form-input">
                {availableCameras.map(cam => (
                  <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Camera ${cam.deviceId.slice(-4)}`}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="settings-mic">Microphone</label>
              <select id="settings-mic" value={selectedMicId} onChange={(e)=>setSelectedMicId(e.target.value)} className="form-input">
                {availableMics.map(m => (
                  <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(-4)}`}</option>
                ))}
              </select>
            </div>
            <div className="settings-actions">
              <button className="btn btn-secondary" onClick={enumerateDevices} title="Refresh devices">Refresh</button>
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
            className={`control-btn ${!isAudioOn ? 'disabled' : ''}`}
            title={isAudioOn ? 'Mute' : 'Unmute'}
          >
            {isAudioOn ? <FiMic /> : <FiMicOff />}
          </button>
          
          <button
            onClick={toggleVideo}
            className={`control-btn ${!isVideoOn ? 'disabled' : ''}`}
            title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoOn ? <FiVideo /> : <FiVideoOff />}
          </button>

          <button
            onClick={handleScreenShare}
            className={`control-btn ${isScreenSharing ? 'active' : ''}`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <FiShare />
          </button>
          
          {/* USE THE NEW TOGGLE FUNCTIONS */}
          <button className="control-btn" onClick={toggleChat} title="Chat">
            <FiMessageSquare />
          </button>
          
          <button className="control-btn" onClick={toggleSettings} title="Settings">
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
const RemoteVideo = ({ participant }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="video-container remote-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="video-stream"
      />
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
