import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { goalsService, Goal, GoalUpdate } from './services/goalsService';

export default function EditGoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'abandoned'>('active');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadGoal();
  }, [id]);

  const loadGoal = async () => {
    if (!id) return;
    try {
      const goalData = await goalsService.getGoal(id);
      setGoal(goalData);
      setTitle(goalData.title || '');
      setDescription(goalData.description || '');
      setCategory(goalData.category || '');
      setTargetDate(goalData.target_date || '');
      setStatus((goalData.status || 'active') as 'active' | 'completed' | 'abandoned');
    } catch (error) {
      console.error('Failed to load goal:', error);
    }
  };

  const handleUpdateGoal = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    if (!id) return;

    setLoading(true);
    try {
      const goalData: GoalUpdate = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        target_date: targetDate || undefined,
        status,
      };

      await goalsService.updateGoal(id, goalData);
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {success && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.successText}>Goal updated successfully!</Text>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Goal</Text>
        <TouchableOpacity onPress={handleUpdateGoal} style={styles.saveButton} disabled={loading || success}>
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : success ? 'Saved!' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="What do you want to achieve?"
            value={title}
            onChangeText={setTitle}
            multiline
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your goal in detail..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Health, Career, Personal Growth"
            value={category}
            onChangeText={setCategory}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Target Date (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={targetDate}
            onChangeText={setTargetDate}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusContainer}>
            {(['active', 'completed', 'abandoned'] as const).map((statusOption) => (
              <TouchableOpacity
                key={statusOption}
                style={[
                  styles.statusButton,
                  status === statusOption && styles.statusButtonActive,
                  status === 'active' && statusOption === 'active' && styles.statusActive,
                  status === 'completed' && statusOption === 'completed' && styles.statusCompleted,
                  status === 'abandoned' && statusOption === 'abandoned' && styles.statusAbandoned,
                ]}
                onPress={() => setStatus(statusOption)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    status === statusOption && styles.statusButtonTextActive,
                  ]}
                >
                  {statusOption.charAt(0).toUpperCase() + statusOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  successToast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  successText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#667eea',
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonActive: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  statusActive: {
    backgroundColor: '#d1fae5',
  },
  statusCompleted: {
    backgroundColor: '#dbeafe',
  },
  statusAbandoned: {
    backgroundColor: '#fee2e2',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextActive: {
    color: '#333',
  },
});
