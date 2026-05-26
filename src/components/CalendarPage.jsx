import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiChevronLeft, FiChevronRight, FiClock, FiFileText, FiArrowRight, FiSave, FiArrowLeft, FiCheck, FiEdit3, FiBarChart2 } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  formatDistanceToNow,
  getDay,
  isSameDay,
  parseISO,
  startOfMonth,
} from 'date-fns';
import '../styles/calendar.css';

const notesStorageKey = 'cumeet-calendar-notes';

const getMeetingTime = (meeting) => {
  const source = meeting.scheduledAt || meeting.startedAt || meeting.createdAt;
  return source ? parseISO(source) : null;
};

const getMeetingDateKey = (meeting) => {
  const source = meeting.scheduledAt || meeting.startedAt || meeting.createdAt;
  return source ? format(parseISO(source), 'yyyy-MM-dd') : null;
};

const getMeetingDeadline = (meeting) => {
  if (meeting?.endedAt) return parseISO(meeting.endedAt);
  if (meeting?.expiresAt) return parseISO(meeting.expiresAt);

  const source = meeting?.startedAt || meeting?.scheduledAt || meeting?.createdAt;
  if (!source || !meeting?.duration) return null;

  const baseTime = parseISO(source);
  return new Date(baseTime.getTime() + meeting.duration * 60 * 1000);
};

const isMeetingEnded = (meeting, now = new Date()) => {
  if (!meeting) return false;
  if (meeting.status === 'ended' || meeting.status === 'cancelled') return true;

  const deadline = getMeetingDeadline(meeting);
  return Boolean(deadline && now >= deadline);
};

const isLiveMeeting = (meeting) => {
  return meeting.status === 'active' && !isMeetingEnded(meeting);
};

const CalendarPage = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notes, setNotes] = useState({});
  const [activeMeetingId, setActiveMeetingId] = useState(null);
  const [saveStatus, setSaveStatus] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async () => {
    try {
      const response = await api.get('/meetings');
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('Error fetching meetings for calendar:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  useEffect(() => {
    try {
      const storedNotes = window.localStorage.getItem(notesStorageKey);
      if (storedNotes) {
        setNotes(JSON.parse(storedNotes));
      }
    } catch (error) {
      console.error('Failed to load calendar notes:', error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(notesStorageKey, JSON.stringify(notes));
    } catch (error) {
      console.error('Failed to save calendar notes:', error);
    }
  }, [notes]);

  useEffect(() => {
    if (activeMeetingId && saveStatus[activeMeetingId] === 'unsaved') {
      const saveTimer = window.setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [activeMeetingId]: 'saved' }));
      }, 600);

      return () => window.clearTimeout(saveTimer);
    }
    return undefined;
  }, [activeMeetingId, saveStatus]);

  const meetingsByDate = useMemo(() => {
    const now = new Date();

    return meetings.reduce((acc, meeting) => {
      const key = getMeetingDateKey(meeting);
      if (!key) return acc;

      const time = getMeetingTime(meeting);
      const statusBucket = isMeetingEnded(meeting, now)
        ? 'past'
        : isLiveMeeting(meeting)
          ? 'live'
          : 'upcoming';
      const item = {
        id: meeting.id,
        meetingId: meeting.meetingId,
        title: meeting.title,
        status: meeting.status,
        type: meeting.type,
        time,
        participantCount: meeting.participantCount || 0,
        note: notes[meeting.meetingId] || '',
        meetingLink: meeting.meetingLink,
      };

      acc[key] = acc[key] || { upcoming: [], live: [], past: [] };
      acc[key][statusBucket].push(item);
      return acc;
    }, {});
  }, [meetings, notes]);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayBucket = meetingsByDate[selectedDateKey] || { upcoming: [], live: [], past: [] };
  const selectedDayMeetings = [...selectedDayBucket.live, ...selectedDayBucket.upcoming, ...selectedDayBucket.past].sort((a, b) => {
    const aTime = a.time ? a.time.getTime() : 0;
    const bTime = b.time ? b.time.getTime() : 0;
    return aTime - bTime;
  });

  useEffect(() => {
    if (selectedDayMeetings.length === 0) {
      setActiveMeetingId(null);
      return;
    }

    if (selectedDayMeetings.length === 1) {
      setActiveMeetingId(selectedDayMeetings[0].meetingId);
      return;
    }

    if (!activeMeetingId || !selectedDayMeetings.some((meeting) => meeting.meetingId === activeMeetingId)) {
      setActiveMeetingId(null);
    }
  }, [selectedDateKey, activeMeetingId, selectedDayMeetings]);

  const activeMeeting = selectedDayMeetings.find((meeting) => meeting.meetingId === activeMeetingId) || null;

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const selectedMonthDays = daysInMonth.map((day) => format(day, 'yyyy-MM-dd'));
  const monthlyMeetings = useMemo(
    () => meetings.filter((meeting) => selectedMonthDays.includes(getMeetingDateKey(meeting))),
    [meetings, selectedMonthDays]
  );

  const stats = useMemo(() => {
    const total = meetings.length;
    const upcoming = meetings.filter((meeting) => !isMeetingEnded(meeting)).length;
    const past = total - upcoming;
    const notesCount = Object.values(notes).filter(Boolean).length;
    return { total, upcoming, past, notesCount };
  }, [meetings, notes]);

  const timelineGroups = useMemo(() => {
    const groups = meetings.reduce((acc, meeting) => {
      const time = getMeetingTime(meeting);
      const key = time ? format(time, 'yyyy-MM-dd') : 'unscheduled';
      const label = time ? format(time, 'EEE, MMM d') : 'Unscheduled';
      const note = notes[meeting.meetingId] || '';
      const live = isLiveMeeting(meeting);
      const ended = isMeetingEnded(meeting);

      if (!acc[key]) {
        acc[key] = {
          key,
          label,
          time,
          meetings: [],
        };
      }

      acc[key].meetings.push({
        meetingId: meeting.meetingId,
        title: meeting.title,
        status: ended ? (meeting.status === 'cancelled' ? 'cancelled' : 'ended') : live ? 'active' : 'upcoming',
        time,
        note,
        live,
      });

      return acc;
    }, {});

    return Object.values(groups)
      .sort((a, b) => {
        const aTime = a.time ? a.time.getTime() : 0;
        const bTime = b.time ? b.time.getTime() : 0;
        return bTime - aTime;
      })
      .map((group) => ({
        ...group,
        meetings: group.meetings.sort((a, b) => {
          const aTime = a.time ? a.time.getTime() : 0;
          const bTime = b.time ? b.time.getTime() : 0;
          return aTime - bTime;
        }),
      }));
  }, [meetings, notes]);

  const timelineStats = useMemo(() => {
    const counts = timelineGroups.reduce((acc, group) => {
      acc.days += 1;
      acc.meetings += group.meetings.length;
      return acc;
    }, { days: 0, meetings: 0 });

    return counts;
  }, [timelineGroups]);

  const [showMeetingMix, setShowMeetingMix] = useState(false);

  const weekdayActivity = useMemo(() => {
    const bucket = [0, 0, 0, 0, 0, 0, 0];
    meetings.forEach((meeting) => {
      const time = getMeetingTime(meeting);
      if (time) bucket[time.getDay()] += 1;
    });
    return bucket;
  }, [meetings]);

  const maxWeekdayCount = Math.max(...weekdayActivity, 1);

  const handleNoteChange = (meetingId, value) => {
    setNotes((prev) => ({ ...prev, [meetingId]: value }));
    setSaveStatus((prev) => ({ ...prev, [meetingId]: 'unsaved' }));
  };

  const handleSaveNote = (meetingId) => {
    setSaveStatus((prev) => ({ ...prev, [meetingId]: 'saved' }));
  };

  const handleMeetingSelect = (meeting) => {
    setActiveMeetingId(meeting.meetingId);
  };

  if (loading) {
    return (
      <div className="calendar-page loading">
        <div className="calendar-loading-card">
          <div className="loading-spinner" />
          <p>Loading your timeline...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="calendar-page">
      <div className="container calendar-page-shell">
        <section className="calendar-hero card">
          <div>
            <p className="calendar-kicker">Timeline</p>
            <h1>{user?.name ? `${user.name}'s Calendar` : 'Calendar'}</h1>
            <p className="calendar-subtitle">
              Review past meetings, check what is next, and keep short notes beside every meeting you attend.
            </p>
          </div>
          <div className="calendar-hero-actions">
            <button className="calendar-hero-btn" onClick={() => setCurrentDate(new Date())}>
              Today
            </button>
            <button className="calendar-hero-btn primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </section>

        <section className="calendar-stats-grid">
          <article className="calendar-stat card">
            <FiCalendar />
            <div>
              <strong>{stats.total}</strong>
              <span>Total meetings</span>
            </div>
          </article>
          <article className="calendar-stat card">
            <FiArrowRight />
            <div>
              <strong>{stats.upcoming}</strong>
              <span>Upcoming</span>
            </div>
          </article>
          <article className="calendar-stat card">
            <FiClock />
            <div>
              <strong>{stats.past}</strong>
              <span>Past</span>
            </div>
          </article>
          <article className="calendar-stat card">
            <FiFileText />
            <div>
              <strong>{stats.notesCount}</strong>
              <span>Saved notes</span>
            </div>
          </article>
        </section>

        <section className="calendar-layout">
          <div className="calendar-board card">
            <div className="calendar-board-header">
              <button className="calendar-nav-btn large" onClick={() => setCurrentDate((date) => addMonths(date, -1))}>
                <FiChevronLeft />
              </button>
              <div>
                <h2>{format(currentDate, 'MMMM yyyy')}</h2>
                <p>Click any day to open the meeting details and notes panel.</p>
              </div>
              <button className="calendar-nav-btn large" onClick={() => setCurrentDate((date) => addMonths(date, 1))}>
                <FiChevronRight />
              </button>
            </div>

            <div className="calendar-grid-shell">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="calendar-weekday">
                  {day}
                </div>
              ))}

              {Array.from({ length: getDay(startOfMonth(currentDate)) }).map((_, index) => (
                <div key={`empty-${index}`} className="calendar-cell empty" />
              ))}

              {daysInMonth.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const bucket = meetingsByDate[key] || { upcoming: [], past: [] };
                const count = bucket.upcoming.length + bucket.past.length;
                const hasMeetings = count > 0;
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);
                const titles = [...bucket.upcoming, ...bucket.past].map((meeting) => meeting.title).join(', ');

                return (
                  <button
                    key={key}
                    type="button"
                    className={`calendar-cell ${hasMeetings ? 'has-meetings' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(day)}
                    title={hasMeetings ? `${count} meetings: ${titles}` : format(day, 'EEE, MMM d')}
                  >
                    <span className="calendar-date-number">{format(day, 'd')}</span>
                    {hasMeetings && <span className="calendar-count-badge">{count}</span>}
                    <span className="calendar-dot-row">
                      {bucket.upcoming.length > 0 && <span className="calendar-dot upcoming" />}
                      {bucket.past.length > 0 && <span className="calendar-dot past" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="calendar-side-panel">
            <div className="calendar-panel card">
              <div className="calendar-panel-header">
                <div>
                  <p className="calendar-kicker">Selected day</p>
                  <h3>{format(selectedDate, 'EEE, MMM d')}</h3>
                </div>
                <span className="calendar-panel-pill">
                  {selectedDayMeetings.length} meeting{selectedDayMeetings.length === 1 ? '' : 's'}
                </span>
              </div>

              {selectedDayMeetings.length > 0 ? (
                activeMeeting ? (
                  <div className="calendar-meeting-editor">
                    <div className="calendar-editor-top">
                      {selectedDayMeetings.length > 1 ? (
                        <button className="calendar-back-btn" type="button" onClick={() => setActiveMeetingId(null)}>
                          <FiArrowLeft /> Back to meetings
                        </button>
                      ) : (
                        <span className="calendar-editor-spacer" />
                      )}
                      <span className={`calendar-status status-${activeMeeting.status}`}>{activeMeeting.status}</span>
                    </div>
                    <h4 className="calendar-editor-title">{activeMeeting.title}</h4>
                    <p className="calendar-editor-meta">
                      {activeMeeting.time ? format(activeMeeting.time, 'PPpp') : 'Any time'}
                      {activeMeeting.time ? ` • ${formatDistanceToNow(activeMeeting.time, { addSuffix: true })}` : ''}
                    </p>

                    <div className="calendar-note-card">
                      <label className="calendar-note-label" htmlFor={`note-${activeMeeting.meetingId}`}>
                        What did you get from this meeting?
                      </label>
                      <textarea
                        id={`note-${activeMeeting.meetingId}`}
                        className="calendar-note-input"
                        placeholder="Write what you learned, action items, or reminders..."
                        rows={10}
                        value={notes[activeMeeting.meetingId] || ''}
                        onChange={(event) => handleNoteChange(activeMeeting.meetingId, event.target.value)}
                      />
                      <div className="calendar-note-actions">
                        <button
                          type="button"
                          className="calendar-save-btn"
                          onClick={() => handleSaveNote(activeMeeting.meetingId)}
                        >
                          <FiSave />
                          {saveStatus[activeMeeting.meetingId] === 'saved' ? 'Saved locally' : 'Save note'}
                        </button>
                        <span className="calendar-save-status">
                          {saveStatus[activeMeeting.meetingId] === 'saved'
                            ? (
                                <>
                                  <FiCheck /> Saved locally
                                </>
                              )
                            : (
                                <>
                                  <FiEdit3 /> Edit and save notes
                                </>
                              )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="calendar-day-list scrollable">
                    {selectedDayMeetings.map((meeting) => (
                      <button
                        key={meeting.meetingId}
                        type="button"
                        className="calendar-day-meeting-select"
                        onClick={() => handleMeetingSelect(meeting)}
                      >
                        <div>
                          <strong>{meeting.title}</strong>
                          <span>
                            {meeting.time ? format(meeting.time, 'p') : 'Any time'}
                            {meeting.time ? ` • ${formatDistanceToNow(meeting.time, { addSuffix: true })}` : ''}
                          </span>
                        </div>
                        <span className={`calendar-status status-${meeting.status}`}>{meeting.status}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="calendar-empty-state">
                  <FiFileText />
                  <p>No meetings on this day yet.</p>
                  <span>Click another day to inspect its meetings.</span>
                </div>
              )}
            </div>
          </aside>
        </section>

        <section className="calendar-timeline card">
          <div className="calendar-timeline-header">
            <div>
              <p className="calendar-kicker">Timeline</p>
              <h2>Walkthrough of your days</h2>
            </div>
            <span>{timelineStats.days} days, {timelineStats.meetings} meetings</span>
          </div>
          <div className="calendar-timeline-list walkthrough">
            {timelineGroups.map((group) => (
              <article key={group.key} className="calendar-timeline-group">
                <div className="calendar-timeline-marker" />
                <div className="calendar-timeline-content">
                  <div className="calendar-timeline-top">
                    <div>
                      <h4>{group.label}</h4>
                      <p>{group.meetings.length} meeting{group.meetings.length === 1 ? '' : 's'}</p>
                    </div>
                    <span className="calendar-panel-pill">{group.meetings.length}</span>
                  </div>
                  <div className="calendar-timeline-day-list">
                    {group.meetings.map((meeting) => (
                      <div key={meeting.meetingId} className="calendar-timeline-meeting-row">
                        <div>
                          <strong>{meeting.title}</strong>
                          <span>
                            {meeting.time ? format(meeting.time, 'p') : 'Any time'}
                            {meeting.time ? ` • ${formatDistanceToNow(meeting.time, { addSuffix: true })}` : ''}
                          </span>
                        </div>
                        <span className={`calendar-status status-${meeting.status}`}>{meeting.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="calendar-panel card meeting-mix-toggle-card">
          <button type="button" className="meeting-mix-toggle" onClick={() => setShowMeetingMix((prev) => !prev)}>
            <span>
              <p className="calendar-kicker">Analytics</p>
              <strong>Meeting mix</strong>
            </span>
            <FiBarChart2 />
          </button>
          {showMeetingMix && (
            <div className="calendar-summary-bars">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, index) => (
                <div key={dayName} className="calendar-summary-row">
                  <span>{dayName}</span>
                  <div className="calendar-summary-track">
                    <div
                      className="calendar-summary-fill"
                      style={{ width: `${(weekdayActivity[index] / maxWeekdayCount) * 100}%` }}
                    />
                  </div>
                  <strong>{weekdayActivity[index]}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default CalendarPage;
