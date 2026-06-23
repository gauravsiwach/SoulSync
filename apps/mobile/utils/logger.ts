// Simple logging utility for mobile app

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    // Set log level based on environment
    // Note: __DEV__ is available in React Native/Expo
    // @ts-ignore
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      this.level = LogLevel.DEBUG;
    } else {
      this.level = LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, error));
    }
  }

  // Chat-specific logging
  logChatMessage(role: 'user' | 'assistant', content: string, userId: string) {
    this.info('Chat Message', {
      role,
      contentLength: content.length,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  logApiCall(method: string, url: string, data?: any) {
    this.info('API Call', {
      method,
      url,
      data: data ? JSON.stringify(data) : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  logApiResponse(status: number, duration: number, data?: any) {
    this.info('API Response', {
      status,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  logApiError(method: string, url: string, error: any) {
    this.error('API Error', {
      method,
      url,
      error: error.message || error,
      timestamp: new Date().toISOString(),
    });
  }
}

export const logger = new Logger();
