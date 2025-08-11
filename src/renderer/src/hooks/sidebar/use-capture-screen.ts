import { useRef, useState, useEffect } from 'react';
import { useScreenCaptureContext } from '@/context/screen-capture-context';
import { logAction, logError } from '@/services/clientLogger';

export function useCaptureScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const { stream, isStreaming, error, startCapture, stopCapture } = useScreenCaptureContext();

  const toggleCapture = async () => {
    try {
      if (isStreaming) {
        await logAction('ui.click', 'screen.stop');
        stopCapture();
      } else {
        await logAction('ui.click', 'screen.start');
        startCapture();
      }
    } catch (e) {
      logError('screen.toggle.failed', { error: String(e) });
    }
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  useEffect(() => {
    if (videoRef.current) {
      (videoRef.current as any).srcObject = stream as any;
    }
  }, [stream]);

  return {
    videoRef,
    error,
    isHovering,
    isStreaming,
    stream,
    toggleCapture,
    handleMouseEnter,
    handleMouseLeave,
  };
}
