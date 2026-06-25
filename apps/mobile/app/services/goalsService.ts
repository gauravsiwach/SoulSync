const API_BASE = 'http://localhost:8000/api';

// Simple JWT token storage using localStorage (works for web)
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('soulsync_token');
  }
  return null;
};

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  target_date: string | null;
  status: string;
  milestones: any[];
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  goal_id: string;
  progress_score: number;
  note: string | null;
  source: string;
  created_at: string;
}

export interface GoalCreate {
  title: string;
  description?: string;
  category?: string;
  target_date?: string;
}

export interface GoalUpdate {
  title?: string;
  description?: string;
  category?: string;
  target_date?: string;
  status?: string;
  milestones?: any[];
}

export interface CheckinCreate {
  progress_score: number;
  note?: string;
  source?: string;
}

class GoalsService {
  private getAuthHeader(): HeadersInit {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async getGoals(): Promise<Goal[]> {
    const headers = this.getAuthHeader();
    const response = await fetch(`${API_BASE}/goals`, { headers });
    if (!response.ok) throw new Error('Failed to fetch goals');
    return response.json();
  }

  async getGoal(goalId: string): Promise<Goal> {
    const headers = this.getAuthHeader();
    const response = await fetch(`${API_BASE}/goals/${goalId}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch goal');
    return response.json();
  }

  async createGoal(goal: GoalCreate): Promise<Goal> {
    const headers = this.getAuthHeader();
    const response = await fetch(`${API_BASE}/goals`, {
      method: 'POST',
      headers,
      body: JSON.stringify(goal),
    });
    if (!response.ok) throw new Error('Failed to create goal');
    return response.json();
  }

  async updateGoal(goalId: string, goal: GoalUpdate): Promise<Goal> {
    const headers = this.getAuthHeader();
    const response = await fetch(`${API_BASE}/goals/${goalId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(goal),
    });
    if (!response.ok) throw new Error('Failed to update goal');
    return response.json();
  }

  async getCheckins(goalId: string): Promise<Checkin[]> {
    const headers = this.getAuthHeader();
    const response = await fetch(`${API_BASE}/checkins/goals/${goalId}`, { headers });
    if (!response.ok) throw new Error('Failed to fetch check-ins');
    return response.json();
  }

  async createCheckin(goalId: string, checkin: CheckinCreate): Promise<Checkin> {
    const headers = this.getAuthHeader();
    const response = await fetch(`${API_BASE}/checkins/goals/${goalId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(checkin),
    });
    if (!response.ok) throw new Error('Failed to create check-in');
    return response.json();
  }

  calculateProgress(goalId: string, checkins: Checkin[]): number {
    const goalCheckins = checkins.filter(c => c.goal_id === goalId);
    if (goalCheckins.length === 0) return 0;
    const avgScore = goalCheckins.reduce((sum, c) => sum + c.progress_score, 0) / goalCheckins.length;
    return (avgScore / 5) * 100; // Convert 1-5 scale to 0-100 percentage
  }
}

export const goalsService = new GoalsService();
