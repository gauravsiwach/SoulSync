const API_BASE = 'http://localhost:8000/api';

const getToken = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('soulsync_token');
  }
  return null;
};

export interface Insight {
  id: string;
  user_id: string;
  category: string;
  content: string;
  confidence: number;
  surfaced: boolean;
  created_at: string;
}

export const insightsService = {
  async getLatestInsights(): Promise<Insight[]> {
    try {
      const token = await getToken();
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE}/insights/latest`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch insights');

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching insights:', error);
      return [];
    }
  },

  async markInsightSurfaced(insightId: string, surfaced: boolean): Promise<void> {
    try {
      const token = await getToken();
      if (!token) throw new Error('No token found');

      const response = await fetch(`${API_BASE}/insights/${insightId}/surface`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ surfaced }),
      });

      if (!response.ok) throw new Error('Failed to update insight');
    } catch (error) {
      console.error('Error updating insight:', error);
      throw error;
    }
  },
};
