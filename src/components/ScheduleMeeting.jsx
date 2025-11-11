import { useState, useEffect } from "react";
import '../styles/scheduleMeeting.css';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios'; // Use the new centralized instance
import { FiCalendar, FiClock, FiUsers, FiFileText } from "react-icons/fi";
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

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="schedule-meeting">
      <div className="container-sm">
        <div className="schedule-header">
          <h1>Schedule New Meeting</h1>
          <p>Set up a meeting for later</p>
        </div>

        <div className="schedule-form-container card">
          {error && <div className="alert alert-error">{error}</div>}

          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="schedule-form">
            <div className="form-group">
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

            <div className="form-group">
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
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <FiCalendar className="form-icon" />
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className="form-input"
                  min={getCurrentDateTime()}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <FiClock className="form-icon" />
                  Duration (minutes)
                </label>
                <select
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>

            <div className="form-group">
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
                Participants will receive meeting invitations with the meeting
                link via email
              </small>
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
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Scheduling..." : "Schedule Meeting"}
              </button>
            </div>
          </form>
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
              <div className="preview-item">
                <strong>Title:</strong> {formData.title}
              </div>
              <div className="preview-item">
                <strong>Date:</strong>{" "}
                {format(new Date(formData.scheduledAt), "PPP")}
              </div>
              <div className="preview-item">
                <strong>Time:</strong>{" "}
                {format(new Date(formData.scheduledAt), "p")}
              </div>
              <div className="preview-item">
                <strong>Duration:</strong> {formData.duration} minutes
              </div>
              <div className="preview-item">
                <strong>Expires:</strong>{" "}
                {format(
                  new Date(
                    new Date(formData.scheduledAt).getTime() +
                      formData.duration * 60000
                  ),
                  "PPp"
                )}
              </div>
              {formData.description && (
                <div className="preview-item">
                  <strong>Description:</strong> {formData.description}
                </div>
              )}
              {formData.participants && (
                <div className="preview-item">
                  <strong>Participants:</strong> {formData.participants}
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
