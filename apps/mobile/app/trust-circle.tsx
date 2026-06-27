import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { trustCircleService, TrustCircleMember } from './services/trustCircleService';

const logger = {
  info: (msg: string, data?: any) => console.log(`[TRUST_CIRCLE] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[TRUST_CIRCLE ERROR] ${msg}`, error),
};

export default function TrustCircleScreen() {
  const [members, setMembers] = useState<TrustCircleMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const loadTrustCircle = async () => {
    try {
      logger.info('Loading trust circle members');
      const data = await trustCircleService.getTrustCircle();
      setMembers(data);
      logger.info('Trust circle loaded', { count: data.length });
    } catch (error) {
      logger.error('Failed to load trust circle', error);
      Alert.alert('Error', 'Failed to load trust circle members');
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTrustCircle();
    }, [])
  );

  const handleAddContact = () => {
    router.push('/add-contact');
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    logger.info('Delete button pressed', { memberId, memberName });
    
    // Use window.confirm for web compatibility
    const confirmed = typeof window !== 'undefined' 
      ? window.confirm(`Are you sure you want to remove ${memberName} from your trust circle?`)
      : true;
    
    if (!confirmed) {
      logger.info('Delete cancelled');
      return;
    }
    
    try {
      logger.info('Starting delete', { memberId });
      setIsDeleting(memberId);
      await trustCircleService.deleteTrustCircleMember(memberId);
      logger.info('Member deleted successfully', { memberId });
      // Update UI immediately
      setMembers(members.filter(m => m.id !== memberId));
    } catch (error) {
      logger.error('Failed to delete member', error);
      if (typeof window !== 'undefined') {
        window.alert('Failed to remove contact');
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'concern':
        return '#f59e0b'; // amber
      case 'urgent':
        return '#f97316'; // orange
      case 'emergency':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getAlertLevelLabel = (level: string) => {
    switch (level) {
      case 'concern':
        return 'Concern';
      case 'urgent':
        return 'Urgent';
      case 'emergency':
        return 'Emergency';
      default:
        return level;
    }
  };

  const renderMember = ({ item }: { item: TrustCircleMember }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color="#667eea" />
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberPhone}>{item.phone}</Text>
          {item.email && <Text style={styles.memberEmail}>{item.email}</Text>}
        </View>
      </View>
      <View style={styles.memberActions}>
        <View style={[styles.alertBadge, { backgroundColor: getAlertLevelColor(item.alert_level) }]}>
          <Text style={styles.alertBadgeText}>{getAlertLevelLabel(item.alert_level)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteMember(item.id, item.name)}
          disabled={isDeleting === item.id}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={isDeleting === item.id ? '#9ca3af' : '#ef4444'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading trust circle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.replace('/(tabs)/profile')}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      {members.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Trust Circle Yet</Text>
          <Text style={styles.emptyText}>
            Add trusted contacts who can support you during difficult times
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddContact}>
            <Ionicons name="add" size={20} color="#ffffff" />
            <Text style={styles.addButtonText}>Add Contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <TouchableOpacity style={styles.addButton} onPress={handleAddContact}>
              <Ionicons name="add" size={20} color="#ffffff" />
              <Text style={styles.addButtonText}>Add Contact</Text>
            </TouchableOpacity>
          }
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  listContent: {
    padding: 20,
    paddingTop: 80, // Add padding to avoid overlap with floating back button
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteButton: {
    padding: 8,
  },
  addButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
});
