const API_BASE = 'http://localhost:8000/api';

const getToken = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('soulsync_token');
  }
  return null;
};

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  created_at: string;
}

export const notificationsService = {
  async getNotifications(): Promise<Notification[]> {
    try {
      const token = await getToken();
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      const token = await getToken();
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to mark notification as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },
};
