import React from "react";
import { FiUsers } from "react-icons/fi";
import "../../styles/meetingRoom.css";

/**
 * MeetingHeader Component
 * Displays meeting title, participant count, and meeting details
 */
const MeetingHeader = ({
  title,
  meetingId,
  participantCount,
  onCopyLink,
}) => {
  return (
    <div className="meeting-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2>{title}</h2>
      </div>
      <div className="meeting-info">
        <div className="meeting-participants-count">
          <FiUsers />
          {participantCount} participant
          {participantCount !== 1 ? "s" : ""}
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
            onClick={onCopyLink}
            style={{ padding: "6px 8px" }}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingHeader;
