import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const STORE_LOCATION = {
  lat: 13.7233708,
  lng: 100.5805155
};

export const MAX_DISTANCE_METERS = 100;

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

export const getSavedGeoLocationEnabled = (): boolean => {
  try {
    const val = localStorage.getItem('geo_location_enabled');
    if (val !== null) {
      return val === 'true';
    }
  } catch (_) {}
  return true; // default ON
};

export const saveGeoLocationSetting = async (enabled: boolean, updatedBy: string = 'Admin'): Promise<void> => {
  try {
    localStorage.setItem('geo_location_enabled', String(enabled));
    const docRef = doc(db, 'settings', 'geo_config');
    await setDoc(docRef, {
      isGeoLocationEnabled: enabled,
      updatedAt: new Date().toISOString(),
      updatedBy,
    }, { merge: true });
  } catch (err) {
    console.error('Error saving geo setting:', err);
  }
};

export const subscribeGeoLocationSetting = (callback: (enabled: boolean) => void) => {
  try {
    const docRef = doc(db, 'settings', 'geo_config');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (typeof data.isGeoLocationEnabled === 'boolean') {
          localStorage.setItem('geo_location_enabled', String(data.isGeoLocationEnabled));
          callback(data.isGeoLocationEnabled);
        }
      }
    }, (err) => {
      console.warn('Geo setting onSnapshot listener failed, using local storage:', err);
    });
  } catch (err) {
    console.warn('Failed to subscribe to geo settings:', err);
    return () => {};
  }
};

