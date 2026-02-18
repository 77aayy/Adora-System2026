/**
 * Location Service
 * Handles geolocation verification for guest QR access
 * Ensures guests are within hotel location before accessing services
 * Adora Hotel Management System V2
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

export interface LocationSettings {
    enabled: boolean;
    coordinates?: LocationCoordinates; // Hotel location coordinates
    googleMapsLink?: string; // Google Maps link for hotel
    maxDistance: number; // Maximum allowed distance in meters (default: 100m)
    autoDetect: boolean; // Auto-detect coordinates from Google Maps link
}

export interface GuestLocation {
    latitude: number;
    longitude: number;
    timestamp: Date;
    accuracy?: number;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

/**
 * Extract coordinates from Google Maps link
 * Supports formats:
 * - https://www.google.com/maps?q=lat,lng
 * - https://www.google.com/maps/@lat,lng,zoom
 * - https://maps.google.com/?q=lat,lng
 */
export const extractCoordinatesFromLink = (link: string): LocationCoordinates | null => {
    try {
        const url = new URL(link);
        
        // Check for @ format: maps/@lat,lng,zoom
        const pathMatch = url.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (pathMatch) {
            return {
                latitude: parseFloat(pathMatch[1]),
                longitude: parseFloat(pathMatch[2])
            };
        }
        
        // Check for q parameter: ?q=lat,lng
        const qParam = url.searchParams.get('q');
        if (qParam) {
            const coords = qParam.split(',');
            if (coords.length === 2) {
                const lat = parseFloat(coords[0].trim());
                const lng = parseFloat(coords[1].trim());
                if (!isNaN(lat) && !isNaN(lng)) {
                    return { latitude: lat, longitude: lng };
                }
            }
        }
        
        return null;
    } catch (error) {
        logger.error('Error extracting coordinates from link:', error, 'locationService');
        return null;
    }
};

// ============================================================
// LOCATION SETTINGS
// ============================================================

/**
 * Get location settings for a branch
 */
export const getLocationSettings = async (
    tenantId: string,
    branchId: string
): Promise<LocationSettings | null> => {
    try {
        const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'location');
        const snap = await getDoc(settingsRef);
        
        if (snap.exists()) {
            return snap.data() as LocationSettings;
        }
        
        // Return default settings
        return {
            enabled: false,
            maxDistance: 100, // 100 meters default (safer for SaaS)
            autoDetect: true
        };
    } catch (error) {
        logger.error('Error getting location settings:', error, 'locationService');
        return null;
    }
};

/**
 * Save location settings for a branch
 */
export const saveLocationSettings = async (
    tenantId: string,
    branchId: string,
    settings: LocationSettings
): Promise<boolean> => {
    try {
        // Auto-detect coordinates from Google Maps link if enabled
        let coordinates = settings.coordinates;
        if (settings.autoDetect && settings.googleMapsLink && !coordinates) {
            coordinates = extractCoordinatesFromLink(settings.googleMapsLink);
        }
        
        const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'location');
        await setDoc(settingsRef, {
            ...settings,
            coordinates,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        return true;
    } catch (error) {
        logger.error('Error saving location settings:', error, 'locationService');
        return false;
    }
};

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

const STORAGE_KEYS = {
    LOCATION_PERMISSION: 'guest_location_permission',
    LOCATION_DATA: 'guest_location_data',
    DEVICE_FINGERPRINT: 'guest_device_fingerprint',
    LAST_VERIFICATION: 'guest_last_verification'
};

/**
 * Save location permission status to localStorage
 */
export const saveLocationPermission = (granted: boolean, coordinates?: GuestLocation): void => {
    try {
        const data = {
            granted,
            timestamp: new Date().toISOString(),
            coordinates: coordinates ? {
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                timestamp: coordinates.timestamp.toISOString()
            } : null
        };
        localStorage.setItem(STORAGE_KEYS.LOCATION_PERMISSION, JSON.stringify(data));
        
        if (coordinates) {
            localStorage.setItem(STORAGE_KEYS.LOCATION_DATA, JSON.stringify({
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                timestamp: coordinates.timestamp.toISOString(),
                accuracy: coordinates.accuracy
            }));
        }
    } catch (error) {
        logger.error('Error saving location permission:', error, 'locationService');
    }
};

/**
 * Get saved location permission from localStorage
 */
export const getSavedLocationPermission = (): { granted: boolean; coordinates?: GuestLocation; timestamp?: Date } | null => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.LOCATION_PERMISSION);
        if (!saved) return null;
        
        const data = JSON.parse(saved);
        const coordinates = data.coordinates ? {
            latitude: data.coordinates.latitude,
            longitude: data.coordinates.longitude,
            timestamp: new Date(data.coordinates.timestamp),
            accuracy: data.coordinates.accuracy
        } : undefined;
        
        return {
            granted: data.granted,
            coordinates,
            timestamp: data.timestamp ? new Date(data.timestamp) : undefined
        };
    } catch (error) {
        logger.error('Error reading location permission:', error, 'locationService');
        return null;
    }
};

/**
 * Get saved location data from localStorage
 */
export const getSavedLocationData = (): GuestLocation | null => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.LOCATION_DATA);
        if (!saved) return null;
        
        const data = JSON.parse(saved);
        // Check if location is recent (less than 1 hour old)
        const timestamp = new Date(data.timestamp);
        const ageInHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > 1) {
            // Location is too old, clear it
            localStorage.removeItem(STORAGE_KEYS.LOCATION_DATA);
            return null;
        }
        
        return {
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp,
            accuracy: data.accuracy
        };
    } catch (error) {
        logger.error('Error reading location data:', error, 'locationService');
        return null;
    }
};

/**
 * Save device fingerprint to localStorage
 */
export const saveDeviceFingerprint = (fingerprint: string): void => {
    try {
        localStorage.setItem(STORAGE_KEYS.DEVICE_FINGERPRINT, fingerprint);
    } catch (error) {
        logger.error('Error saving device fingerprint:', error, 'locationService');
    }
};

/**
 * Get saved device fingerprint from localStorage
 */
export const getSavedDeviceFingerprint = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT);
    } catch (error) {
        logger.error('Error reading device fingerprint:', error, 'locationService');
        return null;
    }
};

/**
 * Save last verification timestamp
 */
export const saveLastVerification = (tenantId: string, branchId: string, roomNumber: string): void => {
    try {
        const key = `${STORAGE_KEYS.LAST_VERIFICATION}_${tenantId}_${branchId}_${roomNumber}`;
        localStorage.setItem(key, new Date().toISOString());
    } catch (error) {
        logger.error('Error saving last verification:', error, 'locationService');
    }
};

/**
 * Get last verification timestamp
 */
export const getLastVerification = (tenantId: string, branchId: string, roomNumber: string): Date | null => {
    try {
        const key = `${STORAGE_KEYS.LAST_VERIFICATION}_${tenantId}_${branchId}_${roomNumber}`;
        const saved = localStorage.getItem(key);
        if (!saved) return null;
        return new Date(saved);
    } catch (error) {
        logger.error('Error reading last verification:', error, 'locationService');
        return null;
    }
};

// ============================================================
// LOCATION VERIFICATION
// ============================================================

/**
 * Get current location from browser (with localStorage caching)
 */
export const getCurrentLocation = (useCache: boolean = true): Promise<GuestLocation> => {
    return new Promise((resolve, reject) => {
        // Check cached location first if useCache is true
        if (useCache) {
            const cached = getSavedLocationData();
            if (cached) {
                // Use cached location if it's recent (less than 10 minutes old)
                const ageInMinutes = (Date.now() - cached.timestamp.getTime()) / (1000 * 60);
                if (ageInMinutes < 10) {
                    logger.info('✅ Using cached location data', undefined, 'locationService');
                    resolve(cached);
                    return;
                }
            }
        }
        
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }
        
        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000 // Accept cached location up to 10 minutes old
        };
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location: GuestLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: new Date(),
                    accuracy: position.coords.accuracy || undefined
                };
                
                // Save to localStorage for future use
                saveLocationPermission(true, location);
                
                resolve(location);
            },
            (error) => {
                // Check if we have cached location as fallback
                if (useCache) {
                    const cached = getSavedLocationData();
                    if (cached) {
                        logger.warn('⚠️ Using cached location due to error', undefined, 'locationService');
                        resolve(cached);
                        return;
                    }
                }
                reject(error);
            },
            options
        );
    });
};

/**
 * Verify guest location against hotel location
 */
export const verifyGuestLocation = async (
    tenantId: string,
    branchId: string
): Promise<{ valid: boolean; distance?: number; error?: string }> => {
    try {
        // Get location settings
        const settings = await getLocationSettings(tenantId, branchId);
        
        if (!settings || !settings.enabled) {
            // Location verification is disabled
            return { valid: true };
        }
        
        if (!settings.coordinates) {
            return {
                valid: false,
                error: 'إعدادات الموقع غير مكتملة. يرجى الاتصال بالاستقبال.'
            };
        }
        
        // Get current location (use cache if available to avoid repeated prompts)
        const currentLocation = await getCurrentLocation(true); // Use localStorage cache
        
        // Calculate distance
        const distance = calculateDistance(
            settings.coordinates.latitude,
            settings.coordinates.longitude,
            currentLocation.latitude,
            currentLocation.longitude
        );
        
        // Check if within allowed distance
        const valid = distance <= settings.maxDistance;
        
        return {
            valid,
            distance: Math.round(distance)
        };
    } catch (error: any) {
        logger.error('Location verification error:', error, 'locationService');
        
        // Error code constants
        const PERMISSION_DENIED = 1;
        const POSITION_UNAVAILABLE = 2;
        const TIMEOUT = 3;
        
        if (error.code === PERMISSION_DENIED) {
            // Save permission denied to localStorage to skip future checks
            saveLocationPermission(false);
            return {
                valid: false,
                error: 'تم رفض الوصول للموقع. يرجى السماح بالوصول للموقع للاستمرار.'
            };
        }
        
        if (error.code === POSITION_UNAVAILABLE) {
            return {
                valid: false,
                error: 'لا يمكن تحديد موقعك الحالي. يرجى التأكد من تفعيل GPS.'
            };
        }
        
        if (error.code === TIMEOUT) {
            return {
                valid: false,
                error: 'انتهى وقت انتظار تحديد الموقع. يرجى المحاولة مرة أخرى.'
            };
        }
        
        return {
            valid: false,
            error: 'حدث خطأ أثناء التحقق من الموقع. يرجى المحاولة مرة أخرى.'
        };
    }
};

// ============================================================
// DEVICE TRACKING
// ============================================================

/**
 * Generate device fingerprint
 */
export const generateDeviceFingerprint = (): string => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset(),
        canvas.toDataURL()
    ].join('|');
    
    // Simple hash (for production, use a proper hashing library)
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
};

/**
 * Get device limit settings
 */
export const getDeviceLimitSettings = async (
    tenantId: string,
    branchId: string
): Promise<{ enabled: boolean; maxDevices: number }> => {
    try {
        const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'qr');
        const snap = await getDoc(settingsRef);
        
        if (snap.exists()) {
            const data = snap.data();
            return {
                enabled: data.deviceLimitEnabled ?? true,
                maxDevices: data.maxDevices ?? 2
            };
        }
        
        return {
            enabled: true,
            maxDevices: 2 // Default: 2 devices
        };
    } catch (error) {
        logger.error('Error getting device limit settings:', error, 'locationService');
        return {
            enabled: true,
            maxDevices: 2
        };
    }
};

/**
 * Check device limit for a room
 */
export const checkDeviceLimit = async (
    tenantId: string,
    branchId: string,
    roomNumber: string,
    deviceFingerprint: string
): Promise<{ allowed: boolean; deviceCount?: number; error?: string }> => {
    try {
        const settings = await getDeviceLimitSettings(tenantId, branchId);
        
        if (!settings.enabled) {
            return { allowed: true };
        }
        
        // Get current devices for this room
        const devicesRef = doc(db, `tenants/${tenantId}/branches/${branchId}/qrDevices`, roomNumber);
        const devicesSnap = await getDoc(devicesRef);
        
        const devices = devicesSnap.exists() ? devicesSnap.data() : {};
        const deviceList = devices.devices || {};
        const deviceCount = Object.keys(deviceList).length;
        
        // Check if current device is already registered
        const currentDevice = deviceList[deviceFingerprint];
        if (currentDevice) {
            // Device is already registered, update timestamp
            await updateDoc(devicesRef, {
                [`devices.${deviceFingerprint}.lastAccess`]: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { allowed: true, deviceCount };
        }
        
        // Check if device limit is reached
        if (deviceCount >= settings.maxDevices) {
            return {
                allowed: false,
                deviceCount,
                error: `تم الوصول للحد الأقصى للأجهزة (${settings.maxDevices} جهاز). يرجى إلغاء تسجيل جهاز آخر أولاً.`
            };
        }
        
        // Register new device
        await updateDoc(devicesRef, {
            [`devices.${deviceFingerprint}`]: {
                registeredAt: serverTimestamp(),
                lastAccess: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        return { allowed: true, deviceCount: deviceCount + 1 };
    } catch (error) {
        logger.error('Error checking device limit:', error, 'locationService');
        // On error, allow access (fail open for better UX, but log error)
        return { allowed: true };
    }
};

/**
 * Remove device from room
 */
export const removeDevice = async (
    tenantId: string,
    branchId: string,
    roomNumber: string,
    deviceFingerprint: string
): Promise<boolean> => {
    try {
        const devicesRef = doc(db, `tenants/${tenantId}/branches/${branchId}/qrDevices`, roomNumber);
        const devicesSnap = await getDoc(devicesRef);
        
        if (devicesSnap.exists()) {
            const devices = devicesSnap.data()?.devices || {};
            delete devices[deviceFingerprint];
            
            await updateDoc(devicesRef, {
                devices,
                updatedAt: serverTimestamp()
            });
        }
        
        return true;
    } catch (error) {
        logger.error('Error removing device:', error, 'locationService');
        return false;
    }
};

// ============================================================
// ROOM STATUS VERIFICATION
// ============================================================

/**
 * Verify room is checked in and QR is active
 */
export const verifyRoomStatus = async (
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<{ valid: boolean; qrActive: boolean; error?: string }> => {
    try {
        const roomCardsRef = tenantId
            ? collection(db, `tenants/${tenantId}/roomCards`)
            : collection(db, 'roomCards');
        const constraints: any[] = [
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active')
        ];
        const q = query(roomCardsRef, ...constraints);
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return {
                valid: false,
                qrActive: false,
                error: 'الغرفة غير مسجلة دخول حالياً. يرجى الانتظار حتى يتم تسجيل الدخول.'
            };
        }
        
        const roomCard = snapshot.docs[0].data();
        
        if (branchId && roomCard.branch !== branchId && roomCard.branchId !== branchId) {
            return {
                valid: false,
                qrActive: false,
                error: 'الغرفة لا تتبع للفرع المحدد.'
            };
        }
        
        // Check if QR is active (optional field, defaults to true if not set)
        const qrActive = roomCard.qrActive !== false;
        
        if (!qrActive) {
            return {
                valid: false,
                qrActive: false,
                error: 'خدمة QR غير مفعلة لهذه الغرفة حالياً.'
            };
        }
        
        return {
            valid: true,
            qrActive: true
        };
    } catch (error: any) {
        logger.error('Room status verification error:', error, 'locationService');
        return {
            valid: false,
            qrActive: false,
            error: 'حدث خطأ أثناء التحقق من حالة الغرفة. يرجى المحاولة مرة أخرى.'
        };
    }
};

// ============================================================
// COMPREHENSIVE CHECK (Location + Device + Room Status)
// ============================================================

/**
 * Comprehensive check for QR access (Location + Device + Room Status)
 * Uses localStorage to avoid repeated prompts
 */
export const performComprehensiveCheck = async (
    tenantId: string,
    branchId: string,
    roomNumber: string,
    skipLocationCheck: boolean = false // Skip if location permission was denied
): Promise<{
    allowed: boolean;
    locationValid?: boolean;
    deviceValid?: boolean;
    roomValid?: boolean;
    errors: string[];
}> => {
    const errors: string[] = [];
    
    // 1. Check Room Status (always required)
    const roomCheck = await verifyRoomStatus(tenantId, branchId, roomNumber);
    if (!roomCheck.valid) {
        errors.push(roomCheck.error || 'الغرفة غير متاحة');
    }
    
    // 2. Get Device Fingerprint
    let fingerprint = getSavedDeviceFingerprint();
    if (!fingerprint) {
        fingerprint = generateDeviceFingerprint();
        saveDeviceFingerprint(fingerprint);
    }
    
    // 3. Check Device Limit
    const deviceCheck = await checkDeviceLimit(tenantId, branchId, roomNumber, fingerprint);
    if (!deviceCheck.allowed) {
        errors.push(deviceCheck.error || 'تم الوصول للحد الأقصى للأجهزة');
    }
    
    // 4. Check Location (if enabled and not skipped)
    let locationValid = true;
    if (!skipLocationCheck) {
        // Check if we have saved permission
        const savedPermission = getSavedLocationPermission();
        
        if (savedPermission && savedPermission.granted) {
            // Use cached location if available
            const cachedLocation = getSavedLocationData();
            if (cachedLocation) {
                // Verify cached location is still valid
                const locationSettings = await getLocationSettings(tenantId, branchId);
                if (locationSettings && locationSettings.enabled && locationSettings.coordinates) {
                    const distance = calculateDistance(
                        locationSettings.coordinates.latitude,
                        locationSettings.coordinates.longitude,
                        cachedLocation.latitude,
                        cachedLocation.longitude
                    );
                    
                    if (distance > locationSettings.maxDistance) {
                        // Cached location is too far, need fresh check
                        const freshCheck = await verifyGuestLocation(tenantId, branchId);
                        locationValid = freshCheck.valid;
                        if (!freshCheck.valid) {
                            errors.push(freshCheck.error || 'الموقع غير صحيح');
                        }
                    } else {
                        locationValid = true;
                        // Save verification timestamp
                        saveLastVerification(tenantId, branchId, roomNumber);
                    }
                }
            } else {
                // No cached location, perform fresh check
                const freshCheck = await verifyGuestLocation(tenantId, branchId);
                locationValid = freshCheck.valid;
                if (!freshCheck.valid) {
                    errors.push(freshCheck.error || 'الموقع غير صحيح');
                } else {
                    saveLastVerification(tenantId, branchId, roomNumber);
                }
            }
        } else {
            // No saved permission, perform check (will prompt user)
            try {
                const freshCheck = await verifyGuestLocation(tenantId, branchId);
                locationValid = freshCheck.valid;
                if (!freshCheck.valid) {
                    errors.push(freshCheck.error || 'الموقع غير صحيح');
                } else {
                    saveLastVerification(tenantId, branchId, roomNumber);
                }
            } catch (error: any) {
                // If permission denied, skip location check for this session
                const PERMISSION_DENIED = 1;
                if (error.code === PERMISSION_DENIED || error?.message?.includes('denied')) {
                    locationValid = true; // Skip check if permission denied
                    saveLocationPermission(false);
                } else {
                    locationValid = false;
                    errors.push('حدث خطأ أثناء التحقق من الموقع');
                }
            }
        }
    }
    
    return {
        allowed: errors.length === 0 && roomCheck.valid && deviceCheck.allowed && locationValid,
        locationValid,
        deviceValid: deviceCheck.allowed,
        roomValid: roomCheck.valid,
        errors
    };
};

// ============================================================
// SUSPICIOUS DEVICE BLOCKING
// ============================================================

const BLOCKED_DEVICES_KEY = 'adora_blocked_devices';
const FAILED_ATTEMPTS_KEY = 'adora_failed_attempts';
const MAX_FAILED_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if device is blocked
 */
export const isDeviceBlocked = (): { blocked: boolean; remainingMinutes?: number } => {
    try {
        const fingerprint = getSavedDeviceFingerprint();
        if (!fingerprint) return { blocked: false };
        
        const blockedData = localStorage.getItem(BLOCKED_DEVICES_KEY);
        if (!blockedData) return { blocked: false };
        
        const blocked = JSON.parse(blockedData);
        const blockInfo = blocked[fingerprint];
        
        if (!blockInfo) return { blocked: false };
        
        const now = Date.now();
        const blockedUntil = blockInfo.blockedUntil;
        
        if (now < blockedUntil) {
            const remainingMs = blockedUntil - now;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            return { blocked: true, remainingMinutes };
        }
        
        // Block expired, remove it
        delete blocked[fingerprint];
        localStorage.setItem(BLOCKED_DEVICES_KEY, JSON.stringify(blocked));
        return { blocked: false };
    } catch (error) {
        logger.error('Error checking device block:', error, 'locationService');
        return { blocked: false };
    }
};

/**
 * Record failed verification attempt
 */
export const recordFailedAttempt = (): { shouldBlock: boolean; attempts: number } => {
    try {
        const fingerprint = getSavedDeviceFingerprint() || generateDeviceFingerprint();
        saveDeviceFingerprint(fingerprint);
        
        const attemptsData = localStorage.getItem(FAILED_ATTEMPTS_KEY);
        const attempts = attemptsData ? JSON.parse(attemptsData) : {};
        
        const deviceAttempts = attempts[fingerprint] || { count: 0, firstAttempt: Date.now() };
        
        // Reset if older than 10 minutes
        if (Date.now() - deviceAttempts.firstAttempt > 10 * 60 * 1000) {
            deviceAttempts.count = 0;
            deviceAttempts.firstAttempt = Date.now();
        }
        
        deviceAttempts.count++;
        deviceAttempts.lastAttempt = Date.now();
        attempts[fingerprint] = deviceAttempts;
        
        localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(attempts));
        
        if (deviceAttempts.count >= MAX_FAILED_ATTEMPTS) {
            // Block device
            blockDevice(fingerprint);
            return { shouldBlock: true, attempts: deviceAttempts.count };
        }
        
        return { shouldBlock: false, attempts: deviceAttempts.count };
    } catch (error) {
        logger.error('Error recording failed attempt:', error, 'locationService');
        return { shouldBlock: false, attempts: 0 };
    }
};

/**
 * Block a device
 */
const blockDevice = (fingerprint: string): void => {
    try {
        const blockedData = localStorage.getItem(BLOCKED_DEVICES_KEY);
        const blocked = blockedData ? JSON.parse(blockedData) : {};
        
        blocked[fingerprint] = {
            blockedAt: Date.now(),
            blockedUntil: Date.now() + BLOCK_DURATION_MS
        };
        
        localStorage.setItem(BLOCKED_DEVICES_KEY, JSON.stringify(blocked));
        
        // Clear failed attempts
        const attemptsData = localStorage.getItem(FAILED_ATTEMPTS_KEY);
        if (attemptsData) {
            const attempts = JSON.parse(attemptsData);
            delete attempts[fingerprint];
            localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(attempts));
        }
        
        logger.info(`🚫 Device blocked: ${fingerprint.substring(0, 8)}...`, undefined, 'locationService');
    } catch (error) {
        logger.error('Error blocking device:', error, 'locationService');
    }
};

/**
 * 📢 إشعار الاستقبال بمحاولة تلاعب محتملة
 * يُستخدم عند حظر جهاز بعد محاولات فاشلة متعددة
 */
export const notifyReceptionOfSuspiciousActivity = async (
    tenantId: string,
    branchId: string,
    roomNumber: string,
    deviceFingerprint: string,
    attemptCount: number
): Promise<void> => {
    if (!db) return;

    try {
        const { collection, addDoc, Timestamp } = await import('firebase/firestore');
        
        // إنشاء تنبيه في مجموعة التنبيهات
        const alertRef = collection(db, `tenants/${tenantId}/branches/${branchId}/securityAlerts`);
        await addDoc(alertRef, {
            type: 'SUSPICIOUS_ACTIVITY',
            roomNumber,
            deviceFingerprint: deviceFingerprint.substring(0, 8) + '...',
            attemptCount,
            message: `🚨 محاولة تلاعب محتملة من الغرفة ${roomNumber}. ${attemptCount} محاولات فاشلة للتحقق. تم حظر الجهاز لمدة 30 دقيقة.`,
            createdAt: Timestamp.now(),
            acknowledged: false,
            severity: 'warning'
        });

        logger.info(`🚨 Reception notified: Suspicious activity from room ${roomNumber}`, undefined, 'locationService');
    } catch (error) {
        logger.error('Error notifying reception:', error, 'locationService');
    }
};

/**
 * Clear failed attempts after successful verification
 */
export const clearFailedAttempts = (): void => {
    try {
        const fingerprint = getSavedDeviceFingerprint();
        if (!fingerprint) return;
        
        const attemptsData = localStorage.getItem(FAILED_ATTEMPTS_KEY);
        if (attemptsData) {
            const attempts = JSON.parse(attemptsData);
            delete attempts[fingerprint];
            localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(attempts));
        }
    } catch (error) {
        logger.error('Error clearing failed attempts:', error, 'locationService');
    }
};