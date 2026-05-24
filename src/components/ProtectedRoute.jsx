import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * Ensures user is authenticated before accessing protected pages
 * Handles token validation, session management, and error states
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading, sessionInitialized } = useAuth();

  if (loading || !sessionInitialized) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="protected-route-wrapper">
      {children}
    </div>
  );
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;
