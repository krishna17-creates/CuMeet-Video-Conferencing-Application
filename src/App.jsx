import { Routes, Route, Navigate ,useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import Dashboard from './components/Dashboard';
import CalendarPage from './components/CalendarPage';
import MeetingRoom from './components/MeetingRoom';
import ScheduleMeeting from './components/ScheduleMeeting';
import Profile from './components/Profile';
import ContactPage from './components/ContactPage';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { ErrorProvider, useError } from './context/ErrorContext';
import ErrorBoundary from './components/ErrorBoundary';
import { setupErrorHandler } from './api/axios';
import './App.css';

/**
 * Inner App Component
 * Uses error context and sets up interceptors
 */
function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { addError } = useError();

  // Setup axios interceptors with error handler on mount
  useEffect(() => {
    setupErrorHandler(addError);
  }, []);

  const isMeetingPage = location.pathname.startsWith('/meeting/');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <div className="app">
        {/* Only show Navbar if user is logged in AND not on the meeting page */}
        {user && !isMeetingPage && <Navbar />}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <HomePage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <SignUpPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/meeting/:meetingId" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><ScheduleMeeting /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      </Routes>
      </div>
    </>
  );
}

/**
 * Main App Component
 * Wraps everything with error boundary and error provider
 */
function App() {
  return (
    <ErrorBoundary>
      <ErrorProvider>
        <AppContent />
      </ErrorProvider>
    </ErrorBoundary>
  );
}

export default App;