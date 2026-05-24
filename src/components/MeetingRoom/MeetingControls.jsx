import React from "react";
import {
  FiMic,
  FiMicOff,
  FiVideo,
  FiVideoOff,
  FiPhone,
  FiShare,
  FiMessageSquare,
  FiSettings,
} from "react-icons/fi";
import "../../styles/meetingRoom.css";

/**
 * MeetingControls Component
 * Fixed bottom control bar with device toggles and meeting actions
 * Provides: Mic, Video, Screen Share, Chat, Settings, and Leave buttons
 */
const MeetingControls = ({
  isAudioOn,
  onToggleAudio,
  isVideoOn,
  onToggleVideo,
  isScreenSharing,
  onHandleScreenShare,
  onToggleChat,
  onToggleSettings,
  onLeaveMeeting,
  isHost,
}) => {
  return (
    <div className="meeting-controls">
      <div className="control-group">
        {/* Microphone Toggle */}
        <button
          onClick={onToggleAudio}
          className={`control-btn ${!isAudioOn ? "disabled" : ""}`}
          title={isAudioOn ? "Mute" : "Unmute"}
        >
          {isAudioOn ? <FiMic /> : <FiMicOff />}
        </button>

        {/* Video Toggle */}
        <button
          onClick={onToggleVideo}
          className={`control-btn ${!isVideoOn ? "disabled" : ""}`}
          title={isVideoOn ? "Turn off camera" : "Turn on camera"}
        >
          {isVideoOn ? <FiVideo /> : <FiVideoOff />}
        </button>

        {/* Screen Share */}
        <button
          onClick={onHandleScreenShare}
          className={`control-btn ${isScreenSharing ? "active" : ""}`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <FiShare />
        </button>

        {/* Chat */}
        <button
          className="control-btn"
          onClick={onToggleChat}
          title="Chat"
        >
          <FiMessageSquare />
        </button>

        {/* Settings */}
        <button
          className="control-btn"
          onClick={onToggleSettings}
          title="Settings"
        >
          <FiSettings />
        </button>
      </div>

      {/* Leave Button */}
      <button
        onClick={onLeaveMeeting}
        className="control-btn leave-btn"
        title={isHost ? "End meeting for everyone" : "Leave meeting"}
      >
        <FiPhone />
      </button>
    </div>
  );
};

export default MeetingControls;
