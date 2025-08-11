/* eslint-disable no-use-before-define */
import {
  createContext, useContext, useRef, useCallback, useEffect, useReducer, useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import { MicVAD } from '@ricky0123/vad-web';
// import { useInterrupt } from '@/components/canvas/live2d';
import { audioTaskQueue } from '@/utils/task-queue';
import { useSendAudio } from '@/hooks/utils/use-send-audio';
import { SubtitleContext } from './subtitle-context';
import { AiStateContext, AiState } from './ai-state-context';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { toaster } from '@/components/ui/toaster';
import { wsService } from '@/services/websocket-service';

/**
 * VAD settings configuration interface
 * @interface VADSettings
 */
export interface VADSettings {
  /** Threshold for positive speech detection (0-100) */
  positiveSpeechThreshold: number;

  /** Threshold for negative speech detection (0-100) */
  negativeSpeechThreshold: number;

  /** Number of frames for speech redemption */
  redemptionFrames: number;
}

/**
 * VAD context state interface
 * @interface VADState
 */
interface VADState {
  /** Auto stop mic feature state */
  autoStopMic: boolean;

  /** Microphone active state */
  micOn: boolean;

  /** Set microphone state */
  setMicOn: (value: boolean) => void;

  /** Internal short cooldown flag after manual stop */
  userMicLock: boolean;

  /** Set short cooldown after manual toggle */
  setUserMicLock: (value: boolean) => void;

  /** Set Auto stop mic state */
  setAutoStopMic: (value: boolean) => void;

  /** Start microphone and VAD */
  startMic: (options?: { bypassLock?: boolean }) => Promise<void>;

  /** Stop microphone and VAD */
  stopMic: () => void;

  /** Previous speech probability value */
  previousTriggeredProbability: number;

  /** Set previous speech probability */
  setPreviousTriggeredProbability: (value: number) => void;

  /** VAD settings configuration */
  settings: VADSettings;

  /** Update VAD settings */
  updateSettings: (newSettings: VADSettings) => void;

  /** Auto start microphone when AI starts speaking */
  autoStartMicOn: boolean;

  /** Set auto start microphone state */
  setAutoStartMicOn: (value: boolean) => void;

  /** Auto start microphone when conversation ends */
  autoStartMicOnConvEnd: boolean;

  /** Set auto start microphone when conversation ends state */
  setAutoStartMicOnConvEnd: (value: boolean) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_VAD_SETTINGS: VADSettings = {
  positiveSpeechThreshold: 50,
  negativeSpeechThreshold: 35,
  redemptionFrames: 35,
};

const DEFAULT_VAD_STATE = {
  micOn: false,
  autoStopMic: false,
  autoStartMicOn: false,
  autoStartMicOnConvEnd: false,
};

/**
 * Create the VAD context
 */
export const VADContext = createContext<VADState | null>(null);

/**
 * VAD Provider Component
 * Manages voice activity detection and microphone state
 *
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function VADProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  // Refs for VAD instance and state
  const vadRef = useRef<MicVAD | null>(null);
  const previousTriggeredProbabilityRef = useRef(0);
  const previousAiStateRef = useRef<AiState>('idle');
  const userMicLockRef = useRef(false);
  // Cooldown removed: we keep persistent manual mic lock, so no auto-restart timer

  // Persistent state management
  const [micOn, setMicOn] = useLocalStorage('micOn', DEFAULT_VAD_STATE.micOn);
  const autoStopMicRef = useRef(true);
  const [userMicLock, setUserMicLockState] = useLocalStorage('userMicLock', false);
  const [autoStopMic, setAutoStopMicState] = useLocalStorage(
    'autoStopMic',
    DEFAULT_VAD_STATE.autoStopMic,
  );
  const [settings, setSettings] = useLocalStorage<VADSettings>(
    'vadSettings',
    DEFAULT_VAD_SETTINGS,
  );
  const [autoStartMicOn, setAutoStartMicOnState] = useLocalStorage(
    'autoStartMicOn',
    DEFAULT_VAD_STATE.autoStartMicOn,
  );
  const autoStartMicRef = useRef(false);
  const [autoStartMicOnConvEnd, setAutoStartMicOnConvEndState] = useLocalStorage(
    'autoStartMicOnConvEnd',
    DEFAULT_VAD_STATE.autoStartMicOnConvEnd,
  );
  const autoStartMicOnConvEndRef = useRef(false);

  // Initialize refs from stored values to avoid first-render mismatch
  useEffect(() => {
    autoStopMicRef.current = autoStopMic;
    autoStartMicRef.current = autoStartMicOn;
    autoStartMicOnConvEndRef.current = autoStartMicOnConvEnd;
    userMicLockRef.current = userMicLock;
    // Force one render so consumers see persisted values immediately
    forceUpdate();
  }, []);

  // Force update mechanism for ref updates
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // External hooks and contexts
  // const { interrupt } = useInterrupt();
  const { sendAudioPartition } = useSendAudio();
  const { setSubtitleText } = useContext(SubtitleContext)!;
  const { aiState, setAiState } = useContext(AiStateContext)!;

  // Refs for callback stability
  // const interruptRef = useRef(interrupt);
  const sendAudioPartitionRef = useRef(sendAudioPartition);
  const aiStateRef = useRef<AiState>(aiState);
  const setSubtitleTextRef = useRef(setSubtitleText);
  const setAiStateRef = useRef(AiStateContext ? setAiState : ((_: AiState) => {}) as any);

  const isProcessingRef = useRef(false);

  // Update refs when dependencies change
  useEffect(() => {
    aiStateRef.current = aiState;
  }, [aiState]);

  // useEffect(() => {
  //   interruptRef.current = interrupt;
  // }, [interrupt]);

  useEffect(() => {
    sendAudioPartitionRef.current = sendAudioPartition;
  }, [sendAudioPartition]);

  useEffect(() => {
    setSubtitleTextRef.current = setSubtitleText;
  }, [setSubtitleText]);

  useEffect(() => {
    setAiStateRef.current = setAiState;
  }, [setAiState]);

  useEffect(() => {
    autoStopMicRef.current = autoStopMic;
  }, [autoStopMic]);

  useEffect(() => {
    autoStartMicRef.current = autoStartMicOn;
  }, [autoStartMicOn]);

  useEffect(() => {
    autoStartMicOnConvEndRef.current = autoStartMicOnConvEnd;
  }, [autoStartMicOnConvEnd]);

  useEffect(() => {
    userMicLockRef.current = userMicLock;
  }, [userMicLock]);

  /**
   * Update previous triggered probability and force re-render
   */
  const setPreviousTriggeredProbability = useCallback((value: number) => {
    previousTriggeredProbabilityRef.current = value;
    forceUpdate();
  }, []);

  /**
   * Handle speech start event (initial detection)
   */
  const handleSpeechStart = useCallback(() => {
    console.log('Speech started - entering listening state');
    previousAiStateRef.current = aiStateRef.current;
    isProcessingRef.current = true;
    setAiStateRef.current('listening');
  }, []);

  /**
   * Handle real speech start event (confirmed speech)
   */
  const handleSpeechRealStart = useCallback(() => {
    console.log('Real speech confirmed - interrupting AI if needed');
    if (aiStateRef.current === 'thinking-speaking') {
      try { wsService.sendMessage({ type: 'interrupt-signal' }); } catch (_) {}
    }
  }, []);

  /**
   * Handle frame processing event
   */
  const handleFrameProcessed = useCallback((probs: { isSpeech: number }) => {
    if (probs.isSpeech > previousTriggeredProbabilityRef.current) {
      setPreviousTriggeredProbability(probs.isSpeech);
    }
  }, []);

  /**
   * Handle speech end event
   */
  const handleSpeechEnd = useCallback((audio: Float32Array) => {
    if (!isProcessingRef.current) return;
    console.log('Speech ended');
    audioTaskQueue.clearQueue();

    // Original order: stop mic first, then send
    if (autoStopMicRef.current) {
      stopMic();
    } else {
      console.log('Auto stop mic is OFF, keeping mic active');
    }

    setPreviousTriggeredProbability(0);
    try { sendAudioPartitionRef.current(audio); } catch (_) {}
    isProcessingRef.current = false;
  }, []);

  /**
   * Handle VAD misfire event
   */
  const handleVADMisfire = useCallback(() => {
    if (!isProcessingRef.current) return;
    console.log('VAD misfire detected');
    setPreviousTriggeredProbability(0);
    isProcessingRef.current = false;

    // Restore previous AI state and show helpful misfire message
    setAiStateRef.current(previousAiStateRef.current);
    setSubtitleTextRef.current(t('error.vadMisfire'));
  }, [t]);

  /**
   * Update VAD settings and restart if active
   */
  const updateSettings = useCallback((newSettings: VADSettings) => {
    setSettings(newSettings);
    if (vadRef.current) {
      stopMic();
      setTimeout(() => {
        startMic();
      }, 100);
    }
  }, []);

  // Debounced updater to avoid repeated rapid saves
  const updateSettingsDebounced = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateSettingsSafe = useCallback((newSettings: VADSettings) => {
    if (updateSettingsDebounced.current) {
      clearTimeout(updateSettingsDebounced.current);
    }
    updateSettingsDebounced.current = setTimeout(() => {
      updateSettings(newSettings);
    }, 200);
  }, [updateSettings]);

  /**
   * Initialize new VAD instance
   */
  const initVAD = async () => {
    const newVAD = await MicVAD.new({
      model: "v5",
      preSpeechPadFrames: 20,
      positiveSpeechThreshold: settings.positiveSpeechThreshold / 100,
      negativeSpeechThreshold: settings.negativeSpeechThreshold / 100,
      redemptionFrames: settings.redemptionFrames,
      baseAssetPath: './libs/',
      onnxWASMBasePath: './libs/',
      onSpeechStart: handleSpeechStart,
      onSpeechRealStart: handleSpeechRealStart,
      onFrameProcessed: handleFrameProcessed,
      onSpeechEnd: handleSpeechEnd,
      onVADMisfire: handleVADMisfire,
    });

    vadRef.current = newVAD;
    // Always start when initializing from explicit startMic
    newVAD.start();
  };

  /**
   * Start microphone and VAD processing
   */
  const startMic = useCallback(async (options?: { bypassLock?: boolean }) => {
    const bypassLock = !!options?.bypassLock;
    // Respect persistent manual lock unless explicitly bypassed for trusted automations
    if (!bypassLock && userMicLockRef.current) {
      console.log('startMic blocked by userMicLock');
      return;
    }
    // Do not start while AI is busy thinking/speaking/loading
    if (aiStateRef.current !== 'idle') {
      console.log(`startMic blocked due to aiState=${aiStateRef.current}`);
      return;
    }
    try {
      if (!vadRef.current) {
        console.log('Initializing VAD');
        await initVAD();
      } else {
        console.log('Starting VAD');
        vadRef.current.start();
      }
      setMicOn(true);
    } catch (error) {
      console.error('Failed to start VAD:', error);
      toaster.create({
        title: `${t('error.failedStartVAD')}: ${error}`,
        type: 'error',
        duration: 2000,
      });
    }
  }, [t, micOn]);

  /**
   * Stop microphone and VAD processing
   */
  const stopMic = useCallback(() => {
    console.log('Stopping VAD');
    if (vadRef.current) {
      vadRef.current.pause();
      vadRef.current.destroy();
      vadRef.current = null;
      console.log('VAD stopped and destroyed successfully');
      setPreviousTriggeredProbability(0);
    } else {
      console.log('VAD instance not found');
    }
    setMicOn(false);
    isProcessingRef.current = false;
  }, []);

  // Sync with backend control messages
  useEffect(() => {
    const sub = wsService.onMessage((msg: any) => {
      try {
        if (msg?.type === 'control') {
          const text = (msg.text || '').toString();
          if (text === 'start-mic') {
            // Backend start-mic requests are ignored when locked or AI is busy
            if (!userMicLockRef.current && aiStateRef.current === 'idle') {
              setMicOn(true);
              startMic();
            } else {
              console.log('Ignoring backend start-mic due to lock or busy AI');
            }
          } else if (text === 'stop-mic') {
            stopMic();
          } else if (text === 'conversation-chain-start') {
            // Ensure mic is stopped when AI starts thinking/speaking
            stopMic();
          }
        }
      } catch (_) {}
    });
    return () => sub.unsubscribe();
  }, [startMic, stopMic]);

  // Also react to AI state changes locally to guarantee mic is off during thinking/speaking
  useEffect(() => {
    if (aiStateRef.current === 'thinking-speaking' || aiStateRef.current === 'loading') {
      stopMic();
    }
  }, [aiState]);

  /**
   * Set Auto stop mic state
   */
  const setAutoStopMic = useCallback((value: boolean) => {
    autoStopMicRef.current = value;
    setAutoStopMicState(value);
    forceUpdate();
  }, []);

  const setAutoStartMicOn = useCallback((value: boolean) => {
    autoStartMicRef.current = value;
    setAutoStartMicOnState(value);
    forceUpdate();
  }, []);

  const setAutoStartMicOnConvEnd = useCallback((value: boolean) => {
    autoStartMicOnConvEndRef.current = value;
    setAutoStartMicOnConvEndState(value);
    forceUpdate();
  }, []);

  const setUserMicLock = useCallback((value: boolean) => {
    userMicLockRef.current = value;
    setUserMicLockState(value);
    forceUpdate();
  }, []);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      autoStopMic: autoStopMicRef.current,
      micOn,
      setMicOn,
      userMicLock: userMicLockRef.current,
      setUserMicLock,
      setAutoStopMic,
      startMic,
      stopMic,
      previousTriggeredProbability: previousTriggeredProbabilityRef.current,
      setPreviousTriggeredProbability,
      settings,
      updateSettings: updateSettingsSafe,
      autoStartMicOn: autoStartMicRef.current,
      setAutoStartMicOn,
      autoStartMicOnConvEnd: autoStartMicOnConvEndRef.current,
      setAutoStartMicOnConvEnd,
    }),
    [
      micOn,
      startMic,
      stopMic,
      settings,
      updateSettingsSafe,
    ],
  );

  return (
    <VADContext.Provider value={contextValue}>
      {children}
    </VADContext.Provider>
  );
}

/**
 * Custom hook to use the VAD context
 * @throws {Error} If used outside of VADProvider
 */
export function useVAD() {
  const context = useContext(VADContext);

  if (!context) {
    throw new Error('useVAD must be used within a VADProvider');
  }

  return context;
}
