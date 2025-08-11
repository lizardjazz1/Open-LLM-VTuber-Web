import { useCallback, useEffect, useState } from 'react';
import { useProactiveSpeak } from '@/context/proactive-speak-context';

interface UseAgentSettingsProps {
  onSave?: (callback: () => void) => () => void
  onCancel?: (callback: () => void) => () => void
}

export function useAgentSettings({ onSave, onCancel }: UseAgentSettingsProps = {}) {
  const { settings: persistedSettings, updateSettings } = useProactiveSpeak();

  const [tempSettings, setTempSettings] = useState({
    allowProactiveSpeak: persistedSettings.allowProactiveSpeak,
    idleSecondsToSpeak: persistedSettings.idleSecondsToSpeak,
    allowButtonTrigger: persistedSettings.allowButtonTrigger,
  });

  const [originalSettings, setOriginalSettings] = useState({
    ...persistedSettings,
  });

  useEffect(() => {
    if (persistedSettings) {
      setOriginalSettings(persistedSettings);
      setTempSettings(persistedSettings);
    }
  }, [persistedSettings]);

  const handleAllowProactiveSpeakChange = useCallback((checked: boolean) => {
    setTempSettings((prev) => ({
      ...prev,
      allowProactiveSpeak: checked,
    }));
    updateSettings({ ...tempSettings, allowProactiveSpeak: checked });
  }, [tempSettings, updateSettings]);

  const handleIdleSecondsChange = useCallback((value: number) => {
    setTempSettings((prev) => ({
      ...prev,
      idleSecondsToSpeak: value,
    }));
    updateSettings({ ...tempSettings, idleSecondsToSpeak: value });
  }, [tempSettings, updateSettings]);

  const handleAllowButtonTriggerChange = useCallback((checked: boolean) => {
    setTempSettings((prev) => ({
      ...prev,
      allowButtonTrigger: checked,
    }));
    updateSettings({ ...tempSettings, allowButtonTrigger: checked });
  }, [tempSettings, updateSettings]);

  const handleSave = useCallback(() => {
    updateSettings(tempSettings);
    setOriginalSettings(tempSettings);
  }, [updateSettings, tempSettings]);

  const handleCancel = useCallback(() => {
    // Do not revert toggles on cancel; they are autosaved on change
    setTempSettings((prev) => prev);
  }, [originalSettings]);

  useEffect(() => {
    if (!onSave || !onCancel) return;

    const cleanupSave = onSave(handleSave);
    const cleanupCancel = onCancel(handleCancel);

    return () => {
      cleanupSave?.();
      cleanupCancel?.();
    };
  }, [onSave, onCancel, handleSave, handleCancel]);

  return {
    settings: tempSettings,
    handleAllowProactiveSpeakChange,
    handleIdleSecondsChange,
    handleAllowButtonTriggerChange,
  };
}
