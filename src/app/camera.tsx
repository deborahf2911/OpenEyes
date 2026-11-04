import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
} from 'expo-audio';
import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import type { ComponentRef } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Your computer's local network IP address
const API_URL = 'http://172.20.10.3:3000';

// Maximum dimension of the image sent to Muse Spark
const MAX_IMAGE_DIMENSION = 1600;
const VOICE_WS_URL = 'ws://172.20.10.3:3000/api/voice';

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [prompt, setPrompt] = useState('Help me find my keys.');
  const [result, setResult] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const cameraReadyRef = useRef(false);
  const voiceSocketRef = useRef<WebSocket | null>(null);
  const metaReadyRef = useRef(false);
  const sendRealAudioRef = useRef(false);
  const analyzingRef = useRef(false);
  const speechRestoreRef = useRef(false);
  const lastAudioBufferAtRef = useRef<number | null>(null);
  const audioBufferCountRef = useRef(0);
  const hasWelcomedRef = useRef(false);
  const listeningPromptRef = useRef<ComponentRef<typeof Text>>(null);

  const speakResultRef = useRef<
    ((message: string, onFinished?: () => void) => Promise<void>) | null
  >(null);

  const analyzeImageRef = useRef<
    ((voiceRequest?: string) => Promise<void>) | null
  >(null);

  const handleAudioBuffer = useCallback((buffer: { data: ArrayBuffer }) => {
    const now = Date.now();
    const previous = lastAudioBufferAtRef.current;

    lastAudioBufferAtRef.current = now;
    audioBufferCountRef.current += 1;

    if (audioBufferCountRef.current % 10 === 0 && previous !== null) {
      console.log(
        'Audio timing:',
        now - previous,
        'ms since previous buffer; socket:',
        voiceSocketRef.current?.readyState,
        'Meta ready:',
        metaReadyRef.current,
        'Sending real audio:',
        sendRealAudioRef.current
      );
    }

    const socket = voiceSocketRef.current;

    if (!metaReadyRef.current || socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    if (sendRealAudioRef.current) {
      socket.send(buffer.data);
    } else {
      socket.send(new ArrayBuffer(buffer.data.byteLength));
    }
  }, []);

  const { stream } = useAudioStream({
    sampleRate: 24000,
    channels: 1,
    encoding: 'int16',
    onBuffer: handleAudioBuffer,
  });

  const startVoiceSession = useCallback(async () => {
    try {
      if (
        voiceSocketRef.current &&
        (voiceSocketRef.current.readyState === WebSocket.CONNECTING ||
          voiceSocketRef.current.readyState === WebSocket.OPEN)
      ) {
        console.log('A voice session is already connecting or active.');
        return;
      }
      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Microphone permission required',
          'Allow microphone access to use OpenEyes hands-free.',
        );
        return;
      }

      const socket = new WebSocket(VOICE_WS_URL);
      voiceSocketRef.current = socket;

      socket.onopen = () => {
        console.log('Connected to OpenEyes voice backend.');
      };

      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'ready') {
            console.log('Meta voice session ready:', message.sessionId);

            metaReadyRef.current = true;

            if (!hasWelcomedRef.current) {
              hasWelcomedRef.current = true;

              speakResultRef.current?.(
                "I'm listening. What are you looking for?",
                () => {
                  if (
                    metaReadyRef.current &&
                    voiceSocketRef.current?.readyState === WebSocket.OPEN
                  ) {
                    sendRealAudioRef.current = true;
                    console.log('OpenEyes is listening for your instruction.');
                  }
                }
              );
            } else {
              await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
              });

              await stream.start();

              sendRealAudioRef.current = true;
              console.log('OpenEyes is listening for your instruction.');
            }
          }

          if (message.type === 'transcript') {
            const transcript = String(
              message.transcript ?? message.text ?? ''
            );

            console.log('Voice transcript:', transcript);

            // Display the live voice transcription in the text box.
            setPrompt(transcript);
          }

          if (message.type === 'speechComplete') {
            const transcript = String(
              message.transcript ?? message.text ?? ''
            ).trim();

            console.log('Completed voice instruction:', transcript);

            if (!transcript || analyzingRef.current) return;

            // Keep the final recognised instruction in the text box.
            setPrompt(transcript);

            sendRealAudioRef.current = false;
            void analyzeImageRef.current?.(transcript);
          }
        } catch (error) {
          console.error('Voice message handling error:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('Voice WebSocket error:', error);
      };

      socket.onclose = () => {
        if (voiceSocketRef.current === socket) {
          voiceSocketRef.current = null;
          metaReadyRef.current = false;
          sendRealAudioRef.current = false;
        }

        console.log('Voice session closed.');
      };
    } catch (error) {
      console.error('Could not start voice session:', error);
      Alert.alert('Voice connection error', 'Could not start the microphone session.');
    }
  }, [stream]);

  const stopSpeaking = () => {
    sendRealAudioRef.current = false;
    Speech.stop();
  };

  const restoreMicrophone = async (onFinished?: () => void) => {
    if (!speechRestoreRef.current) return;

    speechRestoreRef.current = false;

    try {
      const socket = voiceSocketRef.current;
      const sessionIsOpen =
        metaReadyRef.current && socket?.readyState === WebSocket.OPEN;

      if (sessionIsOpen) {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await stream.start();

        if (!analyzingRef.current) {
          sendRealAudioRef.current = true;
        }
      }

      setSpeaking(false);
      onFinished?.();

      console.log('OpenEyes microphone restored.');
    } catch (error) {
      console.error('Error restoring microphone:', error);
      setSpeaking(false);
      onFinished?.();
    }
  };

  const speakResult = async (
    message: string,
    onFinished?: () => void
  ) => {
    sendRealAudioRef.current = false;

    // Prevent an old speech callback from restoring the microphone.
    speechRestoreRef.current = false;
    Speech.stop();

    try {
      stream.stop();
      speechRestoreRef.current = true;

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
      });

      setSpeaking(true);

      Speech.speak(message, {
        language: 'en-US',
        rate: 0.95,
        pitch: 1.0,
        volume: 1.0,
        onDone: () => {
          void restoreMicrophone(onFinished);
        },
        onStopped: () => {
          void restoreMicrophone(onFinished);
        },
        onError: (error) => {
          console.error('Speech playback error:', error);
          void restoreMicrophone(onFinished);
        },
      });
    } catch (error) {
      console.error('Could not start speech playback:', error);
      await restoreMicrophone(onFinished);
    }
  };

  // Stop any ongoing speech when leaving the camera screen
  useEffect(() => {
    if (!cameraReady) {
      return;
    }

    startVoiceSession();

    return () => {
      metaReadyRef.current = false;
      sendRealAudioRef.current = false;

      stream.stop();

      const socket = voiceSocketRef.current;

      if (socket) {
        socket.close();
        voiceSocketRef.current = null;
      }

      speechRestoreRef.current = false;

      Speech.stop();
    };
  }, [cameraReady, startVoiceSession, stream]);

  const analyzeImage = async (voiceRequest?: string) => {
    console.log('Starting image analysis...');
    console.log('Camera ready:', cameraReady);
    console.log('Camera ref available:', !!cameraRef.current);
    console.log('Already analyzing:', analyzingRef.current);

    if (
      !cameraRef.current ||
      !cameraReadyRef.current ||
      analyzingRef.current
    ) {
      console.log('Image analysis stopped by initial safety check.');
      return;
    }

    console.log('Image analysis safety check passed.');

    analyzingRef.current = true;

    sendRealAudioRef.current = false;

    const totalStartedAt = Date.now();

    const oldSocket = voiceSocketRef.current;
    voiceSocketRef.current = null;
    metaReadyRef.current = false;

    if (oldSocket) {
      oldSocket.close();
    }

    stream.stop();

    try {
      stopSpeaking();

      setAnalyzing(true);
      setResult('Capturing image...');

      // Step 1: Capture the original camera image
      const captureStartedAt = Date.now();

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
      });

      console.log(
        `Photo capture time: ${((Date.now() - captureStartedAt) / 1000).toFixed(2)} seconds`
      );

      if (!photo?.uri || !photo.width || !photo.height) {
        throw new Error('Could not capture the image.');
      }

      console.log(
        `Original image dimensions: ${photo.width} x ${photo.height}`
      );

      setResult('Preparing image...');

      // Step 2: Resize while preserving the original aspect ratio
      const resizeStartedAt = Date.now();

      const actions: ImageManipulator.Action[] = [];

      if (
        photo.width > MAX_IMAGE_DIMENSION ||
        photo.height > MAX_IMAGE_DIMENSION
      ) {
        if (photo.width >= photo.height) {
          actions.push({
            resize: {
              width: MAX_IMAGE_DIMENSION,
            },
          });
        } else {
          actions.push({
            resize: {
              height: MAX_IMAGE_DIMENSION,
            },
          });
        }
      }

      const resizedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        actions,
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      console.log(
        `Image resize and compression time: ${((Date.now() - resizeStartedAt) / 1000).toFixed(2)} seconds`
      );

      console.log(
        `Resized dimensions: ${resizedImage.width} x ${resizedImage.height}`
      );

      console.log(
        `Resized image size: ${((resizedImage.base64?.length ?? 0) * 0.75 / 1024).toFixed(2)} KB`
      );

      if (!resizedImage.base64) {
        throw new Error('Could not prepare the image for analysis.');
      }

      setResult('OpenEyes is looking for your object...');

      const userRequest =
        voiceRequest?.trim() || prompt.trim() || 'Help me find my keys.';

      const accessibilityPrompt = `
        You are OpenEyes, a careful visual assistant designed to help blind
        and low-vision users understand their surroundings and locate objects.

        USER REQUEST:
        ${userRequest}

        YOUR TASK:
        Analyse the attached camera image and respond specifically to the
        user's request.

        IMPORTANT RULES:
        1. Focus on the object or information the user is asking about.
        2. Only identify objects that are actually visible in the image.
        3. Never invent objects, locations, colours, or details.
        4. Never describe an object's location using image-based terms such as
          "centre of the image", "middle of the view", "top-left", or
          "bottom-right".

          Instead, explain where the object is in the physical scene, using
          recognisable landmarks and natural directional language.

          When the user asks about something visible, first establish what
          the camera is facing if that context helps. Then explain where the
          requested object is relative to the surroundings.

          For example:
          "Your camera is facing a window with curtains on either side.
          The window is directly ahead, between the curtains."

          Do not assume the user knows what is visible. Briefly introduce
          unfamiliar landmarks when useful.
        5. If you are uncertain, say so clearly. Do not pretend to be certain.
        6. If the object is not visible in this image, say that you cannot
          see it in the current view. Do not claim it is absent from the
          entire room or surroundings.
        7. If the object is not visible, suggest one simple, cautious next
          camera movement, such as slowly scanning a nearby surface or
          pointing the camera slightly downward.
        8. Never give instructions that could put the user in physical danger.
          Do not tell the user to walk, climb, reach, or move without assistance.
        9. Use short, clear sentences suitable for being read aloud.
        10. Do not use Markdown formatting, headings, or long unnecessary
            descriptions.
        11. Speak directly to the user in natural conversational language.
            Make directions practical and concise, as if guiding someone
            who cannot see the camera image.
        12. Never describe an object's location using image-based terms
            such as "centre of the image", "middle of the view",
            "top-left", or "bottom-right".
        13. Instead, explain where the object is in the physical scene,
            using recognisable landmarks and natural directional language.
        14. When useful, first explain what the camera is facing.
            Briefly introduce unfamiliar landmarks so the user can
            understand the surroundings.
        15. Then explain where the requested object is relative to
            those landmarks. For example:
            "Your camera is facing a window with curtains on either
            side. The window is directly ahead, between the curtains."
        16. Only describe details supported by the image. Never invent
            landmarks or claim to know the user's compass direction.

        Give the most useful answer for the user's request.
      `.trim();

      // Step 3: Prepare and send the resized image
      const requestBody = JSON.stringify({
        prompt: accessibilityPrompt,
        imageDataUrl: `data:image/jpeg;base64,${resizedImage.base64}`,
      });

      console.log(
        `Request body size: ${(new Blob([requestBody]).size / 1024).toFixed(2)} KB`
      );

      const fetchStartedAt = Date.now();

      const response = await fetch(`${API_URL}/api/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      console.log(
        `Fetch time: ${((Date.now() - fetchStartedAt) / 1000).toFixed(2)} seconds`
      );

      console.log(`HTTP response status: ${response.status}`);

      const downloadStartedAt = Date.now();
      const data = await response.json();

      console.log(
        `Response download and JSON parsing: ${((Date.now() - downloadStartedAt) / 1000).toFixed(2)} seconds`
      );

      console.log(
        `Total mobile processing time: ${((Date.now() - totalStartedAt) / 1000).toFixed(2)} seconds`
      );

      if (!response.ok) {
        throw new Error(data.error || 'Image analysis failed.');
      }

      const message = data.message || 'No response was returned.';

      setResult(message);

      // Read the AI response aloud, then resume listening
      speakResult(message, () => {
        void startVoiceSession();
      });
    } catch (error) {
      console.error('OpenEyes image analysis error:', error);
      setResult('');

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Something went wrong while analysing the image.';

      speakResult(
        `Sorry, I couldn't analyse that image. ${errorMessage}`,
        () => {
          void startVoiceSession();
        }
      );
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    speakResultRef.current = speakResult;
    analyzeImageRef.current = analyzeImage;
  });

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.message}>
          Checking camera permission…
        </Text>
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
                'Please enable camera access in your phone settings.'
              );
            }
          }}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            Allow camera access
          </Text>
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

        <Text
          style={styles.headerTitle}
          accessibilityRole="header"
          accessibilityLabel="Look around"
        >
          Look around
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.preview}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => {
            cameraReadyRef.current = true;
            setCameraReady(true);
          }}
        />

        {!cameraReady && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>
              Starting camera…
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.bottomPanel}
        contentContainerStyle={styles.bottomContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <Text
          ref={listeningPromptRef}
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel="I'm listening. What are you looking for?"
        >
          What are you looking for?
        </Text>

        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Example: Help me find my keys..."
          placeholderTextColor="#8293A3"
          multiline
          accessibilityLabel="Describe the object you want to find"
        />

        <Pressable
          style={[
            styles.button,
            (!cameraReady || analyzing) && styles.disabledButton,
          ]}
          onPress={() => analyzeImage()}
          disabled={!cameraReady || analyzing}
          accessibilityRole="button"
          accessibilityLabel="Capture photo and find the requested object"
        >
          {analyzing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Capture and find
            </Text>
          )}
        </Pressable>

        {analyzing && (
          <Text style={styles.statusText}>
            OpenEyes is looking...
          </Text>
        )}

        {!!result && (
          <View
            style={styles.resultBox}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.resultTitle}>
              OpenEyes response
            </Text>

            <Text selectable style={styles.resultText}>
              {result}
            </Text>

            <View style={styles.speechControls}>
            <Pressable
              style={styles.speechButton}
              onPress={() => speakResult(result)}
              disabled={analyzing || speaking}
              accessibilityRole="button"
              accessibilityLabel="Repeat OpenEyes response"
            >
              <Text style={styles.speechButtonText}>
                ↻ Repeat response
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.speechButton,
                !speaking && styles.disabledButton,
              ]}
              onPress={stopSpeaking}
              disabled={!speaking}
              accessibilityRole="button"
              accessibilityLabel="Stop speaking"
            >
              <Text style={styles.speechButtonText}>
                ■ Stop speaking
              </Text>
            </Pressable>
          </View>
          </View>
        )}
      </ScrollView>
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
    minHeight: 180,
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
    maxHeight: '55%',
    flexShrink: 1,
  },
  bottomContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 30,
  },
  title: {
    color: '#123B56',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  input: {
    minHeight: 65,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E0E8',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    color: '#123B56',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 54,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#087E8B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  disabledButton: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statusText: {
    color: '#087E8B',
    textAlign: 'center',
    marginTop: 10,
  },
  resultBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D5E0E8',
  },
  resultTitle: {
    color: '#087E8B',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultText: {
    color: '#263E50',
    fontSize: 15,
    lineHeight: 23,
  },
  message: {
    color: '#526579',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
  },
  backButton: {
    padding: 16,
    marginTop: 8,
  },
  speechControls: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },

  speechButton: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E5F3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  speechButtonText: {
    color: '#087E8B',
    fontSize: 13,
    fontWeight: '700',
  },
});