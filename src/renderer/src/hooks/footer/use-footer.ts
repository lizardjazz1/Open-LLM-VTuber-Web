import { ChangeEvent, KeyboardEvent } from 'react';
import { useTextInput } from '@/hooks/footer/use-text-input';
import { useInterrupt } from '@/hooks/utils/use-interrupt';
import { useMicToggle } from '@/hooks/utils/use-mic-toggle';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { useTriggerSpeak } from '@/hooks/utils/use-trigger-speak';
import { useProactiveSpeak } from '@/context/proactive-speak-context';
import { logAction } from '@/services/clientLogger';

export const useFooter = () => {
  const {
    inputText: inputValue,
    setInputText: handleChange,
    handleKeyPress: handleKey,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTextInput();

  const { interrupt } = useInterrupt();
  // no direct need here; auto-start handled inside use-interrupt
  const { handleMicToggle, micOn, isDisabled } = useMicToggle();
  const { setAiState, aiState } = useAiState();
  const { sendTriggerSignal } = useTriggerSpeak();
  const { settings } = useProactiveSpeak();

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleChange({ target: { value: e.target.value } } as ChangeEvent<HTMLInputElement>);
    setAiState(AiStateEnum.WAITING);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    handleKey(e as any);
  };

  const handleInterrupt = () => {
    logAction('ui.click', 'interrupt');
    if (aiState === AiStateEnum.THINKING_SPEAKING) {
      // use-interrupt handles setting idle and auto-starting mic (with bypass)
      interrupt();
    } else if (settings.allowButtonTrigger) {
      sendTriggerSignal(-1);
    }
  };

  return {
    inputValue,
    handleInputChange,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
    handleInterrupt,
    handleMicToggle,
    micOn,
    isDisabled,
  };
};
