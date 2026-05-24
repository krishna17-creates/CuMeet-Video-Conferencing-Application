import React from "react";
import "../../styles/meetingRoom.css";

/**
 * SettingsPanel Component
 * Settings overlay for display name, camera, and microphone selection
 */
const SettingsPanel = ({
  displayName,
  onDisplayNameChange,
  selectedCameraId,
  onCameraChange,
  availableCameras,
  selectedMicId,
  onMicChange,
  availableMics,
  onRefreshDevices,
  onApplyChanges,
  onClose,
}) => {
  return (
    <div className="settings-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <strong>Settings</strong>
        <button
          className="btn btn-secondary btn-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Panel Content */}
      <div className="panel-content">
        {/* Display Name */}
        <div className="form-group">
          <label htmlFor="settings-name">Display Name</label>
          <input
            id="settings-name"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            className="form-input"
            placeholder="Enter your name"
          />
        </div>

        {/* Camera Selection */}
        <div className="form-group">
          <label htmlFor="settings-cam">Camera</label>
          <select
            id="settings-cam"
            value={selectedCameraId}
            onChange={(e) => onCameraChange(e.target.value)}
            className="form-input"
          >
            {availableCameras.map((cam) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                {cam.label || `Camera ${cam.deviceId.slice(-4)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Microphone Selection */}
        <div className="form-group">
          <label htmlFor="settings-mic">Microphone</label>
          <select
            id="settings-mic"
            value={selectedMicId}
            onChange={(e) => onMicChange(e.target.value)}
            className="form-input"
          >
            {availableMics.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Mic ${m.deviceId.slice(-4)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button
            className="btn btn-secondary"
            onClick={onRefreshDevices}
            title="Refresh devices"
          >
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={onApplyChanges}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
