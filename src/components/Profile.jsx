import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  FiUser,
  FiMail,
  FiLock,
  FiSave,
  FiEdit3,
  FiVideo,
  FiCalendar,
  FiClock,
  FiBell,
  FiSettings,
  FiShield,
  FiMessageCircle,
  FiPhone,
  FiAlertTriangle,
  FiEye,
  FiEyeOff,
  FiCheck,
  FiX,
} from 'react-icons/fi';
import { readProfileSettings, writeProfileSettings } from '../utils/profileSettings';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState(() => readProfileSettings());
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [meetingStats, setMeetingStats] = useState({
    hosted: 0,
    attended: 0,
    minutes: 0
  });

  const passwordCriteria = useMemo(() => ({
    minLength: profileData.newPassword.length >= 6,
    hasLetter: /[a-zA-Z]/.test(profileData.newPassword),
    hasNumber: /[0-9]/.test(profileData.newPassword),
    passwordsMatch: Boolean(profileData.newPassword) && profileData.newPassword === profileData.confirmPassword,
  }), [profileData.newPassword, profileData.confirmPassword]);

  const canUpdatePassword = passwordCriteria.minLength && passwordCriteria.hasLetter && passwordCriteria.hasNumber && passwordCriteria.passwordsMatch && profileData.currentPassword;

  const userInitials = useMemo(() => {
    const name = user?.name || user?.email || 'Cumeet';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'C';
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (user) {
      setProfileData((current) => ({
        ...current,
        name: user.name,
        email: user.email
      }));
    }
  }, [user]);

  useEffect(() => {
    writeProfileSettings(settings);
  }, [settings]);

  useEffect(() => {
    const fetchMeetingStats = async () => {
      try {
        const response = await api.get('/meetings?limit=100');
        const meetingList = response.data.meetings || [];
        const hosted = meetingList.filter((meeting) => meeting.host?._id === user?.id).length;
        const attended = meetingList.length;
        const minutes = meetingList.reduce((total, meeting) => total + (Number(meeting.duration) || 0), 0);
        setMeetingStats({ hosted, attended, minutes });
      } catch (error) {
        console.error('Failed to load profile meeting stats:', error);
      }
    };

    if (user?.id) fetchMeetingStats();
  }, [user?.id]);

  const handleChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const toggleSetting = (key) => {
    setSettings((current) => {
      const nextSettings = {
        ...current,
        [key]: !current[key]
      };
      writeProfileSettings(nextSettings);
      return nextSettings;
    });
  };

  const openMailTo = (subject) => {
    const email = 'support@cumeet.com';
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    window.location.href = mailto;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.put('/auth/profile', {
        name: profileData.name,
        email: profileData.email
      });
      updateUser(response.data.user);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      setError(error.response?.data?.message || error.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordError('');
    setSuccess('');

    if (!profileData.currentPassword) {
      setPasswordError('Enter your current password to verify your account.');
      return;
    }

    if (profileData.newPassword !== profileData.confirmPassword) {
      setPasswordError('New password and retype password must match.');
      return;
    }

    if (profileData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (!/[a-zA-Z]/.test(profileData.newPassword) || !/[0-9]/.test(profileData.newPassword)) {
      setPasswordError('New password must include at least one letter and one number.');
      return;
    }

    setLoading(true);

    try {
      await api.put('/auth/password', {
        currentPassword: profileData.currentPassword,
        newPassword: profileData.newPassword
      });
      
      setSuccess('Password updated successfully!');
      setProfileData({
        ...profileData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      const serverMessage = error.response?.data?.message || error.response?.data?.error?.message || 'Failed to update password';
      if (/current password is incorrect/i.test(serverMessage)) {
        setPasswordError('Current password does not match your account. Try again.');
      } else {
        setPasswordError(serverMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-shell container">
        <section className="profile-hero card">
          <div className="profile-hero-copy">
            <span className="profile-kicker">Account center</span>
            <h1>Profile, privacy, and support</h1>
            <p>
              Keep your account details, notification choices, and support links in one place.
              Changes are saved instantly where possible and locally for browser preferences.
            </p>
          </div>

          <div className="profile-hero-actions">
            <button type="button" className="btn btn-secondary profile-hero-btn" onClick={() => navigate('/contact')}>
              <FiMessageCircle />
              Contact us
            </button>
            <button type="button" className="btn btn-primary profile-hero-btn" onClick={() => openMailTo('CUMEET bug report')}>
              <FiAlertTriangle />
              Report a bug
            </button>
          </div>
        </section>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="profile-grid">
          <aside className="profile-sidebar">
            <div className="profile-card card profile-identity-card">
              <div className="profile-avatar">{userInitials}</div>
              <div className="profile-identity-text">
                <h2>{profileData.name || user?.name || 'Your profile'}</h2>
                <p>{profileData.email || user?.email}</p>
              </div>
              <div className="profile-status-badge">Active account</div>
            </div>

            <div className="profile-card card profile-stats-card">
              <div className="profile-card-title-row">
                <h3>Account statistics</h3>
                <FiSettings />
              </div>
              <div className="stats-grid profile-stats-grid">
                <div className="stat-item">
                  <FiVideo className="stat-item-icon" />
                  <div className="stat-value">{meetingStats.hosted}</div>
                  <div className="stat-label">Hosted</div>
                </div>
                <div className="stat-item">
                  <FiCalendar className="stat-item-icon" />
                  <div className="stat-value">{meetingStats.attended}</div>
                  <div className="stat-label">Joined</div>
                </div>
                <div className="stat-item">
                  <FiClock className="stat-item-icon" />
                  <div className="stat-value">{meetingStats.minutes}</div>
                  <div className="stat-label">Minutes</div>
                </div>
              </div>
            </div>

            <div className="profile-card card profile-support-card">
              <div className="profile-card-title-row">
                <h3>Need help?</h3>
                <FiShield />
              </div>
              <p className="profile-support-copy">
                Reach the CUMEET team for bugs, access issues, or product feedback.
              </p>
              <div className="profile-support-links">
                <button type="button" className="profile-support-link" onClick={() => navigate('/contact')}>
                  <FiMessageCircle />
                  Open contact form
                </button>
                <button type="button" className="profile-support-link" onClick={() => openMailTo('CUMEET support request')}>
                  <FiMail />
                  Email support
                </button>
                <button type="button" className="profile-support-link" onClick={() => window.location.href = 'tel:+1234567890'}>
                  <FiPhone />
                  Call admin
                </button>
              </div>
            </div>
          </aside>

          <main className="profile-main">
            <section className="profile-panel card">
              <div className="profile-panel-header">
                <div>
                  <span className="profile-panel-kicker">Profile details</span>
                  <h3>Account information</h3>
                </div>
                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="btn btn-secondary">
                    <FiEdit3 />
                    Edit profile
                  </button>
                )}
              </div>

              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-grid profile-form-grid">
                  <div className="form-group form-group-wide">
                    <label className="form-label">
                      <FiUser className="form-icon" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={profileData.name}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!isEditing}
                      required
                    />
                  </div>

                  <div className="form-group form-group-wide">
                    <label className="form-label">
                      <FiMail className="form-icon" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleChange}
                      className="form-input"
                      disabled={!isEditing}
                      required
                    />
                  </div>
                </div>

                <div className="form-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setError('');
                          setSuccess('');
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                      >
                        <FiSave />
                        {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                    </>
                  ) : (
                    <div className="profile-helper-text">
                      Use the edit button to update your name or email address.
                    </div>
                  )}
                </div>
              </form>
            </section>

            <section className="profile-panel card">
              <div className="profile-panel-header">
                <div>
                  <span className="profile-panel-kicker">Preferences</span>
                  <h3>Notifications and behavior</h3>
                </div>
              </div>

              <div className="settings-list">
                <button type="button" className={`setting-row ${settings.notificationsEnabled ? 'enabled' : 'disabled'}`} onClick={() => toggleSetting('notificationsEnabled')}>
                  <div>
                    <strong><FiBell /> Push notifications</strong>
                    <span>Turn meeting alerts and reminders on or off for this browser.</span>
                  </div>
                  <div className="setting-switch">{settings.notificationsEnabled ? 'On' : 'Off'}</div>
                </button>

                <button type="button" className={`setting-row ${settings.soundAlerts ? 'enabled' : 'disabled'}`} onClick={() => toggleSetting('soundAlerts')}>
                  <div>
                    <strong><FiBell /> Sound alerts</strong>
                    <span>Play a sound when a meeting starts or a message arrives.</span>
                  </div>
                  <div className="setting-switch">{settings.soundAlerts ? 'On' : 'Off'}</div>
                </button>

                <button type="button" className={`setting-row ${settings.compactMeetingCards ? 'enabled' : 'disabled'}`} onClick={() => toggleSetting('compactMeetingCards')}>
                  <div>
                    <strong><FiSettings /> Compact meeting cards</strong>
                    <span>Reduce card spacing in meeting lists and dashboards.</span>
                  </div>
                  <div className="setting-switch">{settings.compactMeetingCards ? 'On' : 'Off'}</div>
                </button>

              </div>

              <p className="settings-note">
                On means the feature is active in this browser. Off means the app skips that behavior.
              </p>
            </section>

            <section className="profile-panel card">
              <div className="profile-panel-header">
                <div>
                  <span className="profile-panel-kicker">Security</span>
                  <h3>Change password</h3>
                </div>
              </div>

              <form onSubmit={handlePasswordUpdate} className="password-form">
                {passwordError && <div className="security-inline-alert security-inline-alert-error">{passwordError}</div>}
                <div className="form-grid profile-form-grid">
                  <div className="form-group form-group-wide">
                    <label className="form-label">
                      <FiLock className="form-icon" />
                      Current Password
                    </label>
                    <div className="password-input-wrapper profile-password-wrapper">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        name="currentPassword"
                        value={profileData.currentPassword}
                        onChange={handleChange}
                        className="form-input"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowCurrentPassword((current) => !current)}
                        aria-label="Toggle current password visibility"
                      >
                        {showCurrentPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>

                  <div className="password-fields-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <FiLock className="form-icon" />
                        New Password
                      </label>
                      <div className="password-input-wrapper profile-password-wrapper">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          name="newPassword"
                          value={profileData.newPassword}
                          onChange={handleChange}
                          className="form-input"
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowNewPassword((current) => !current)}
                          aria-label="Toggle new password visibility"
                        >
                          {showNewPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <FiLock className="form-icon" />
                        Confirm New Password
                      </label>
                      <div className="password-input-wrapper profile-password-wrapper">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={profileData.confirmPassword}
                          onChange={handleChange}
                          className="form-input"
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          aria-label="Toggle confirm password visibility"
                        >
                          {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="password-requirements profile-password-checklist">
                  <div className={`requirement ${passwordCriteria.minLength ? 'valid' : 'invalid'}`}>
                    {passwordCriteria.minLength ? <FiCheck /> : <FiX />}
                    <span>At least 6 characters</span>
                  </div>
                  <div className={`requirement ${passwordCriteria.hasLetter ? 'valid' : 'invalid'}`}>
                    {passwordCriteria.hasLetter ? <FiCheck /> : <FiX />}
                    <span>Contains a letter</span>
                  </div>
                  <div className={`requirement ${passwordCriteria.hasNumber ? 'valid' : 'invalid'}`}>
                    {passwordCriteria.hasNumber ? <FiCheck /> : <FiX />}
                    <span>Contains a number</span>
                  </div>
                  <div className={`requirement ${passwordCriteria.passwordsMatch ? 'valid' : 'invalid'}`}>
                    {passwordCriteria.passwordsMatch ? <FiCheck /> : <FiX />}
                    <span>New password matches retype password</span>
                  </div>
                </div>

                <div className="form-actions profile-security-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !canUpdatePassword}
                  >
                    <FiSave />
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Profile;
