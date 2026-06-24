import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const logger = {
  info: (msg: string, data?: any) => console.log(`[CHAT_TAB] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[CHAT_TAB ERROR] ${msg}`, error),
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export default function ChatTabScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationIdParam = params.conversationId as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationIdParam || null);
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userId = useRef<string>('');
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  // Get user ID from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = window.localStorage.getItem('soulsync_user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userId.current = user.id || '';
          logger.info('User ID loaded', { userId: userId.current });
        } catch (error) {
          logger.error('Error parsing user data', error);
        }
      }
    }
  }, []);

  // Update conversation ID when navigating from conversation list
  useEffect(() => {
    if (conversationIdParam && conversationIdParam !== currentConversationId) {
      logger.info('Conversation ID from navigation', { conversationIdParam });
      setCurrentConversationId(conversationIdParam);
    }
  }, [conversationIdParam]);

  // Load messages from API if conversation ID is provided
  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  const loadMostRecentConversation = async () => {
    try {
      logger.info('Loading most recent conversation');
      const token = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('soulsync_token')
        : null;

      if (!token) return;

      const response = await fetch('http://localhost:8000/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const conversations = data.conversations || [];
        if (conversations.length > 0) {
          const mostRecent = conversations[0];
          logger.info('Loaded most recent conversation', { conversationId: mostRecent.id });
          setCurrentConversationId(mostRecent.id);
          await loadMessages(mostRecent.id);
        }
      }
    } catch (error) {
      logger.error('Error loading most recent conversation', error);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      logger.info('Loading messages for conversation', { conversationId: convId });
      const token = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('soulsync_token')
        : null;

      if (!token) return;

      const response = await fetch(`http://localhost:8000/api/conversations/${convId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));
        setMessages(loadedMessages);
        logger.info('Messages loaded', { count: loadedMessages.length });
      }
    } catch (error) {
      logger.error('Error loading messages', error);
    }
  };

  // Connect to WebSocket
  useEffect(() => {
    if (!userId.current) {
      logger.error('Cannot connect: No user ID');
      return;
    }

    if (!currentConversationId) {
      logger.info('Not connecting to WebSocket: No conversation ID');
      return;
    }

    const token = typeof window !== 'undefined' && window.localStorage 
      ? window.localStorage.getItem('soulsync_token')
      : null;

    if (!token) {
      logger.error('Cannot connect: No token');
      return;
    }

    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:8000/ws/chat/${userId.current}?token=${token}&conversation_id=${currentConversationId}`;
      logger.info('Connecting to WebSocket', { wsUrl, userId: userId.current, hasToken: !!token, conversationId: currentConversationId });

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        logger.info('WebSocket connected successfully');
        setIsConnected(true);
        setReconnectAttempts(0);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          logger.info('WebSocket message received', data);

          if (data.type === 'conversation_id') {
            logger.info('Conversation ID received', data.conversation_id);
            setCurrentConversationId(data.conversation_id);
          } else if (data.type === 'token') {
            setStreamingMessage(prev => prev + data.content);
          } else if (data.type === 'end') {
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: data.content,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            setStreamingMessage('');
            setIsLoading(false);
          } else if (data.type === 'error') {
            logger.error('WebSocket error message', data.message);
            setStreamingMessage('');
            setIsLoading(false);
          }
        } catch (error) {
          logger.error('Error parsing WebSocket message', error);
        }
      };

      wsRef.current.onerror = (error) => {
        logger.error('WebSocket error', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = (event) => {
        logger.info('WebSocket closed', { code: event.code, reason: event.reason });
        setIsConnected(false);
        
        // Attempt reconnection if not max attempts
        setReconnectAttempts(prev => {
          if (prev < maxReconnectAttempts) {
            logger.info(`Attempting reconnection (${prev + 1}/${maxReconnectAttempts})`);
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, reconnectDelay);
            return prev + 1;
          } else {
            logger.error('Max reconnection attempts reached');
            return prev;
          }
        });
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [userId.current, currentConversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages, streamingMessage]);

  const sendMessage = () => {
    logger.info('Send button pressed', {
      hasInput: !!inputText.trim(),
      inputLength: inputText.length,
      isLoading,
      isConnected,
      hasWebSocket: !!wsRef.current,
      wsReadyState: wsRef.current?.readyState
    });

    if (!inputText.trim() || isLoading || !isConnected || !wsRef.current) {
      logger.error('Cannot send message - check failed', {
        hasInput: !!inputText.trim(),
        isLoading,
        isConnected,
        hasWebSocket: !!wsRef.current
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content: inputText.trim(),
      }));
      logger.info('Message sent via WebSocket', inputText.trim().length);
    } catch (error) {
      logger.error('Error sending WebSocket message', error);
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Text
        style={[
          styles.messageText,
          item.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
        ]}
      >
        {item.content}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

  const handleNewConversation = async () => {
    try {
      logger.info('+ button clicked - Creating new conversation');
      const token = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('soulsync_token')
        : null;

      if (!token) {
        logger.error('No token found, cannot create conversation');
        return;
      }

      logger.info('Sending POST to /api/conversations');
      const response = await fetch('http://localhost:8000/api/conversations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      logger.info('POST response received', { status: response.status, ok: response.ok });

      if (response.ok) {
        const data = await response.json();
        logger.info('New conversation created successfully', { conversationId: data.id, data });
        setCurrentConversationId(data.id);
        setMessages([]);
        logger.info('State updated, WebSocket should reconnect');
      } else {
        const errorText = await response.text();
        logger.error('Failed to create conversation', { status: response.status, errorText });
      }
    } catch (error) {
      logger.error('Error creating new conversation', error);
    }
  };

  const renderStreamingMessage = () => {
    if (!streamingMessage) return null;

    return (
      <View style={[styles.messageContainer, styles.assistantMessage]}>
        <Text style={[styles.messageText, styles.assistantMessageText]}>
          {streamingMessage}
        </Text>
        <ActivityIndicator size="small" color="#667eea" style={styles.streamingIndicator} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.push('/conversations')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>SoulSync Chat</Text>
              <View style={styles.headerSubtitleRow}>
                <Text style={styles.headerSubtitle}>Your AI Companion</Text>
                <View style={[styles.connectionIndicator, isConnected ? styles.connected : styles.disconnected]} />
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={handleNewConversation} style={styles.newChatButton}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderStreamingMessage}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e0e0',
    marginRight: 8,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connected: {
    backgroundColor: '#4ade80',
  },
  disconnected: {
    backgroundColor: '#f87171',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    backgroundColor: '#667eea',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  assistantMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  streamingIndicator: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    backgroundColor: '#667eea',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
