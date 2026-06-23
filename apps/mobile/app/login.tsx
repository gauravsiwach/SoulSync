import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Simple logger for auth
const logger = {
  info: (msg: string, data?: any) => console.log(`[AUTH] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[AUTH ERROR] ${msg}`, error),
};

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for OAuth callback messages from popup window
    const handleMessage = (event: MessageEvent) => {
      console.log('[LOGIN] Received message:', event.origin, event.data);
      
      if (event.origin !== 'http://localhost:8000') {
        console.log('[LOGIN] Ignoring message from', event.origin);
        return;
      }
      
      if (event.data.type === 'soulsync_auth_success') {
        logger.info('Received auth success message from popup', { token: event.data.token?.substring(0, 20) + '...' });
        setIsLoading(false);
        
        // Store token
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('soulsync_token', event.data.token);
        }
        
        // Check if onboarding is completed
        checkOnboardingStatus(event.data.token);
      }
    };

    if (typeof window !== 'undefined') {
      console.log('[LOGIN] Adding message event listener');
      window.addEventListener('message', handleMessage);
      return () => {
        console.log('[LOGIN] Removing message event listener');
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [router]);

  const checkOnboardingStatus = async (token: string) => {
    try {
      logger.info('Checking onboarding status');
      const response = await fetch('http://localhost:8000/profile/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Handle expired token
      if (response.status === 401) {
        logger.info('Token expired during onboarding check');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('soulsync_token');
          window.localStorage.removeItem('soulsync_user');
        }
        Alert.alert('Session Expired', 'Please sign in again');
        setIsLoading(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        logger.info('Profile retrieved', data);
        
        // Check if required onboarding fields are present
        if (data.name && data.age_range && data.occupation && data.relationship_status) {
          logger.info('Onboarding completed, navigating to profile');
          Alert.alert('Success', 'Authentication successful! Welcome to SoulSync.');
          router.replace('/profile');
        } else {
          logger.info('Onboarding not completed, navigating to onboarding');
          router.replace('/onboarding');
        }
      } else {
        logger.error('Failed to check profile status');
        Alert.alert('Success', 'Authentication successful! Welcome to SoulSync.');
        router.replace('/onboarding');
      }
    } catch (error) {
      logger.error('Error checking onboarding status', error);
      Alert.alert('Success', 'Authentication successful! Welcome to SoulSync.');
      router.replace('/onboarding');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      logger.info('Starting Google sign in');

      // Get Google OAuth URL from backend
      const response = await fetch('http://localhost:8000/auth/google');
      const data = await response.json();
      
      logger.info('Got Google OAuth URL', { url: data.auth_url });

      if (data.auth_url) {
        // For web, use window.open to maintain connection
        if (typeof window !== 'undefined' && window.open) {
          logger.info('Opening OAuth URL in popup window');
          const popup = window.open(data.auth_url, 'Google Sign In', 'width=500,height=600');
          
          if (!popup) {
            Alert.alert('Popup Blocked', 'Please allow popups for this site and try again.');
            setIsLoading(false);
          }
        } else {
          // Fallback for native apps
          const supported = await Linking.canOpenURL(data.auth_url);
          
          if (supported) {
            logger.info('Opening OAuth URL in browser');
            await Linking.openURL(data.auth_url);
          } else {
            logger.error('Cannot open OAuth URL', data.auth_url);
            Alert.alert(
              'Google Sign In',
              `Please visit this URL in your browser:\n\n${data.auth_url}`,
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Copy URL', 
                  onPress: () => {
                    logger.info('OAuth URL copied for manual use');
                  }
                }
              ]
            );
          }
        }
      }
    } catch (error) {
      logger.error('Google sign in failed', error);
      Alert.alert('Error', 'Failed to start Google sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipAuth = () => {
    logger.info('Skipping authentication');
    // Navigate directly to chat for development
    router.push('/chat');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="heart" size={60} color="#6366f1" />
            </View>
            <Text style={styles.appName}>SoulSync</Text>
            <Text style={styles.tagline}>Your mindful companion</Text>
          </View>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to continue your mindfulness journey
            </Text>
          </View>

          {/* Sign In Buttons */}
          <View style={styles.buttonContainer}>
            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.signInButton, styles.googleButton]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="logo-google" size={20} color="#000" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Removed Apple Sign In as per requirements */}
          </View>

          {/* Skip for Development */}
          <View style={styles.skipSection}>
            <TouchableOpacity onPress={handleSkipAuth}>
              <Text style={styles.skipText}>Skip for development →</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  welcomeSection: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  signInButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    minHeight: 56,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 12,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  skipSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  skipText: {
    fontSize: 14,
    color: '#6366f1',
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
