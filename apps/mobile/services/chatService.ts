// Note: EventSource will be handled differently for React Native
// We'll use fetch with streaming for now

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatMessage {
  message: string;
  user_id: string;
}

export interface ChatResponse {
  response: string;
  user_id: string;
}

export interface ChatHistory {
  user_id: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

class ChatService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          user_id: this.userId,
        } as ChatMessage),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      return data.response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async *streamMessage(message: string): AsyncGenerator<string, void, unknown> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          user_id: this.userId,
        } as ChatMessage),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            if (data.trim()) {
              yield data;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming message:', error);
      throw error;
    }
  }

  async getHistory(): Promise<ChatHistory> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/history/${this.userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching history:', error);
      throw error;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/history/${this.userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }
}

export default ChatService;
