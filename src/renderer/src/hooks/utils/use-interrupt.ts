import { useAiState } from '@/context/ai-state-context';
import { useWebSocket } from '@/context/websocket-context';
import { useChatHistory } from '@/context/chat-history-context';
import { audioTaskQueue } from '@/utils/task-queue';
import { useSubtitle } from '@/context/subtitle-context';
import { useAudioTask } from './use-audio-task';
import { useVAD } from '@/context/vad-context';

export const useInterrupt = () => {
  const { aiState, setAiState } = useAiState();
  const { sendMessage } = useWebSocket();
  const { fullResponse, clearResponse } = useChatHistory();
  // const { currentModel } = useLive2DModel();
  const { subtitleText, setSubtitleText } = useSubtitle();
  const { stopCurrentAudioAndLipSync } = useAudioTask();
  const { startMic, autoStartMicOn } = useVAD();

  const interrupt = (sendSignal = true) => {
    if (aiState !== 'thinking-speaking') return;
    console.log('Interrupting conversation chain');

    stopCurrentAudioAndLipSync();

    audioTaskQueue.clearQueue();

    setAiState('interrupted');

    if (sendSignal) {
      sendMessage({
        type: 'interrupt-signal',
        text: fullResponse,
      });
    }

    clearResponse();

    if (subtitleText === 'Thinking...') {
      setSubtitleText('');
    }
    console.log('Interrupted!');

    // Transition to idle promptly for UI and input readiness
    setAiState('idle');

    // If user enabled auto-start-on-interrupt, start mic bypassing user lock
    if (autoStartMicOn) {
      try { startMic({ bypassLock: true }); } catch (_) {}
    }
  };

  return { interrupt };
};
