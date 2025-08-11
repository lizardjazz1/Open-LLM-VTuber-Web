/* eslint-disable import/no-extraneous-dependencies */
import { useTranslation } from "react-i18next";
import { Stack, createListCollection } from "@chakra-ui/react";
import { useBgUrl } from "@/context/bgurl-context";
import { settingStyles } from "./setting-styles";
import { useConfig } from "@/context/character-config-context";
import { useGeneralSettings } from "@/hooks/sidebar/setting/use-general-settings";
import { useWebSocket } from "@/context/websocket-context";
import { SelectField, SwitchField, InputField } from "./common";
import { logAction } from "@/services/clientLogger";

interface GeneralProps {
  onSave?: (callback: () => void) => () => void;
  onCancel?: (callback: () => void) => () => void;
}

// Data collection definition
const useCollections = () => {
  const { backgroundFiles } = useBgUrl() || {};
  const { configFiles } = useConfig();

  const languages = createListCollection({
    items: [
      { label: "English", value: "en" },
      { label: "中文", value: "zh" },
      { label: "Русский", value: "ru" },
    ],
  });

  const backgrounds = createListCollection({
    items:
      backgroundFiles?.map((filename) => ({
        label: String(filename),
        value: `/bg/${filename}`,
      })) || [],
  });

  const characterPresets = createListCollection({
    items: configFiles.map((config) => ({
      label: config.name,
      value: config.filename,
    })),
  });

  return {
    languages,
    backgrounds,
    characterPresets,
  };
};

function General({ onSave, onCancel }: GeneralProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const bgUrlContext = useBgUrl();
  const { confName, setConfName } = useConfig();
  const { wsUrl, setWsUrl, baseUrl, setBaseUrl } = useWebSocket();
  const collections = useCollections();

  const {
    settings,
    handleSettingChange,
    handleCameraToggle,
    handleCharacterPresetChange,
    showSubtitle,
    setShowSubtitle,
  } = useGeneralSettings({
    bgUrlContext,
    confName,
    setConfName,
    baseUrl,
    wsUrl,
    onWsUrlChange: setWsUrl,
    onBaseUrlChange: setBaseUrl,
    onSave,
    onCancel,
  });

  if (settings.language[0] !== i18n.language) {
    handleSettingChange("language", [i18n.language]);
  }

  return (
    <Stack {...settingStyles.common.container}>
      <SelectField
        label={t("settings.general.language")}
        value={settings.language}
        onChange={(value) => { handleSettingChange("language", value); logAction('settings.change', 'general.language', { value }); }}
        collection={collections.languages}
        placeholder={t("settings.general.language")}
      />

      <SwitchField
        label={t("settings.general.useCameraBackground")}
        checked={settings.useCameraBackground}
        onChange={(v) => { handleCameraToggle(v); logAction('settings.change', 'general.useCameraBackground', { value: v }); }}
      />

      <SwitchField
        label={t("settings.general.showSubtitle")}
        checked={showSubtitle}
        onChange={(v) => { setShowSubtitle(v); logAction('settings.change', 'general.showSubtitle', { value: v }); }}
      />

      <SwitchField
        label={t('settings.general.enableFrontendErrorLogging')}
        checked={settings.enableFrontendErrorLogging}
        onChange={(checked: boolean) => { handleSettingChange('enableFrontendErrorLogging', checked); logAction('settings.change', 'general.enableFrontendErrorLogging', { value: checked }); }}
      />

      {!settings.useCameraBackground && (
        <>
          <SelectField
            label={t("settings.general.backgroundImage")}
            value={settings.selectedBgUrl}
            onChange={(value) => { handleSettingChange("selectedBgUrl", value); logAction('settings.change', 'general.selectedBgUrl', { value }); }}
            collection={collections.backgrounds}
            placeholder={t("settings.general.backgroundImage")}
          />

          <InputField
            label={t("settings.general.customBgUrl")}
            value={settings.customBgUrl}
            onChange={(value) => { handleSettingChange("customBgUrl", value); logAction('settings.change', 'general.customBgUrl'); }}
            placeholder={t("settings.general.customBgUrlPlaceholder")}
          />
        </>
      )}

      <SelectField
        label={t("settings.general.characterPreset")}
        value={settings.selectedCharacterPreset}
        onChange={(v) => { handleCharacterPresetChange(v); logAction('settings.change', 'general.characterPreset', { value: v }); }}
        collection={collections.characterPresets}
        placeholder={confName || t("settings.general.characterPreset")}
      />

      <InputField
        label={t("settings.general.wsUrl")}
        value={settings.wsUrl}
        onChange={(value) => { handleSettingChange("wsUrl", value); logAction('settings.change', 'general.wsUrl'); }}
        placeholder="Enter WebSocket URL"
      />

      <InputField
        label={t("settings.general.baseUrl")}
        value={settings.baseUrl}
        onChange={(value) => { handleSettingChange("baseUrl", value); logAction('settings.change', 'general.baseUrl'); }}
        placeholder="Enter Base URL"
      />

      <InputField
        label={t("settings.general.imageCompressionQuality")}
        value={settings.imageCompressionQuality.toString()}
        onChange={(value) => {
          const quality = parseFloat(value as string);
          if (!Number.isNaN(quality) && quality >= 0.1 && quality <= 1.0) {
            handleSettingChange("imageCompressionQuality", quality);
            logAction('settings.change', 'general.imageCompressionQuality', { value: quality });
          } else if (value === "") {
            handleSettingChange("imageCompressionQuality", settings.imageCompressionQuality);
          }
        }}
      />

      <InputField
        label={t("settings.general.imageMaxWidth")}
        value={settings.imageMaxWidth.toString()}
        onChange={(value) => {
          const maxWidth = parseInt(value as string, 10);
          if (!Number.isNaN(maxWidth) && maxWidth > 0) {
            handleSettingChange("imageMaxWidth", maxWidth);
            logAction('settings.change', 'general.imageMaxWidth', { value: maxWidth });
          } else if (value === "") {
            handleSettingChange("imageMaxWidth", settings.imageMaxWidth);
          }
        }}
      />
    </Stack>
  );
}

export default General;
