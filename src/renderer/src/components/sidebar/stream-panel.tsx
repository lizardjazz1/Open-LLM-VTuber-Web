import { Box, Text, Badge, VStack, HStack } from '@chakra-ui/react';
import { useTwitch } from '@/context/twitch-context';

export default function StreamPanel(): JSX.Element {
  const { status, messages } = useTwitch();

  return (
    <VStack align="start" gap={3} maxH={{ base: '60vh', md: '75vh' }} overflowY="auto" w="100%">
      <HStack gap={3} align="center">
        <Text fontSize="sm">Twitch</Text>
        <Badge colorPalette={status.connected ? 'green' : 'yellow'}>
          {status.connected ? 'Connected' : 'Disconnected'}
        </Badge>
        {status.channel && (
          <Badge colorPalette="blue">#{status.channel}</Badge>
        )}
      </HStack>
      <Box w="100%" fontSize="sm" color="whiteAlpha.800">
        {messages.map((m: any, idx: number) => (
          <Box key={`${idx}-${m.timestamp || ''}`} mb={2}>
            <Text as="span" color="whiteAlpha.600">[{m.timestamp?.slice(11,19) || ''}]</Text>{' '}
            <Text as="span" fontWeight="semibold">{m.user}:</Text>{' '}
            <Text as="span">{m.text}</Text>
          </Box>
        ))}
        {messages.length === 0 && (
          <Text color="whiteAlpha.500">No messages yet</Text>
        )}
      </Box>
    </VStack>
  );
} 