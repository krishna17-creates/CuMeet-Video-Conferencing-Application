import React, { useEffect, useRef } from "react";
import { FiMicOff, FiVideoOff, FiMonitor } from "react-icons/fi";
import "../../styles/meetingRoom.css";

/**
 * RemoteVideo Component
 * Renders a remote participant's video stream
 */
const RemoteVideo = ({ participant }) => {
  const videoRef = useRef();

  useEffect(() => {
    console.log(
      `[RemoteVideo] useEffect running for ${participant.userName}. Stream:`,
      participant.stream
    );

    if (participant.stream && videoRef.current) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch((e) => {
        console.warn(
          `[RemoteVideo] Autoplay was prevented for ${participant.userName}.`,
          e.name
        );
      });
    }
  }, [participant.stream]);

  return (
    <div className="video-container remote-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="video-stream"
      />
      {!participant.videoOn && (
        <div className="video-placeholder">
          <span>{participant.userName?.charAt(0)?.toUpperCase() || "?"}</span>
        </div>
      )}
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

/**
 * VideoGrid Component
 * Manages the layout and rendering of all video tiles (local + remote)
 * Dynamically adjusts CSS class based on participant count
 */
const VideoGrid = ({
  localVideoRef,
  displayName,
  userName,
  isAudioOn,
  isVideoOn,
  isScreenSharing,
  participants,
}) => {
  const totalParticipants = participants.length + 1; // +1 for local user

  const gridClass =
    totalParticipants === 1
      ? "single"
      : totalParticipants === 2
      ? "two"
      : totalParticipants <= 4
      ? "four"
      : "many";

  return (
    <div className={`video-grid ${gridClass}`}>
      {/* Local Video */}
      <div className="video-container local-video">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="video-stream"
        />
        {!isVideoOn && (
          <div className="video-placeholder">
            <span>{(displayName || userName)?.charAt(0)?.toUpperCase() || "?"}</span>
          </div>
        )}
        <div className="video-overlay">
          <span className="participant-name">
            {displayName || userName} (You)
          </span>

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
  );
};

export default VideoGrid;
