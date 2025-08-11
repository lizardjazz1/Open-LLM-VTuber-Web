/* eslint-disable */
import { Tabs, Box } from '@chakra-ui/react'
import { FiCamera, FiMonitor, FiGlobe, FiCast } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { sidebarStyles } from './sidebar-styles'
import CameraPanel from './camera-panel'
import ScreenPanel from './screen-panel'
import BrowserPanel from './browser-panel'
import StreamPanel from './stream-panel'
import React, { useCallback, useEffect, useRef, useState } from 'react'

function BottomTab(): JSX.Element {
  const { t } = useTranslation();

  // Resizable height state (pixels)
  const [heightPx, setHeightPx] = useState<number>(520)
  const isDraggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHRef = useRef(0)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return
    const dy = e.clientY - startYRef.current
    const next = Math.min(
      Math.max(startHRef.current - dy, 220),
      Math.floor(window.innerHeight * 0.85)
    )
    setHeightPx(next)
    e.preventDefault()
  }, [])

  const onMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const onStartDrag = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true
    startYRef.current = e.clientY
    startHRef.current = heightPx
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [heightPx])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])
  
  return (
    <Box position="relative" height={`${heightPx}px`} width="97%" px={4} pt={3} zIndex={0} colorPalette="gray" maxH="calc(100vh - 240px)" overflowY="auto">
      {/* Drag handle on top edge */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h="10px"
        cursor="ns-resize"
        onMouseDown={onStartDrag}
        _before={{
          content: '""',
          position: 'absolute',
          left: '40px',
          right: '40px',
          top: '1px',
          height: '6px',
          borderRadius: 'full',
          bg: 'whiteAlpha.300',
          _hover: { bg: 'whiteAlpha.500' },
        }}
      />

      <Tabs.Root 
        defaultValue="camera" 
        variant="plain"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Tabs.List {...sidebarStyles.bottomTab.list}>
          <Tabs.Trigger value="camera" {...sidebarStyles.bottomTab.trigger}>
            <FiCamera />
            {t('sidebar.camera')}
          </Tabs.Trigger>
          <Tabs.Trigger value="screen" {...sidebarStyles.bottomTab.trigger}>
            <FiMonitor />
            {t('sidebar.screen')}
          </Tabs.Trigger>
          <Tabs.Trigger value="browser" {...sidebarStyles.bottomTab.trigger}>
            <FiGlobe />
            {t('sidebar.browser')}
          </Tabs.Trigger>
          <Tabs.Trigger value="stream" {...sidebarStyles.bottomTab.trigger}>
            <FiCast />
            {t('sidebar.stream') || 'Stream'}
          </Tabs.Trigger>
        </Tabs.List>

        <Box flex="1 1 auto" overflow="auto">
          <Tabs.Content value="camera">
            <CameraPanel />
          </Tabs.Content>
          
          <Tabs.Content value="screen">
            <ScreenPanel />
          </Tabs.Content>
          
          <Tabs.Content value="browser">
            <BrowserPanel />
          </Tabs.Content>
          <Tabs.Content value="stream">
            <StreamPanel />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Box>
  );
}

export default BottomTab
