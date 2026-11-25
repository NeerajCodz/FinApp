'use client';

/**
 * Voice messages on the web: a MediaRecorder-based recorder hook and a compact player bubble.
 */
import React from 'react';
import { Pause, Play } from '@phosphor-icons/react';
import { VOICE_MAX_DURATION_MS, VOICE_MIN_DURATION_MS } from '@convex/shared/voice';
import { formatVoiceDuration } from '../model';
import styles from './ChatThread.module.css';

export type VoiceClip = { blob: Blob; durationMs: number; mimeType: string };

/** Containers the browser can record that the server accepts, best first. */
const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

function pickRecordingType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
}

export function voiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Records one clip at a time. `stop()` resolves with the clip (null if it was too short or
 * cancelled). Recording stops by itself at the maximum length.
 */
export function useVoiceRecorder() {
  const [state, setState] = React.useState<'idle' | 'recording'>('idle');
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const startedAt = React.useRef(0);
  const ticker = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const settle = React.useRef<((clip: VoiceClip | null) => void) | null>(null);
  const cancelled = React.useRef(false);

  const cleanup = React.useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
    setState('idle');
    setElapsedMs(0);
  }, []);

  React.useEffect(() => () => cleanup(), [cleanup]);

  const stop = React.useCallback(
    () =>
      new Promise<VoiceClip | null>((resolve) => {
        const active = recorder.current;
        if (!active || active.state === 'inactive') {
          resolve(null);
          return;
        }
        settle.current = resolve;
        active.stop();
      }),
    [],
  );

  const start = React.useCallback(async () => {
    setError(null);
    if (!voiceRecordingSupported()) {
      setError('Voice messages aren’t supported in this browser.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = pickRecordingType();
      const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      cancelled.current = false;
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      media.onstop = () => {
        const durationMs = Date.now() - startedAt.current;
        const mimeType = (media.mimeType || type || 'audio/webm').split(';')[0]!;
        const blob = new Blob(chunks.current, { type: mimeType });
        const clip =
          cancelled.current || durationMs < VOICE_MIN_DURATION_MS || !blob.size
            ? null
            : { blob, durationMs: Math.min(durationMs, VOICE_MAX_DURATION_MS), mimeType };
        cleanup();
        settle.current?.(clip);
        settle.current = null;
      };
      recorder.current = media;
      startedAt.current = Date.now();
      media.start(250);
      setState('recording');
      ticker.current = setInterval(() => {
        const elapsed = Date.now() - startedAt.current;
        setElapsedMs(elapsed);
        if (elapsed >= VOICE_MAX_DURATION_MS) media.stop();
      }, 200);
      return true;
    } catch (cause) {
      cleanup();
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Allow microphone access to record a voice message.'
          : 'Could not start recording.',
      );
      return false;
    }
  }, [cleanup]);

  const cancel = React.useCallback(() => {
    cancelled.current = true;
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    else cleanup();
  }, [cleanup]);

  return { state, elapsedMs, error, start, stop, cancel, clearError: () => setError(null) };
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
  const audio = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const total = durationMs ? durationMs / 1000 : 0;
  if (!src) return <span className={styles.voiceGone}>Voice message is no longer available.</span>;
  const progress = total ? Math.min(1, position / total) : 0;
  return (
    <div className={styles.voice} data-mine={mine || undefined}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button
        type="button"
        className={styles.voicePlay}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        onClick={() => {
          const element = audio.current;
          if (!element) return;
          if (element.paused) void element.play().catch(() => setPlaying(false));
          else element.pause();
        }}
      >
        {playing ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
      </button>
      <span className={styles.voiceTrack} aria-hidden>
        <span className={styles.voiceFill} style={{ width: `${progress * 100}%` }} />
      </span>
      <span className={styles.voiceTime}>
        {formatVoiceDuration(playing || position ? position * 1000 : (durationMs ?? 0))}
      </span>
    </div>
  );
}
