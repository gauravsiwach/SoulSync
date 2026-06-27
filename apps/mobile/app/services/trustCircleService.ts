// Trust Circle Service
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const getToken = async (): Promise<string | null> => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('soulsync_token');
  }
  return null;
};

export interface TrustCircleMember {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  alert_level: string;
  created_at: string;
}

export interface TrustCircleMemberCreate {
  name: string;
  phone: string;
  email?: string;
  alert_level: string;
}

export const trustCircleService = {
  async getTrustCircle(): Promise<TrustCircleMember[]> {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/trust-circle`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch trust circle members');
    }

    return response.json();
  },

  async createTrustCircleMember(member: TrustCircleMemberCreate): Promise<TrustCircleMember> {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/trust-circle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(member),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Trust circle creation failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        sentData: member
      });
      const errorMsg = typeof errorData.detail === 'string' 
        ? errorData.detail 
        : JSON.stringify(errorData.detail || errorData);
      throw new Error(`Failed to create trust circle member: ${errorMsg}`);
    }

    return response.json();
  },

  async deleteTrustCircleMember(memberId: string): Promise<void> {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/trust-circle/${memberId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete trust circle member');
    }
  },
};
