/**
 * Branch Location Service
 * Detects employee location and warns if opening wrong branch
 */

import { getLocationSettings, calculateDistance, getCurrentLocation } from './locationService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface BranchLocationCheck {
    isAtBranch: boolean;
    currentBranchId?: string;
    distance?: number; // in meters
    warning?: string;
    suggestedBranch?: string;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Check if employee is at the correct branch location
 */
export const checkBranchLocation = async (
    tenantId: string,
    branchId: string,
    userBranches: string[]
): Promise<BranchLocationCheck> => {
    try {
        // Get branch location settings
        const locationSettings = await getLocationSettings(tenantId, branchId);
        
        if (!locationSettings || !locationSettings.enabled || !locationSettings.coordinates) {
            // Location verification disabled, skip check
            return { isAtBranch: true };
        }

        // Get current user location
        const currentLocationData = await getCurrentLocation(false); // Don't use cache
        const currentLocation = {
            latitude: currentLocationData.latitude,
            longitude: currentLocationData.longitude
        };
        
        // Calculate distance to branch
        const distance = calculateDistance(
            locationSettings.coordinates.latitude,
            locationSettings.coordinates.longitude,
            currentLocation.latitude,
            currentLocation.longitude
        );

        const isAtBranch = distance <= locationSettings.maxDistance;

        // If not at branch, check other branches
        if (!isAtBranch && userBranches.length > 1) {
            // Check which branch user is actually at
            const branchChecks = await Promise.all(
                userBranches.map(async (bId) => {
                    if (bId === branchId) return null;
                    
                    const branchSettings = await getLocationSettings(tenantId, bId);
                    if (!branchSettings?.coordinates) return null;
                    
                    const branchDistance = calculateDistance(
                        branchSettings.coordinates.latitude,
                        branchSettings.coordinates.longitude,
                        currentLocation.latitude,
                        currentLocation.longitude
                    );
                    
                    return {
                        branchId: bId,
                        distance: branchDistance,
                        maxDistance: branchSettings.maxDistance || 100
                    };
                })
            );

            const validBranches = branchChecks.filter(Boolean) as Array<{
                branchId: string;
                distance: number;
                maxDistance: number;
            }>;

            // Find closest branch user is actually at
            const closestBranch = validBranches
                .filter(b => b.distance <= b.maxDistance)
                .sort((a, b) => a.distance - b.distance)[0];

            if (closestBranch) {
                // Get branch name
                const branchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, closestBranch.branchId));
                const branchName = branchDoc.data()?.name || closestBranch.branchId;
                
                const currentBranchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, branchId));
                const currentBranchName = currentBranchDoc.data()?.name || branchId;

                return {
                    isAtBranch: false,
                    currentBranchId: branchId,
                    distance,
                    warning: `أنت موجود في ${branchName} ولكن تحاول فتح ${currentBranchName}`,
                    suggestedBranch: closestBranch.branchId
                };
            }
        }

        return {
            isAtBranch,
            currentBranchId: branchId,
            distance: Math.round(distance)
        };
    } catch (error: any) {
        logger.error('Branch location check error:', error, 'branchLocationService');
        // If location check fails, allow access (fail open)
        return { isAtBranch: true };
    }
};

