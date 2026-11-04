import { requestRecordingPermissionsAsync } from 'expo-audio';
import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
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

  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();

  const [isStarting, setIsStarting] = useState(false);

  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) {
        setIsScreenReaderEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Speech.speak(
        "Hello! I'm OpenEyes, your visual assistant. I can help you find everyday objects and understand what's around you. To get started, I'll need access to your camera and microphone. Let's get started.",
        {
          language: 'en-US',
          rate: 0.85,
          pitch: 1.1,
          volume: 1.0,
          onDone: () => {
            if (isScreenReaderEnabled) {
              AccessibilityInfo.announceForAccessibility(
                'Welcome to OpenEyes. Explore the screen to get started.'
              );
            }
          },
        }
      );
    }, isScreenReaderEnabled ? 1500 : 1000);

    return () => {
      clearTimeout(timer);
      Speech.stop();
    };
  }, [isScreenReaderEnabled]);

  function speakAndWait(message: string): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(message, {
        language: 'en-US',
        rate: 0.85,
        pitch: 1.1,
        volume: 1.0,
        onDone: resolve,
        onStopped: resolve,
        onError: () => resolve(),
      });
    });
  }

  async function handleDescribe() {
    if (isStarting) return;

    setIsStarting(true);
    Speech.stop();

    try {
      if (!isScreenReaderEnabled) {
        await speakAndWait(
          'To help you understand your surroundings, OpenEyes needs access to your camera. Please allow camera access when the permission request appears.'
        );
      }

      let cameraGranted = cameraPermission?.granted;

      if (!cameraGranted) {
        const result = await requestCameraPermission();
        cameraGranted = result.granted;
      }

      if (!cameraGranted) {
        Alert.alert(
          'Camera access needed',
          'Please enable camera access in your iPhone Settings to use OpenEyes.'
        );
        return;
      }

      if (!isScreenReaderEnabled) {
        await speakAndWait(
          'Thank you. OpenEyes also needs microphone access so you can give voice instructions. Please allow microphone access when asked.'
        );
      }

      const microphoneResult = await requestRecordingPermissionsAsync();

      if (!microphoneResult.granted) {
        Alert.alert(
          'Microphone access needed',
          'Please enable microphone access in your iPhone Settings to use voice instructions.'
        );
        return;
      }

      router.push('/camera');
    } catch (error) {
      console.error('Permission setup error:', error);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setIsStarting(false);
    }
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
            Discover what&apos;s in front of you with an assistant designed to
            make everyday moments easier.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleDescribe}
          disabled={isStarting}
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
