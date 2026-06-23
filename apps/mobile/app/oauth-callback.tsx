import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Simple logger for OAuth callback
const logger = {
  info: (msg: string, data?: any) => console.log(`[OAUTH_CALLBACK] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[OAUTH_CALLBACK ERROR] ${msg}`, error),
};

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      logger.info('Processing OAuth callback', { params });

      const { code, error, token } = params as { code?: string; error?: string; token?: string };

      if (error) {
        logger.error('OAuth returned error', error);
        Alert.alert('Authentication Error', 'Failed to authenticate with Google. Please try again.');
        router.replace('/login');
        return;
      }

      // Handle deep link callback with token
      if (token) {
        logger.info('Received token from deep link', { token: token.substring(0, 20) + '...' });
        setStatus('Authentication successful!');
        
        // Store the token (in a real app, you'd use SecureStore)
        // For now, just navigate to the main screen
        setTimeout(() => {
          setIsLoading(false);
          Alert.alert('Success', 'Authentication successful! Welcome to SoulSync.');
          // Navigate to main app or profile screen
          router.replace('/profile');
        }, 1000);
        return;
      }

      // Check if token is in localStorage (for web browser redirect)
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedToken = window.localStorage.getItem('soulsync_token');
        const storedUser = window.localStorage.getItem('soulsync_user');
        
        if (storedToken) {
          logger.info('Retrieved token from localStorage', { token: storedToken.substring(0, 20) + '...' });
          setStatus('Authentication successful!');
          
          // Clear localStorage
          window.localStorage.removeItem('soulsync_token');
          window.localStorage.removeItem('soulsync_user');
          
          // Store token and navigate
          setTimeout(() => {
            setIsLoading(false);
            Alert.alert('Success', 'Authentication successful! Welcome to SoulSync.');
            // Navigate to main app or profile screen
            router.replace('/profile');
          }, 1000);
          return;
        }
      }

      if (!code) {
        logger.error('No authorization code received');
        Alert.alert('Authentication Error', 'No authorization code received. Please try again.');
        router.replace('/login');
        return;
      }

      setStatus('Exchanging authorization code for tokens...');
      
      // Send the authorization code to backend
      const response = await fetch('http://localhost:8000/auth/google/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      logger.info('Backend response', { status: response.status, data });

      if (response.ok) {
        setStatus('Authentication successful!');
        
        // TODO: Store the access token securely
        logger.info('Authentication successful', { user: data.user });
        
        Alert.alert(
          'Success!',
          'You have been successfully signed in.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to profile or main app
                router.replace('/profile');
              },
            },
          ]
        );
      } else {
        logger.error('Backend authentication failed', data);
        Alert.alert(
          'Authentication Failed',
          data.detail || 'Failed to complete authentication. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login'),
            },
          ]
        );
      }
    } catch (error) {
      logger.error('OAuth callback error', error);
      Alert.alert(
        'Authentication Error',
        'An unexpected error occurred. Please try again.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.statusText}>{status}</Text>
        <Text style={styles.subText}>Please wait while we complete your sign-in...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 20,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
});
