/**
 * Smart Branch Detection Service
 * Auto-detects the closest branch based on user location
 */

import { getLocationSettings, calculateDistance, getCurrentLocation } from './locationService';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface BranchMatch {
    branchId: string;
    branchName: string;
    distance: number; // in meters
    confidence: 'high' | 'medium' | 'low';
}

// ============================================================
// SMART BRANCH DETECTION
// ============================================================

/**
 * Detect closest branch based on user location
 */
export const detectClosestBranch = async (
    tenantId: string,
    userBranches: string[]
): Promise<BranchMatch | null> => {
    try {
        if (userBranches.length === 0) return null;

        // Get user location
        const userLocationData = await getCurrentLocation(false); // Don't use cache for fresh location
        const userLocation = {
            latitude: userLocationData.latitude,
            longitude: userLocationData.longitude
        };

        // Check all user branches
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

                // Get branch name
                const branchDoc = await getDoc(doc(db, `tenants/${tenantId}/branches`, branchId));
                const branchName = branchDoc.data()?.name || branchId;

                // Determine confidence
                let confidence: 'high' | 'medium' | 'low' = 'low';
                const maxDistance = locationSettings.maxDistance || 100;
                
                if (distance <= maxDistance * 0.3) {
                    confidence = 'high';
                } else if (distance <= maxDistance * 0.7) {
                    confidence = 'medium';
                }

                return {
                    branchId,
                    branchName,
                    distance,
                    confidence
                };
            })
        );

        // Filter out null results and sort by distance
        const validMatches = branchChecks.filter((match): match is BranchMatch => match !== null);
        
        if (validMatches.length === 0) return null;

        // Sort by distance (closest first)
        validMatches.sort((a, b) => a.distance - b.distance);

        // Return closest match
        return validMatches[0];
    } catch (error) {
        logger.error('Error detecting closest branch:', error, 'smartBranchService');
        return null;
    }
};
