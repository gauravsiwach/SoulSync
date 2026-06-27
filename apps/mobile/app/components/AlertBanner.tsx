import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AlertBannerProps {
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | null;
  onDismiss?: () => void;
  onAction?: () => void;
}

export default function AlertBanner({ riskLevel, onDismiss, onAction }: AlertBannerProps) {
  if (!riskLevel) {
    return null;
  }

  const config = {
    low: {
      bgColor: '#dcfce7',
      borderColor: '#22c55e',
      iconColor: '#22c55e',
      icon: 'checkmark-circle',
      title: 'All Good',
      message: 'Your well-being looks stable. Keep up the great work!',
      actionText: null
    },
    medium: {
      bgColor: '#fef3c7',
      borderColor: '#f59e0b',
      iconColor: '#f59e0b',
      icon: 'alert-circle',
      title: 'Check In Recommended',
      message: 'We\'ve noticed some patterns. Consider reaching out to your support network.',
      actionText: 'View Trust Circle'
    },
    high: {
      bgColor: '#fee2e2',
      borderColor: '#ef4444',
      iconColor: '#ef4444',
      icon: 'warning',
      title: 'Elevated Risk Detected',
      message: 'Your trust circle has been notified. Please reach out to someone you trust.',
      actionText: 'Get Support'
    },
    critical: {
      bgColor: '#fecaca',
      borderColor: '#dc2626',
      iconColor: '#dc2626',
      icon: 'warning',
      title: 'Immediate Attention Needed',
      message: 'Your trust circle has been alerted. Please check in with someone right away.',
      actionText: 'Get Support'
    }
  };

  const currentConfig = config[riskLevel];

  return (
    <View style={[styles.container, { backgroundColor: currentConfig.bgColor, borderColor: currentConfig.borderColor }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: currentConfig.bgColor }]}>
          <Ionicons name={currentConfig.icon as any} size={24} color={currentConfig.iconColor} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{currentConfig.title}</Text>
          <Text style={styles.message}>{currentConfig.message}</Text>
        </View>
      </View>
      {onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={20} color="#6b7280" />
        </TouchableOpacity>
      )}
      {onAction && currentConfig.actionText && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{currentConfig.actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  message: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dismissButton: {
    padding: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
});
