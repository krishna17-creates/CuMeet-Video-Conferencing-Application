import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { useMeetingSocket } from "../hooks/useMeetingSocket";
import { useSFUConnection } from "../hooks/useSFUConnection";
import PreJoinScreen from "./MeetingRoom/PreJoinScreen";
import VideoGrid from "./MeetingRoom/VideoGrid";
import MeetingControls from "./MeetingRoom/MeetingControls";
import ChatPanel from "./MeetingRoom/ChatPanel";
import SettingsPanel from "./MeetingRoom/SettingsPanel";
import MeetingHeader from "./MeetingRoom/MeetingHeader";

import "../styles/meetingRoom.css";

/**
 * MeetingRoom Component
 * Main container for video conferencing functionality
 * Orchestrates hooks and sub-components for a clean, maintainable architecture
 */
const MeetingRoom = () => {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ============ STATE ============
  const [meeting, setMeeting] = useState(null);
  const [, setLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // ============ HOOKS ============
  const localMedia = useLocalMedia();
  const meetingSocket = useMeetingSocket(meetingId, user);
  const sfuConnection = useSFUConnection(meetingSocket);

  const {
    initializeMedia,
    enumerateDevices,
    cleanup,
    settingsInitializedRef,
  } = localMedia;

  const {
    onSfuExistingProducers,
    onNewProducer,
    onProducerClosed,
    onRoomEnded,
    onUserLeft,
    disconnect: disconnectSocket,
  } = meetingSocket;

  const {
    consumeSfuStream,
    handleExistingProducers,
    removeParticipant,
    closeConsumerByProducerId,
    destroySfuConnection,
  } = sfuConnection;

  // ============ INITIALIZE MEETING & MEDIA ============
  const fetchMeetingDetails = useCallback(async () => {
    try {
      const response = await api.get(`/meetings/${meetingId}`);
      setMeeting(response.data.meeting);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 410) {
        setGlobalError("This meeting has expired");
      } else {
        setGlobalError(
          "Meeting not found or you do not have access to this meeting"
        );
      }
      setLoading(false);
    }
  }, [meetingId]);

  // Initial load: fetch meeting and initialize media preview
  useEffect(() => {
    const init = async () => {
      try {
        await fetchMeetingDetails();
        // Initialize media for preview
        await initializeMedia(true);
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };

    init();

    return () => {
      cleanup();
      disconnectSocket();
      destroySfuConnection();
    };
  }, [fetchMeetingDetails, initializeMedia, cleanup, disconnectSocket, destroySfuConnection]);

  // ============ SOCKET LISTENERS ============
  useEffect(() => {
    onSfuExistingProducers((producers) => {
      handleExistingProducers(producers);
    });

    onNewProducer(async (producerInfo) => {
      console.log("New producer:", producerInfo);
      consumeSfuStream(producerInfo);
    });

    onProducerClosed(({ producerId }) => {
      console.log("Producer closed:", producerId);
      closeConsumerByProducerId(producerId);
    });

    onUserLeft(({ userId }) => {
      removeParticipant(userId);
    });

    onRoomEnded(({ endedByName }) => {
      cleanup();
      destroySfuConnection();
      disconnectSocket();
      try {
        document.body.style.overflow = "";
      } catch {
        // Browser environments without document.body can ignore this.
      }
      setGlobalError(
        endedByName
          ? `${endedByName} ended this meeting.`
          : "This meeting has ended."
      );
    });
  }, [
    onSfuExistingProducers,
    onNewProducer,
    onProducerClosed,
    onRoomEnded,
    onUserLeft,
    handleExistingProducers,
    consumeSfuStream,
    closeConsumerByProducerId,
    removeParticipant,
    cleanup,
    destroySfuConnection,
    disconnectSocket,
  ]);

  // ============ DEVICE ENUMERATION ============
  useEffect(() => {
    if (!settingsInitializedRef.current) {
      enumerateDevices();
      settingsInitializedRef.current = true;
    }
  }, [enumerateDevices, settingsInitializedRef]);

  // ============ HANDLERS ============

  /**
   * Handle joining the meeting
   */
  const handleJoin = async () => {
    setGlobalError("");
    localMedia.setLoading(true);

    try {
      // Ensure we have a stream
      if (!localMedia.localStreamRef.current) {
        await localMedia.initializeMedia(false);
      }

      // Apply preview toggles to tracks
      const audioTrack =
        localMedia.localStreamRef.current?.getAudioTracks()[0];
      const videoTrack =
        localMedia.localStreamRef.current?.getVideoTracks()[0];
      if (audioTrack) audioTrack.enabled = localMedia.previewAudioOn;
      if (videoTrack) videoTrack.enabled = localMedia.previewVideoOn;

      localMedia.setIsAudioOn(localMedia.previewAudioOn);
      localMedia.setIsVideoOn(localMedia.previewVideoOn);

      // Join via API
      await api.post(`/meetings/${meetingId}/join`, { displayName });

      await meetingSocket.initializeSocket();

      // Prevent background scroll
      try {
        document.body.style.overflow = "hidden";
      } catch {
        // Browser environments without document.body can ignore this.
      }

      setHasJoined(true);
      localMedia.setLoading(false);

      await sfuConnection.initializeSfuConnection(localMedia.localStreamRef);
    } catch (err) {
      console.error("Error during join:", err);
      setGlobalError(
        err?.message
          ? `Failed to join meeting: ${err.message}`
          : "Failed to join meeting. See console for details."
      );
      localMedia.setLoading(false);
    }
  };

  /**
   * Handle leaving the meeting
   */
  const handleLeaveMeeting = async () => {
    try {
      const isHost = meeting?.host?._id === user?.id || meeting?.host?.id === user?.id;
      if (isHost) {
        await api.post(`/meetings/${meetingId}/end`);
        await meetingSocket.emitEndRoom();
      } else {
        await api.post(`/meetings/${meetingId}/leave`);
      }
    } catch (error) {
      console.error("Error leaving meeting:", error);
    }

    localMedia.cleanup();
    sfuConnection.destroySfuConnection();
    meetingSocket.disconnect();

    try {
      document.body.style.overflow = "";
    } catch {
      // Browser environments without document.body can ignore this.
    }

    setHasJoined(false);
    navigate("/dashboard");
  };

  /**
   * Handle audio toggle with SFU producer update
   */
  const handleToggleAudio = useCallback(() => {
    const nextEnabled = !localMedia.isAudioOn;
    localMedia.toggleAudio();
    if (hasJoined) {
      sfuConnection.toggleProducer("audio", nextEnabled);
    }
  }, [hasJoined, localMedia, sfuConnection]);

  /**
   * Handle video toggle with SFU producer update
   */
  const handleToggleVideo = useCallback(() => {
    const nextEnabled = !localMedia.isVideoOn;
    localMedia.toggleVideo();
    if (hasJoined) {
      sfuConnection.toggleProducer("video", nextEnabled);
    }
  }, [hasJoined, localMedia, sfuConnection]);

  /**
   * Handle screen sharing
   */
  const handleScreenShare = useCallback(async () => {
    if (localMedia.isScreenSharing) {
      // Stop screen share
      await localMedia.stopScreenShare();
      // Revert to camera track
      if (localMedia.localStreamRef.current && hasJoined) {
        const cameraTrack =
          localMedia.localStreamRef.current.getVideoTracks()[0];
        if (cameraTrack) {
          await sfuConnection.replaceProducerTrack("video", cameraTrack);
        }
      }
    } else {
      // Start screen share
      const screenTrack = await localMedia.shareScreen();
      if (screenTrack && hasJoined) {
        await sfuConnection.replaceProducerTrack("video", screenTrack);
      }
    }
  }, [hasJoined, localMedia, sfuConnection]);

  /**
   * Handle device change
   */
  const handleDeviceChange = async () => {
    try {
      await localMedia.handleDeviceChange();
      // If in meeting, update SFU producers with new tracks
      if (hasJoined && localMedia.localStreamRef.current) {
        const audioTrack = localMedia.localStreamRef.current.getAudioTracks()[0];
        const videoTrack = localMedia.localStreamRef.current.getVideoTracks()[0];
        if (audioTrack)
          await sfuConnection.replaceProducerTrack("audio", audioTrack);
        if (videoTrack)
          await sfuConnection.replaceProducerTrack("video", videoTrack);
      }
      setShowSettings(false);
    } catch (err) {
      console.error("Device change error:", err);
      setGlobalError("Failed to apply device changes.");
    }
  };

  /**
   * Handle chat message
   */
  const handleSendChat = useCallback(
    (message) => {
      meetingSocket.sendChatMessage(displayName, message);
    },
    [displayName, meetingSocket]
  );

  /**
   * Copy meeting link to clipboard
   */
  const handleCopyLink = useCallback(() => {
    try {
      navigator.clipboard.writeText(window.location.href);
    } catch (error) {
      console.error("Copy failed", error);
    }
  }, []);

  /**
   * Update display name
   */
  const handleDisplayNameChange = (newName) => {
    setDisplayName(newName);
    if (hasJoined) {
      meetingSocket.updateDisplayName(newName);
    }
  };

  // ============ RENDER ============

  // Loading state
  if (localMedia.loading) {
    return (
      <div className="meeting-loading">
        <div className="loading-spinner"></div>
        <p>Joining meeting...</p>
      </div>
    );
  }

  // Error state
  if (globalError || localMedia.error || sfuConnection.error) {
    const errorMsg = globalError || localMedia.error || sfuConnection.error;
    return (
      <div className="meeting-error">
        <div className="error-content">
          <h2>Unable to Join Meeting</h2>
          <p>{errorMsg}</p>
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

  // Pre-join screen
  if (!hasJoined) {
    return (
      <PreJoinScreen
        localVideoRef={localMedia.localVideoRef}
        displayName={displayName}
        onDisplayNameChange={handleDisplayNameChange}
        previewAudioOn={localMedia.previewAudioOn}
        onToggleAudio={localMedia.togglePreviewAudio}
        previewVideoOn={localMedia.previewVideoOn}
        onToggleVideo={localMedia.togglePreviewVideo}
        onJoin={handleJoin}
        meeting={meeting}
        meetingId={meetingId}
        userName={user?.name}
      />
    );
  }

  // Main meeting view
  const totalParticipants = sfuConnection.participants.length + 1;
  const isHost = meeting?.host?._id === user?.id || meeting?.host?.id === user?.id;

  return (
    <div className="meeting-room">
      <div className="meeting-content-wrapper">
        {/* Header */}
        <MeetingHeader
          title={meeting?.title || "Meeting"}
          meetingId={meetingId}
          participantCount={totalParticipants}
          onCopyLink={handleCopyLink}
        />

        {/* Main Body */}
        <div className="meeting-body">
          {/* Chat Panel */}
          {showChat && (
            <ChatPanel
              chatMessages={meetingSocket.chatMessages}
              onSendMessage={handleSendChat}
              onClose={() => setShowChat(false)}
            />
          )}

          {/* Video Grid */}
          <VideoGrid
            localVideoRef={localMedia.localVideoRef}
            displayName={displayName}
            userName={user?.name}
            isAudioOn={localMedia.isAudioOn}
            isVideoOn={localMedia.isVideoOn}
            isScreenSharing={localMedia.isScreenSharing}
            participants={sfuConnection.participants}
          />
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          displayName={displayName}
          onDisplayNameChange={handleDisplayNameChange}
          selectedCameraId={localMedia.selectedCameraId}
          onCameraChange={localMedia.setSelectedCameraId}
          availableCameras={localMedia.availableCameras}
          selectedMicId={localMedia.selectedMicId}
          onMicChange={localMedia.setSelectedMicId}
          availableMics={localMedia.availableMics}
          onRefreshDevices={localMedia.enumerateDevices}
          onApplyChanges={handleDeviceChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Controls */}
      <MeetingControls
        isAudioOn={localMedia.isAudioOn}
        onToggleAudio={handleToggleAudio}
        isVideoOn={localMedia.isVideoOn}
        onToggleVideo={handleToggleVideo}
        isScreenSharing={localMedia.isScreenSharing}
        onHandleScreenShare={handleScreenShare}
        onToggleChat={() => {
          setShowChat((s) => !s);
          setShowSettings(false);
        }}
        onToggleSettings={() => {
          setShowSettings((s) => !s);
          setShowChat(false);
        }}
        onLeaveMeeting={handleLeaveMeeting}
        isHost={isHost}
      />
    </div>
  );
};

export default MeetingRoom;
