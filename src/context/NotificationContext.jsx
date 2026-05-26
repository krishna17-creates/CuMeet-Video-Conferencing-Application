import React, { createContext, useContext, useState } from 'react';
import { readProfileSettings } from '../utils/profileSettings';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const playNotificationTone = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.02;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 120);
    } catch (error) {
      // Ignore browsers that block Web Audio or do not support it.
    }
  };

  const addNotification = (notification) => {
    const profileSettings = readProfileSettings();

    if (!profileSettings.notificationsEnabled) {
      return;
    }

    let shouldPlayTone = false;

    setNotifications((prev) => {
      // Prevent duplicate notifications for the same meeting
      if (prev.some(n => n.id === notification.id)) {
        return prev;
      }

      shouldPlayTone = profileSettings.soundAlerts;
      return [...prev, { ...notification, read: false }];
    });

    if (shouldPlayTone) {
      playNotificationTone();
    }
  };

  const markNotificationAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = {
    notifications,
    addNotification,
    markNotificationAsRead,
    clearAllNotifications,
    unreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};