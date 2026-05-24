import React, { useState } from "react";
import "../../styles/meetingRoom.css";

/**
 * ChatPanel Component
 * Side drawer for text chat messages
 * Manages its own local input state to prevent unnecessary re-renders
 */
const ChatPanel = ({
  chatMessages,
  onSendMessage,
  onClose,
}) => {
  const [localInput, setLocalInput] = useState("");

  const handleSendMessage = () => {
    if (localInput.trim()) {
      onSendMessage(localInput);
      setLocalInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="side-drawer">
      {/* Panel Header */}
      <div className="panel-header">
        <strong>Chat</strong>
        <button
          className="btn btn-secondary btn-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Chat Messages */}
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

      {/* Chat Input */}
      <div className="chat-input">
        <input
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="form-input"
        />
        <button
          className="btn btn-primary"
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
