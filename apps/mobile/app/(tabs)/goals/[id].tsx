import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { goalsService, Goal, Checkin } from '../../services/goalsService';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  console.log('GoalDetailScreen rendered with id:', id);
  console.log('Goal data:', goal);

  useEffect(() => {
    loadGoalData();
  }, [id]);

  useFocusEffect(
    React.useCallback(() => {
      loadGoalData();
    }, [id])
  );

  const loadGoalData = async () => {
    try {
      const [goalData, checkinsData] = await Promise.all([
        goalsService.getGoal(id!),
        goalsService.getCheckins(id!)
      ]);
      setGoal(goalData);
      setCheckins(checkinsData);
    } catch (error) {
      console.error('Failed to load goal data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Goal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const progress = goalsService.calculateProgress(id!, checkins);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/goals')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">{goal?.title || 'Loading...'}</Text>
        <TouchableOpacity style={styles.menuButton} onPress={() => {
          console.log('Menu button pressed, id:', id);
          setShowMenu(true);
        }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>{goal.title}</Text>
          <View style={[styles.statusBadge, goal.status === 'active' && styles.activeBadge]}>
            <Text style={styles.statusText}>{goal.status}</Text>
          </View>
          {goal.description && (
            <Text style={styles.goalDescription}>{goal.description}</Text>
          )}
          {goal.category && (
            <Text style={styles.goalCategory}>{goal.category}</Text>
          )}
          {goal.target_date && (
            <Text style={styles.targetDate}>Target: {new Date(goal.target_date).toLocaleDateString()}</Text>
          )}
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Progress</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%`}]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        </View>

        <View style={styles.checkinsSection}>
          <View style={styles.checkinsHeader}>
            <Text style={styles.checkinsTitle}>Check-in History</Text>
            <TouchableOpacity style={styles.addCheckinButton} onPress={() => router.push({ pathname: '/checkin', params: { id } })}>
              <Ionicons name="add" size={20} color="#667eea" />
              <Text style={styles.addCheckinText}>Add Check-in</Text>
            </TouchableOpacity>
          </View>

          {checkins.length === 0 ? (
            <View style={styles.emptyCheckins}>
              <Text style={styles.emptyCheckinsText}>No check-ins yet</Text>
            </View>
          ) : (
            checkins.map((checkin) => (
              <View key={checkin.id} style={styles.checkinCard}>
                <View style={styles.checkinHeader}>
                  <Text style={styles.checkinDate}>
                    {new Date(checkin.created_at).toLocaleDateString()}
                  </Text>
                  <View style={styles.scoreContainer}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Ionicons
                        key={score}
                        name="star"
                        size={16}
                        color={score <= checkin.progress_score ? '#fbbf24' : '#e5e7eb'}
                      />
                    ))}
                  </View>
                </View>
                {checkin.note && (
                  <Text style={styles.checkinNote}>{checkin.note}</Text>
                )}
                <Text style={styles.checkinSource}>
                  {checkin.source === 'ai_inferred' ? 'AI-inferred' : 'Manual'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.menuModal}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push({ pathname: '/edit-goal', params: { id } });
              }}
            >
              <Ionicons name="pencil" size={20} color="#667eea" />
              <Text style={styles.menuItemText}>Edit Goal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                Alert.alert('Delete', 'Delete functionality coming soon');
              }}
            >
              <Ionicons name="trash" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete Goal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginHorizontal: 12,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  goalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  activeBadge: {
    backgroundColor: '#d1fae5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
  },
  goalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    lineHeight: 24,
  },
  goalCategory: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 8,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  targetDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  checkinsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkinsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkinsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  addCheckinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0ff',
    borderRadius: 16,
  },
  addCheckinText: {
    color: '#667eea',
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyCheckins: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyCheckinsText: {
    fontSize: 14,
    color: '#999',
  },
  checkinCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  checkinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkinDate: {
    fontSize: 14,
    color: '#666',
  },
  scoreContainer: {
    flexDirection: 'row',
  },
  checkinNote: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  checkinSource: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
});
