/**
 * Voice messages on mobile (expo-audio): a recorder hook and a compact player bubble.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Pause, Play } from 'phosphor-react-native';
import { VOICE_MAX_DURATION_MS, VOICE_MIN_DURATION_MS } from '@convex/shared/voice';
import { useTheme } from '../../native/ThemeProvider';
import { Typography } from '../../native/typography';
import { formatVoiceDuration } from '../model';

/** A recorded clip: a local file URI, its length and the type to upload it as. */
export type NativeVoiceClip = { uri: string; durationMs: number; mimeType: string };

/**
 * Records one clip at a time (m4a). `stop()` resolves with the clip, or null when it was too
 * short or cancelled. Stops by itself at the maximum length.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 200);
  const [error, setError] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const startedAt = React.useRef(0);
  const elapsedMs = recording ? Math.max(status.durationMillis ?? 0, 0) : 0;

  const stop = React.useCallback(async (): Promise<NativeVoiceClip | null> => {
    if (!recording) return null;
    setRecording(false);
    const durationMs = Math.min(Date.now() - startedAt.current, VOICE_MAX_DURATION_MS);
    try {
      await recorder.stop();
    } catch {
      return null;
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    }
    const uri = recorder.uri;
    if (!uri || durationMs < VOICE_MIN_DURATION_MS) return null;
    return { uri, durationMs, mimeType: 'audio/mp4' };
  }, [recorder, recording]);

  // Hard stop at the maximum length (the caller decides what to do with the clip).
  const stopRef = React.useRef(stop);
  stopRef.current = stop;
  const onLimit = React.useRef<((clip: NativeVoiceClip | null) => void) | null>(null);
  React.useEffect(() => {
    if (recording && elapsedMs >= VOICE_MAX_DURATION_MS)
      void stopRef.current().then((clip) => onLimit.current?.(clip));
  }, [elapsedMs, recording]);

  const start = React.useCallback(async () => {
    setError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Allow microphone access in Settings to record a voice message.');
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setRecording(true);
      return true;
    } catch {
      setError('Could not start recording.');
      setRecording(false);
      return false;
    }
  }, [recorder]);

  const cancel = React.useCallback(async () => {
    if (!recording) return;
    setRecording(false);
    await recorder.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [recorder, recording]);

  return {
    recording,
    elapsedMs: recording ? elapsedMs || Date.now() - startedAt.current : 0,
    error,
    start,
    stop,
    cancel,
    clearError: () => setError(null),
    /** Receives the clip when recording hits the maximum length. */
    onLimit,
  };
}

/** A voice clip: play/pause, progress and length. */
export function VoiceBubble({
  src,
  durationMs,
  mine,
}: {
  src: string | null | undefined;
  durationMs?: number;
  mine?: boolean;
}) {
  const { tokens } = useTheme();
  const player = useAudioPlayer(src ? { uri: src } : null);
  const status = useAudioPlayerStatus(player);
  React.useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [player, status.didJustFinish]);
  if (!src)
    return (
      <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
        Voice message is no longer available.
      </Typography>
    );
  const total = durationMs ? durationMs / 1000 : status.duration || 0;
  const progress = total ? Math.min(1, status.currentTime / total) : 0;
  const shown =
    status.playing || status.currentTime > 0 ? status.currentTime * 1000 : (durationMs ?? 0);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: mine ? tokens.primaryForeground : tokens.primary,
        }}
      >
        {status.playing ? (
          <Pause size={16} weight="fill" color={mine ? tokens.primary : tokens.primaryForeground} />
        ) : (
          <Play size={16} weight="fill" color={mine ? tokens.primary : tokens.primaryForeground} />
        )}
      </Pressable>
      <View
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: tokens.borderSubtle,
        }}
      >
        <View
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            backgroundColor: mine ? tokens.primaryForeground : tokens.primary,
          }}
        />
      </View>
      <Typography
        variant="caption"
        style={{
          fontVariant: ['tabular-nums'],
          color: mine ? tokens.primaryForeground : tokens.foregroundMuted,
        }}
      >
        {formatVoiceDuration(shown)}
      </Typography>
    </View>
  );
}
