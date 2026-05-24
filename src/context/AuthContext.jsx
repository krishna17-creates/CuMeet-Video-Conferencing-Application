import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionInitialized, setSessionInitialized] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Handle popstate event to prevent unwanted back/forward navigation
  useEffect(() => {
    if (!sessionInitialized) return;

    const handlePopState = (event) => {
      // If user tries to go back from a protected page
      if (user && window.location.pathname.match(/^\/(dashboard|meeting|schedule|profile)/)) {
        // Prevent going back to login/signup
        window.history.forward();
      }
      // If user tries to go forward while logged out
      if (!user && event.state?.protectedPage) {
        window.history.back();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, sessionInitialized]);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
        setSessionInitialized(true);
      } else {
        setSessionInitialized(true);
      }
    } catch (error) {
      localStorage.removeItem('token');
      setSessionInitialized(true);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('loginTime', Date.now().toString());
      setUser(user);

      // Add a state to history to prevent back button
      // This replaces the current history entry so user can't go back to login
      window.history.replaceState({ userLoggedIn: true }, '', window.location.href);
      
      // Push new state so forward button won't work later
      setTimeout(() => {
        window.history.pushState({ protectedPage: true }, '', window.location.href);
      }, 100);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await api.post('/auth/signup', userData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('loginTime', Date.now().toString());
      setUser(user);

      // Add a state to history to prevent back button
      window.history.replaceState({ userLoggedIn: true }, '', window.location.href);
      
      setTimeout(() => {
        window.history.pushState({ protectedPage: true }, '', window.location.href);
      }, 100);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || 'Signup failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('loginTime');
    setUser(null);

    // Clear history to prevent forward navigation to protected pages
    window.history.replaceState({ loggedOut: true }, '', window.location.href);
    
    // Prevent access to previous pages using forward button
    window.history.pushState(null, '', window.location.href);
  };

  const updateUser = (nextUser) => {
    setUser((currentUser) => ({
      ...currentUser,
      ...nextUser,
    }));
  };

  const value = {
    user,
    login,
    signup,
    logout,
    updateUser,
    loading,
    sessionInitialized
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
