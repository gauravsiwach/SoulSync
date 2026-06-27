import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    // Handle deep links for OAuth callback
    const handleDeepLink = (event: { url: string }) => {
      console.log('[DEEPLINK] Received URL:', event.url);
      
      if (event.url.includes('soulsync://auth-success')) {
        console.log('[DEEPLINK] OAuth success detected');
        // Parse the token from the URL
        const url = new URL(event.url);
        const token = url.searchParams.get('token');
        
        if (token) {
          console.log('[DEEPLINK] Token received, navigating to oauth-callback');
          // Navigate to oauth-callback with the token
          // In a real app, you'd store the token and navigate to main app
          // For now, let's just navigate to the callback screen
        }
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if the app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'SoulSync' }} />
        <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
        <Stack.Screen name="oauth-callback" options={{ title: 'Signing In', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding', headerShown: false }} />
        <Stack.Screen name="welcome" options={{ title: 'Welcome', headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="chat" options={{ title: 'Chat', headerShown: false }} />
        <Stack.Screen name="conversations" options={{ title: 'Conversations' }} />
        <Stack.Screen name="trust-circle" options={{ title: 'Trust Circle', headerShown: false }} />
        <Stack.Screen name="add-contact" options={{ title: 'Add Contact', headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
