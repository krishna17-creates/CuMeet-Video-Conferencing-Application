import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { FiVideo, FiPlus, FiCalendar, FiUsers, FiClock, FiCopy, FiXCircle, FiInfo, FiRadio } from 'react-icons/fi';
import { useNotifications } from '../context/NotificationContext'; // Import useNotifications
import { format, formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const [meetings, setMeetings] = useState([]);
  const [joinMeetingId, setJoinMeetingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const { addNotification } = useNotifications(); // Use addNotification
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async () => {
    try {
      const response = await axios.get('/meetings');
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch meetings initially and then every 30 seconds
    fetchMeetings(); // Initial fetch
    const intervalId = setInterval(fetchMeetings, 30000); // Poll for status changes from the backend
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchMeetings]);

  useEffect(() => {
    // Update the 'now' state every 30 seconds to re-evaluate time-sensitive UI.
    const timerId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    // Check for upcoming meetings and add notifications
    if (meetings.length > 0) {
      meetings.forEach(meeting => {
        const scheduledTime = meeting.scheduledAt ? new Date(meeting.scheduledAt) : null;
        if (meeting.status === 'scheduled' && scheduledTime && now.getTime() >= (scheduledTime.getTime() - 5 * 60 * 1000) && now.getTime() < scheduledTime.getTime()) {
          addNotification({ id: meeting.id, title: meeting.title, scheduledAt: meeting.scheduledAt, meetingId: meeting.meetingId });
        }
      });
    }
  }, [meetings, now, addNotification]);

  const handleStartMeeting = async () => {
    try {
      const response = await axios.post('/meetings', {
        title: 'Instant Meeting',
        type: 'instant'
      });
      navigate(`/meeting/${response.data.meeting.meetingId}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
    }
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (joinMeetingId.trim()) {
      navigate(`/meeting/${joinMeetingId}`);
    }
  };

  const handleJoinScheduledMeeting = (meetingId) => {
    navigate(`/meeting/${meetingId}`);
  };

  const handleViewDetails = (meeting) => {
    setSelectedMeeting(meeting);
  };

  const handleCancelMeeting = async (meetingId, currentStatus) => {
    const confirmMessage =
      currentStatus === 'active'
        ? 'Are you sure you want to end this meeting for all participants?'
        : 'Are you sure you want to cancel this meeting?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await axios.delete(`/meetings/${meetingId}`);
      fetchMeetings(); // Refetch meetings to get the latest state from the server
    } catch (error) {
      console.error('Error cancelling/ending meeting:', error);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <h1>Welcome back, {user?.name}!</h1>
          <p>Manage your meetings and connect with your team</p>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="action-card card">
            <div className="action-content">
              <FiVideo className="action-icon" />
              <div>
                <h3>Start Instant Meeting</h3>
                <p>Begin a meeting right now</p>
              </div>
            </div>
            <button onClick={handleStartMeeting} className="btn btn-primary">
              <FiVideo />
              Start Meeting
            </button>
          </div>

          <div className="action-card card">
            <div className="action-content">
              <FiUsers className="action-icon" />
              <div>
                <h3>Join Meeting</h3>
                <p>Enter meeting ID to join</p>
              </div>
            </div>
            <form onSubmit={handleJoinMeeting} className="join-form">
              <input
                type="text"
                value={joinMeetingId}
                onChange={(e) => setJoinMeetingId(e.target.value)}
                placeholder="Enter Meeting ID"
                className="form-input"
              />
              <button type="submit" className="btn btn-secondary">
                Join
              </button>
            </form>
          </div>

          <div className="action-card card">
            <div className="action-content">
              <FiCalendar className="action-icon" />
              <div>
                <h3>Schedule Meeting</h3>
                <p>Plan for later</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/schedule')} 
              className="btn btn-success"
            >
              <FiPlus />
              Schedule
            </button>
          </div>
        </div>

        {/* Recent Meetings */}
        <div className="meetings-section">
          <div className="section-header">
            <h2>Your Meetings</h2>
            <button 
              onClick={() => navigate('/schedule')} 
              className="btn btn-primary"
            >
              <FiPlus />
              New Meeting
            </button>
          </div>

          <div className="meetings-grid">
            {meetings.length === 0 ? (
              <div className="empty-state">
                <FiCalendar className="empty-icon" />
                <h3>No meetings scheduled</h3>
                <p>Schedule your first meeting to get started</p>
                <button 
                  onClick={() => navigate('/schedule')} 
                  className="btn btn-primary"
                >
                  Schedule Meeting
                </button>
              </div>
            ) : (
              meetings.map((meeting) => {
                const scheduledTime = meeting.scheduledAt ? new Date(meeting.scheduledAt) : null;
                const gracePeriodExpirationTime = meeting.gracePeriodExpiresAt ? new Date(meeting.gracePeriodExpiresAt) : null;

                const isPast = ['ended', 'cancelled'].includes(meeting.status) || (gracePeriodExpirationTime && now > gracePeriodExpirationTime);
                const isEffectivelyLive = meeting.status === 'active' || (meeting.status === 'scheduled' && scheduledTime && now >= scheduledTime && !isPast);

                const isHost = user && user.id === meeting.host._id;
                const canCancel = isHost && !isPast && (meeting.status === 'scheduled' || meeting.status === 'active');

                let buttonText = 'Unavailable';
                let cardHighlightClass = 'highlight-inactive';
                let timeDisplay = scheduledTime ? format(scheduledTime, 'p') : 'Just now';
                let isJoinable = false;

                if (isPast) {
                  buttonText = meeting.status === 'cancelled' ? 'Cancelled' : 'Ended';
                } else if (isEffectivelyLive) {
                  // Meeting is active, allow joining
                  buttonText = 'Join Now'; 
                  // If the scheduled time is in the past, but it's active, display "Started X ago"
                  timeDisplay = scheduledTime && now > scheduledTime ? `Started ${formatDistanceToNow(scheduledTime)} ago` : 'Now';
                  cardHighlightClass = 'highlight-active';
                  isJoinable = true;
                } else if (scheduledTime && now < scheduledTime) { // It's upcoming
                  cardHighlightClass = 'highlight-scheduled';
                  const timeToStart = scheduledTime.getTime() - now.getTime();
                  if (timeToStart <= 5 * 60 * 1000) { // Within 5 minutes
                    buttonText = 'Join';
                    isJoinable = true;
                  } else { // More than 5 minutes away
                    buttonText = 'Upcoming';
                    isJoinable = false;
                    timeDisplay = `in ${formatDistanceToNow(scheduledTime)}`;
                  }
                } else { // Scheduled meeting that is ready to be joined, or an instant meeting
                  buttonText = 'Join';
                  isJoinable = true;
                  cardHighlightClass = 'highlight-scheduled';
                }

                return (
                  <div key={meeting.id} className={`meeting-card card status-${meeting.status} ${cardHighlightClass}`}>
                    {isEffectivelyLive ? (
                      <div className="live-indicator">
                        <FiRadio />
                        <span>Live</span>
                      </div>
                    ) : (
                      <span className={`meeting-status status-${meeting.status}`}>
                        {meeting.status}
                      </span>
                    )}
                    <div className="meeting-card-body">
                      <div className="meeting-header">
                        <h3 className="meeting-title" title={meeting.title}>{meeting.title}</h3>
                      </div>
                      <p className="meeting-description">
                        {meeting.description || 'No description for this meeting.'}
                      </p>
                      <div className="meeting-details">
                        <div className="meeting-detail-item">
                          <FiCalendar />
                          <span>{scheduledTime ? format(scheduledTime, 'PP') : 'Instant'}</span>
                        </div>
                        <div className="meeting-detail-item">
                          <FiClock />
                          <span>{timeDisplay}</span>
                        </div>
                        <div className="meeting-detail-item">
                          <FiClock />
                          <span>{meeting.duration} min duration</span>
                        </div>
                        <div className="meeting-detail-item">
                          <FiUsers />
                          <span>{meeting.participantCount} participant{meeting.participantCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="meeting-id-container">
                        <span>ID: {meeting.meetingId}</span>
                        {meeting.meetingLink && (
                          <button 
                            onClick={() => navigator.clipboard.writeText(meeting.meetingLink)}
                            className="copy-link-btn"
                            title="Copy meeting link"
                          >
                            <FiCopy /> Copy Link
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="meeting-actions">
                      {isPast ? (
                        <button
                          onClick={() => handleViewDetails(meeting)}
                          className="btn btn-secondary"
                        >
                          <FiInfo />
                          View Details
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleJoinScheduledMeeting(meeting.meetingId)}
                            className={`btn ${isJoinable ? 'btn-primary' : 'btn-disabled'}`}
                            disabled={!isJoinable}
                          >
                            <FiVideo />
                            {buttonText}
                          </button>
                          <button
                            onClick={() => handleViewDetails(meeting)}
                            className="btn btn-secondary btn-icon"
                            title="View Details"
                          >
                            <FiInfo />
                          </button>
                        </>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => handleCancelMeeting(meeting.meetingId, meeting.status)}
                          className="btn btn-danger"
                          title={meeting.status === 'active' ? 'End meeting for all' : 'Cancel meeting'}
                        >
                          <FiXCircle />
                          {meeting.status === 'active' ? 'End' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Meeting Details Modal */}
        {selectedMeeting && (
          <div className="modal-overlay" onClick={() => setSelectedMeeting(null)}>
            <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Meeting Details</h2>
                <button onClick={() => setSelectedMeeting(null)} className="modal-close-btn">&times;</button>
              </div>
              <div className="modal-body">
                <h3>{selectedMeeting.title}</h3>
                <p>
                  <strong>Status:</strong> <span className={`meeting-status status-${selectedMeeting.status}`}>{selectedMeeting.status}</span>
                </p>
                <p><strong>ID:</strong> {selectedMeeting.meetingId}</p>
                <p><strong>Host:</strong> {selectedMeeting.host.name}</p>
                <p><strong>Scheduled:</strong> {selectedMeeting.scheduledAt ? format(new Date(selectedMeeting.scheduledAt), 'PPpp') : 'Instant'}</p>
                <p><strong>Duration:</strong> {selectedMeeting.duration} minutes</p>
                <p><strong>Description:</strong> {selectedMeeting.description || 'N/A'}</p>
                <p><strong>Participants:</strong> {selectedMeeting.participantCount}</p>
                <p><strong>Ended At:</strong> {selectedMeeting.endedAt ? format(new Date(selectedMeeting.endedAt), 'PPpp') : 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;