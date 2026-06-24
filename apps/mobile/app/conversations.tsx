import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const logger = {
  info: (msg: string, data?: any) => console.log(`[CONVERSATIONS] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[CONVERSATIONS ERROR] ${msg}`, error),
};

interface Conversation {
  id: string;
  user_id: string;
  started_at: string;
  last_message_at: string;
  status: string;
  is_first_conversation: boolean;
  message_count: number;
}

export default function ConversationsScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      logger.info('Loading conversations');
      
      const token = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('soulsync_token')
        : null;

      if (!token) {
        logger.error('No token found');
        router.replace('/login');
        return;
      }

      const response = await fetch('http://localhost:8000/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter out empty conversations (no messages)
        const nonEmptyConversations = (data.conversations || []).filter(
          (conv: Conversation) => conv.message_count > 0
        );
        setConversations(nonEmptyConversations);
        logger.info('Conversations loaded (filtered empty)', {
          total: data.conversations?.length,
          nonEmpty: nonEmptyConversations.length
        });
      } else if (response.status === 401) {
        logger.error('Unauthorized - redirecting to login');
        // Clear invalid token and redirect to login
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('soulsync_token');
          window.localStorage.removeItem('soulsync_user');
        }
        router.replace('/login');
      } else {
        logger.error('Failed to load conversations', response.status);
      }
    } catch (error) {
      logger.error('Error loading conversations', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => router.push({ pathname: '/chat', params: { conversationId: item.id } })}
    >
      <View style={styles.conversationIcon}>
        <Ionicons name="chatbubbles" size={24} color="#667eea" />
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationTitle}>
            {item.is_first_conversation ? 'First Conversation' : 'Conversation'}
          </Text>
          <Text style={styles.conversationDate}>
            {formatDate(item.last_message_at)}
          </Text>
        </View>
        <Text style={styles.conversationStatus}>
          {item.status === 'active' ? 'Active' : 'Archived'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>Start chatting with SoulSync</Text>
      <TouchableOpacity
        style={styles.newChatButton}
        onPress={() => router.push('/chat')}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.newChatButtonText}>Start New Chat</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversations</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => router.push('/chat')}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newChatButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          style={styles.conversationsList}
          contentContainerStyle={styles.conversationsContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#667eea',
    padding: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  conversationsList: {
    flex: 1,
  },
  conversationsContainer: {
    padding: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  conversationDate: {
    fontSize: 12,
    color: '#999',
  },
  conversationStatus: {
    fontSize: 14,
    color: '#667eea',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    marginBottom: 24,
  },
});
