import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import { FiCopy, FiMail, FiPhoneOff, FiPlus, FiUsers } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { useLocalMedia } from "../hooks/useLocalMedia";
import api from "../api/axios";
import PreJoinScreen from "./MeetingRoom/PreJoinScreen";

import "../styles/meetingRoom.css";

const MeetingRoom = () => {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const localMedia = useLocalMedia();
  const {
    localVideoRef,
    initializeMedia,
    cleanup,
    setLoading: setMediaLoading,
    previewAudioOn,
    previewVideoOn,
    togglePreviewAudio,
    togglePreviewVideo,
  } = localMedia;

  const [meeting, setMeeting] = useState(null);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [hasJoined, setHasJoined] = useState(false);
  const [livekitConfig, setLivekitConfig] = useState(null);
  const [globalError, setGlobalError] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");

  const isHost = useMemo(
    () => meeting?.host?._id === user?.id || meeting?.host?.id === user?.id,
    [meeting?.host, user?.id]
  );

  const fetchMeetingDetails = useCallback(async () => {
    try {
      const response = await api.get(`/meetings/${meetingId}`);
      setMeeting(response.data.meeting);
    } catch (error) {
      setGlobalError(
        error.response?.status === 410
          ? "This meeting has expired."
          : "Meeting not found or you do not have access to this meeting."
      );
    }
  }, [meetingId]);

  useEffect(() => {
    const init = async () => {
      await fetchMeetingDetails();
      try {
        await initializeMedia(true);
      } catch (error) {
        console.warn("Preview media unavailable:", error);
      }
    };

    init();

    return () => {
      cleanup();
      document.body.style.overflow = "";
    };
  }, [fetchMeetingDetails, initializeMedia, cleanup]);

  const handleJoin = async () => {
    setGlobalError("");
    setMediaLoading(true);

    try {
      await api.post(`/meetings/${meetingId}/join`, { displayName });
      const response = await api.post(`/meetings/${meetingId}/livekit-token`, {
        displayName,
      });

      setLivekitConfig({
        token: response.data.token,
        serverUrl: response.data.serverUrl,
        roomName: response.data.roomName,
      });
      setHasJoined(true);
      document.body.style.overflow = "hidden";
    } catch (error) {
      setGlobalError(
        error.response?.data?.message ||
          error.message ||
          "Failed to join meeting."
      );
    } finally {
      setMediaLoading(false);
    }
  };

  const leaveMeeting = useCallback(async () => {
    try {
      await api.post(`/meetings/${meetingId}/leave`);
    } catch (error) {
      console.warn("Leave meeting failed:", error);
    }

    document.body.style.overflow = "";
    cleanup();
    navigate("/dashboard");
  }, [meetingId, navigate, cleanup]);

  const endMeeting = async () => {
    try {
      await api.post(`/meetings/${meetingId}/end`);
    } catch (error) {
      console.error("End meeting failed:", error);
    }

    document.body.style.overflow = "";
    navigate("/dashboard");
  };

  const inviteParticipants = async (event) => {
    event.preventDefault();
    setInviteStatus("");

    try {
      const response = await api.post(`/meetings/${meetingId}/invite`, {
        emails: inviteEmails,
      });
      setMeeting((current) => ({
        ...current,
        invitedEmails: response.data.invitedEmails,
      }));
      setInviteEmails("");
      setInviteStatus("Invites added.");
    } catch (error) {
      setInviteStatus(
        error.response?.data?.message || "Could not add participants."
      );
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (error) {
      console.warn("Copy failed:", error);
    }
  };

  if (globalError) {
    return (
      <div className="meeting-error">
        <div className="error-content">
          <h2>Unable to join meeting</h2>
          <p>{globalError}</p>
          <button onClick={() => navigate("/dashboard")} className="btn btn-primary">
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!hasJoined || !livekitConfig) {
    return (
      <PreJoinScreen
        localVideoRef={localVideoRef}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        previewAudioOn={previewAudioOn}
        onToggleAudio={togglePreviewAudio}
        previewVideoOn={previewVideoOn}
        onToggleVideo={togglePreviewVideo}
        onJoin={handleJoin}
        meeting={meeting}
        meetingId={meetingId}
        userName={user?.name}
      />
    );
  }

  return (
    <div className="meeting-room livekit-meeting" data-lk-theme="default">
      <LiveKitRoom
        token={livekitConfig.token}
        serverUrl={livekitConfig.serverUrl}
        connect
        audio={previewAudioOn}
        video={previewVideoOn}
        onDisconnected={leaveMeeting}
      >
        <header className="meeting-header livekit-header">
          <div className="meeting-info">
            <h2>{meeting?.title || "CUMEET Meeting"}</h2>
            <span className="meeting-id">ID: {livekitConfig.roomName}</span>
          </div>
          <div className="meeting-header-actions">
            <button className="meeting-icon-btn" onClick={copyLink} title="Copy meeting link">
              <FiCopy />
            </button>
            {isHost && (
              <button
                className="meeting-icon-btn"
                onClick={() => setShowInvite((open) => !open)}
                title="Invite participants"
              >
                <FiPlus />
              </button>
            )}
            {isHost && (
              <button className="meeting-end-btn" onClick={endMeeting}>
                <FiPhoneOff />
                End for all
              </button>
            )}
          </div>
        </header>

        {showInvite && (
          <form className="invite-panel" onSubmit={inviteParticipants}>
            <div className="panel-header">
              <strong><FiUsers /> Add participants</strong>
              <button type="button" className="btn-close" onClick={() => setShowInvite(false)}>
                Close
              </button>
            </div>
            <div className="panel-content">
              <label htmlFor="invite-emails">Emails</label>
              <textarea
                id="invite-emails"
                value={inviteEmails}
                onChange={(event) => setInviteEmails(event.target.value)}
                placeholder="teammate@example.com, client@example.com"
                className="form-input invite-textarea"
              />
              <button className="btn btn-primary" type="submit">
                <FiMail />
                Add and send invite
              </button>
              {inviteStatus && <p className="prejoin-helper-text">{inviteStatus}</p>}
            </div>
          </form>
        )}

        <main className="livekit-stage">
          <VideoConference />
        </main>
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
};

export default MeetingRoom;
