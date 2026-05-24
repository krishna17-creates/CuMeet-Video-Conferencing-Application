import React from "react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from "react-icons/fi";
import "../../styles/meetingRoom.css";

/**
 * PreJoinScreen Component
 * Displays the pre-join preview UI with name input, device toggles, and meeting details
 */
const PreJoinScreen = ({
  localVideoRef,
  displayName,
  onDisplayNameChange,
  previewAudioOn,
  onToggleAudio,
  previewVideoOn,
  onToggleVideo,
  onJoin,
  meeting,
  meetingId,
  userName,
}) => {
  const isJoinDisabled = !displayName || displayName.trim().length === 0;

  return (
    <div className="meeting-room prejoin-container">
      <div className="prejoin-card">
        {/* LEFT COLUMN (VIDEO) */}
        <div className="prejoin-video-col">
          <div className="video-container local-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="video-stream"
            />
            <div className="video-overlay">
              <span className="participant-name">
                Preview: {displayName || userName}
              </span>
              <div className="video-controls">
                {!previewAudioOn && (
                  <FiMicOff className="muted-indicator" />
                )}
                {!previewVideoOn && (
                  <FiVideoOff className="video-off-indicator" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (CONTROLS) */}
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
              onChange={(e) => onDisplayNameChange(e.target.value)}
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
              onClick={onToggleAudio}
            >
              {previewAudioOn ? <FiMic /> : <FiMicOff />}
              {previewAudioOn ? "Mic On" : "Mic Off"}
            </button>
            <button
              className={`btn btn-secondary ${
                !previewVideoOn ? "disabled" : ""
              }`}
              onClick={onToggleVideo}
            >
              {previewVideoOn ? <FiVideo /> : <FiVideoOff />}
              {previewVideoOn ? "Cam On" : "Cam Off"}
            </button>
          </div>

          {/* Join Button */}
          <button
            className="btn btn-primary btn-join"
            onClick={onJoin}
            disabled={isJoinDisabled}
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
};

export default PreJoinScreen;
