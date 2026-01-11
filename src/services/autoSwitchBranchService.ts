/**
 * Auto-Switch Branch Service
 * Automatically switches branch when user enters a new branch geofence
 */

import { getLocationSettings, calculateDistance, getCurrentLocation } from './locationService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface GeofenceEvent {
    type: 'enter' | 'exit';
    branchId: string;
    branchName: string;
    distance: number;
    timestamp: Date;
}

export interface GeofenceMonitor {
    start: () => void;
    stop: () => void;
    onEnter: (callback: (event: GeofenceEvent) => void) => void;
    onExit: (callback: (event: GeofenceEvent) => void) => void;
}

// ============================================================
// GEOFENCING MONITOR
// ============================================================

/**
 * Create geofence monitor for auto-switching branches
 */
export const createGeofenceMonitor = (
    tenantId: string,
    currentBranchId: string,
    userBranches: string[],
    checkInterval: number = 60000 // 1 minute default
): GeofenceMonitor => {
    let intervalId: NodeJS.Timeout | null = null;
    let lastKnownBranch: string | null = currentBranchId;
    const enterCallbacks: Array<(event: GeofenceEvent) => void> = [];
    const exitCallbacks: Array<(event: GeofenceEvent) => void> = [];

    const checkLocation = async () => {
        try {
            const userLocationData = await getCurrentLocation(false); // Don't use cache for fresh location
            const userLocation = {
                latitude: userLocationData.latitude,
                longitude: userLocationData.longitude
            };

            // Check all branches
            const branchChecks = await Promise.all(
                userBranches.map(async (branchId) => {
                    const locationSettings = await getLocationSettings(tenantId, branchId);
                    
                    if (!locationSettings?.coordinates || !locationSettings.enabled) {
                        return null;
                    }

                    const distance = calculateDistance(
                        locationSettings.coordinates.latitude,
                        locationSettings.coordinates.longitude,
                        userLocation.latitude,
                        userLocation.longitude
                    );

                    const maxDistance = locationSettings.maxDistance || 100;

                    return {
                        branchId,
                        distance,
                        isWithin: distance <= maxDistance
                    };
                })
            );

            const validChecks = branchChecks.filter((check): check is { branchId: string; distance: number; isWithin: boolean } => check !== null);
            
            // Find closest branch within geofence
            const withinGeofence = validChecks.filter(check => check.isWithin);
            withinGeofence.sort((a, b) => a.distance - b.distance);

            if (withinGeofence.length > 0) {
                const closestBranch = withinGeofence[0];

                // Check if we entered a new branch
                if (lastKnownBranch !== closestBranch.branchId) {
                    // Trigger enter event
                    const branchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, closestBranch.branchId));
                    const branchName = branchDoc.data()?.name || closestBranch.branchId;

                    const enterEvent: GeofenceEvent = {
                        type: 'enter',
                        branchId: closestBranch.branchId,
                        branchName,
                        distance: closestBranch.distance,
                        timestamp: new Date()
                    };

                    enterCallbacks.forEach(callback => callback(enterEvent));
                    
                    // If we were in another branch, trigger exit
                    if (lastKnownBranch) {
                        const oldBranchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, lastKnownBranch));
                        const oldBranchName = oldBranchDoc.data()?.name || lastKnownBranch;

                        const exitEvent: GeofenceEvent = {
                            type: 'exit',
                            branchId: lastKnownBranch,
                            branchName: oldBranchName,
                            distance: 0,
                            timestamp: new Date()
                        };

                        exitCallbacks.forEach(callback => callback(exitEvent));
                    }

                    lastKnownBranch = closestBranch.branchId;
                }
            } else {
                // We're outside all geofences
                if (lastKnownBranch) {
                    const branchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, lastKnownBranch));
                    const branchName = branchDoc.data()?.name || lastKnownBranch;

                    const exitEvent: GeofenceEvent = {
                        type: 'exit',
                        branchId: lastKnownBranch,
                        branchName,
                        distance: 0,
                        timestamp: new Date()
                    };

                    exitCallbacks.forEach(callback => callback(exitEvent));
                    lastKnownBranch = null;
                }
            }
        } catch (error: any) {
            // ✅ Silent fail for expected errors (timeout, permission denied, etc.)
            // Only log unexpected errors
            if (error?.code === 3 || error?.code === 'TIMEOUT') {
                // Geolocation timeout - expected in some scenarios (indoor, poor GPS signal)
                // Fail silently
                return;
            }
            // Log only unexpected errors
            console.error('Error checking geofence:', error);
        }
    };

    return {
        start: () => {
            if (intervalId) return; // Already started
            
            // Initial check
            checkLocation();
            
            // Set up interval
            intervalId = setInterval(checkLocation, checkInterval);
        },
        stop: () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        },
        onEnter: (callback: (event: GeofenceEvent) => void) => {
            enterCallbacks.push(callback);
        },
        onExit: (callback: (event: GeofenceEvent) => void) => {
            exitCallbacks.push(callback);
        }
    };
};
