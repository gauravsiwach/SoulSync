import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trustCircleService, TrustCircleMemberCreate } from './services/trustCircleService';
import InlineAlert from './components/InlineAlert';

const logger = {
  info: (msg: string, data?: any) => console.log(`[ADD_CONTACT] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[ADD_CONTACT ERROR] ${msg}`, error),
};

const ALERT_LEVELS = [
  { value: 'concern', label: 'Concern', color: '#f59e0b', description: 'For general concerns' },
  { value: 'urgent', label: 'Urgent', color: '#f97316', description: 'For urgent situations' },
  { value: 'emergency', label: 'Emergency', color: '#ef4444', description: 'For emergencies only' },
];

export default function AddContactScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [alertLevel, setAlertLevel] = useState('concern');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});

  const handleSave = async () => {
    // Clear previous validation errors
    setValidationError(null);
    setFieldErrors({});
    
    const errors: typeof fieldErrors = {};
    
    if (!name.trim()) {
      errors.name = 'Name is required';
    }
    if (!phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (phone.trim().length < 10) {
      errors.phone = 'Phone number must be at least 10 digits';
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setValidationError('Please fix the errors below');
      return;
    }

    try {
      setIsLoading(true);
      logger.info('Creating trust circle member', { name, phone, alertLevel });

      const memberData: TrustCircleMemberCreate = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        alert_level: alertLevel,
      };

      await trustCircleService.createTrustCircleMember(memberData);
      logger.info('Trust circle member created successfully');
      // Navigate back to trust circle - the list will refresh automatically
      router.replace('/trust-circle');
    } catch (error) {
      logger.error('Failed to create trust circle member', error);
      Alert.alert('Error', 'Failed to add contact. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.replace('/trust-circle')}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          {validationError && (
            <InlineAlert
              type="error"
              message={validationError}
              onDismiss={() => setValidationError(null)}
            />
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={fieldErrors.name ? [styles.input, styles.inputError] : styles.input}
              placeholder="Enter contact name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (fieldErrors.name) {
                  setFieldErrors(prev => ({ ...prev, name: undefined }));
                }
              }}
            />
            {fieldErrors.name && (
              <Text style={styles.errorText}>{fieldErrors.name}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={fieldErrors.phone ? [styles.input, styles.inputError] : styles.input}
              placeholder="Enter phone number (min 10 digits)"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (fieldErrors.phone) {
                  setFieldErrors(prev => ({ ...prev, phone: undefined }));
                }
              }}
              keyboardType="phone-pad"
            />
            <Text style={styles.helperText}>Must be at least 10 digits</Text>
            {fieldErrors.phone && (
              <Text style={styles.errorText}>{fieldErrors.phone}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alert Level *</Text>
            <Text style={styles.subtitle}>
              When should this contact be notified?
            </Text>
            {ALERT_LEVELS.map((level) => (
              <TouchableOpacity
                key={level.value}
                style={[
                  styles.alertLevelCard,
                  alertLevel === level.value && styles.alertLevelCardSelected,
                  { borderColor: level.color },
                ]}
                onPress={() => setAlertLevel(level.value)}
              >
                <View style={styles.alertLevelHeader}>
                  <View
                    style={[
                      styles.alertLevelDot,
                      { backgroundColor: level.color },
                    ]}
                  />
                  <Text style={styles.alertLevelLabel}>{level.label}</Text>
                  {alertLevel === level.value && (
                    <Ionicons name="checkmark-circle" size={20} color={level.color} />
                  )}
                </View>
                <Text style={styles.alertLevelDescription}>{level.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Add Contact</Text>
              </>
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
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 80, // Add padding to avoid overlap with floating back button
  },
  form: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  alertLevelCard: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  alertLevelCardSelected: {
    backgroundColor: '#fef3c7',
  },
  alertLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertLevelDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  alertLevelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  alertLevelDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 20,
  },
  saveButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
});
