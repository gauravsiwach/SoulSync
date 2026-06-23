import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Simple logger for profile
const logger = {
  info: (msg: string, data?: any) => console.log(`[PROFILE] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[PROFILE ERROR] ${msg}`, error),
};

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  provider: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      logger.info('Loading user profile');
      
      // Get token from localStorage
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('soulsync_token') : null;
      
      if (!token) {
        logger.error('No token found, redirecting to login');
        router.replace('/login');
        return;
      }
      
      const response = await fetch('http://localhost:8000/profile/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        logger.info('Profile loaded successfully', userData);
      } else {
        logger.error('Failed to load profile', response.status);
        // For development, show mock data
        setUser({
          id: 'mock_user_id',
          email: 'user@example.com',
          name: 'Demo User',
          avatar_url: '',
          provider: 'google',
        });
      }
    } catch (error) {
      logger.error('Error loading profile', error);
      // For development, show mock data
      setUser({
        id: 'mock_user_id',
        email: 'user@example.com',
        name: 'Demo User',
        avatar_url: '',
        provider: 'google',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    console.log('[PROFILE] Sign out button clicked');
    logger.info('Sign out initiated');
    
    // For web, use window.confirm instead of Alert
    if (typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        try {
          console.log('[PROFILE] User confirmed sign out');
          logger.info('Signing out user');
          
          // Clear token from localStorage
          if (window.localStorage) {
            window.localStorage.removeItem('soulsync_token');
            window.localStorage.removeItem('soulsync_user');
            console.log('[PROFILE] localStorage cleared');
          }
          
          // Navigate to landing page
          console.log('[PROFILE] Navigating to landing page');
          router.replace('/');
        } catch (error) {
          logger.error('Sign out error', error);
          alert('Failed to sign out. Please try again.');
        }
      } else {
        console.log('[PROFILE] Sign out cancelled');
      }
    } else {
      // Fallback for native
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log('[PROFILE] User confirmed sign out');
                logger.info('Signing out user');
                
                // Clear token from localStorage
                if (typeof window !== 'undefined' && window.localStorage) {
                  window.localStorage.removeItem('soulsync_token');
                  window.localStorage.removeItem('soulsync_user');
                }
                
                // Navigate to landing page
                router.replace('/');
              } catch (error) {
                logger.error('Sign out error', error);
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              }
            },
          },
        ]
      );
    }
  };

  const handleEditProfile = () => {
    console.log('[PROFILE] Edit profile tapped');
    logger.info('Edit profile tapped');
    
    // Store current profile data for editing
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('soulsync_edit_profile', JSON.stringify(user));
    }
    
    // Navigate to onboarding for editing (pre-filled with existing data)
    router.replace('/onboarding');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#6366f1" />
                </View>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Anonymous User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.providerBadge}>
                <Ionicons 
                  name={user?.provider === 'google' ? 'logo-google' : 'logo-apple'} 
                  size={14} 
                  color="#64748b" 
                />
                <Text style={styles.providerText}>
                  {user?.provider ? user.provider.charAt(0).toUpperCase() + user.provider.slice(1) : 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Ionicons name="pencil" size={16} color="#6366f1" />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications" size={20} color="#64748b" />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
              thumbColor={notifications ? '#6366f1' : '#f1f5f9'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon" size={20} color="#64748b" />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
              thumbColor={darkMode ? '#6366f1' : '#f1f5f9'}
            />
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="heart" size={20} color="#64748b" />
              <Text style={styles.settingText}>About SoulSync</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield-checkmark" size={20} color="#64748b" />
              <Text style={styles.settingText}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="document-text" size={20} color="#64748b" />
              <Text style={styles.settingText}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out" size={20} color="#ef4444" />
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  card: {
    margin: 24,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  providerText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginLeft: 8,
  },
  section: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#1e293b',
    marginLeft: 12,
  },
  signOutSection: {
    marginHorizontal: 24,
    marginBottom: 40,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
});
