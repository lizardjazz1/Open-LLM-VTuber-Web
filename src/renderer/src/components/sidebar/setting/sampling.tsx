import { Stack, HStack, Button } from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { settingStyles } from './setting-styles';
import { NumberField } from './common';
import { useWebSocket } from '@/context/websocket-context';
import { logAction } from '@/services/clientLogger';

interface SamplingSettings {
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  seed?: number | null;
}

const STORAGE_KEY = 'llmSamplingSettings';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function Sampling(): JSX.Element {
  const { t } = useTranslation();
  const { sendMessage } = useWebSocket();

  const defaultSettings: SamplingSettings = useMemo(() => ({
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0.4,
    presence_penalty: 0.2,
    max_tokens: 384,
    seed: null,
  }), []);

  const loadInitial = useCallback((): SamplingSettings => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings;
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  }, [defaultSettings]);

  const [settings, setSettings] = useState<SamplingSettings>(loadInitial);

  const apply = useCallback((next: Partial<SamplingSettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      // send WS update
      try {
        const payload: any = { type: 'update-llm-params' };
        if (merged.temperature != null) payload.temperature = clamp(merged.temperature, 0, 2);
        if (merged.top_p != null) payload.top_p = clamp(merged.top_p, 0, 1);
        if (merged.frequency_penalty != null) payload.frequency_penalty = clamp(merged.frequency_penalty, 0, 2);
        if (merged.presence_penalty != null) payload.presence_penalty = clamp(merged.presence_penalty, 0, 2);
        if (merged.max_tokens != null) payload.max_tokens = Math.max(1, Math.floor(merged.max_tokens));
        if (merged.seed !== undefined) payload.seed = merged.seed === null ? undefined : Math.floor(merged.seed as number);
        sendMessage(payload);
      } catch {}
      return merged;
    });
  }, [sendMessage]);

  const presetStrict = useCallback(() => {
    logAction('settings.preset', 'sampling', { preset: 'strict' });
    apply({ temperature: 0.2, top_p: 0.9, frequency_penalty: 0.2, presence_penalty: 0.0, max_tokens: 256 });
  }, [apply]);
  const presetBalanced = useCallback(() => {
    logAction('settings.preset', 'sampling', { preset: 'balanced' });
    apply({ temperature: 0.7, top_p: 0.9, frequency_penalty: 0.4, presence_penalty: 0.2, max_tokens: 384 });
  }, [apply]);
  const presetCreative = useCallback(() => {
    logAction('settings.preset', 'sampling', { preset: 'creative' });
    apply({ temperature: 1.2, top_p: 1.0, frequency_penalty: 0.0, presence_penalty: 0.0, max_tokens: 512 });
  }, [apply]);

  return (
    <Stack {...settingStyles.common.container}>
      <HStack gap={2}>
        <Button size="sm" onClick={presetStrict}>{t('settings.sampling.presets.strict') || 'Strict'}</Button>
        <Button size="sm" onClick={presetBalanced}>{t('settings.sampling.presets.balanced') || 'Balanced'}</Button>
        <Button size="sm" onClick={presetCreative}>{t('settings.sampling.presets.creative') || 'Creative'}</Button>
      </HStack>

      <NumberField
        label={t('settings.sampling.temperature') || 'Temperature'}
        value={settings.temperature}
        onChange={(v) => { logAction('settings.change', 'sampling.temperature', { value: Number(v) }); apply({ temperature: Number(v) }); }}
        min={0}
        max={2}
        step={0.05}
        allowMouseWheel
      />

      <NumberField
        label={t('settings.sampling.top_p') || 'Top P'}
        value={settings.top_p}
        onChange={(v) => { logAction('settings.change', 'sampling.top_p', { value: Number(v) }); apply({ top_p: Number(v) }); }}
        min={0}
        max={1}
        step={0.01}
        allowMouseWheel
      />

      <NumberField
        label={t('settings.sampling.frequency_penalty') || 'Frequency penalty'}
        value={settings.frequency_penalty}
        onChange={(v) => { logAction('settings.change', 'sampling.frequency_penalty', { value: Number(v) }); apply({ frequency_penalty: Number(v) }); }}
        min={0}
        max={2}
        step={0.05}
        allowMouseWheel
      />

      <NumberField
        label={t('settings.sampling.presence_penalty') || 'Presence penalty'}
        value={settings.presence_penalty}
        onChange={(v) => { logAction('settings.change', 'sampling.presence_penalty', { value: Number(v) }); apply({ presence_penalty: Number(v) }); }}
        min={0}
        max={2}
        step={0.05}
        allowMouseWheel
      />

      <NumberField
        label={t('settings.sampling.max_tokens') || 'Max tokens'}
        value={settings.max_tokens}
        onChange={(v) => { logAction('settings.change', 'sampling.max_tokens', { value: Number(v) }); apply({ max_tokens: Number(v) }); }}
        min={1}
        max={8192}
        step={16}
        allowMouseWheel
      />

      <NumberField
        label={t('settings.sampling.seed') || 'Seed'}
        value={settings.seed ?? '' as unknown as number}
        onChange={(v) => { const nv = v === '' ? null : Number(v); logAction('settings.change', 'sampling.seed', { value: nv }); apply({ seed: nv }); }}
        min={-2147483648}
        max={2147483647}
        step={1}
        allowMouseWheel
      />
    </Stack>
  );
}

export default Sampling; 