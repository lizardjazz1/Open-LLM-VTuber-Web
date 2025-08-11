import { ChangeEvent, KeyboardEvent } from 'react';
import { useChatHistory } from '@/context/chat-history-context';
import { useMicToggle } from '@/hooks/utils/use-mic-toggle';
import { useTextInput } from '@/hooks/footer/use-text-input';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { useInterrupt } from '@/hooks/utils/use-interrupt';

export function useInputSubtitle() {
  const {
    inputText: inputValue,
    setInputText: handleChange,
    handleKeyPress: handleKey,
    handleCompositionStart,
    handleCompositionEnd,
    handleSend,

  } = useTextInput();

  const { messages } = useChatHistory();
  const { handleMicToggle, micOn, isDisabled } = useMicToggle();
  const { aiState, setAiState } = useAiState();
  const { interrupt } = useInterrupt();

  const lastAIMessage = messages
    .filter((msg) => msg.role === 'ai')
    .slice(-1)
    .map((msg) => msg.content)[0];

  const hasAIMessages = messages.some((msg) => msg.role === 'ai');

  const handleInterrupt = () => {
    // use-interrupt will set idle and auto-start mic (with bypass) if configured
    interrupt();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleChange({ target: { value: e.target.value } } as ChangeEvent<HTMLInputElement>);
    setAiState(AiStateEnum.WAITING);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    handleKey(e as any);
  };

  return {
    inputValue,
    handleInputChange,
    handleKeyPress,
    handleCompositionStart,
    handleCompositionEnd,
    handleInterrupt,
    handleMicToggle,
    lastAIMessage,
    hasAIMessages,
    aiState,
    micOn,
    isDisabled,
    handleSend,
  };
}
