/* eslint-disable no-shadow */
import { useRef, useState } from 'react';
import { useCamera } from '@/context/camera-context';
import { logAction, logError } from '@/services/clientLogger';

export const useCameraPanel = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>('');
  const [isHovering, setIsHovering] = useState(false);
  const {
    isStreaming, stream, startCamera, stopCamera,
  } = useCamera();

  const toggleCamera = async (): Promise<void> => {
    try {
      if (isStreaming) {
        await logAction('ui.click', 'camera.stop');
        stopCamera();
      } else {
        await logAction('ui.click', 'camera.start');
        await startCamera();
      }
      setError('');
    } catch (error) {
      let errorMessage = 'Unable to access camera';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      setError(errorMessage);
      logError('camera.toggle.failed', { error: errorMessage });
    }
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  return {
    videoRef,
    error,
    isHovering,
    isStreaming,
    stream,
    toggleCamera,
    handleMouseEnter,
    handleMouseLeave,
  };
};
