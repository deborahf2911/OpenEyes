
import {
    CameraView,
    useCameraPermissions,
} from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.message}>Checking camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.message}>
          OpenEyes needs camera access to help describe the world around you.
        </Text>

        <Pressable
          style={styles.button}
          onPress={async () => {
            const result = await requestPermission();
            if (!result.granted) {
              Alert.alert(
                'Camera permission needed',
                'Please enable camera access in your phone settings to use this feature.'
              );
            }
          }}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Allow camera access</Text>
        </Pressable>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>Back to Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Look around</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.preview}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />

        {!cameraReady && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Starting camera…</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPanel}>
        <Text style={styles.title}>What would you like to explore?</Text>
        <Text style={styles.message}>
          Point your camera towards something you want OpenEyes to describe.
        </Text>
        <Text style={styles.comingSoon}>
          Photo capture and AI descriptions are our next steps.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  center: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: {
    color: '#087E8B',
    fontSize: 17,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#123B56',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 48,
  },
  preview: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#172B3A',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172B3A',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  bottomPanel: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    color: '#123B56',
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: '#526579',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
  },
  comingSoon: {
    color: '#087E8B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
  },
  button: {
    minHeight: 54,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#087E8B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  backButton: {
    padding: 16,
    marginTop: 8,
  },
});
