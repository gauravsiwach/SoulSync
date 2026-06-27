const API_BASE_URL = 'http://localhost:8000';

export interface UserSettings {
  risk_monitoring_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const getToken = (): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('soulsync_token');
    }
    return null;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const settingsService = {
  async getUserSettings(): Promise<UserSettings> {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }

    return response.json();
  },

  async updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const token = getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Settings update failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        sentData: settings
      });
      const errorMsg = typeof errorData.detail === 'string' 
        ? errorData.detail 
        : JSON.stringify(errorData.detail || errorData);
      throw new Error(`Failed to update settings: ${errorMsg}`);
    }

    return response.json();
  },
};
