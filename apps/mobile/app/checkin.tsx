import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { goalsService, CheckinCreate } from './services/goalsService';

export default function CheckinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [score, setScore] = useState(3);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreateCheckin = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const checkinData: CheckinCreate = {
        progress_score: score,
        note: note.trim() || undefined,
        source: 'user',
      };

      await goalsService.createCheckin(id, checkinData);
      setSuccess(true);
      setTimeout(() => router.back(), 1500);
    } catch (error) {
      console.error('Failed to create check-in:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {success && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.successText}>Check-in recorded!</Text>
        </View>
      )}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Check-in</Text>
        <TouchableOpacity onPress={handleCreateCheckin} style={styles.saveButton} disabled={loading || success}>
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : success ? 'Saved!' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>How did you do?</Text>
          <View style={styles.scoreContainer}>
            {[1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.scoreButton, score >= num && styles.scoreButtonActive]}
                onPress={() => setScore(num)}
              >
                <Text style={[styles.scoreButtonText, score >= num && styles.scoreButtonTextActive]}>
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.scoreLabel}>
            {score === 1 ? 'Poor' : score === 2 ? 'Below expectations' : score === 3 ? 'On track' : score === 4 ? 'Good' : 'Excellent'}
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What did you accomplish? Any challenges?"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
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
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scoreButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreButtonActive: {
    backgroundColor: '#667eea',
  },
  scoreButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  scoreButtonTextActive: {
    color: '#fff',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    textAlign: 'center',
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
    height: 120,
  },
});
