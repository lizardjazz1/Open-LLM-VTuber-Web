import { Box, Text, Badge, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@/context/character-config-context';

function TTS(): JSX.Element {
  const { t } = useTranslation();
  const { ttsInfo } = useConfig();

  return (
    <VStack align="start" gap={3}>
      <Text fontSize="sm" color="whiteAlpha.800">
        {t('settings.tts.currentEngine')}
      </Text>
      <Badge colorPalette="blue" size="lg">
        {ttsInfo?.model || t('settings.tts.unknown')}
      </Badge>
      <Box fontSize="sm" color="whiteAlpha.700">
        {t('settings.tts.note')}
      </Box>
    </VStack>
  );
}

export default TTS;
