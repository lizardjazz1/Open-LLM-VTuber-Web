/* eslint-disable import/no-extraneous-dependencies */
import {
  Tabs,
  Button,
  DrawerRoot,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerBackdrop,
  DrawerCloseTrigger,
} from '@chakra-ui/react';
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseButton } from '@/components/ui/close-button';
import { logAction } from '@/services/clientLogger';

import { settingStyles } from './setting-styles';
import General from './general';
import Live2D from './live2d';
import ASR from './asr';
import TTS from './tts';
import Agent from './agent';
import About from './about';
import Sampling from './sampling';

interface SettingUIProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}

function SettingUI({ open, onClose }: SettingUIProps): JSX.Element {
  const { t } = useTranslation();
  const [saveHandlers, setSaveHandlers] = useState<(() => void)[]>([]);
  const [cancelHandlers, setCancelHandlers] = useState<(() => void)[]>([]);
  const [activeTab, setActiveTab] = useState('general');

  const handleSaveCallback = useCallback((handler: () => void) => {
    setSaveHandlers((prev) => [...prev, handler]);
    return (): void => {
      setSaveHandlers((prev) => prev.filter((h) => h !== handler));
    };
  }, []);

  const handleCancelCallback = useCallback((handler: () => void) => {
    setCancelHandlers((prev) => [...prev, handler]);
    return (): void => {
      setCancelHandlers((prev) => prev.filter((h) => h !== handler));
    };
  }, []);

  const handleSave = useCallback((): void => {
    logAction('settings.click', 'save');
    saveHandlers.forEach((handler) => handler());
    onClose();
  }, [saveHandlers, onClose]);

  const handleCancel = useCallback((): void => {
    logAction('settings.click', 'cancel');
    cancelHandlers.forEach((handler) => handler());
    onClose();
  }, [cancelHandlers, onClose]);

  const tabsContent = useMemo(
    () => (
      <Tabs.ContentGroup>
        <Tabs.Content value="general" {...settingStyles.settingUI.tabs.content}>
          <General
            onSave={handleSaveCallback}
            onCancel={handleCancelCallback}
          />
        </Tabs.Content>
        <Tabs.Content value="live2d" {...settingStyles.settingUI.tabs.content}>
          <Live2D
            onSave={handleSaveCallback}
            onCancel={handleCancelCallback}
          />
        </Tabs.Content>
        <Tabs.Content value="asr" {...settingStyles.settingUI.tabs.content}>
          <ASR onSave={handleSaveCallback} onCancel={handleCancelCallback} />
        </Tabs.Content>
        <Tabs.Content value="tts" {...settingStyles.settingUI.tabs.content}>
          <TTS />
        </Tabs.Content>
        <Tabs.Content value="agent" {...settingStyles.settingUI.tabs.content}>
          <Agent
            onSave={handleSaveCallback}
            onCancel={handleCancelCallback}
          />
        </Tabs.Content>
        <Tabs.Content value="sampling" {...settingStyles.settingUI.tabs.content}>
          <Sampling />
        </Tabs.Content>
        <Tabs.Content value="about" {...settingStyles.settingUI.tabs.content}>
          <About />
        </Tabs.Content>
      </Tabs.ContentGroup>
    ),
    [handleSaveCallback, handleCancelCallback],
  );

  return (
    <DrawerRoot
      open={open}
      onOpenChange={(e) => (e.open ? null : onClose())}
      placement="start"
    >
      <DrawerBackdrop />
      <DrawerContent {...settingStyles.settingUI.drawerContent}>
        <DrawerHeader {...settingStyles.settingUI.drawerHeader}>
          <DrawerTitle {...settingStyles.settingUI.drawerTitle}>
            {t('common.settings')}
          </DrawerTitle>
          <div {...settingStyles.settingUI.closeButton}>
            <DrawerCloseTrigger asChild onClick={handleCancel}>
              <CloseButton size="sm" color="white" />
            </DrawerCloseTrigger>
          </div>
        </DrawerHeader>

        <DrawerBody>
          <Tabs.Root
            defaultValue="general"
            value={activeTab}
            onValueChange={(details) => { setActiveTab(details.value); logAction('settings.tab', 'switch', { to: details.value }); }}
            {...settingStyles.settingUI.tabs.root}
          >
            <Tabs.List {...settingStyles.settingUI.tabs.list}>
              <Tabs.Trigger
                value="general"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.general')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="live2d"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.live2d')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="asr"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.asr')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="tts"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.tts')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="agent"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.agent')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="sampling"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.sampling')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="about"
                {...settingStyles.settingUI.tabs.trigger}
              >
                {t('settings.tabs.about')}
              </Tabs.Trigger>
            </Tabs.List>

            {tabsContent}
          </Tabs.Root>
        </DrawerBody>

        <DrawerFooter>
          <Button colorPalette="red" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button colorPalette="blue" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </DrawerRoot>
  );
}

export default SettingUI;
