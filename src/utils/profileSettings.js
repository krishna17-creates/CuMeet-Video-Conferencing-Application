const STORAGE_KEY = 'cumeet-profile-settings';

export const DEFAULT_PROFILE_SETTINGS = {
  notificationsEnabled: true,
  soundAlerts: true,
  compactMeetingCards: false,
};

export const readProfileSettings = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_PROFILE_SETTINGS;
  }

  try {
    const storedSettings = window.localStorage.getItem(STORAGE_KEY);
    if (!storedSettings) {
      return DEFAULT_PROFILE_SETTINGS;
    }

    return {
      ...DEFAULT_PROFILE_SETTINGS,
      ...JSON.parse(storedSettings),
    };
  } catch (error) {
    return DEFAULT_PROFILE_SETTINGS;
  }
};

export const writeProfileSettings = (settings) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...DEFAULT_PROFILE_SETTINGS,
      ...settings,
    }));
  } catch (error) {
    console.error('Failed to save profile settings:', error);
  }
};