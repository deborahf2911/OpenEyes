import {
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioStream,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const VOICE_WS_URL = 'ws://192.168.1.2:3000/api/voice';

export default function MicTestScreen() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [bufferCount, setBufferCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [actualSampleRate, setActualSampleRate] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [transcript, setTranscript] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('');
  const [error, setError] = useState('');

  const [speechStatus, setSpeechStatus] = useState('Not tested');

  const testSpeech = async () => {
    setError('');
    setSpeechStatus('Pausing microphone...');

    let restored = false;

    const restoreMicrophone = async () => {
        if (restored) return;
        restored = true;

        try {
        setSpeechStatus('Restoring microphone...');
        await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
        });
        await stream.start();
        setSpeechStatus('Speech finished — microphone listening again');
        } catch (error) {
        console.error('Could not restart microphone:', error);
        setSpeechStatus('Could not restart microphone');
        }
    };

    try {
        Speech.stop();
        stream.stop();

        await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        });

        setSpeechStatus('Speaking...');

        Speech.speak('Hello! This is a test of OpenEyes speech output.', {
        language: 'en-US',
        rate: 0.9,
        onStart: () => setSpeechStatus('Speaking...'),
        onDone: () => {
          void restoreMicrophone();
        },
        onStopped: () => {
            void restoreMicrophone();
        },
        onError: (error) => {
            console.log('Speech test error:', error);
            setError('Speech error: ' + error.message);
            void restoreMicrophone();
        },
        });
    } catch (error) {
        console.error('Speech test failed:', error);
        setError('Could not start speech test.');
        await restoreMicrophone();
    }
    };

  const socketRef = useRef<WebSocket | null>(null);
  const metaReadyRef = useRef(false);

  const bufferCountRef = useRef(0);
  const totalBytesRef = useRef(0);
  const lastUpdateRef = useRef(0);

  const handleBuffer = useCallback((buffer: {
    data: ArrayBuffer;
    sampleRate: number;
    channels: number;
    timestamp: number;
  }) => {
    bufferCountRef.current += 1;
    totalBytesRef.current += buffer.data.byteLength;

    // Send raw PCM audio to Meta only after its session is ready.
    const socket = socketRef.current;

    if (
      metaReadyRef.current &&
      socket &&
      socket.readyState === WebSocket.OPEN
    ) {
      socket.send(buffer.data);
    }

    const now = Date.now();

    if (now - lastUpdateRef.current >= 500) {
      lastUpdateRef.current = now;

      setBufferCount(bufferCountRef.current);
      setTotalBytes(totalBytesRef.current);
      setActualSampleRate(buffer.sampleRate);
    }
  }, []);

  const { stream, isStreaming } = useAudioStream({
    sampleRate: 24000,
    channels: 1,
    encoding: 'int16',
    onBuffer: handleBuffer,
  });

  useEffect(() => {
    return () => {
      metaReadyRef.current = false;
      stream.stop();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [stream]);

  const startMicrophone = async () => {
    let socket: WebSocket | null = null;

    try {
      setError('');
      setStarting(true);
      setTranscript('');
      setTranscriptStatus('');

      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        setPermissionGranted(false);
        setError('Microphone permission was not granted.');
        return;
      }

      setPermissionGranted(true);

      bufferCountRef.current = 0;
      totalBytesRef.current = 0;
      lastUpdateRef.current = 0;

      setBufferCount(0);
      setTotalBytes(0);
      setActualSampleRate(0);

      setConnectionStatus('Connecting to Meta...');

      // Connect to our backend, which establishes the Meta session.
      socket = new WebSocket(VOICE_WS_URL);
      socketRef.current = socket;
      metaReadyRef.current = false;

      // Wait until the backend confirms that Meta is ready.
      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Timed out connecting to Meta voice service.'));
          }
        }, 20000);

        socket!.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'ready') {
              metaReadyRef.current = true;
              setConnectionStatus('Connected to Meta — listening');
              settled = true;
              clearTimeout(timeout);
              resolve();
              return;
            }

            if (message.type === 'error') {
              const messageText =
                message.message || 'Meta voice service returned an error.';

              setError(messageText);

              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error(messageText));
              }

              return;
            }

            if (
              message.type === 'transcript' &&
              typeof message.transcript === 'string'
            ) {
              setTranscript(message.transcript);
              setTranscriptStatus('Receiving transcription...');
            }

            if (message.type === 'speechComplete') {
              setTranscript(message.transcript || '');
              setTranscriptStatus('Speech recognized');
            }
          } catch {
            setError('Could not read the transcription response.');
          }
        };

        socket!.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error('Could not connect to the voice service.'));
          } else {
            setError('The voice connection encountered an error.');
          }
        };

        socket!.onclose = () => {
          metaReadyRef.current = false;
          setConnectionStatus('Disconnected');

          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error('Voice connection closed before Meta was ready.'));
          }
        };
      });

      // Start recording only after Meta confirms the session is ready.
      await stream.start();
    } catch (err) {
      metaReadyRef.current = false;

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      setConnectionStatus('Disconnected');
      setError(
        err instanceof Error ? err.message : 'Could not start the microphone.'
      );
    } finally {
      setStarting(false);
    }
  };

  const stopMicrophone = () => {
    stream.stop();

    // Stop sending audio, then ask Meta to finish processing.
    metaReadyRef.current = false;

    const socket = socketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      setConnectionStatus('Finishing transcription...');

      socket.send(JSON.stringify({ type: 'endStream' }));
    } else {
      setConnectionStatus('Disconnected');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>OpenEyes Voice Test</Text>

        <Text style={styles.description}>
          Speak naturally after connecting. OpenEyes will send your live
          microphone audio to Meta for transcription.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.label}>Microphone status</Text>
          <Text style={styles.status}>
            {isStreaming ? 'Listening' : 'Stopped'}
          </Text>

          <Text style={styles.label}>Meta connection</Text>
          <Text style={styles.status}>{connectionStatus}</Text>

          {starting && <ActivityIndicator size="small" />}
        </View>

        <TouchableOpacity
        style={styles.button}
        onPress={testSpeech}
        >
          <Text style={styles.buttonText}>Test speech output</Text>
        </TouchableOpacity>

        <Text style={styles.stat}>Speech status: {speechStatus}</Text>

        <TouchableOpacity
          style={[styles.button, (isStreaming || starting) && styles.disabledButton]}
          onPress={startMicrophone}
          disabled={isStreaming || starting}
        >
          <Text style={styles.buttonText}>
            {starting ? 'Connecting...' : 'Start voice test'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.stopButton,
            !isStreaming && styles.disabledButton,
          ]}
          onPress={stopMicrophone}
          disabled={!isStreaming}
        >
          <Text style={styles.buttonText}>Stop microphone</Text>
        </TouchableOpacity>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Live audio information</Text>

          <Text style={styles.stat}>
            Microphone permission: {permissionGranted ? 'Granted' : 'Not granted'}
          </Text>

          <Text style={styles.stat}>
            Actual sample rate: {actualSampleRate || 'Waiting'} Hz
          </Text>

          <Text style={styles.stat}>
            Audio buffers received: {bufferCount}
          </Text>

          <Text style={styles.stat}>
            Total audio data: {(totalBytes / 1024).toFixed(2)} KB
          </Text>

          <Text style={styles.stat}>Encoding: int16 PCM</Text>
          <Text style={styles.stat}>Channels: Mono</Text>
        </View>

        <View style={styles.transcriptCard}>
          <Text style={styles.statsTitle}>Recognized speech</Text>

          <Text style={styles.transcript}>
            {transcript || 'Your spoken words will appear here.'}
          </Text>

          {transcriptStatus !== '' && (
            <Text style={styles.transcriptStatus}>{transcriptStatus}</Text>
          )}
        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.note}>
          This is a temporary voice connection test. It does not yet send
          recognized instructions to the object-finding camera workflow.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
  },
  content: {
    padding: 24,
    paddingTop: 40,
    gap: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#CBD5E1',
  },
  statusCard: {
    padding: 20,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    gap: 8,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  status: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#208AEF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#DC4545',
  },
  disabledButton: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsCard: {
    padding: 20,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    gap: 12,
  },
  statsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stat: {
    color: '#CBD5E1',
    fontSize: 15,
  },
  transcriptCard: {
    padding: 20,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    gap: 12,
  },
  transcript: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 27,
  },
  transcriptStatus: {
    color: '#94A3B8',
    fontSize: 14,
  },
  error: {
    color: '#FF7777',
    fontSize: 15,
  },
  note: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
  },
});