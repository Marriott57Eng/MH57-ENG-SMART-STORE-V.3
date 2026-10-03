import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface GeoConfig {
  isGeoLocationEnabled: boolean;
  lat: number;
  lng: number;
  maxDistanceMeters: number;
  locationName: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_GEO_CONFIG: GeoConfig = {
  isGeoLocationEnabled: true,
  lat: 13.7233708,
  lng: 100.5805155,
  maxDistanceMeters: 100,
  locationName: 'Bangkok Marriott Hotel Sukhumvit (Store FL.6)',
};

// Fallback constant pointers for components still importing STORE_LOCATION / MAX_DISTANCE_METERS
export const STORE_LOCATION = {
  lat: DEFAULT_GEO_CONFIG.lat,
  lng: DEFAULT_GEO_CONFIG.lng,
};

export const MAX_DISTANCE_METERS = DEFAULT_GEO_CONFIG.maxDistanceMeters;

let cachedGeoConfig: GeoConfig | null = null;

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get current saved GeoConfig synchronously (fallback to localStorage or defaults)
 */
export const getSavedGeoConfig = (): GeoConfig => {
  if (cachedGeoConfig) return cachedGeoConfig;
  try {
    const val = localStorage.getItem('geo_config_v2');
    if (val) {
      cachedGeoConfig = { ...DEFAULT_GEO_CONFIG, ...JSON.parse(val) };
      return cachedGeoConfig;
    }
    // Backward compatibility with legacy key
    const legacyEnabled = localStorage.getItem('geo_location_enabled');
    if (legacyEnabled !== null) {
      cachedGeoConfig = { ...DEFAULT_GEO_CONFIG, isGeoLocationEnabled: legacyEnabled === 'true' };
      return cachedGeoConfig;
    }
  } catch (_) {}
  return DEFAULT_GEO_CONFIG;
};

export const getSavedGeoLocationEnabled = (): boolean => {
  return getSavedGeoConfig().isGeoLocationEnabled;
};

/**
 * Save GeoConfig to Firestore (Admin only)
 * When saved by Admin, all connected users will automatically receive this exact config
 */
export const saveGeoConfig = async (
  config: Partial<GeoConfig>,
  updatedBy: string = 'Admin'
): Promise<GeoConfig> => {
  const current = getSavedGeoConfig();
  const updated: GeoConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  cachedGeoConfig = updated;

  try {
    localStorage.setItem('geo_config_v2', JSON.stringify(updated));
    localStorage.setItem('geo_location_enabled', String(updated.isGeoLocationEnabled));
    const docRef = doc(db, 'settings', 'geo_config');
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.error('Error saving geo setting to Firestore:', err);
  }

  // Also sync to backend server
  try {
    await fetch('/api/geo/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (_) {}

  return updated;
};

export const saveGeoLocationSetting = async (
  enabled: boolean,
  updatedBy: string = 'Admin'
): Promise<void> => {
  await saveGeoConfig({ isGeoLocationEnabled: enabled }, updatedBy);
};

/**
 * Real-time listener for GeoConfig from Firestore
 * Ensures every user on the system operates under the exact same Admin-defined configuration
 */
export const subscribeGeoConfig = (callback: (config: GeoConfig) => void) => {
  try {
    const docRef = doc(db, 'settings', 'geo_config');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const merged: GeoConfig = {
          ...DEFAULT_GEO_CONFIG,
          ...(data as any),
        };
        cachedGeoConfig = merged;
        try {
          localStorage.setItem('geo_config_v2', JSON.stringify(merged));
          localStorage.setItem('geo_location_enabled', String(merged.isGeoLocationEnabled));
        } catch (_) {}
        callback(merged);
      }
    }, (err) => {
      console.warn('Geo config onSnapshot listener failed, using local fallback:', err);
    });
  } catch (err) {
    console.warn('Failed to subscribe to geo config:', err);
    return () => {};
  }
};

export const subscribeGeoLocationSetting = (callback: (enabled: boolean) => void) => {
  return subscribeGeoConfig((config) => callback(config.isGeoLocationEnabled));
};
