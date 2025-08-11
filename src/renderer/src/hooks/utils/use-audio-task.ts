/* eslint-disable func-names */
/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAiState } from '@/context/ai-state-context';
import { useSubtitle } from '@/context/subtitle-context';
import { useChatHistory } from '@/context/chat-history-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { toaster } from '@/components/ui/toaster';
import { useWebSocket } from '@/context/websocket-context';
import { DisplayText } from '@/services/websocket-service';
import { useLive2DExpression } from '@/hooks/canvas/use-live2d-expression';
import * as LAppDefine from '../../../WebSDK/src/lappdefine';
import { useVAD } from '@/context/vad-context';

// Simple type alias for Live2D model
type Live2DModel = any;

interface AudioTaskOptions {
  audioBase64: string
  volumes: number[]
  sliceLength: number
  displayText?: DisplayText | null
  expressions?: string[] | number[] | null
  speaker_uid?: string
  forwarded?: boolean
}

/**
 * Custom hook for handling audio playback tasks with Live2D lip sync
 */
export const useAudioTask = () => {
  const { t } = useTranslation();
  const { aiState, backendSynthComplete, setBackendSynthComplete } = useAiState();
  const { setSubtitleText } = useSubtitle();
  const { appendResponse, appendAIMessage } = useChatHistory();
  const { sendMessage } = useWebSocket();
  const { setExpression } = useLive2DExpression();
  const { startMic, stopMic, autoStartMicOnConvEnd } = useVAD();

  // State refs to avoid stale closures
  const stateRef = useRef({
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  });

  // Track current audio and model
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentModelRef = useRef<Live2DModel | null>(null);

  stateRef.current = {
    aiState,
    setSubtitleText,
    appendResponse,
    appendAIMessage,
  };

  /**
   * Stop current audio playback and lip sync
   */
  const stopCurrentAudioAndLipSync = useCallback(() => {
    if (currentAudioRef.current) {
      console.log('Stopping current audio and lip sync');
      const audio = currentAudioRef.current;
      audio.pause();
      audio.src = '';
      audio.load();

      const model = currentModelRef.current;
      if (model && model._wavFileHandler) {
        try {
          // Release PCM data to stop lip sync calculation in update()
          model._wavFileHandler.releasePcmData();
          console.log('Called _wavFileHandler.releasePcmData()');

          // Additional reset of state variables as fallback
          model._wavFileHandler._lastRms = 0.0;
          model._wavFileHandler._sampleOffset = 0;
          model._wavFileHandler._userTimeSeconds = 0.0;
          console.log('Also reset _lastRms, _sampleOffset, _userTimeSeconds as fallback');
        } catch (e) {
          console.error('Error stopping/resetting wavFileHandler:', e);
        }
      } else if (model) {
        console.warn('Current model does not have _wavFileHandler to stop/reset.');
      } else {
        console.log('No associated model found to stop lip sync.');
      }

      currentAudioRef.current = null;
      currentModelRef.current = null;
    } else {
      console.log('No current audio playing to stop.');
    }
  }, []);

  /**
   * Handle audio playback with Live2D lip sync
   */
  const handleAudioPlayback = (options: AudioTaskOptions): Promise<void> => new Promise((resolve) => {
    const {
      aiState: currentAiState,
      setSubtitleText: updateSubtitle,
      appendResponse: appendText,
      appendAIMessage: appendAI,
    } = stateRef.current;

    // Skip if already interrupted
    if (currentAiState === 'interrupted') {
      console.warn('Audio playback blocked by interruption state.');
      resolve();
      return;
    }

    const { audioBase64, displayText, expressions, forwarded } = options;

    // Update display text
    if (displayText) {
      appendText(displayText.text);
      appendAI(displayText.text, displayText.name, displayText.avatar);
      if (audioBase64) {
        updateSubtitle(displayText.text);
      }
      if (!forwarded) {
        sendMessage({
          type: "audio-play-start",
          display_text: displayText,
          forwarded: true,
        });
      }
    }

    try {
      // Process audio if available
      if (audioBase64) {
        const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;

        // Get Live2D manager and model (optional for lip sync)
        const live2dManager = (window as any).getLive2DManager?.();
        let model: Live2DModel | null = null;
        if (!live2dManager) {
          console.warn('Live2D manager not found. Proceeding with audio playback without lip sync.');
        } else {
          model = live2dManager.getModel(0);
          if (!model) {
            console.warn('Live2D model not found at index 0. Proceeding without lip sync.');
          } else {
            console.log('Found model for audio playback');
            currentModelRef.current = model;
          }
        }

        if (!model || !model._wavFileHandler) {
          console.warn('Model does not have _wavFileHandler for lip sync');
        } else {
          console.log('Model has _wavFileHandler available');
        }

        // Set expression if available
        const lappAdapter = (window as any).getLAppAdapter?.();
        if (lappAdapter && expressions?.[0] !== undefined) {
          setExpression(
            expressions[0],
            lappAdapter,
            `Set expression to: ${expressions[0]}`,
          );
        }

        // Start talk motion
        if (model && LAppDefine && typeof LAppDefine.PriorityNormal === 'number') {
          const hasTalk = typeof model._modelSetting?.getMotionGroupCount === 'function'
            && (() => {
              const cnt = model._modelSetting.getMotionGroupCount();
              for (let i = 0; i < cnt; i += 1) {
                if (model._modelSetting.getMotionGroupName(i) === 'Talk') return true;
              }
              return false;
            })();
          if (hasTalk) {
            console.log("Starting random 'Talk' motion");
            model.startRandomMotion(
              'Talk',
              LAppDefine.PriorityNormal,
            );
          }
        }

        // Setup audio element
        const audio = new Audio(audioDataUrl);
        currentAudioRef.current = audio;
        let isFinished = false;

        const cleanup = () => {
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
            currentModelRef.current = null;
          }
          if (!isFinished) {
            isFinished = true;
            resolve();
          }
        };

        // Enhance lip sync sensitivity
        const lipSyncScale = 2.0;

        audio.addEventListener('canplaythrough', () => {
          // Check for interruption before playback
          if (stateRef.current.aiState === 'interrupted' || currentAudioRef.current !== audio) {
            console.warn('Audio playback cancelled due to interruption or new audio');
            cleanup();
            return;
          }

          // Temporarily stop mic to avoid loopback into ASR while TTS is playing
          try { stopMic(); } catch (_) {}

          console.log('Starting audio playback with lip sync');
          audio.play().catch((err) => {
            console.error("Audio play error:", err);
            cleanup();
          });

          // Setup lip sync if model is available
          if (model && model._wavFileHandler) {
            if (!model._wavFileHandler._initialized) {
              console.log('Applying enhanced lip sync');
              model._wavFileHandler._initialized = true;

              const originalUpdate = model._wavFileHandler.update.bind(model._wavFileHandler);
              model._wavFileHandler.update = function (deltaTimeSeconds: number) {
                const result = originalUpdate(deltaTimeSeconds);
                // @ts-ignore
                this._lastRms = Math.min(2.0, this._lastRms * lipSyncScale);
                return result;
              };
            }

            if (currentAudioRef.current === audio) {
              model._wavFileHandler.start(audioDataUrl);
            } else {
              console.warn('WavFileHandler start skipped - audio was stopped');
            }
          }
        });

        audio.addEventListener('ended', () => {
          console.log("Audio playback completed");
          cleanup();
        });

        audio.addEventListener('error', (error) => {
          console.error("Audio playback error:", error);
          cleanup();
        });

        audio.load();
      } else {
        resolve();
      }
    } catch (error) {
      console.error('Audio playback setup error:', error);
      toaster.create({
        title: `${t('error.audioPlayback')}: ${error}`,
        type: "error",
        duration: 2000,
      });
      currentAudioRef.current = null;
      currentModelRef.current = null;
      resolve();
    }
  });

  // Handle backend synthesis completion
  useEffect(() => {
    let isMounted = true;

    const handleComplete = async () => {
      await audioTaskQueue.waitForCompletion();
      if (isMounted && backendSynthComplete) {
        stopCurrentAudioAndLipSync();
        sendMessage({ type: "frontend-playback-complete" });
        setBackendSynthComplete(false);
      }
    };

    handleComplete();

    return () => {
      isMounted = false;
    };
  }, [backendSynthComplete, sendMessage, setBackendSynthComplete]);

  /**
   * Add a new audio task to the queue
   */
  const addAudioTask = async (options: AudioTaskOptions) => {
    const { aiState: currentState } = stateRef.current;

    if (currentState === 'interrupted') {
      console.log('Skipping audio task due to interrupted state');
      return;
    }

    console.log(`Adding audio task ${options.displayText?.text} to queue`);
    audioTaskQueue.addTask(() => handleAudioPlayback(options));
  };

  return {
    addAudioTask,
    appendResponse,
    stopCurrentAudioAndLipSync,
  };
};
