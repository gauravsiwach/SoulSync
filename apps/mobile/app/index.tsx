import { Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
      <View style={{ alignItems: 'center', paddingHorizontal: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 20 }}>🧘‍♀️</Text>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 16 }}>
          SoulSync
        </Text>
        <Text style={{ fontSize: 18, color: '#666', textAlign: 'center', marginBottom: 40 }}>
          Your AI Mental Health Companion
        </Text>
        
        <TouchableOpacity
          style={{
            backgroundColor: '#667eea',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 25,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            marginBottom: 16,
          }}
          onPress={() => router.push('/chat' as any)}
        >
          <Ionicons name="chatbubble" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
            Start Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#667eea',
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 25,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
          }}
          onPress={() => router.push('/login' as any)}
        >
          <Ionicons name="log-in" size={20} color="#667eea" style={{ marginRight: 8 }} />
          <Text style={{ color: '#667eea', fontSize: 18, fontWeight: '600' }}>
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: 'transparent',
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 25,
            flexDirection: 'row',
            alignItems: 'center',
          }}
          onPress={() => router.push('/profile' as any)}
        >
          <Ionicons name="person" size={20} color="#666" style={{ marginRight: 8 }} />
          <Text style={{ color: '#666', fontSize: 16 }}>
            Profile
          </Text>
        </TouchableOpacity>
        
        <Text style={{ fontSize: 14, color: '#999', marginTop: 20, textAlign: 'center' }}>
          Phase 1 & 2: Auth + AI Chat
        </Text>
      </View>
    </SafeAreaView>
  );
}
