import { useVAD } from '@/context/vad-context';
import { useAiState } from '@/context/ai-state-context';
import { logAction } from '@/services/clientLogger';

export function useMicToggle() {
  const {
    startMic,
    stopMic,
    micOn,
    setUserMicLock,
  } = useVAD();
  const { aiState, setAiState } = useAiState();
  const isDisabled = aiState !== 'idle';

  const handleMicToggle = async (): Promise<void> => {
    if (isDisabled) {
      await logAction('ui.click.blocked', 'vad.toggle', { reason: 'ai-busy', aiState });
      return;
    }
    if (micOn) {
      await logAction('ui.click', 'vad.toggle', { to: 'off', aiState });
      // Engage user lock before stopping to avoid any auto-restart races
      setUserMicLock(true);
      stopMic();
      // Ensure UI returns to idle after manual mic off
      setAiState('idle');
    } else {
      await logAction('ui.click', 'vad.toggle', { to: 'on', aiState });
      // Release user lock before starting
      setUserMicLock(false);
      await startMic();
    }
  };

  return {
    handleMicToggle,
    micOn,
    isDisabled,
  };
}
