// Risk Score Service
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const getToken = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('soulsync_token');
  }
  return null;
};

export interface RiskScore {
  id: string;
  user_id: string;
  isolation_score: number | null;
  burnout_score: number | null;
  distress_score: number | null;
  crisis_probability: number | null;
  overall_level: string | null;
  scored_at: string;
}

export const riskScoreService = {
  async getLatestRiskScore(): Promise<RiskScore | null> {
    const token = await getToken();
    if (!token) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/risk-scores/latest`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If endpoint doesn't exist or user has no risk scores, return null
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch risk score');
      }

      return response.json();
    } catch (error) {
      console.error('Failed to fetch risk score:', error);
      return null;
    }
  },
};
