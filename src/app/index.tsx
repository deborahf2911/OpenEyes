
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();

  const [message, setMessage] = useState(
    'Your visual assistant is ready to get started.'
  );

  function handleDescribe() {
    router.push('/camera');
  }

  function handleQuestion() {
    Alert.alert(
      'Ask OpenEyes',
      'Conversational questions will be available once we connect the camera and AI.'
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText} accessibilityLabel="OpenEyes">
              O
            </Text>
          </View>

          <View style={styles.brandText}>
            <Text style={styles.brandName}>OpenEyes</Text>
            <Text style={styles.tagline}>A clearer world, through AI</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR EVERYDAY COMPANION</Text>

          <Text style={styles.heading}>
            Understand{'\n'}the world{'\n'}around you.
          </Text>

          <Text style={styles.description}>
            Discover what's in front of you with an assistant designed to
            make everyday moments easier.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleDescribe}
          accessibilityRole="button"
          accessibilityLabel="Describe what I see"
          accessibilityHint="Starts the visual description experience"
        >
          <Text style={styles.cameraIcon} accessible={false}>
            ◎
          </Text>
          <View style={styles.primaryButtonText}>
            <Text style={styles.primaryTitle}>Describe what I see</Text>
            <Text style={styles.primarySubtitle}>
              Explore your surroundings
            </Text>
          </View>
          <Text style={styles.arrow} accessible={false}>
            →
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleQuestion}
          accessibilityRole="button"
          accessibilityLabel="Ask a question"
          accessibilityHint="Learn about asking OpenEyes questions"
        >
          <Text style={styles.questionIcon} accessible={false}>
            ?
          </Text>
          <Text style={styles.secondaryTitle}>Ask a question</Text>
          <Text style={styles.secondaryArrow} accessible={false}>
            →
          </Text>
        </Pressable>

        <View
          style={styles.statusCard}
          accessible
          accessibilityLabel={`Development status. ${message}`}
        >
          <View style={styles.statusDot} />
          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>A little progress, every day</Text>
            <Text style={styles.statusMessage}>{message}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            BUILT FOR ACCESSIBILITY. DESIGNED FOR EVERYONE.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 42,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#123B56',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  brandText: {
    marginLeft: 12,
  },
  brandName: {
    color: '#123B56',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#526579',
    fontSize: 12,
    marginTop: 2,
  },
  hero: {
    marginBottom: 28,
  },
  eyebrow: {
    color: '#087E8B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 14,
  },
  heading: {
    color: '#123B56',
    fontSize: 43,
    lineHeight: 49,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  description: {
    color: '#526579',
    fontSize: 16,
    lineHeight: 25,
    marginTop: 16,
    maxWidth: 340,
  },
  primaryButton: {
    minHeight: 100,
    backgroundColor: '#087E8B',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  cameraIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    color: '#087E8B',
    fontSize: 35,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 48,
  },
  primaryButtonText: {
    flex: 1,
    marginLeft: 14,
  },
  primaryTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  primarySubtitle: {
    color: '#E0F5F6',
    fontSize: 12,
    marginTop: 5,
  },
  arrow: {
    color: '#FFFFFF',
    fontSize: 25,
    marginLeft: 8,
  },
  secondaryButton: {
    minHeight: 68,
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E3EB',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  questionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E8F3F6',
    color: '#123B56',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 36,
  },
  secondaryTitle: {
    color: '#123B56',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 13,
    flex: 1,
  },
  secondaryArrow: {
    color: '#087E8B',
    fontSize: 23,
  },
  statusCard: {
    backgroundColor: '#EAF1F6',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#087E8B',
    marginTop: 5,
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    color: '#123B56',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },
  statusMessage: {
    color: '#40576A',
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: '#65798A',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
});
