/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable react/require-default-props */
import { Stack } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { settingStyles } from './setting-styles';
import { useASRSettings } from '@/hooks/sidebar/setting/use-asr-settings';
import { SwitchField, NumberField } from './common';
import { logAction } from '@/services/clientLogger';

interface ASRProps {
  onSave?: (callback: () => void) => () => void
  onCancel?: (callback: () => void) => () => void
}

function ASR({ onSave, onCancel }: ASRProps): JSX.Element {
  const { t } = useTranslation();
  const {
    localSettings,
    autoStopMic,
    autoStartMicOn,
    autoStartMicOnConvEnd,
    setAutoStopMic,
    setAutoStartMicOn,
    setAutoStartMicOnConvEnd,
    handleInputChange,
    handleSave,
    handleCancel,
  } = useASRSettings();

  useEffect(() => {
    if (!onSave || !onCancel) return;

    const cleanupSave = onSave(() => { handleSave(); logAction('settings.change', 'asr.save'); });
    const cleanupCancel = onCancel(() => { handleCancel(); logAction('settings.change', 'asr.cancel'); });

    return (): void => {
      cleanupSave?.();
      cleanupCancel?.();
    };
  }, [onSave, onCancel, handleSave, handleCancel]);

  return (
    <Stack {...settingStyles.common.container}>
      <SwitchField
        label={t('settings.asr.autoStopMic')}
        checked={autoStopMic}
        onChange={(v) => { if (v !== autoStopMic) { setAutoStopMic(v); logAction('settings.change', 'asr.autoStopMic', { value: v }); } }}
      />

      <SwitchField
        label={t('settings.asr.autoStartMicOnConvEnd')}
        checked={autoStartMicOnConvEnd}
        onChange={(v) => { if (v !== autoStartMicOnConvEnd) { setAutoStartMicOnConvEnd(v); logAction('settings.change', 'asr.autoStartMicOnConvEnd', { value: v }); } }}
      />

      <SwitchField
        label={t('settings.asr.autoStartMicOn')}
        checked={autoStartMicOn}
        onChange={(v) => { if (v !== autoStartMicOn) { setAutoStartMicOn(v); logAction('settings.change', 'asr.autoStartMicOn', { value: v }); } }}
      />

      <NumberField
        label={t('settings.asr.positiveSpeechThreshold')}
        help={t('settings.asr.positiveSpeechThresholdDesc')}
        value={localSettings.positiveSpeechThreshold}
        onChange={(value) => { handleInputChange('positiveSpeechThreshold', value); logAction('settings.change', 'asr.positiveSpeechThreshold', { value }); }}
        min={1}
        max={100}
      />

      <NumberField
        label={t('settings.asr.negativeSpeechThreshold')}
        help={t('settings.asr.negativeSpeechThresholdDesc')}
        value={localSettings.negativeSpeechThreshold}
        onChange={(value) => { handleInputChange('negativeSpeechThreshold', value); logAction('settings.change', 'asr.negativeSpeechThreshold', { value }); }}
        min={0}
        max={100}
      />

      <NumberField
        label={t('settings.asr.redemptionFrames')}
        help={t('settings.asr.redemptionFramesDesc')}
        value={localSettings.redemptionFrames}
        onChange={(value) => { handleInputChange('redemptionFrames', value); logAction('settings.change', 'asr.redemptionFrames', { value }); }}
        min={1}
        max={100}
      />
    </Stack>
  );
}

export default ASR;
