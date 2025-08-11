/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-use-before-define */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import { useEffect, useRef, useCallback, useState, RefObject } from "react";
import { ModelInfo } from "@/context/live2d-config-context";
import { updateModelConfig } from '../../../WebSDK/src/lappdefine';
import { LAppDelegate } from '../../../WebSDK/src/lappdelegate';
import { initializeLive2D } from '@cubismsdksamples/main';
import { useMode } from '@/context/mode-context';

interface UseLive2DModelProps {
  modelInfo: ModelInfo | undefined;
  canvasRef: RefObject<HTMLCanvasElement>;
}

interface Position {
  x: number;
  y: number;
}

// Thresholds for tap vs drag detection
const TAP_DURATION_THRESHOLD_MS = 200; // Max duration for a tap
const DRAG_DISTANCE_THRESHOLD_PX = 5; // Min distance to be considered a drag

function parseModelUrl(url: string): { baseUrl: string; modelDir: string; modelFileName: string } {
  try {
    const urlObj = new URL(url);
    const { pathname } = urlObj;

    const lastSlashIndex = pathname.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    const fullFileName = pathname.substring(lastSlashIndex + 1);
    const modelFileName = fullFileName.replace('.model3.json', '');

    const secondLastSlashIndex = pathname.lastIndexOf('/', lastSlashIndex - 1);
    if (secondLastSlashIndex === -1) {
      throw new Error('Invalid model URL format');
    }

    const modelDir = pathname.substring(secondLastSlashIndex + 1, lastSlashIndex);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}${pathname.substring(0, secondLastSlashIndex + 1)}`;

    return { baseUrl, modelDir, modelFileName };
  } catch (error) {
    console.error('Error parsing model URL:', error);
    return { baseUrl: '', modelDir: '', modelFileName: '' };
  }
}

export const playAudioWithLipSync = (audioPath: string, modelIndex = 0): Promise<void> => new Promise((resolve, reject) => {
  const live2dManager = window.LAppLive2DManager?.getInstance();
  if (!live2dManager) {
    reject(new Error('Live2D manager not initialized'));
    return;
  }

  const fullPath = `/Resources/${audioPath}`;
  const audio = new Audio(fullPath);

  audio.addEventListener('canplaythrough', () => {
    const model = live2dManager.getModel(modelIndex);
    if (model) {
      if (model._wavFileHandler) {
        model._wavFileHandler.start(fullPath);
        audio.play();
      } else {
        reject(new Error('Wav file handler not available on model'));
      }
    } else {
      reject(new Error(`Model index ${modelIndex} not found`));
    }
  });

  audio.addEventListener('ended', () => {
    resolve();
  });

  audio.addEventListener('error', () => {
    reject(new Error(`Failed to load audio: ${fullPath}`));
  });

  audio.load();
});

export const useLive2DModel = ({
  modelInfo,
  canvasRef,
}: UseLive2DModelProps) => {
  const { mode } = useMode();
  const isPet = mode === 'pet';
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const dragStartPos = useRef<Position>({ x: 0, y: 0 }); // Screen coordinates at drag start
  const modelStartPos = useRef<Position>({ x: 0, y: 0 }); // Model coordinates at drag start
  const modelPositionRef = useRef<Position>({ x: 0, y: 0 });
  const prevModelUrlRef = useRef<string | null>(null);
  const isHoveringModelRef = useRef(false);
  const electronApi = (window as any).electron;

  // Track deferred init attempts
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initAttemptsRef = useRef<number>(0);

  const tryInitializeWhenReady = useCallback((initKey: string) => {
    const MAX_ATTEMPTS = 40; // ~4s total if 100ms interval
    const INTERVAL_MS = 100;

    const attempt = () => {
      if (canvasRef.current) {
        (window as any).__L2D_INIT_KEY__ = initKey;
        initializeLive2D();
        return;
      }
      if (initAttemptsRef.current >= MAX_ATTEMPTS) {
        console.warn('[Live2D] Canvas not ready after waiting, skipping init for now');
        return;
      }
      initAttemptsRef.current += 1;
      initTimerRef.current = setTimeout(attempt, INTERVAL_MS);
    };

    // Start attempts
    // Reset previous schedule if any
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
    initAttemptsRef.current = 0;
    attempt();
  }, [canvasRef]);

  // --- State for Tap vs Drag ---
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef<Position>({ x: 0, y: 0 }); // Screen coords at mousedown
  const isPotentialTapRef = useRef<boolean>(false); // Flag for ongoing potential tap/drag action
  // ---

  useEffect(() => {
    const currentUrl = modelInfo?.url;
    const sdkScale = (window as any).LAppDefine?.CurrentKScale;
    const modelScale = modelInfo?.kScale !== undefined ? Number(modelInfo.kScale) : undefined;

    const needsUpdate = currentUrl &&
                        (currentUrl !== prevModelUrlRef.current ||
                         (sdkScale !== undefined && modelScale !== undefined && sdkScale !== modelScale));

    if (!needsUpdate) return;

    prevModelUrlRef.current = currentUrl!;

    try {
      const { baseUrl, modelDir, modelFileName } = parseModelUrl(currentUrl!);

      if (!(baseUrl && modelDir && modelFileName)) return;

      // Apply model configuration
      updateModelConfig(baseUrl, modelDir, modelFileName, Number(modelInfo?.kScale));

      // One-shot init when both config and canvas are ready
      const initKey = `${baseUrl}|${modelDir}|${modelFileName}`;
      const initializedForUrlRef = (window as any).__L2D_INIT_KEY__ as string | undefined;

      if (initializedForUrlRef !== initKey) {
        if (canvasRef.current) {
          (window as any).__L2D_INIT_KEY__ = initKey;
          initializeLive2D();
        } else {
          // Defer until canvas mounts
          tryInitializeWhenReady(initKey);
        }
      }
    } catch (error) {
      console.error('Error processing model URL:', error);
    }
  }, [modelInfo?.url, modelInfo?.kScale, canvasRef.current, tryInitializeWhenReady]);

  // Ensure init if confUid+modelInfo are present and canvas exists (one-shot safety)
  useEffect(() => {
    const currentUrl = modelInfo?.url;
    if (!currentUrl || !(window as any).LAppDefine) return;
    const initDone = (window as any).__L2D_INIT_DONE__;
    if (canvasRef.current && !initDone) {
      try {
        const { baseUrl, modelDir, modelFileName } = parseModelUrl(currentUrl);
        if (baseUrl && modelDir && modelFileName) {
          const initKey = `${baseUrl}|${modelDir}|${modelFileName}`;
          tryInitializeWhenReady(initKey);
        }
      } catch (_) {}
    }
  }, [modelInfo?.url, canvasRef.current, tryInitializeWhenReady]);

  // Cleanup pending timers on unmount
  useEffect(() => () => {
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
  }, []);

  const getModelPosition = useCallback(() => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        return {
          x: matrix[12],
          y: matrix[13],
        };
      }
    }
    return { x: 0, y: 0 };
  }, []);

  const setModelPosition = useCallback((x: number, y: number) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (adapter) {
      const model = adapter.getModel();
      if (model && model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();

        const newMatrix = [...matrix];
        newMatrix[12] = x;
        newMatrix[13] = y;

        model._modelMatrix.setMatrix(newMatrix);
        modelPositionRef.current = { x, y };
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentPos = getModelPosition();
      modelPositionRef.current = currentPos;
      setPosition(currentPos);
    }, 500);

    return () => clearTimeout(timer);
  }, [modelInfo?.url, getModelPosition]);

  const getCanvasScale = useCallback(() => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) return { width: 1, height: 1, scale: 1 };

    const { width } = canvas;
    const { height } = canvas;
    const scale = width / canvas.clientWidth;

    return { width, height, scale };
  }, []);

  const screenToModelPosition = useCallback((screenX: number, screenY: number) => {
    const { width, height, scale } = getCanvasScale();

    const x = ((screenX * scale) / width) * 2 - 1;
    const y = -((screenY * scale) / height) * 2 + 1;

    return { x, y };
  }, [getCanvasScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    if (!adapter || !canvasRef.current) return;

    const model = adapter.getModel();
    const view = LAppDelegate.getInstance().getView();
    if (!view || !model) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left; // Screen X relative to canvas
    const y = e.clientY - rect.top; // Screen Y relative to canvas

    // --- Check if click is on model ---
    if (!view._deviceToScreen) return;
    const scale = canvas.width / canvas.clientWidth;
    const scaledX = x * scale;
    const scaledY = y * scale;
    const modelX = view._deviceToScreen.transformX(scaledX);
    const modelY = view._deviceToScreen.transformY(scaledY);

    if (!model.anyhitTest || !model.isHitOnModel) return;
    const hitAreaName = model.anyhitTest(modelX, modelY);
    const isHitOnModel = model.isHitOnModel(modelX, modelY);
    // --- End Check ---

    if (hitAreaName !== null || isHitOnModel) {
      // Record potential tap/drag start
      mouseDownTimeRef.current = Date.now();
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY }; // Use clientX/Y for distance check
      isPotentialTapRef.current = true;
      setIsDragging(false); // Ensure dragging is false initially

      // Store initial model position IF drag starts later
      if (model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        modelStartPos.current = { x: matrix[12], y: matrix[13] };
      }
    }
  }, [canvasRef, modelInfo]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    const view = LAppDelegate.getInstance().getView();
    const model = adapter?.getModel();

    // --- Start Drag Logic ---
    if (isPotentialTapRef.current && adapter && view && model && canvasRef.current) {
      const timeElapsed = Date.now() - mouseDownTimeRef.current;
      const deltaX = e.clientX - mouseDownPosRef.current.x;
      const deltaY = e.clientY - mouseDownPosRef.current.y;
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if it's a drag (moved enough distance OR held long enough while moving slightly)
      if (distanceMoved > DRAG_DISTANCE_THRESHOLD_PX || (timeElapsed > TAP_DURATION_THRESHOLD_MS && distanceMoved > 1)) {
        isPotentialTapRef.current = false; // It's a drag, not a tap
        setIsDragging(true);

        // Set initial drag screen position using the position from mousedown
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        dragStartPos.current = {
          x: mouseDownPosRef.current.x - rect.left,
          y: mouseDownPosRef.current.y - rect.top,
        };
        // modelStartPos is already set in handleMouseDown
      }
    }
    // --- End Start Drag Logic ---

    // --- Continue Drag Logic ---
    if (isDragging && adapter && view && model && canvasRef.current) {
      if (!view._deviceToScreen) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const currentX = e.clientX - rect.left; // Current screen X relative to canvas
      const currentY = e.clientY - rect.top; // Current screen Y relative to canvas

      // Convert screen delta to model delta
      const scale = canvas.width / canvas.clientWidth;
      const startScaledX = dragStartPos.current.x * scale;
      const startScaledY = dragStartPos.current.y * scale;
      const startModelX = view._deviceToScreen.transformX(startScaledX);
      const startModelY = view._deviceToScreen.transformY(startScaledY);

      const currentScaledX = currentX * scale;
      const currentScaledY = currentY * scale;
      const currentModelX = view._deviceToScreen.transformX(currentScaledX);
      const currentModelY = view._deviceToScreen.transformY(currentScaledY);

      const dx = currentModelX - startModelX;
      const dy = currentModelY - startModelY;

      const newX = modelStartPos.current.x + dx;
      const newY = modelStartPos.current.y + dy;

      // Use the adapter's setModelPosition method if available, otherwise update matrix directly
      if (adapter.setModelPosition) {
        adapter.setModelPosition(newX, newY);
      } else if (model._modelMatrix) {
        const matrix = model._modelMatrix.getArray();
        const newMatrix = [...matrix];
        newMatrix[12] = newX;
        newMatrix[13] = newY;
        model._modelMatrix.setMatrix(newMatrix);
      }

      modelPositionRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY }); // Update React state if needed for UI feedback
    }
    // --- End Continue Drag Logic ---

    // --- Pet Hover Logic (Unchanged) ---
    if (isPet && !isDragging && !isPotentialTapRef.current && electronApi && adapter && view && model && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const scale = canvas.width / canvas.clientWidth;
      const scaledX = x * scale;
      const scaledY = y * scale;
      if (!view._deviceToScreen) return;
      const modelX = view._deviceToScreen.transformX(scaledX);
      const modelY = view._deviceToScreen.transformY(scaledY);

      if (!model.anyhitTest || !model.isHitOnModel) return;
      const currentHitState = model.anyhitTest(modelX, modelY) !== null || model.isHitOnModel(modelX, modelY);

      if (currentHitState !== isHoveringModelRef.current) {
        isHoveringModelRef.current = currentHitState;
        electronApi.ipcRenderer.send('update-component-hover', 'live2d-model', currentHitState);
      }
    }
    // --- End Pet Hover Logic ---
  }, [isPet, isDragging, electronApi, canvasRef]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const adapter = (window as any).getLAppAdapter?.();
    const model = adapter?.getModel();
    const view = LAppDelegate.getInstance().getView();

    if (isDragging) {
      // Finalize drag
      setIsDragging(false);
      if (adapter) {
        const currentModel = adapter.getModel(); // Re-get model in case adapter changed
        if (currentModel && currentModel._modelMatrix) {
          const matrix = currentModel._modelMatrix.getArray();
          const finalPos = { x: matrix[12], y: matrix[13] };
          modelPositionRef.current = finalPos;
          modelStartPos.current = finalPos; // Update base position for next potential drag
          setPosition(finalPos);
        }
      }
    } else if (isPotentialTapRef.current && adapter && model && view && canvasRef.current) {
      // --- Tap Motion Logic ---
      const timeElapsed = Date.now() - mouseDownTimeRef.current;
      const deltaX = e.clientX - mouseDownPosRef.current.x;
      const deltaY = e.clientY - mouseDownPosRef.current.y;
      const distanceMoved = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if it qualifies as a tap (short duration, minimal movement)
      if (timeElapsed < TAP_DURATION_THRESHOLD_MS && distanceMoved < DRAG_DISTANCE_THRESHOLD_PX) {
        const allowTapMotion = modelInfo?.pointerInteractive !== false;

        if (allowTapMotion && modelInfo?.tapMotions) {
          // Use mouse down position for hit testing
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const scale = canvas.width / canvas.clientWidth;
          const downX = (mouseDownPosRef.current.x - rect.left) * scale;
          const downY = (mouseDownPosRef.current.y - rect.top) * scale;
          if (!view._deviceToScreen || !model.anyhitTest) return;
          const modelX = view._deviceToScreen.transformX(downX);
          const modelY = view._deviceToScreen.transformY(downY);

          const hitAreaName = model.anyhitTest(modelX, modelY);
          // Trigger tap motion using the specific hit area name or null for general body tap
          model.startTapMotion(hitAreaName, modelInfo.tapMotions);
        }
      }
      // --- End Tap Motion Logic ---
    }

    // Reset potential tap flag regardless of outcome
    isPotentialTapRef.current = false;
  }, [isDragging, canvasRef, modelInfo]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      // If dragging and mouse leaves, treat it like a mouse up to end drag
      handleMouseUp({} as React.MouseEvent); // Pass a dummy event or adjust handleMouseUp signature
    }
    // Reset potential tap if mouse leaves before mouse up
    if (isPotentialTapRef.current) {
      isPotentialTapRef.current = false;
    }
    // --- Pet Hover Logic (Unchanged) ---
    if (isPet && electronApi && isHoveringModelRef.current) {
      isHoveringModelRef.current = false;
      electronApi.ipcRenderer.send('update-component-hover', 'live2d-model', false);
    }
  }, [isPet, isDragging, electronApi, handleMouseUp]);

  useEffect(() => {
    if (!isPet && electronApi && isHoveringModelRef.current) {
      isHoveringModelRef.current = false;
    }
  }, [isPet, electronApi]);

  return {
    position,
    isDragging,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
    },
  };
};
