import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { insightsService, Insight } from '../services/insightsService';
import { moodService, MoodSummary } from '../services/moodService';
import { riskScoreService } from '../services/riskScoreService';
import AlertBanner from '../components/AlertBanner';

const MOOD_EMOJIS: Record<string, string> = {
  positive: '😊',
  negative: '😔',
  neutral: '😐',
  anxious: '😰',
  happy: '😄',
  sad: '😢',
  excited: '🤩',
  calm: '😌',
  frustrated: '😤',
  hopeful: '🌟',
};

export default function HomeScreen() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [moodSummary, setMoodSummary] = useState<MoodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical' | null>(null);
  const [showAlertBanner, setShowAlertBanner] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [latestInsights, moodData] = await Promise.all([
        insightsService.getLatestInsights(),
        moodService.getMoodSummary(),
      ]);
      setInsights(latestInsights);
      setMoodSummary(moodData);
      
      // Load risk score
      const riskScore = await riskScoreService.getLatestRiskScore();
      if (riskScore && riskScore.overall_level) {
        setRiskLevel(riskScore.overall_level as 'low' | 'medium' | 'high' | 'critical');
      } else {
        setRiskLevel(null);
      }
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const dismissInsight = async (insightId: string) => {
    try {
      await insightsService.markInsightSurfaced(insightId, true);
      setDismissedInsights(prev => new Set(prev).add(insightId));
      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (error) {
      console.error('Error dismissing insight:', error);
    }
  };

  const getMoodEmoji = (mood: string | null) => {
    if (!mood) return '😐';
    return MOOD_EMOJIS[mood] || '😐';
  };

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const handleAlertAction = () => {
    if (riskLevel === 'medium') {
      router.push('/trust-circle' as any);
    } else if (riskLevel === 'high' || riskLevel === 'critical') {
      router.push('/trust-circle' as any);
    }
  };

  const getMoodForDay = (date: string) => {
    if (!moodSummary) return null;
    const dayEntry = moodSummary.mood_timeline.find((entry: { date: string; mood: string }) => entry.date === date);
    return dayEntry ? dayEntry.mood : null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      </SafeAreaView>
    );
  }

  const visibleInsights = insights.filter(i => !dismissedInsights.has(i.id));

  return (
    <SafeAreaView style={styles.container}>
      {showAlertBanner && riskLevel && (
        <AlertBanner
          riskLevel={riskLevel}
          onDismiss={() => setShowAlertBanner(false)}
          onAction={handleAlertAction}
        />
      )}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Good Morning</Text>
          <Text style={styles.headerSubtitle}>How are you feeling today?</Text>
        </View>

        {/* Chat Entry Button */}
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => router.push('/chat' as any)}
        >
          <Ionicons name="chatbubbles" size={24} color="#fff" />
          <Text style={styles.chatButtonText}>Start Chat</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Today's Insight Card */}
        {visibleInsights.length > 0 && (
          <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.insightIconContainer}>
                <Ionicons name="bulb" size={24} color="#667eea" />
              </View>
              <Text style={styles.insightTitle}>Today's Insight</Text>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={() => dismissInsight(visibleInsights[0].id)}
              >
                <Ionicons name="close" size={20} color="#999" />
              </TouchableOpacity>
            </View>
            <Text style={styles.insightContent}>{visibleInsights[0].content}</Text>
            <View style={styles.insightFooter}>
              <Text style={styles.insightCategory}>{visibleInsights[0].category}</Text>
            </View>
          </View>
        )}

        {/* Mood Timeline */}
        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>7-Day Mood Timeline</Text>
          <View style={styles.moodTimeline}>
            {getLast7Days().map((date, index) => {
              const mood = getMoodForDay(date);
              const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
              return (
                <View key={date} style={styles.moodDay}>
                  <View style={[styles.moodEmojiContainer, mood ? styles.moodEmojiActive : styles.moodEmojiInactive]}>
                    <Text style={styles.moodEmoji}>{mood ? getMoodEmoji(mood) : '—'}</Text>
                  </View>
                  <Text style={styles.moodDayLabel}>{dayName}</Text>
                </View>
              );
            })}
          </View>
          {moodSummary && moodSummary.dominant_mood && (
            <Text style={styles.moodSummary}>
              Dominant mood: {getMoodEmoji(moodSummary.dominant_mood)} {moodSummary.dominant_mood}
            </Text>
          )}
        </View>

        {/* Empty State for No Insights */}
        {visibleInsights.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="sparkles" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptySubtitle}>
              Chat more to generate personalized insights
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatButtonText: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  dismissButton: {
    padding: 4,
  },
  insightContent: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 12,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  insightCategory: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  moodSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  moodTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  moodDay: {
    alignItems: 'center',
  },
  moodEmojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  moodEmojiActive: {
    backgroundColor: '#f0f0ff',
  },
  moodEmojiInactive: {
    backgroundColor: '#f5f5f5',
  },
  moodEmoji: {
    fontSize: 20,
  },
  moodDayLabel: {
    fontSize: 12,
    color: '#666',
  },
  moodSummary: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});
