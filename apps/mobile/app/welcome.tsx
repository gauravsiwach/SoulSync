import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Logo/Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="heart-circle-outline" size={120} color="#6366f1" />
          </View>

          {/* Title */}
          <Text style={styles.title}>Welcome to SoulSync</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Your personal wellness companion for mental health, emotional support, and daily mindfulness.
          </Text>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="chatbubbles-outline" size={32} color="#6366f1" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>AI-Powered Chat</Text>
                <Text style={styles.featureDescription}>
                  Talk to your AI companion anytime, anywhere
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="calendar-outline" size={32} color="#6366f1" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Daily Check-ins</Text>
                <Text style={styles.featureDescription}>
                  Track your mood and mental wellness journey
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#6366f1" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Risk Monitoring</Text>
                <Text style={styles.featureDescription}>
                  Your trusted circle gets alerts when you need support
                </Text>
              </View>
            </View>

            <View style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name="people-outline" size={32} color="#6366f1" />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>Trust Circle</Text>
                <Text style={styles.featureDescription}>
                  Build your support network of trusted contacts
                </Text>
              </View>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>

          {/* Privacy Note */}
          <Text style={styles.privacyText}>
            Your data is secure and private. We use end-to-end encryption for all communications.
          </Text>
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
  scrollContent: {
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginVertical: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 30,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  privacyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
