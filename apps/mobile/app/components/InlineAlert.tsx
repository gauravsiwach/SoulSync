import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InlineAlertProps {
  type: 'error' | 'success' | 'info';
  message: string;
  onDismiss?: () => void;
}

export default function InlineAlert({ type, message, onDismiss }: InlineAlertProps) {
  const getAlertColor = () => {
    switch (type) {
      case 'error':
        return { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '#ef4444' };
      case 'success':
        return { bg: '#dcfce7', border: '#22c55e', text: '#166534', icon: '#22c55e' };
      case 'info':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '#3b82f6' };
    }
  };

  const colors = getAlertColor();
  const iconName = type === 'error' ? 'warning' : type === 'success' ? 'checkmark-circle' : 'information-circle';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.content}>
        <Ionicons name={iconName} size={20} color={colors.icon} />
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Ionicons name="close" size={16} color={colors.text} />
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
});
