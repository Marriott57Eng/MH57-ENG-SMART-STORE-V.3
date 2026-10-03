import { useState, useCallback } from 'react';
import { GeoConfig, getSavedGeoConfig, getDistance } from '../utils/geo';
import { User } from '../types';
import { GeoModalState } from '../components/GeoRestrictionModal';

export function useGeolocationAuth(
  currentUser: User | null, 
  geoConfigOrEnabled: GeoConfig | boolean = true
) {
  const [isCheckingGeo, setIsCheckingGeo] = useState(false);
  const [geoModalState, setGeoModalState] = useState<GeoModalState>({
    isOpen: false,
    type: 'login_notice'
  });

  const getActiveConfig = useCallback((): GeoConfig => {
    if (typeof geoConfigOrEnabled === 'object' && geoConfigOrEnabled !== null) {
      return geoConfigOrEnabled;
    }
    const saved = getSavedGeoConfig();
    if (typeof geoConfigOrEnabled === 'boolean') {
      return { ...saved, isGeoLocationEnabled: geoConfigOrEnabled };
    }
    return saved;
  }, [geoConfigOrEnabled]);

  const closeGeoModal = useCallback(() => {
    setGeoModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const checkInitialLocation = useCallback(() => {
    const config = getActiveConfig();
    // If Geo Location is turned off globally by admin, bypass check completely
    if (!config.isGeoLocationEnabled) return;
    if (!currentUser || currentUser.role === 'admin') return;

    if (!navigator.geolocation) {
      setGeoModalState({
        isOpen: true,
        type: 'unsupported',
        locationName: config.locationName,
        allowedRadius: config.maxDistanceMeters,
        message: 'เบราว์เซอร์หรืออุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง (Geolocation) จะไม่สามารถทำรายการเบิกหรือรับเข้าได้'
      });
      return;
    }

    setIsCheckingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsCheckingGeo(false);
        const distance = getDistance(
          position.coords.latitude,
          position.coords.longitude,
          config.lat,
          config.lng
        );

        if (distance > config.maxDistanceMeters) {
          setGeoModalState({
            isOpen: true,
            type: 'login_notice',
            distance,
            locationName: config.locationName,
            allowedRadius: config.maxDistanceMeters,
            message: `แจ้งเตือน: คุณอยู่นอกพื้นที่ทำงาน (ห่างออกไปประมาณ ${Math.round(distance).toLocaleString()} เมตร)\nระบบอนุญาตให้เข้าดูข้อมูลได้เท่านั้น และจะไม่สามารถทำรายการเบิกหรือรับเข้าสินค้าได้จนกว่าจะอยู่ในพื้นที่ทำงาน (รัศมีไม่เกิน ${config.maxDistanceMeters} เมตร ตามที่แอดมินกำหนด)`
          });
        }
      },
      (error) => {
        setIsCheckingGeo(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoModalState({
            isOpen: true,
            type: 'permission_denied',
            locationName: config.locationName,
            allowedRadius: config.maxDistanceMeters,
            message: 'ยังไม่ได้รับอนุญาตการเข้าถึงตำแหน่ง (Location)\nจะไม่สามารถทำรายการเบิกหรือรับเข้าสินค้าได้ กรุณาเปิดการอนุญาตตำแหน่งบนเบราว์เซอร์หรืออุปกรณ์ของคุณ'
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [currentUser, getActiveConfig]);

  const verifyLocation = useCallback(async (): Promise<boolean> => {
    const config = getActiveConfig();
    // If Geo Location is disabled globally by Admin, bypass checks immediately
    if (!config.isGeoLocationEnabled) {
      return true;
    }

    // Admins bypass this check entirely
    if (currentUser?.role === 'admin') {
      return true;
    }

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGeoModalState({
          isOpen: true,
          type: 'unsupported',
          locationName: config.locationName,
          allowedRadius: config.maxDistanceMeters,
          message: 'เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่งพิกัด'
        });
        resolve(false);
        return;
      }

      setIsCheckingGeo(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsCheckingGeo(false);
          const distance = getDistance(
            position.coords.latitude,
            position.coords.longitude,
            config.lat,
            config.lng
          );

          if (distance <= config.maxDistanceMeters) {
            resolve(true);
          } else {
            setGeoModalState({
              isOpen: true,
              type: 'action_blocked',
              distance,
              locationName: config.locationName,
              allowedRadius: config.maxDistanceMeters,
              message: `ไม่สามารถทำรายการได้เนื่องจากคุณอยู่นอกพื้นที่ทำงาน (ห่างออกไปประมาณ ${Math.round(distance).toLocaleString()} เมตร)\nระบบอนุญาตให้ทำรายการเบิกหรือรับเข้าสินค้าได้เฉพาะเมื่ออยู่ในพื้นที่ทำงาน (${config.locationName || 'พื้นที่คลัง'} ระยะไม่เกิน ${config.maxDistanceMeters} เมตร) ตามที่แอดมินกำหนดเท่านั้น`
            });
            resolve(false);
          }
        },
        (error) => {
          setIsCheckingGeo(false);
          let errorMsg = 'ไม่สามารถดึงข้อมูลตำแหน่งปัจจุบันได้ กรุณาลองใหม่อีกครั้ง';
          if (error.code === error.PERMISSION_DENIED) {
            errorMsg = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง (Location) เพื่อใช้ฟังก์ชันนี้ (เพื่อยืนยันว่าคุณอยู่ในพื้นที่ทำงาน)';
            setGeoModalState({
              isOpen: true,
              type: 'permission_denied',
              locationName: config.locationName,
              allowedRadius: config.maxDistanceMeters,
              message: errorMsg
            });
          } else {
            setGeoModalState({
              isOpen: true,
              type: 'action_blocked',
              locationName: config.locationName,
              allowedRadius: config.maxDistanceMeters,
              message: errorMsg
            });
          }
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [currentUser, getActiveConfig]);

  const recheckLocation = useCallback(() => {
    const config = getActiveConfig();
    if (config.isGeoLocationEnabled) {
      verifyLocation();
    }
  }, [verifyLocation, getActiveConfig]);

  return {
    verifyLocation,
    isCheckingGeo,
    checkInitialLocation,
    geoModalState,
    closeGeoModal,
    recheckLocation,
  };
}
