import { useState, useEffect } from "react";
import '../styles/scheduleMeeting.css';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios'; // Use the new centralized instance
import { FiCalendar, FiClock, FiUsers, FiFileText, FiArrowRight, FiBell, FiShield } from "react-icons/fi";
import { format } from "date-fns";

const ScheduleMeeting = () => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    duration: 30,
    participants: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [emailsQueued, setEmailsQueued] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Ensure body scrolling is enabled when visiting schedule page
    try { document.body.style.overflow = ''; } catch (e) {}
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    console.log('[Schedule] Submit clicked, formData:', formData);

    try {
      const scheduledDateTime = new Date(formData.scheduledAt);
      const meetingData = {
        ...formData,
        scheduledAt: scheduledDateTime.toISOString(),
        formattedScheduledAt: format(scheduledDateTime, 'PPPP pppp'), // e.g., "July 25th, 2024 at 2:00:00 PM GMT+5:30"
        participants: formData.participants // Keep this for UTC storage
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
      };

      // --- NEW FRONTEND LOG ---
      console.log('[Schedule] Sending meeting data to server:', meetingData);

      console.log('[Schedule] Prepared meetingData:', {
        title: meetingData.title,
        scheduledAt: meetingData.scheduledAt,
        participantsCount: meetingData.participants.length
      });

      // Use the new instance. The URL is now relative to '/api'
      const response = await api.post('/meetings', meetingData);
      console.log('[Schedule] /meetings response:', response && response.data);
      setSuccess("Meeting scheduled successfully!");
      setCreatedMeeting(response.data.meeting);
      setEmailsQueued(Boolean(response.data.emailsQueued));
    } catch (error) {
      console.error('[Schedule] Error scheduling:', error);
      // Provide detailed error message for debugging
      const serverMsg = error?.response?.data?.message;
      const errDetail = error?.response?.data || error?.message || String(error);
      setError(serverMsg || "Failed to schedule meeting. See console for details.");
      console.error('[Schedule] Error details:', errDetail);
    } finally {
      setLoading(false);
    }
  };
              <small className="form-note form-note-accent">
                If the room stays empty, the meeting will close automatically after the timeout period.
              </small>

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const selectedDateTime = formData.scheduledAt ? new Date(formData.scheduledAt) : null;
  const meetingEndsAt = selectedDateTime
    ? new Date(selectedDateTime.getTime() + Number(formData.duration || 0) * 60000)
    : null;
  const durationLabel =
    formData.duration >= 60
      ? `${formData.duration / 60} hour${formData.duration > 60 ? 's' : ''}`
      : `${formData.duration} minutes`;

  return (
    <div className="schedule-meeting">
      <div className="schedule-shell container">
        <section className="schedule-hero card">
          <div className="schedule-hero-copy">
            <span className="schedule-eyebrow">Schedule workspace</span>
            <h1>Build a polished meeting setup in seconds.</h1>
            <p>
              Create a meeting with a cleaner layout, stronger visual hierarchy, and a responsive calendar flow that adapts from wide desktop screens to compact mobile views.
            </p>
          </div>

          <div className="schedule-hero-points">
            <div className="schedule-point">
              <FiBell />
              <div>
                <strong>Smart reminders</strong>
                <span>Invite participants with a clear schedule.</span>
              </div>
            </div>
            <div className="schedule-point">
              <FiShield />
              <div>
                <strong>Clean handoff</strong>
                <span>Meeting links and timing are shown immediately.</span>
              </div>
            </div>
            <div className="schedule-point">
              <FiArrowRight />
              <div>
                <strong>Responsive layout</strong>
                <span>Expands on desktop and stacks naturally on smaller screens.</span>
              </div>
            </div>
          </div>
        </section>

        <div className="schedule-layout">
          <div className="schedule-form-container card">
            <div className="schedule-form-topbar">
              <div>
                <p className="schedule-panel-kicker">Meeting details</p>
                <h2>Prepare the session</h2>
              </div>
              <div className="schedule-panel-badge">Responsive form</div>
            </div>

          {error && <div className="alert alert-error">{error}</div>}

          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="schedule-form">
            <div className="form-grid">
              <div className="form-group form-group-wide">
                <label className="form-label">
                  <FiFileText className="form-icon" />
                  Meeting Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter meeting title"
                  required
                />
              </div>

              <div className="form-group form-group-wide">
                <label className="form-label">
                  <FiFileText className="form-icon" />
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="form-textarea"
                  placeholder="Meeting description or agenda"
                  rows="4"
                />
              </div>

              <div className="schedule-date-block form-group">
                <label className="form-label">
                  <FiCalendar className="form-icon" />
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className="form-input schedule-datetime"
                  min={getCurrentDateTime()}
                  required
                />
                <small className="form-help">
                  Choose the exact start time. The meeting link will be created for this window.
                </small>
                <small className="form-note form-note-accent">
                  Meeting room will close automatically if nobody stays in the room for 20 min atmost.
                </small>
              </div>

              <div className="schedule-date-card">
                <div className="schedule-date-card-title">Meeting window</div>
                <div className="schedule-date-value">
                  {selectedDateTime ? format(selectedDateTime, 'EEE, MMM d • p') : 'Select a date and time'}
                </div>
                <div className="schedule-date-meta">
                  <span>{durationLabel}</span>
                  <span>{meetingEndsAt ? `Ends ${format(meetingEndsAt, 'p')}` : 'Duration preview'}</span>
                </div>
              </div>

              <div className="form-group schedule-duration-block">
              <label className="form-label">
                  <FiClock className="form-icon" />
                  Duration (minutes)
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="form-input schedule-select"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
                <small className="form-note">
                  This updates the expiry preview shown beside the field.
                </small>
              </div>

              <div className="form-group form-group-wide">
                <label className="form-label">
                  <FiUsers className="form-icon" />
                  Participant Emails (Optional)
                </label>
                <input
                  type="text"
                  name="participants"
                  value={formData.participants}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Enter email addresses separated by commas"
                />
                <small className="form-help">
                  Participants will receive meeting invitations with the meeting link via email.
                </small>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary schedule-submit"
                disabled={loading}
              >
                {loading ? "Scheduling..." : "Schedule Meeting"}
              </button>
            </div>
          </form>
          </div>

          <aside className="schedule-sidebar">
            <div className="schedule-preview card">
              <div className="schedule-panel-kicker">Live summary</div>
              <h3>Preview your meeting</h3>
              <div className="schedule-preview-grid">
                <div>
                  <span>Title</span>
                  <strong>{formData.title || 'Untitled meeting'}</strong>
                </div>
                <div>
                  <span>Start</span>
                  <strong>{selectedDateTime ? format(selectedDateTime, 'PPp') : 'Not selected yet'}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{durationLabel}</strong>
                </div>
                <div>
                  <span>Expires</span>
                  <strong>{meetingEndsAt ? format(meetingEndsAt, 'PPp') : 'Calculated automatically'}</strong>
                </div>
              </div>
              
            </div>

            <div className="schedule-tips card">
              <div className="schedule-panel-kicker">Quick checklist</div>
              <ul>
                <li>Pick the meeting window first so the preview updates instantly.</li>
                <li>Add participants with comma-separated email addresses.</li>
                <li>Use the primary button to create the meeting and send invitations.</li>
              </ul>
            </div>
          </aside>
        </div>

        {/* Success Message with Meeting Link */}
        {success && createdMeeting && (
          <div className="meeting-link-card card">
            <h3>Meeting Scheduled Successfully! 🎉</h3>
            <div className="meeting-link-details">
              <p>
                <strong>
                  Your meeting has been created and invitations have been sent.
                </strong>
              </p>
              <div className="meeting-link-info">
                <label>Meeting Link:</label>
                <div className="link-container">
                  <input
                    type="text"
                    value={createdMeeting.meetingLink}
                    readOnly
                    className="form-input meeting-link-input"
                  />
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(createdMeeting.meetingLink)
                    }
                    className="btn btn-secondary copy-btn"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <p className="expiry-info">
                <strong>Note:</strong> This meeting link will expire after the
                scheduled duration ends.
              </p>
              {emailsQueued ? (
                <div className="alert alert-info">Invitations have been queued and are being sent in the background.</div>
              ) : (
                <div className="alert alert-warning">Invitations were not queued — email sending may not be configured on the server.</div>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-primary"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Meeting Preview */}
        {formData.title && formData.scheduledAt && (
          <div className="meeting-preview card">
            <h3>Meeting Preview</h3>
            <div className="preview-details">
              <div className="preview-item preview-item-hero">
                <strong>{formData.title}</strong>
                <span>{format(new Date(formData.scheduledAt), "EEE, MMM d • p")}</span>
              </div>
              <div className="preview-item">
                <strong>Duration</strong>
                <span>{formData.duration} minutes</span>
              </div>
              <div className="preview-item">
                <strong>Ends</strong>
                <span>
                  {format(
                    new Date(
                      new Date(formData.scheduledAt).getTime() +
                        formData.duration * 60000
                    ),
                    "PPp"
                  )}
                </span>
              </div>
              {formData.description && (
                <div className="preview-item preview-item-wide">
                  <strong>Description</strong>
                  <span>{formData.description}</span>
                </div>
              )}
              {formData.participants && (
                <div className="preview-item preview-item-wide">
                  <strong>Participants</strong>
                  <span>{formData.participants}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleMeeting;
