/**
 * Error Context
 * Global error state management for frontend
 */

import React, { createContext, useState, useCallback } from 'react';

export const ErrorContext = createContext();

export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState([]);

  const addError = useCallback((error) => {
    const id = Date.now();
    const errorObj = {
      id,
      message: error.message || 'An error occurred',
      code: error.code,
      type: error.type || 'error',
      timestamp: new Date(),
    };

    setErrors((prev) => [...prev, errorObj]);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
      removeError(id);
    }, 5000);

    return id;
  }, []);

  const removeError = useCallback((id) => {
    setErrors((prev) => prev.filter((err) => err.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const value = {
    errors,
    addError,
    removeError,
    clearErrors,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = React.useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
};
