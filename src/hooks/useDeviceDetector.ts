import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type OrientationType = 'portrait' | 'landscape';
export type PerformanceMode = 'auto' | 'smooth' | 'high';

export interface DeviceInfo {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: OrientationType;
  isLandscape: boolean;
  isPortrait: boolean;
  width: number;
  height: number;
  isTouch: boolean;
  recommendedCols: number;
  isLowSpec: boolean;
  perfMode: PerformanceMode;
  setPerfMode: (mode: PerformanceMode) => void;
}

const checkIsLowSpec = (mode: PerformanceMode, isTouch: boolean, isMobile: boolean, isTablet: boolean): boolean => {
  if (mode === 'smooth') return true;
  if (mode === 'high') return false;

  // Auto mode heuristic:
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory || 4;

  // Most budget mobile phones & tablets have <= 4 cores or <= 4GB RAM
  if ((isMobile || isTablet || isTouch) && (cores <= 4 || mem <= 4)) {
    return true;
  }
  // If touch mobile/tablet, default to performance-friendly mode
  if (isMobile) {
    return true;
  }
  return false;
};

const getStoredPerfMode = (): PerformanceMode => {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = localStorage.getItem('performance_mode') as PerformanceMode;
    if (stored === 'smooth' || stored === 'high' || stored === 'auto') return stored;
  } catch (_) {}
  return 'auto';
};

const calculateDeviceInfo = (currentPerfMode?: PerformanceMode): Omit<DeviceInfo, 'setPerfMode'> => {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      orientation: 'portrait',
      isLandscape: false,
      isPortrait: true,
      width: 375,
      height: 667,
      isTouch: true,
      recommendedCols: 1,
      isLowSpec: true,
      perfMode: 'auto',
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const orientation: OrientationType = w >= h ? 'landscape' : 'portrait';
  const isLandscape = orientation === 'landscape';
  const isPortrait = orientation === 'portrait';
  const isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  
  const ua = navigator.userAgent.toLowerCase();
  const isIpad = /ipad|macintosh/.test(ua) && Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua);
  const isTabletUA = isIpad || isAndroidTablet || /tablet|playbook|silk/.test(ua);

  // Shortest and longest screen dimensions to distinguish phone from tablet regardless of rotation
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);

  let deviceType: DeviceType = 'desktop';

  if (!isTouch && w >= 1024) {
    deviceType = 'desktop';
  } else if (isTabletUA || (isTouch && minDim >= 600 && maxDim >= 900)) {
    deviceType = 'tablet';
  } else if (minDim < 600 || /mobile|iphone|ipod|android.*mobile/.test(ua)) {
    deviceType = 'mobile';
  } else if (w < 1200) {
    deviceType = 'tablet';
  } else {
    deviceType = 'desktop';
  }

  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop';

  // Recommended grid columns for inventory items in portrait and landscape
  let recommendedCols = 1;
  if (isDesktop) {
    recommendedCols = w >= 1600 ? 4 : 3;
  } else if (isTablet) {
    recommendedCols = isLandscape ? 3 : 2;
  } else {
    // Mobile phones: 1 col in portrait, 2 cols in landscape for high-productivity viewing
    recommendedCols = isLandscape ? 2 : 1;
  }

  const mode = currentPerfMode || getStoredPerfMode();
  const isLowSpec = checkIsLowSpec(mode, Boolean(isTouch), isMobile, isTablet);

  return {
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    isLandscape,
    isPortrait,
    width: w,
    height: h,
    isTouch: Boolean(isTouch),
    recommendedCols,
    isLowSpec,
    perfMode: mode,
  };
};

export const useDeviceDetector = (): DeviceInfo => {
  const [perfMode, setPerfModeState] = useState<PerformanceMode>(getStoredPerfMode);
  const [deviceInfo, setDeviceInfo] = useState(() => calculateDeviceInfo(perfMode));

  const setPerfMode = (mode: PerformanceMode) => {
    setPerfModeState(mode);
    try {
      localStorage.setItem('performance_mode', mode);
    } catch (_) {}
    const next = calculateDeviceInfo(mode);
    setDeviceInfo(next);

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-perf-mode', mode);
      document.documentElement.setAttribute('data-low-spec', String(next.isLowSpec));
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const next = calculateDeviceInfo(perfMode);
      setDeviceInfo(next);

      // Auto-tag HTML document element for high-performance CSS and typography rules
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-device', next.deviceType);
        document.documentElement.setAttribute('data-orientation', next.orientation);
        document.documentElement.setAttribute('data-touch', String(next.isTouch));
        document.documentElement.setAttribute('data-landscape', String(next.isLandscape));
        document.documentElement.setAttribute('data-low-spec', String(next.isLowSpec));
        document.documentElement.setAttribute('data-perf-mode', next.perfMode);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    // Also listen to modern screen.orientation if available
    if (typeof window !== 'undefined' && 'screen' in window && window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (typeof window !== 'undefined' && 'screen' in window && window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleResize);
      }
    };
  }, [perfMode]);

  return {
    ...deviceInfo,
    setPerfMode,
  };
};
