import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext'; // Import useNotifications
import { FiHome, FiCalendar, FiUser, FiLogOut, FiVideo, FiBell } from 'react-icons/fi'; // Import FiBell
import NotificationDropdown from './NotificationDropdown'; // Import NotificationDropdown

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications(); // Get unreadCount from notifications context
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false); // State to toggle notification dropdown

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/dashboard" className="nav-brand">
          <FiVideo className="brand-icon" />
          Cumeet
        </Link>

        <div className="nav-menu">
          <Link to="/dashboard" className={isActive('/dashboard')}>
            <FiHome />
            Dashboard
          </Link>
          
          <Link to="/schedule" className={isActive('/schedule')}>
            <FiCalendar />
            Schedule
          </Link>
          
          <Link to="/profile" className={isActive('/profile')}>
            <FiUser />
            Profile
          </Link>
        </div>

        <div className="nav-user">
          <div className="notification-icon-container">
            <FiBell className="notification-icon" onClick={() => setShowNotifications(!showNotifications)} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
            {showNotifications && (
              <NotificationDropdown onClose={() => setShowNotifications(false)} />
            )}
          </div>
          <span className="user-name">Hello, {user?.name}</span>
          <button onClick={handleLogout} className="btn btn-secondary">
            <FiLogOut />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;