const API_BASE = 'http://localhost:8000/api';

const getToken = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('soulsync_token');
  }
  return null;
};

export interface MoodSummary {
  period: string;
  message_count: number;
  mood_distribution: Record<string, number>;
  dominant_mood: string | null;
  mood_timeline: Array<{
    date: string;
    mood: string;
    timestamp: string;
  }>;
}

export const moodService = {
  async getMoodSummary(): Promise<MoodSummary> {
    try {
      const token = await getToken();
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE}/mood/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch mood summary');

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching mood summary:', error);
      return {
        period: '7_days',
        message_count: 0,
        mood_distribution: {},
        dominant_mood: null,
        mood_timeline: [],
      };
    }
  },
};
