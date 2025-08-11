import { Box, Button, Input, Tabs, Text, Checkbox } from '@chakra-ui/react';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerActionTrigger,
  DrawerBackdrop,
  DrawerCloseTrigger,
} from '@/components/ui/drawer';
import { sidebarStyles } from './sidebar-styles';
import { useWebSocket } from '@/context/websocket-context';
import { wsService } from '@/services/websocket-service';

interface MemoryDrawerProps {
  children: React.ReactNode;
}

interface HistoryItem {
  uid: string;
  latest_message: { role: 'human' | 'ai'; timestamp: string; content: string } | null;
  timestamp: string | null;
  consolidated?: boolean;
  consolidated_ts?: string | null;
}

function MemoryDrawer({ children }: MemoryDrawerProps): JSX.Element {
  const { t } = useTranslation();
  const { sendMessage } = useWebSocket();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('memorySettings');
      return raw ? JSON.parse(raw).enabled !== false : true;
    } catch { return true; }
  });
  const [topK, setTopK] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('memorySettings');
      return raw ? Math.max(1, Math.min(20, Number(JSON.parse(raw).top_k || 4))) : 4;
    } catch { return 4; }
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id?: string; text: string; score?: number; kind?: string }>>([]);
  const [minImportance, setMinImportance] = useState<number | undefined>(() => {
    try {
      const raw = localStorage.getItem('memorySettings');
      const v = raw ? JSON.parse(raw).min_importance : undefined;
      return typeof v === 'number' ? v : undefined;
    } catch { return undefined; }
  });
  const [items, setItems] = useState<Array<{ id: string; text: string; kind?: string }>>([]);
  const kindsList = ['FactsAboutUser', 'PastEvents', 'SelfBeliefs', 'Objectives', 'Emotions', 'KeyFacts'] as const;
  const kindLabels: Record<(typeof kindsList)[number], string> = {
    FactsAboutUser: 'Факты о зрителях',
    PastEvents: 'События на стриме',
    SelfBeliefs: 'Убеждения Нейри',
    Objectives: 'Цели Нейри',
    Emotions: 'Эмоции',
    KeyFacts: 'Важные факты',
  };
  const kindDescriptions: Record<(typeof kindsList)[number], string> = {
    FactsAboutUser: 'Факты о зрителях (ник, интересы, привычки, предпочтения)',
    PastEvents: 'События, произошедшие на стриме (челленджи, шутки, конфликты)',
    SelfBeliefs: 'Убеждения и установки самой Нейри (о себе, своей роли)',
    Objectives: 'Цели, которые Нейри поставила в ходе стрима',
    Emotions: 'Эмоции, которые Нейри испытывала к людям или в целом',
    KeyFacts: 'Любая важная информация для будущих стримов',
  };
  const labelForKind = (k?: string) => {
    if (!k) return 'Другое';
    return kindLabels[k as (typeof kindsList)[number]] || k;
  };
  const descForKind = (k?: string) => {
    if (!k) return '';
    return kindDescriptions[k as (typeof kindsList)[number]] || '';
  };
  const [kinds, setKinds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('memorySettings');
      const arr = raw ? JSON.parse(raw).kinds : [];
      return Array.isArray(arr) ? arr.filter((x: any) => typeof x === 'string') : [];
    } catch { return []; }
  });
  const [moods, setMoods] = useState<Array<{ user: string; score: number; label: string }>>([]);
  const [moodUser, setMoodUser] = useState<string>('');
  const [moodScore, setMoodScore] = useState<string>('');
  const [emotionItems, setEmotionItems] = useState<Array<{ id: string; text: string }>>([]);
  const [pruneDays, setPruneDays] = useState<string>('');
  const [pruneMaxImportance, setPruneMaxImportance] = useState<string>('');
  const [lastListKind, setLastListKind] = useState<string | undefined>(undefined);

  // Consolidation tab state
  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [conLimit, setConLimit] = useState<string>('');

  // Add memory form state
  const [memText, setMemText] = useState('');
  const [memKind, setMemKind] = useState('FactsAboutUser');
  const [memUserId, setMemUserId] = useState('');
  const [memPlatform, setMemPlatform] = useState('');
  const [memCategory, setMemCategory] = useState('');
  const [memTopics, setMemTopics] = useState(''); // comma
  const [memTags, setMemTags] = useState(''); // comma
  const [memImportance, setMemImportance] = useState('');
  const [memEmotion, setMemEmotion] = useState(''); // [-1..1]
  const [memTimestamp, setMemTimestamp] = useState(''); // ISO or epoch

  const onAddMemory = useCallback(() => {
    if (!memText.trim()) return;
    const entry: any = { text: memText.trim(), kind: memKind };
    if (memUserId) entry.user_id = memUserId.trim();
    if (memPlatform) entry.platform = memPlatform.trim();
    if (memCategory) entry.category = memCategory.trim();
    if (memTopics) entry.topics = memTopics.split(',').map(s => s.trim()).filter(Boolean);
    if (memTags) entry.tags = memTags.split(',').map(s => s.trim()).filter(Boolean);
    if (memImportance !== '') entry.importance = Number(memImportance);
    if (memEmotion !== '') entry.emotion_score = Number(memEmotion);
    if (memTimestamp) entry.timestamp = memTimestamp;
    sendMessage({ type: 'memory-add', entry });
    setMemText(''); setMemUserId(''); setMemPlatform(''); setMemCategory(''); setMemTopics(''); setMemTags(''); setMemImportance(''); setMemEmotion(''); setMemTimestamp('');
  }, [memText, memKind, memUserId, memPlatform, memCategory, memTopics, memTags, memImportance, memEmotion, memTimestamp, sendMessage]);

  const apply = useCallback((next: Partial<{ enabled: boolean; top_k: number }>) => {
    const prev = (() => { try { return JSON.parse(localStorage.getItem('memorySettings') || '{}'); } catch { return {}; } })();
    const merged = { ...prev, enabled, top_k: topK, min_importance: minImportance, kinds, ...next } as any;
    setEnabled(!!merged.enabled);
    setTopK(Math.max(1, Math.min(20, Number(merged.top_k || 4))));
    localStorage.setItem('memorySettings', JSON.stringify(merged));
    try {
      const payload: any = { type: 'update-memory-settings' };
      if (typeof merged.enabled === 'boolean') payload.enabled = merged.enabled;
      if (typeof merged.top_k === 'number') payload.top_k = merged.top_k;
      if (typeof minImportance === 'number') payload.min_importance = minImportance;
      if (Array.isArray(kinds) && kinds.length) payload.kinds = kinds;
      sendMessage(payload);
    } catch {}
  }, [enabled, topK, minImportance, kinds, sendMessage]);

  const onClearCurrent = useCallback(() => sendMessage({ type: 'memory-clear', scope: 'current' }), [sendMessage]);
  const onClearAll = useCallback(() => {
    if (confirm('Очистить всю память?')) sendMessage({ type: 'memory-clear', scope: 'all' });
  }, [sendMessage]);

  const onSearch = useCallback(() => {
    sendMessage({ type: 'memory-search-grouped', query, top_k: topK, min_importance: minImportance, kinds });
  }, [sendMessage, query, topK, minImportance, kinds]);

  const onConsolidate = useCallback(() => {
    sendMessage({ type: 'memory-consolidate', reason: 'manual' });
  }, [sendMessage]);

  const fetchHistories = useCallback(() => {
    sendMessage({ type: 'fetch-history-list' });
  }, [sendMessage]);

  const toggleSelect = useCallback((uid: string) => {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }, []);

  const consolidateSelected = useCallback(() => {
    const limit = conLimit === '' ? undefined : Number(conLimit);
    Array.from(selectedUids).forEach(uid => {
      const payload: any = { type: 'memory-consolidate-history', history_uid: uid };
      if (typeof limit === 'number' && !isNaN(limit)) payload.limit_messages = limit;
      sendMessage(payload);
    });
  }, [selectedUids, conLimit, sendMessage]);

  const onListEmotions = useCallback(() => {
    setLastListKind('Emotions');
    sendMessage({ type: 'memory-list', limit: 100, kind: 'Emotions' });
  }, [sendMessage]);

  const onPrune = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const days = Number(pruneDays);
    const maxImp = pruneMaxImportance === '' ? undefined : Number(pruneMaxImportance);
    const max_age_ts = !isNaN(days) && days > 0 ? now - Math.floor(days * 86400) : undefined;
    const payload: any = { type: 'memory-prune' };
    if (typeof max_age_ts === 'number') payload.max_age_ts = max_age_ts;
    if (typeof maxImp === 'number' && !isNaN(maxImp)) payload.max_importance = maxImp;
    sendMessage(payload);
  }, [sendMessage, pruneDays, pruneMaxImportance]);

  const onDeleteMemory = useCallback((id?: string) => {
    if (!id) return;
    sendMessage({ type: 'memory-delete', ids: [id] });
    // Optimistic update
    setResults(prev => prev.filter(x => x.id !== id));
    setItems(prev => prev.filter(x => x.id !== id));
  }, [sendMessage]);

  // subscribe to ws messages to capture search results
  useMemo(() => wsService.onMessage((msg: any) => {
    if (msg?.type === 'memory-search-result') {
      const hits = Array.isArray(msg.hits) ? msg.hits : [];
      setResults(hits.map((h: any) => ({ id: h.id, text: h.text, score: h.score, kind: h.kind })));
    } else if (msg?.type === 'memory-search-grouped-result') {
      const groups = (msg.groups || msg.result || msg.items || msg) as Record<string, any[] | undefined>;
      const flat: Array<{ id?: string; text: string; score?: number; kind?: string }> = [];
      if (groups && typeof groups === 'object') {
        Object.entries(groups).forEach(([k, arr]) => {
          if (Array.isArray(arr)) {
            arr.forEach((x: any) => flat.push({ id: x.id, text: x.text, score: x.score, kind: k }));
          }
        });
      }
      setResults(flat);
    } else if (msg?.type === 'history-list') {
      const arr = Array.isArray(msg.histories) ? msg.histories : [];
      setHistories(arr.map((h: any) => ({
        uid: String(h.uid),
        latest_message: h.latest_message || null,
        timestamp: h.timestamp || null,
        consolidated: Boolean(h.consolidated),
        consolidated_ts: h.consolidated_ts || null,
      })));
      setSelectedUids(prev => new Set(Array.from(prev).filter(uid => arr.find((h: any) => String(h.uid) === uid))));
    } else if (msg?.type === 'memory-consolidate-history-result') {
      if (msg.ok && msg.history_uid) {
        setHistories(prev => prev.map(h => h.uid === msg.history_uid ? { ...h, consolidated: true, consolidated_ts: new Date().toISOString() } : h));
      }
    } else if (msg?.type === 'memory-list-result') {
      const arr = Array.isArray(msg.items) ? msg.items : [];
      if (lastListKind === 'Emotions') {
        setEmotionItems(arr.map((x: any) => ({ id: String(x.id || ''), text: String(x.text || '') })));
      } else {
        setItems(arr.map((x: any) => ({ id: String(x.id || ''), text: String(x.text || ''), kind: String(x.kind || '') })));
      }
    } else if (msg?.type === 'memory-list-grouped-result') {
      const groups = (msg.groups || msg.result || msg.items || msg) as Record<string, any[] | undefined>;
      const flat: Array<{ id: string; text: string; kind?: string }> = [];
      if (groups && typeof groups === 'object') {
        Object.entries(groups).forEach(([k, arr]) => {
          if (Array.isArray(arr)) {
            arr.forEach((x: any) => flat.push({ id: String(x.id || ''), text: String(x.text || ''), kind: k }));
          }
        });
      }
      setItems(flat);
    } else if (msg?.type === 'mood-updated') {
      // no-op
    }
  }), [lastListKind]);

  // subscribe moods
  useMemo(() => wsService.onMessage((msg: any) => {
    if (msg?.type === 'mood-list-result') {
      const arr = Array.isArray(msg.items) ? msg.items : [];
      setMoods(arr.map((x: any) => ({ user: String(x.user || ''), score: Number(x.score || 0), label: String(x.label || '') })));
    }
  }), []);

  const enableLabel = enabled ? 'On' : 'Off';
  const enableColor: any = enabled ? 'green' : 'red';

  return (
    <DrawerRoot open={open} onOpenChange={(e) => setOpen(e.open)} placement="start">
      <DrawerBackdrop />
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent style={sidebarStyles.historyDrawer.drawer.content}>
        <DrawerHeader>
          <DrawerTitle style={sidebarStyles.historyDrawer.drawer.title}>
            {t('settings.tabs.memory')}
          </DrawerTitle>
          <DrawerCloseTrigger style={sidebarStyles.historyDrawer.drawer.closeButton} />
        </DrawerHeader>
        <DrawerBody>
          {/* Overview header */}
          <Box display="flex" gap={2} mb={3} alignItems="center" flexWrap="nowrap" overflowX="auto">
            <Button size="sm" colorPalette={enableColor} variant="solid" onClick={() => apply({ enabled: !enabled })} title={`Memory ${enableLabel}`} flexShrink={0}>
              Память
            </Button>
            <Button size="sm" colorPalette="red" variant="solid" onClick={onClearCurrent} title="Очистить память текущей сессии" flexShrink={0}>Очистить чат</Button>
            <Button size="sm" colorPalette="red" variant="solid" onClick={onClearAll} title="Очистить всю базу памяти" flexShrink={0}>Очистить всё</Button>
          </Box>

          <Tabs.Root defaultValue="search">
            <Tabs.List mb={3}>
              <Tabs.Trigger value="search" title="Поиск и фильтры">Поиск</Tabs.Trigger>
              <Tabs.Trigger value="consolidation" title="Свести последние диалоги в структурированные записи">Консолидация</Tabs.Trigger>
              <Tabs.Trigger value="emotions" title="История эмоциональных записей">Эмоции</Tabs.Trigger>
              <Tabs.Trigger value="mood" title="Текущие значения настроения пользователей">Настроение</Tabs.Trigger>
              <Tabs.Trigger value="maintenance" title="Очистка устаревших/маловажных записей">Обслуживание</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="search">
              <Text mb={1} color="white">Поиск по долговременной памяти</Text>
              <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск в памяти" title="Строка поиска" maxW="420px" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                <Button onClick={onSearch} title="Искать по памяти" colorPalette="blue" variant="solid">Искать</Button>
                <Button onClick={() => { setLastListKind(undefined); sendMessage({ type: 'memory-list-grouped', limit: 50 }); }} title="Показать последние записи" colorPalette="green" variant="solid">Показать</Button>
                <Button onClick={() => setQuery('')} title="Очистить поле поиска" colorPalette="blue" variant="solid">Сброс</Button>
              </Box>
              <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
                <Box display="flex" gap={1} alignItems="center">
                  <Text fontSize="sm" color="white">Top‑K:</Text>
                  <Input type="number" width="80px" value={topK} min={1} max={20} step={1} onChange={(e) => apply({ top_k: Number(e.target.value) })} title="Количество релевантных фрагментов памяти" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                </Box>
                <Box display="flex" gap={1} alignItems="center">
                  <Text fontSize="sm" color="white">min importance:</Text>
                  <Input type="number" width="140px" value={minImportance ?? ''} onChange={(e) => setMinImportance(e.target.value === '' ? undefined : Number(e.target.value))} title="Минимальная важность записи [0..1]" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                </Box>
                <Box display="flex" gap={1} alignItems="center" flex={1} minW="220px">
                  <Text fontSize="sm" color="white">kinds:</Text>
                  <Input placeholder="comma-separated" value={kinds.join(',')} onChange={(e) => setKinds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} title="Ограничить видами записей (через запятую)" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                </Box>
                <Button onClick={() => apply({})} title="Применить фильтры к выборке" colorPalette="blue" variant="solid">Применить фильтры</Button>
              </Box>
              <Box mt={2} display="flex" gap={3} flexWrap="wrap">
                {kindsList.map(k => {
                  const active = kinds.includes(k);
                  return (
                    <Button key={k} size="xs" color="white" colorPalette={active ? 'blue' : 'gray'} variant={active ? 'solid' : 'outline'} onClick={() => {
                      const next = active ? kinds.filter(x => x !== k) : Array.from(new Set([...kinds, k]));
                      setKinds(next);
                    }} title={kindDescriptions[k]}>{kindLabels[k]}</Button>
                  );
                })}
              </Box>
              {/* Группировка результатов поиска по типам */}
              <Box mt={3} display="flex" flexDir="column" gap={2}>
                {Object.entries(
                  results.reduce((acc: Record<string, typeof results>, r) => {
                    const k = String(r.kind || 'Other');
                    (acc[k] ||= []).push(r);
                    return acc;
                  }, {})
                ).map(([k, arr]) => (
                  <Box key={k}>
                    <Box mb={1} fontSize="sm" color="whiteAlpha.800" title={descForKind(k)}>
                      {labelForKind(k)}
                    </Box>
                    <Box display="flex" flexDir="column" gap={1}>
                      {arr.map((r, i) => (
                        <Box key={r.id || `${k}-${i}`} p={2} bg="whiteAlpha.100" borderRadius="md" color="white" display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                          <Box flex={1}>{r.text}</Box>
                          {r.id && (
                            <Button size="xs" colorPalette="red" variant="solid" onClick={() => onDeleteMemory(r.id)} title="Удалить эту запись">Del</Button>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Группировка списка памяти по типам */}
              {items.length > 0 && (
                <Box mt={4}>
                  {Object.entries(
                    items.reduce((acc: Record<string, typeof items>, it) => {
                      const k = String(it.kind || 'Other');
                      (acc[k] ||= []).push(it);
                      return acc;
                    }, {})
                  ).map(([k, arr]) => (
                    <Box key={k} mt={3}>
                      <Box mb={1} fontSize="sm" color="whiteAlpha.800" title={descForKind(k)}>
                        {labelForKind(k)}
                      </Box>
                      <Box display="flex" flexDir="column" gap={1}>
                        {arr.map((it) => (
                          <Box key={it.id} p={2} bg="whiteAlpha.50" borderRadius="md" color="white" display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                            <Box flex={1}>{it.text}</Box>
                            {it.id && (
                              <Button size="xs" colorPalette="red" variant="outline" onClick={() => onDeleteMemory(it.id)} title="Удалить эту запись">Del</Button>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Tabs.Content>

            <Tabs.Content value="consolidation">
              <Text mb={2} color="white">Свести последние сообщения в структурированные факты/события/эмоции</Text>
              <Button onClick={onConsolidate} title="Запустить свёртку последних сообщений в память" colorPalette="blue" variant="solid">Запустить консолидацию</Button>
              <Box mt={4}>
                <Text mb={2} color="white">Консолидация выбранных диалогов</Text>
                <Box display="flex" gap={2} alignItems="center" flexWrap="wrap" mb={2}>
                  <Button size="sm" onClick={fetchHistories} colorPalette="blue" variant="solid" title="Обновить список диалогов">Обновить список</Button>
                  <Input placeholder="limit messages (optional)" width="200px" value={conLimit} onChange={(e) => setConLimit(e.target.value)} title="Ограничение последних сообщений для свёртки" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                  <Button size="sm" onClick={consolidateSelected} colorPalette="green" variant="solid" title="Свёртка выбранных">Консолидировать выбранные</Button>
                </Box>
                <Box display="flex" flexDir="column" gap={1} maxH="240px" overflowY="auto">
                  {histories.map(h => (
                    <Box key={h.uid} p={2} bg="whiteAlpha.50" borderRadius="md" color="white" display="flex" alignItems="center" justifyContent="space-between" gap={2}>
                      <Box display="flex" alignItems="center" gap={2} flex={1}>
                        <Checkbox.Root checked={selectedUids.has(h.uid)} onCheckedChange={() => toggleSelect(h.uid)}>
                          <Checkbox.Control />
                        </Checkbox.Root>
                        <Box>
                          <Box fontSize="sm">{h.uid}</Box>
                          <Box fontSize="xs" color="whiteAlpha.700">{h.latest_message?.content?.slice(0, 80) || '—'}</Box>
                        </Box>
                      </Box>
                      <Box fontSize="xs" color={h.consolidated ? 'green.300' : 'whiteAlpha.700'}>
                        {h.consolidated ? `consolidated${h.consolidated_ts ? ` @ ${h.consolidated_ts}` : ''}` : 'not consolidated'}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Tabs.Content>

            <Tabs.Content value="emotions">
              <Button size="sm" onClick={onListEmotions} title="Показать эмоциональные записи" colorPalette="blue" variant="solid">Показать эмоции</Button>
              <Box mt={2} display="flex" flexDir="column" gap={1}>
                {emotionItems.map((it) => (
                  <Box key={it.id} p={2} bg="whiteAlpha.50" borderRadius="md" color="white">{it.text}</Box>
                ))}
              </Box>
            </Tabs.Content>

            <Tabs.Content value="mood">
              <Box display="flex" gap={2} mb={2} flexWrap="wrap">
                <Button size="sm" onClick={() => sendMessage({ type: 'mood-list' })} title="Обновить список настроений" colorPalette="blue" variant="solid">Показать настроения</Button>
                <Button size="sm" colorPalette="red" variant="solid" onClick={() => sendMessage({ type: 'mood-reset' })} title="Сбросить все значения настроения">Сбросить всё</Button>
              </Box>
              <Box display="flex" gap={2} mb={2} flexWrap="wrap">
                <Input placeholder="user" value={moodUser} onChange={(e) => setMoodUser(e.target.value)} width="160px" title="Имя пользователя" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                <Input placeholder="score [-10..10]" value={moodScore} onChange={(e) => setMoodScore(e.target.value)} width="160px" title="Значение [-10..10]" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                <Button size="sm" colorPalette="green" variant="solid" onClick={() => {
                  const raw = Number(moodScore);
                  const scaled = isNaN(raw) ? undefined : Math.max(-1, Math.min(1, raw / 10));
                  if (scaled === undefined) return;
                  sendMessage({ type: 'mood-set', user: moodUser, score: scaled });
                }} title="Установить значение">Установить</Button>
                <Button size="sm" colorPalette="red" variant="solid" onClick={() => sendMessage({ type: 'mood-reset', user: moodUser })} title="Сбросить значение">Сброс</Button>
              </Box>
              <Box display="flex" flexDir="column" gap={1}>
                {moods.map((m) => (
                  <Box key={m.user} p={2} bg="whiteAlpha.50" borderRadius="md" color="white">
                    {m.user}: {m.label} ({m.score.toFixed(2)})
                  </Box>
                ))}
              </Box>
            </Tabs.Content>

            <Tabs.Content value="maintenance">
              <Text mb={2} color="white">Удаление старых/маловажных записей</Text>
              <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <Input placeholder="prune: days" width="140px" value={pruneDays} onChange={(e) => setPruneDays(e.target.value)} title="Удалить записи старше N дней" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                <Input placeholder="max importance" width="160px" value={pruneMaxImportance} onChange={(e) => setPruneMaxImportance(e.target.value)} title="Удалить записи с важностью ниже порога" color="white" _placeholder={{ color: 'whiteAlpha.700' }} />
                <Button size="sm" colorPalette="orange" variant="solid" onClick={onPrune} title="Выполнить очистку">Очистить</Button>
              </Box>

              <Box mt={5}>
                <Text mb={2} color="white">Add memory (ручное добавление записи)</Text>
                <Box display="flex" flexDir="column" gap={2}>
                  <Input placeholder="text" value={memText} onChange={(e) => setMemText(e.target.value)} _placeholder={{ color: 'whiteAlpha.700' }} title="Текст записи" color="white" />
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Input placeholder="kind (e.g. FactsAboutUser)" value={memKind} onChange={(e) => setMemKind(e.target.value)} width="240px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="user_id (Twitch:Igor)" value={memUserId} onChange={(e) => setMemUserId(e.target.value)} width="240px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="platform (Twitch/Local)" value={memPlatform} onChange={(e) => setMemPlatform(e.target.value)} width="200px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="category (emotion/...)" value={memCategory} onChange={(e) => setMemCategory(e.target.value)} width="200px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                  </Box>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <Input placeholder="topics (comma)" value={memTopics} onChange={(e) => setMemTopics(e.target.value)} width="260px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="tags (comma)" value={memTags} onChange={(e) => setMemTags(e.target.value)} width="240px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="importance [0..1]" value={memImportance} onChange={(e) => setMemImportance(e.target.value)} width="180px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="emotion_score [-1..1]" value={memEmotion} onChange={(e) => setMemEmotion(e.target.value)} width="200px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                    <Input placeholder="timestamp (ISO или epoch)" value={memTimestamp} onChange={(e) => setMemTimestamp(e.target.value)} width="260px" _placeholder={{ color: 'whiteAlpha.700' }} color="white" />
                  </Box>
                  <Box display="flex" gap={2}>
                    <Button size="sm" colorPalette="green" variant="solid" onClick={onAddMemory} title="Сохранить запись">Сохранить</Button>
                    <Button size="sm" colorPalette="red" variant="solid" onClick={() => { setMemText(''); setMemUserId(''); setMemPlatform(''); setMemCategory(''); setMemTopics(''); setMemTags(''); setMemImportance(''); setMemEmotion(''); setMemTimestamp(''); }} title="Очистить форму">Сброс</Button>
                  </Box>
                </Box>
              </Box>
            </Tabs.Content>
          </Tabs.Root>
        </DrawerBody>
        <DrawerFooter>
          <DrawerActionTrigger asChild>
            <Button>{t('common.close')}</Button>
          </DrawerActionTrigger>
        </DrawerFooter>
      </DrawerContent>
    </DrawerRoot>
  );
}

export default MemoryDrawer;