import { Stack, HStack, Button } from '@chakra-ui/react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { settingStyles } from './setting-styles';
import { NumberField, SwitchField } from './common';
import { useWebSocket } from '@/context/websocket-context';
import { logAction } from '@/services/clientLogger';

interface MemorySettings {
  enabled: boolean;
  top_k: number;
}

const STORAGE_KEY = 'memorySettings';

function Memory(): JSX.Element {
  const { t } = useTranslation();
  const { sendMessage } = useWebSocket();

  const defaultSettings: MemorySettings = useMemo(() => ({ enabled: true, top_k: 4 }), []);

  const loadInitial = useCallback((): MemorySettings => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings;
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed };
    } catch {
      return defaultSettings;
    }
  }, [defaultSettings]);

  const [settings, setSettings] = useState<MemorySettings>(loadInitial);

  const apply = useCallback((next: Partial<MemorySettings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      try {
        const payload: any = { type: 'update-memory-settings' };
        if (typeof merged.enabled === 'boolean') payload.enabled = merged.enabled;
        if (typeof merged.top_k === 'number' && merged.top_k > 0) payload.top_k = Math.min(merged.top_k, 20);
        sendMessage(payload);
      } catch {}
      return merged;
    });
  }, [sendMessage]);

  const onToggle = useCallback((checked: boolean) => { logAction('settings.change', 'memory.enabled', { value: checked }); apply({ enabled: checked }); }, [apply]);
  const onTopK = useCallback((v: string) => { const val = Math.max(1, Math.min(20, Number(v))); logAction('settings.change', 'memory.top_k', { value: val }); apply({ top_k: val }); }, [apply]);

  const clearCurrent = useCallback(() => {
    logAction('memory.clear', 'current');
    sendMessage({ type: 'memory-clear', scope: 'current' });
  }, [sendMessage]);

  const clearAll = useCallback(() => {
    if (confirm('Очистить всю память? Это действие необратимо.')) {
      logAction('memory.clear', 'all');
      sendMessage({ type: 'memory-clear', scope: 'all' });
    }
  }, [sendMessage]);

  return (
    <Stack {...settingStyles.common.container}>
      <SwitchField
        label={t('settings.memory.enabled') || 'Enable long-term memory'}
        checked={settings.enabled}
        onChange={onToggle}
      />

      <NumberField
        label={t('settings.memory.top_k') || 'Top-K retrieval'}
        value={settings.top_k}
        onChange={onTopK}
        min={1}
        max={20}
        step={1}
        allowMouseWheel
      />

      <HStack gap={2}>
        <Button size="sm" colorPalette="red" onClick={clearCurrent}>{t('settings.memory.clear_current') || 'Clear current character'}</Button>
        <Button size="sm" colorPalette="red" variant="outline" onClick={clearAll}>{t('settings.memory.clear_all') || 'Clear ALL'}</Button>
      </HStack>
    </Stack>
  );
}

export default Memory; 