import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { format } from 'date-fns';
import { FiInfo, FiVideo, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const NotificationDropdown = ({ onClose }) => {
  const { notifications, markNotificationAsRead, clearAllNotifications } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification) => {
    markNotificationAsRead(notification.id);
    navigate(`/meeting/${notification.meetingId}`);
    onClose();
  };

  return (
    <div className="notification-dropdown card">
      <div className="notification-header">
        <h3>Notifications</h3>
        <button onClick={onClose} className="close-btn"><FiX /></button>
      </div>
      {notifications.length === 0 ? (
        <p className="no-notifications">No new notifications.</p>
      ) : (
        <>
          <ul className="notification-list">
            {notifications.map((notif) => (
              <li key={notif.id} className={`notification-item ${notif.read ? 'read' : ''}`}>
                <div className="notification-content">
                  <FiInfo className="notification-icon" />
                  <div>
                    <p className="notification-title">Meeting starting soon: <strong>{notif.title}</strong></p>
                    <p className="notification-time">
                      {notif.scheduledAt ? format(new Date(notif.scheduledAt), 'MMM dd, yyyy HH:mm') : 'Instant Meeting'}
                    </p>
                  </div>
                </div>
                <div className="notification-actions">
                  <button
                    onClick={() => handleNotificationClick(notif)}
                    className="btn btn-primary btn-sm"
                  >
                    <FiVideo /> Join
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="notification-footer">
            <button onClick={clearAllNotifications} className="btn btn-secondary btn-sm">
              Clear All
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationDropdown;