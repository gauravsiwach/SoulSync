import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const logger = {
  info: (msg: string, data?: any) => console.log(`[PROFILE_TAB] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[PROFILE_TAB ERROR] ${msg}`, error),
};

interface UserProfile {
  id: string;
  name: string;
  age_range: string;
  occupation: string;
  location: string;
  relationship_status: string;
  interests: string[];
  personal_goals: string;
}

interface MemorySummary {
  memory_count: number;
  facts: string[];
  last_updated: number | null;
}

export default function ProfileTabScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memorySummary, setMemorySummary] = useState<MemorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
    loadMemorySummary();
  }, []);

  const loadUserProfile = async () => {
    try {
      logger.info('Loading user profile');
      
      const token = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('soulsync_token')
        : null;
      
      if (!token) {
        logger.error('No token found');
        router.replace('/login');
        return;
      }
      
      const response = await fetch('http://localhost:8000/profile/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        logger.info('Profile loaded');
      } else if (response.status === 401) {
        logger.error('Unauthorized, redirecting to login');
        router.replace('/login');
      } else {
        logger.error('Failed to load profile', response.status);
      }
    } catch (error) {
      logger.error('Error loading profile', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemorySummary = async () => {
    try {
      logger.info('Loading memory summary');
      
      const token = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('soulsync_token')
        : null;
      
      if (!token) {
        logger.error('No token found for memory summary');
        return;
      }
      
      const response = await fetch('http://localhost:8000/api/memory/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMemorySummary(data);
        logger.info('Memory summary loaded', data);
      } else {
        logger.error('Failed to load memory summary', response.status);
      }
    } catch (error) {
      logger.error('Error loading memory summary', error);
    }
  };

  const handleSignOut = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('soulsync_token');
      window.localStorage.removeItem('soulsync_user');
    }
    router.replace('/');
  };

  const handleEditProfile = () => {
    if (typeof window !== 'undefined' && window.localStorage && user) {
      window.localStorage.setItem('soulsync_edit_profile', JSON.stringify(user));
    }
    router.push('/onboarding');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>Failed to load profile</Text>
          <TouchableOpacity style={styles.button} onPress={loadUserProfile}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#667eea" />
          </View>
          <Text style={styles.name}>{user.name || 'Anonymous'}</Text>
          <Text style={styles.subtitle}>{user.occupation || 'Not specified'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Age Range:</Text>
            <Text style={styles.value}>{user.age_range || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>{user.location || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Relationship:</Text>
            <Text style={styles.value}>{user.relationship_status || 'Not specified'}</Text>
          </View>
        </View>

        {memorySummary && memorySummary.memory_count > 0 && (
          <View style={styles.section}>
            <View style={styles.memoryHeader}>
              <Text style={styles.sectionTitle}>Memory Summary</Text>
              <View style={styles.memoryCountBadge}>
                <Text style={styles.memoryCountText}>{memorySummary.memory_count}</Text>
              </View>
            </View>
            <Text style={styles.memorySubtitle}>Things I know about you</Text>
            {memorySummary.facts && memorySummary.facts.length > 0 ? (
              <View style={styles.factsContainer}>
                {memorySummary.facts.slice(0, 5).map((fact, index) => (
                  <View key={index} style={styles.factItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#667eea" />
                    <Text style={styles.factText}>{fact}</Text>
                  </View>
                ))}
                {memorySummary.facts.length > 5 && (
                  <Text style={styles.moreFactsText}>+ {memorySummary.facts.length - 5} more</Text>
                )}
              </View>
            ) : (
              <Text style={styles.noData}>No memories yet</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestsContainer}>
            {user.interests && user.interests.length > 0 ? (
              user.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noData}>No interests specified</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Goals</Text>
          <Text style={styles.goalsText}>
            {user.personal_goals || 'No goals specified'}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Ionicons name="create-outline" size={20} color="#667eea" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 20,
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
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#667eea',
  },
  noData: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  goalsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actions: {
    marginTop: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memoryCountBadge: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  memoryCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  memorySubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  factsContainer: {
    gap: 8,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  moreFactsText: {
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
  },
});
