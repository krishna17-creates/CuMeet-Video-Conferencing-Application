import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
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

  useEffect(() => {
    fetchMeetingDetails();
    // Initialize socket connection only once
    if (!socketRef.current) initializeSocket();
    
    return () => {
      cleanup();
    };
  }, [meetingId]);

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

  const fetchMeetingDetails = useCallback(async () => {
    try {
      const response = await axios.get(`/meetings/${meetingId}`);
      setMeeting(response.data.meeting);
      
      // Join the meeting via API
      await axios.post(`/meetings/${meetingId}/join`);
      
      // Now that we have meeting details and have joined, get media.
      // This prevents trying to get media for a meeting that doesn't exist.
      if (!localStreamRef.current) {
        initializeMedia();
      }
    } catch (error) {
      if (error.response?.status === 410) {
        setError('This meeting has expired');
      } else {
        setError('Meeting not found or you do not have access to this meeting');
      } // Do not set loading here, let initializeMediaAndSocket handle it
    }
  }, [meetingId]);

  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLoading(false);
      setConnectionStatus('Connected');
      
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setError('Unable to access camera or microphone. Please check permissions.');
      setLoading(false);
    }
  });

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
        initializeMedia();
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
      trickle: false,
      stream: localStreamRef.current,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
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
      console.log('Sending signal to:', userName);
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('signal', {
          targetSocketId: socketId,
          signal,
          userId: user.id
        });
      }
    });

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
            const sender = peerObj.peer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack).catch(console.error);
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
          const sender = peerObj.peer._pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) sender.replaceTrack(cameraTrack).catch(console.error);
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
      await axios.post(`/meetings/${meetingId}/leave`);
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
    
    cleanup();
    navigate('/dashboard');
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

  const totalParticipants = participants.length + 1; // +1 for local user

  return (
    <div className="meeting-room">
      <div className="meeting-header">
        <h2>{meeting?.title}</h2>
        <div className="meeting-info">
          <div className="meeting-participants-count">
            <FiUsers />
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </div>
          <div className={`topology-indicator ${topology}`}>
            Topology: {topology.toUpperCase()}
          </div>
        </div>
      </div>

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
          <div className="video-overlay">
            <span className="participant-name">{user?.name} (You)</span>
            <div className="video-controls">
              {!isAudioOn && <FiMicOff className="muted-indicator" />}
              {!isVideoOn && <FiVideoOff className="video-off-indicator" />}
              {isScreenSharing && <FiMonitor className="screen-sharing-indicator" />}
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
          
          <button className="control-btn" title="Chat (coming soon)">
            <FiMessageSquare />
          </button>
          
          <button className="control-btn" title="Settings (coming soon)">
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
