import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { settingsService, UserSettings } from './services/settingsService';
import InlineAlert from './components/InlineAlert';

const logger = {
  info: (msg: string, data?: any) => console.log(`[SETTINGS] ${msg}`, data),
  error: (msg: string, error?: any) => console.error(`[SETTINGS ERROR] ${msg}`, error),
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>({
    risk_monitoring_enabled: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      logger.info('Loading settings');
      const data = await settingsService.getUserSettings();
      setSettings(data);
      logger.info('Settings loaded', data);
    } catch (error) {
      logger.error('Failed to load settings', error);
      // Use default values if API fails
      setSettings({
        risk_monitoring_enabled: true,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      logger.info('Saving settings', settings);
      
      const updatedSettings = await settingsService.updateUserSettings(settings);
      setSettings(updatedSettings);
      
      setSaveMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setSaveMessage(null), 3000);
      logger.info('Settings saved successfully', updatedSettings);
    } catch (error) {
      logger.error('Failed to save settings', error);
      setSaveMessage({ type: 'error', text: 'Failed to save settings' });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRiskMonitoring = () => {
    setSettings({ ...settings, risk_monitoring_enabled: !settings.risk_monitoring_enabled });
  };

  const toggleQuietHours = () => {
    setSettings({ ...settings, quiet_hours_enabled: !settings.quiet_hours_enabled });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.floatingBackButton} onPress={() => router.replace('/(tabs)/profile')}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.floatingSaveButton} onPress={handleSaveSettings} disabled={isSaving}>
        {isSaving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {saveMessage && (
          <InlineAlert
            type={saveMessage.type}
            message={saveMessage.text}
            onDismiss={() => setSaveMessage(null)}
          />
        )}
        {/* Risk Monitoring Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety & Monitoring</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="shield-checkmark" size={24} color="#667eea" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingName}>Risk Monitoring</Text>
                <Text style={styles.settingDescription}>
                  Allow the app to monitor your wellbeing and alert your trust circle if needed
                </Text>
              </View>
            </View>
            <Switch
              value={settings.risk_monitoring_enabled}
              onValueChange={toggleRiskMonitoring}
              trackColor={{ false: '#d1d5db', true: '#667eea' }}
              thumbColor={settings.risk_monitoring_enabled ? '#ffffff' : '#f3f4f6'}
            />
          </View>
        </View>

        {/* Quiet Hours Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="moon" size={24} color="#667eea" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingName}>Enable Quiet Hours</Text>
                <Text style={styles.settingDescription}>
                  Pause notifications during specified hours
                </Text>
              </View>
            </View>
            <Switch
              value={settings.quiet_hours_enabled}
              onValueChange={toggleQuietHours}
              trackColor={{ false: '#d1d5db', true: '#667eea' }}
              thumbColor={settings.quiet_hours_enabled ? '#ffffff' : '#f3f4f6'}
            />
          </View>

          {settings.quiet_hours_enabled && (
            <>
              <View style={styles.timeRow}>
                <View style={styles.timeItem}>
                  <Text style={styles.timeLabel}>From</Text>
                  <View style={styles.timeValue}>
                    <Text style={styles.timeText}>{settings.quiet_hours_start}</Text>
                  </View>
                </View>
                <View style={styles.timeItem}>
                  <Text style={styles.timeLabel}>To</Text>
                  <View style={styles.timeValue}>
                    <Text style={styles.timeText}>{settings.quiet_hours_end}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.timeNote}>
                You won't receive notifications during these hours
              </Text>
            </>
          )}
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => {}}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="information-circle" size={24} color="#667eea" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingName}>App Version</Text>
                <Text style={styles.settingDescription}>1.0.0</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#667eea" />
          <Text style={styles.infoText}>
            Risk monitoring analyzes your messages and activity to detect concerning patterns. 
            Your trust circle will only be notified if you're at high risk.
          </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 80, // Add padding to avoid overlap with floating buttons
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  timeItem: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  timeValue: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  timeNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#4338ca',
    lineHeight: 20,
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
  floatingSaveButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#667eea',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
});
