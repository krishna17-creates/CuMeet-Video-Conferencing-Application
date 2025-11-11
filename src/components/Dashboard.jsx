import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  FiVideo,
  FiPlus,
  FiCalendar,
  FiUsers,
  FiClock,
  FiCopy,
  FiXCircle,
  FiInfo,
  FiRadio,
  FiBarChart2,
  FiCheckCircle,
  FiArchive
} from 'react-icons/fi';
import { useNotifications } from '../context/NotificationContext';
// Import new functions from date-fns for the calendar
import {
  format,
  formatDistanceToNow,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO
} from 'date-fns';
import '../styles/dashboard.css'; // Import the new CSS file (lowercase filename)

// --- New Mini-Calendar Component ---
const CalendarWidget = ({ meetings }) => {
  const [currentDate] = useState(new Date()); // Simplified to only show current month

  // Get a list of "yyyy-MM-dd" strings for scheduled meetings
  const { user, logout } = useAuth();
  const meetingDays = useMemo(() => {
    return meetings
      .filter(m => m.status === 'scheduled' && m.scheduledAt)
      .map(m => format(parseISO(m.scheduledAt), 'yyyy-MM-dd'));
  }, [meetings]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // 0 = Sunday, 1 = Monday...
  const startingDayOfWeek = getDay(startOfMonth(currentDate));

  return (

    <div className="calendar-widget card">
      <div className="calendar-widget-header">
        <h3>{user?.name}'s {format(currentDate, 'MMMM yyyy')}</h3>
      </div>
      <div className="calendar-widget-grid">
        {/* Day names: S, M, T, W, T, F, S */}
        {[
          { day: 'S', key: 'sun' },
          { day: 'M', key: 'mon' },
          { day: 'T', key: 'tue' },
          { day: 'W', key: 'wed' },
          { day: 'T', key: 'thu' },
          { day: 'F', key: 'fri' },
          { day: 'S', key: 'sat' }
        ].map(({ day, key }) => (
          <div key={key} className="calendar-day-name">
            {day}
          </div>
        ))}

        {/* Render empty cells for start of month offset */}
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="calendar-day empty" />
        ))}

        {/* Render actual days */}
        {daysInMonth.map(day => {
          const dayString = format(day, 'yyyy-MM-dd');
          const hasMeeting = meetingDays.includes(dayString);
          const isToday = isSameDay(day, new Date());

          let dayClass = 'calendar-day';
          if (hasMeeting) dayClass += ' event';
          if (isToday) dayClass += ' today';

          return (
            <div key={dayString} className={dayClass}>
              {format(day, 'd')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [meetings, setMeetings] = useState([]);
  const [joinMeetingId, setJoinMeetingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming', 'past', 'all'
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async () => {
    try {
      const response = await api.get('/meetings');
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
    const intervalId = setInterval(fetchMeetings, 30000);
    return () => clearInterval(intervalId);
  }, [fetchMeetings]);

  useEffect(() => {
    const timerId = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (meetings.length > 0) {
      meetings.forEach(meeting => {
        // Ensure scheduledAt exists before parsing
        const scheduledTime = meeting.scheduledAt ? parseISO(meeting.scheduledAt) : null;
        if (
          meeting.status === 'scheduled' &&
          scheduledTime &&
          now.getTime() >= scheduledTime.getTime() - 5 * 60 * 1000 &&
          now.getTime() < scheduledTime.getTime()
        ) {
          addNotification({
            id: meeting.id,
            title: meeting.title,
            scheduledAt: meeting.scheduledAt,
            meetingId: meeting.meetingId
          });
        }
      });
    }
  }, [meetings, now, addNotification]);

  const handleStartMeeting = async () => {
    try {
      const response = await api.post('/meetings', { title: 'Instant Meeting', type: 'instant' });
      navigate(`/meeting/${response.data.meeting.meetingId}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
    }
  };

  const handleJoinMeeting = e => {
    e.preventDefault();
    if (joinMeetingId.trim()) {
      navigate(`/meeting/${joinMeetingId}`);
    }
  };

  const handleJoinScheduledMeeting = meetingId => {
    navigate(`/meeting/${meetingId}`);
  };

  const handleViewDetails = meeting => {
    setSelectedMeeting(meeting);
  };

  const handleCancelMeeting = async (meetingId, currentStatus) => {
    const confirmMessage =
      currentStatus === 'active'
        ? 'Are you sure you want to end this meeting for all participants?'
        : 'Are you sure you want to cancel this meeting?';
    if (!window.confirm(confirmMessage)) return;

    try {
      await api.delete(`/meetings/${meetingId}`);
      fetchMeetings();
    } catch (error) {
      console.error('Error cancelling/ending meeting:', error);
    }
  };

  // --- New Stats & Filtering Logic ---
  const { filteredMeetings, stats } = useMemo(() => {
    const upcoming = [];
    const past = [];
    let completedCount = 0;

    meetings.forEach(meeting => {
      // Ensure gracePeriodExpiresAt exists before parsing
      const gracePeriodExpirationTime = meeting.gracePeriodExpiresAt
        ? parseISO(meeting.gracePeriodExpiresAt)
        : null;
      const isPast =
        ['ended', 'cancelled'].includes(meeting.status) ||
        (gracePeriodExpirationTime && now > gracePeriodExpirationTime);

      if (isPast) {
        past.push(meeting);
        if (meeting.status === 'ended') completedCount++;
      } else {
        upcoming.push(meeting);
      }
    });

    const stats = {
      total: meetings.length,
      upcoming: upcoming.length,
      completed: completedCount
    };

    let filteredMeetings;
    if (filter === 'upcoming') {
      filteredMeetings = upcoming.slice();
    } else if (filter === 'past') {
      filteredMeetings = past.slice();
    } else {
      filteredMeetings = meetings.slice();
    }

    // Sort upcoming meetings to show soonest first
    if (filter === 'upcoming') {
      filteredMeetings.sort((a, b) => {
        if (!a.scheduledAt) return 1; // Put instant meetings last
        if (!b.scheduledAt) return -1;
        return parseISO(a.scheduledAt) - parseISO(b.scheduledAt);
      });
    }

    // Sort past meetings to show most recent first
    if (filter === 'past') {
      filteredMeetings.sort((a, b) => {
        const aTime = a.endedAt ? parseISO(a.endedAt) : a.scheduledAt ? parseISO(a.scheduledAt) : new Date(0);
        const bTime = b.endedAt ? parseISO(b.endedAt) : b.scheduledAt ? parseISO(b.scheduledAt) : new Date(0);
        return bTime - aTime;
      });
    }

    return { filteredMeetings, stats };
  }, [meetings, filter, now]);
  // ---------------------------------

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
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

        {/* --- New Stats Section --- */}
        <div className="dashboard-stats">
          <div className="stat-card card">
            <FiBarChart2 className="stat-icon" />
            <div className="stat-info">
              <h3>{stats.total}</h3>
              <p>Total Meetings</p>
            </div>
          </div>
          <div className="stat-card card">
            <FiCalendar className="stat-icon upcoming" />
            <div className="stat-info">
              <h3>{stats.upcoming}</h3>
              <p>Upcoming Meetings</p>
            </div>
          </div>
          <div className="stat-card card">
            <FiCheckCircle className="stat-icon completed" />
            <div className="stat-info">
              <h3>{stats.completed}</h3>
              <p>Completed Meetings</p>
            </div>
          </div>
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
                onChange={e => setJoinMeetingId(e.target.value)}
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
            <button onClick={() => navigate('/schedule')} className="btn btn-success">
              <FiPlus />
              Schedule
            </button>
          </div>
        </div>

        {/* --- New Main Layout: Meetings List + Calendar Widget --- */}
        <div className="dashboard-main-layout">
          <div className="meetings-section">
            <div className="section-header">
              <h2>Your Meetings</h2>

              {/* --- New Filter Tabs --- */}
              <div className="filter-tabs">
                <button
                  className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setFilter('upcoming')}
                >
                  <FiCalendar /> Upcoming ({stats.upcoming})
                </button>
                <button
                  className={`filter-btn ${filter === 'past' ? 'active' : ''}`}
                  onClick={() => setFilter('past')}
                >
                  <FiArchive /> Past
                </button>
                <button
                  className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All ({stats.total})
                </button>
              </div>
            </div>

            <div className="meetings-grid">
              {filteredMeetings.length === 0 ? (
                <div className="empty-state">
                  <FiCalendar className="empty-icon" />
                  <h3>No {filter} meetings</h3>
                  <p>Schedule your first meeting or change your filter.</p>
                  <button onClick={() => navigate('/schedule')} className="btn btn-primary">
                    Schedule Meeting
                  </button>
                </div>
              ) : (
                filteredMeetings.map((meeting, index) => {
                  const scheduledTime = meeting.scheduledAt ? parseISO(meeting.scheduledAt) : null;
                  const gracePeriodExpirationTime = meeting.gracePeriodExpiresAt
                    ? parseISO(meeting.gracePeriodExpiresAt)
                    : null;

                  const isPast =
                    ['ended', 'cancelled'].includes(meeting.status) ||
                    (gracePeriodExpirationTime && now > gracePeriodExpirationTime);
                  const isEffectivelyLive =
                    meeting.status === 'active' ||
                    (meeting.status === 'scheduled' && scheduledTime && now >= scheduledTime && !isPast);

                  const isHost = user && user.id === meeting.host?._id;
                  const canCancel = isHost && !isPast && (meeting.status === 'scheduled' || meeting.status === 'active');

                  let buttonText = 'Unavailable';
                  let cardHighlightClass = 'highlight-inactive';
                  let timeDisplay = scheduledTime ? format(scheduledTime, 'p') : 'Just now';
                  let isJoinable = false;

                  if (isPast) {
                    buttonText = meeting.status === 'cancelled' ? 'Cancelled' : 'Ended';
                  } else if (isEffectivelyLive) {
                    buttonText = 'Join Now';
                    timeDisplay =
                      scheduledTime && now > scheduledTime
                        ? `Started ${formatDistanceToNow(scheduledTime, { addSuffix: true })}`
                        : 'Now';
                    cardHighlightClass = 'highlight-active';
                    isJoinable = true;
                  } else if (scheduledTime && now < scheduledTime) {
                    cardHighlightClass = 'highlight-scheduled';
                    const timeToStart = scheduledTime.getTime() - now.getTime();
                    if (timeToStart <= 5 * 60 * 1000) {
                      buttonText = 'Join';
                      isJoinable = true;
                    } else {
                      buttonText = 'Upcoming';
                      isJoinable = false;
                      timeDisplay = `in ${formatDistanceToNow(scheduledTime)}`;
                    }
                  } else {
                    buttonText = 'Join';
                    isJoinable = true;
                    cardHighlightClass = 'highlight-scheduled';
                  }

                  return (
                    <div
                      key={meeting.id || meeting._id || index}
                      className={`meeting-card card status-${meeting.status} ${cardHighlightClass}`}
                      style={{ animationDelay: `${index * 0.05}s` }} // Staggered animation for list
                    >
                      {isEffectivelyLive ? (
                        <div className="live-indicator">
                          <FiRadio />
                          <span>Live</span>
                        </div>
                      ) : (
                        <span className={`meeting-status status-${meeting.status}`}>{meeting.status}</span>
                      )}
                      <div className="meeting-card-body">
                        <div className="meeting-header">
                          <h3 className="meeting-title" title={meeting.title}>
                            {meeting.title}
                          </h3>
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
                            <FiUsers />
                            <span>
                              {meeting.participantCount} participant{meeting.participantCount !== 1 ? 's' : ''}
                            </span>
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
                          <button onClick={() => handleViewDetails(meeting)} className="btn btn-secondary">
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

          {/* --- New Calendar Widget Area --- */}
          <div className="dashboard-sidebar">
            <CalendarWidget meetings={meetings} />
            {/* You could add more widgets here, like "Recent Activity" */}
          </div>
        </div>
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <div className="modal-overlay" onClick={() => setSelectedMeeting(null)}>
          <div className="modal-content card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Meeting Details</h2>
              <button onClick={() => setSelectedMeeting(null)} className="modal-close-btn">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <h3>{selectedMeeting.title}</h3>
              <p>
                <strong>Status:</strong>{' '}
                <span className={`meeting-status status-${selectedMeeting.status}`}>{selectedMeeting.status}</span>
              </p>
              <p>
                <strong>ID:</strong> {selectedMeeting.meetingId}
              </p>
              <p>
                <strong>Host:</strong> {selectedMeeting.host?.name || 'N/A'}
              </p>
              <p>
                <strong>Scheduled:</strong>{' '}
                {selectedMeeting.scheduledAt ? format(parseISO(selectedMeeting.scheduledAt), 'PPpp') : 'Instant'}
              </p>
              <p>
                <strong>Duration:</strong> {selectedMeeting.duration} minutes
              </p>
              <p>
                <strong>Description:</strong> {selectedMeeting.description || 'N/A'}
              </p>
              <p>
                <strong>Participants:</strong> {selectedMeeting.participantCount}
              </p>
              <p>
                <strong>Ended At:</strong>{' '}
                {selectedMeeting.endedAt ? format(parseISO(selectedMeeting.endedAt), 'PPpp') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
