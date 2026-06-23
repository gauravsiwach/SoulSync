import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Simple logger for onboarding
const logger = {
  info: (msg: string, data?: any) => console.log(`[ONBOARDING] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[ONBOARDING ERROR] ${msg}`, error),
};

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const OCCUPATIONS = ['Student', 'Working Professional', 'Entrepreneur', 'Retired', 'Homemaker', 'Other'];
const RELATIONSHIP_STATUSES = ['Single', 'In a Relationship', 'Married', 'Divorced', 'Widowed'];
const INTEREST_OPTIONS = ['Meditation', 'Exercise', 'Reading', 'Music', 'Art', 'Travel', 'Cooking', 'Gardening'];

export default function OnboardingScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Auto-fill name from Google profile OR pre-fill for edit mode
  useEffect(() => {
    console.log('[ONBOARDING] useEffect triggered');
    const loadUserData = () => {
      console.log('[ONBOARDING] loadUserData called');
      console.log('[ONBOARDING] window available:', typeof window !== 'undefined');
      
      if (typeof window !== 'undefined' && window.localStorage) {
        console.log('[ONBOARDING] localStorage available');
        
        // Check for edit mode first
        const editProfileStr = window.localStorage.getItem('soulsync_edit_profile');
        if (editProfileStr) {
          console.log('[ONBOARDING] Edit mode detected');
          try {
            const editProfile = JSON.parse(editProfileStr);
            console.log('[ONBOARDING] Edit profile data:', editProfile);
            
            // Pre-fill all fields with existing data
            if (editProfile.name) setName(editProfile.name);
            if (editProfile.age_range) setAgeRange(editProfile.age_range);
            if (editProfile.occupation) setOccupation(editProfile.occupation);
            if (editProfile.location) setLocation(editProfile.location);
            if (editProfile.relationship_status) setRelationshipStatus(editProfile.relationship_status);
            if (editProfile.interests) setInterests(editProfile.interests);
            if (editProfile.personal_goals) setPersonalGoals(editProfile.personal_goals);
            
            setIsEditMode(true);
            console.log('[ONBOARDING] Edit mode fields pre-filled');
            
            // Clear edit mode flag
            window.localStorage.removeItem('soulsync_edit_profile');
          } catch (error) {
            console.error('[ONBOARDING] Error parsing edit profile data:', error);
          }
          return;
        }
        
        // Normal onboarding - auto-fill from Google profile
        const userStr = window.localStorage.getItem('soulsync_user');
        console.log('[ONBOARDING] userStr from localStorage:', userStr);
        
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            console.log('[ONBOARDING] Parsed user data:', user);
            console.log('[ONBOARDING] user.display_name:', user.display_name);
            console.log('[ONBOARDING] user.name:', user.name);
            
            logger.info('Auto-filling name from Google profile', user);
            // Try both display_name and name fields
            const userName = user.display_name || user.name || '';
            console.log('[ONBOARDING] userName extracted:', userName);
            
            if (userName) {
              console.log('[ONBOARDING] Setting name to:', userName);
              setName(userName);
              console.log('[ONBOARDING] Name state updated');
            } else {
              console.log('[ONBOARDING] No name found in user data');
            }
          } catch (error) {
            console.error('[ONBOARDING] Error parsing user data:', error);
            logger.error('Error parsing user data', error);
          }
        } else {
          console.log('[ONBOARDING] No user data in localStorage');
        }
      } else {
        console.log('[ONBOARDING] localStorage not available');
      }
    };
    loadUserData();
  }, []);
  const [ageRange, setAgeRange] = useState('');
  const [occupation, setOccupation] = useState('');
  const [location, setLocation] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [personalGoals, setPersonalGoals] = useState('');

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleCompleteOnboarding = async () => {
    console.log('[ONBOARDING] Button clicked!');
    logger.info('Form submission started', { name, ageRange, occupation, relationshipStatus });
    
    // Clear previous errors
    setErrors({});
    const newErrors: {[key: string]: string} = {};
    
    // Validation
    if (!name.trim()) {
      console.log('[ONBOARDING] Validation failed: name empty');
      newErrors.name = 'Please enter your name';
    }
    if (!ageRange) {
      console.log('[ONBOARDING] Validation failed: ageRange empty');
      newErrors.ageRange = 'Please select your age range';
    }
    if (!occupation) {
      console.log('[ONBOARDING] Validation failed: occupation empty');
      newErrors.occupation = 'Please select your occupation';
    }
    if (!relationshipStatus) {
      console.log('[ONBOARDING] Validation failed: relationshipStatus empty');
      newErrors.relationshipStatus = 'Please select your relationship status';
    }

    if (Object.keys(newErrors).length > 0) {
      console.log('[ONBOARDING] Validation failed:', newErrors);
      setErrors(newErrors);
      Alert.alert('Required Fields', 'Please fill in all required fields marked with *');
      return;
    }

    console.log('[ONBOARDING] Validation passed, starting API call');

    try {
      setIsLoading(true);
      logger.info('Starting onboarding submission');

      // Get token from localStorage
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('soulsync_token') : null;
      
      if (!token) {
        Alert.alert('Error', 'Please sign in first');
        router.replace('/login');
        return;
      }

      // Submit onboarding data
      const response = await fetch('http://localhost:8000/profile/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          age_range: ageRange,
          occupation: occupation,
          location: location.trim() || null,
          relationship_status: relationshipStatus,
          interests: interests.length > 0 ? interests : null,
          personal_goals: personalGoals.trim() || null,
        }),
      });

      // Handle expired token
      if (response.status === 401) {
        logger.info('Token expired, redirecting to login');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('soulsync_token');
          window.localStorage.removeItem('soulsync_user');
        }
        Alert.alert('Session Expired', 'Please sign in again');
        router.replace('/login');
        return;
      }

      const data = await response.json();

      if (response.ok) {
        logger.info('Onboarding completed successfully', data);
        Alert.alert('Success', 'Welcome to SoulSync! Your profile has been created.');
        router.replace('/welcome');
      } else {
        logger.error('Onboarding failed', data);
        Alert.alert('Error', data.detail || 'Failed to complete onboarding. Please try again.');
      }
    } catch (error) {
      logger.error('Onboarding error', error);
      Alert.alert('Error', 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Ionicons name="person-circle-outline" size={80} color="#6366f1" />
          <Text style={styles.title}>Welcome to SoulSync</Text>
          <Text style={styles.subtitle}>Let's get to know you better</Text>
        </View>

        <View style={styles.form}>
          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={[styles.input, errors.name ? styles.inputError : null]}
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Age Range */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age Range *</Text>
            {errors.ageRange && <Text style={styles.errorText}>{errors.ageRange}</Text>}
            <View style={styles.optionsContainer}>
              {AGE_RANGES.map(range => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.option,
                    ageRange === range && styles.optionSelected,
                  ]}
                  onPress={() => setAgeRange(range)}
                >
                  <Text style={[
                    styles.optionText,
                    ageRange === range && styles.optionTextSelected,
                  ]}>
                    {range}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Occupation */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Occupation *</Text>
            {errors.occupation && <Text style={styles.errorText}>{errors.occupation}</Text>}
            <View style={styles.optionsContainer}>
              {OCCUPATIONS.map(occ => (
                <TouchableOpacity
                  key={occ}
                  style={[
                    styles.option,
                    occupation === occ && styles.optionSelected,
                  ]}
                  onPress={() => setOccupation(occ)}
                >
                  <Text style={[
                    styles.optionText,
                    occupation === occ && styles.optionTextSelected,
                  ]}>
                    {occ}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your city"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* Relationship Status */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Relationship Status *</Text>
            {errors.relationshipStatus && <Text style={styles.errorText}>{errors.relationshipStatus}</Text>}
            <View style={styles.optionsContainer}>
              {RELATIONSHIP_STATUSES.map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.option,
                    relationshipStatus === status && styles.optionSelected,
                  ]}
                  onPress={() => setRelationshipStatus(status)}
                >
                  <Text style={[
                    styles.optionText,
                    relationshipStatus === status && styles.optionTextSelected,
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Interests */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Interests (Optional)</Text>
            <View style={styles.optionsContainer}>
              {INTEREST_OPTIONS.map(interest => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.option,
                    interests.includes(interest) && styles.optionSelected,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[
                    styles.optionText,
                    interests.includes(interest) && styles.optionTextSelected,
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Personal Goals */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Personal Goals (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What would you like to achieve?"
              value={personalGoals}
              onChangeText={setPersonalGoals}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleCompleteOnboarding}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditMode ? 'Update Profile' : 'Complete Onboarding'}
              </Text>
            )}
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
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 5,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  optionSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  optionText: {
    fontSize: 14,
    color: '#64748b',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
