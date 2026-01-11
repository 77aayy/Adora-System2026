/**
 * Smart Prediction Service 🧠
 * AI-powered predictions for hotel operations
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import {
    collection, query, where, getDocs, orderBy, limit,
    Timestamp, startAt, endAt
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface PredictionResult {
    type: 'cleaning' | 'checkout' | 'maintenance' | 'supply' | 'staffing';
    confidence: number; // 0-100
    prediction: string;
    data: any;
    suggestedAction: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface RoomPattern {
    roomNumber: string;
    avgCleaningTime: number;
    avgCheckoutTime: string;
    frequentIssues: string[];
    minibarConsumption: Record<string, number>;
}

export interface StaffPattern {
    employeeId: string;
    avgTasksPerShift: number;
    peakHours: number[];
    strongAreas: string[];
    avgCompletionTime: number;
}

// ============================================================
// PREDICTION ALGORITHMS
// ============================================================

/**
 * 🔮 Predict busy hours based on historical data
 */
export async function predictBusyHours(
    tenantId: string,
    branchId: string,
    department: string
): Promise<{ hour: number; expectedRequests: number; confidence: number }[]> {
    try {
        // Get last 30 days of requests
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('tenantId', '==', tenantId),
            where('branch', '==', branchId),
            where('department', '==', department),
            where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
        );
        
        const snapshot = await getDocs(q);
        
        // Count requests by hour
        const hourCounts: Record<number, number[]> = {};
        for (let h = 0; h < 24; h++) hourCounts[h] = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt?.toDate();
            if (date) {
                const hour = date.getHours();
                const dayOfWeek = date.getDay();
                hourCounts[hour].push(dayOfWeek);
            }
        });
        
        // Calculate averages and predictions
        return Object.entries(hourCounts).map(([hour, days]) => {
            const avgRequests = days.length / 30;
            const variance = calculateVariance(days.length, 30);
            
            return {
                hour: parseInt(hour),
                expectedRequests: Math.round(avgRequests * 10) / 10,
                confidence: Math.round((1 - variance) * 100),
            };
        }).sort((a, b) => b.expectedRequests - a.expectedRequests);
    } catch (error) {
        logger.error('Error predicting busy hours:', error, 'smartPredictionService');
        return [];
    }
}

/**
 * 🛎️ Predict room cleaning needs
 */
export async function predictCleaningNeeds(
    tenantId: string,
    branchId: string
): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    
    try {
        // Get active room cards
        const roomCardsRef = collection(db, `tenants/${tenantId}/roomCards`);
        const q = query(
            roomCardsRef,
            where('branch', '==', branchId),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const now = new Date();
        
        snapshot.forEach(doc => {
            const card = doc.data();
            const checkInDate = card.checkInTime?.toDate();
            
            if (checkInDate) {
                const daysStayed = Math.floor((now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
                
                // Predict cleaning need based on stay duration
                if (daysStayed >= 2 && daysStayed % 2 === 0) {
                    predictions.push({
                        type: 'cleaning',
                        confidence: 85,
                        prediction: `الغرفة ${card.roomNumber} تحتاج تنظيف (${daysStayed} أيام إقامة)`,
                        data: { roomNumber: card.roomNumber, daysStayed },
                        suggestedAction: 'جدولة تنظيف للغرفة المشغولة',
                        priority: daysStayed >= 4 ? 'high' : 'medium',
                    });
                }
            }
        });
    } catch (error) {
        logger.error('Error predicting cleaning needs:', error, 'smartPredictionService');
    }
    
    return predictions;
}

/**
 * 📦 Predict inventory shortages
 */
export async function predictInventoryShortages(
    tenantId: string,
    branchId: string
): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    
    try {
        const inventoryRef = collection(db, `tenants/${tenantId}/inventory`);
        const q = query(inventoryRef, where('branch', '==', branchId));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
            const item = doc.data();
            const currentQty = item.quantity || 0;
            const minQty = item.minQuantity || 10;
            const avgDailyUsage = item.avgDailyUsage || 1;
            
            // Calculate days until shortage
            const daysUntilShortage = currentQty / avgDailyUsage;
            
            if (daysUntilShortage <= 7) {
                predictions.push({
                    type: 'supply',
                    confidence: Math.min(95, 100 - daysUntilShortage * 10),
                    prediction: `${item.name}: سينفد خلال ${Math.round(daysUntilShortage)} أيام`,
                    data: { itemName: item.name, currentQty, daysUntilShortage },
                    suggestedAction: `طلب ${Math.ceil((minQty - currentQty) + (avgDailyUsage * 14))} وحدة`,
                    priority: daysUntilShortage <= 2 ? 'critical' : daysUntilShortage <= 4 ? 'high' : 'medium',
                });
            }
        });
    } catch (error) {
        logger.error('Error predicting inventory:', error, 'smartPredictionService');
    }
    
    return predictions;
}

/**
 * 👥 Predict staffing needs
 */
export async function predictStaffingNeeds(
    tenantId: string,
    branchId: string
): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    
    try {
        // Get today's day of week
        const today = new Date();
        const dayOfWeek = today.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday/Saturday
        
        // Get historical data for same day
        const busyHours = await predictBusyHours(tenantId, branchId, 'reception');
        const peakHours = busyHours.filter(h => h.expectedRequests > 5);
        
        if (peakHours.length > 0) {
            const peakTimes = peakHours.map(h => `${h.hour}:00`).join(', ');
            
            predictions.push({
                type: 'staffing',
                confidence: isWeekend ? 90 : 75,
                prediction: `أوقات الذروة المتوقعة: ${peakTimes}`,
                data: { peakHours, isWeekend },
                suggestedAction: isWeekend 
                    ? 'تعزيز الفريق في عطلة نهاية الأسبوع'
                    : 'توفير موظف إضافي في أوقات الذروة',
                priority: isWeekend ? 'high' : 'medium',
            });
        }
        
        // Check for upcoming checkouts
        const roomCardsRef = collection(db, `tenants/${tenantId}/roomCards`);
        const activeCardsQuery = query(
            roomCardsRef,
            where('branch', '==', branchId),
            where('isActive', '==', true)
        );
        
        const cardsSnapshot = await getDocs(activeCardsQuery);
        const checkoutsToday: string[] = [];
        
        cardsSnapshot.forEach(doc => {
            const card = doc.data();
            const expectedCheckout = card.expectedCheckout?.toDate();
            if (expectedCheckout && isSameDay(expectedCheckout, today)) {
                checkoutsToday.push(card.roomNumber);
            }
        });
        
        if (checkoutsToday.length >= 5) {
            predictions.push({
                type: 'staffing',
                confidence: 95,
                prediction: `${checkoutsToday.length} غرفة متوقع مغادرتها اليوم`,
                data: { rooms: checkoutsToday, count: checkoutsToday.length },
                suggestedAction: 'تجهيز فريق النظافة والبيلمان مبكراً',
                priority: checkoutsToday.length >= 10 ? 'critical' : 'high',
            });
        }
    } catch (error) {
        logger.error('Error predicting staffing:', error, 'smartPredictionService');
    }
    
    return predictions;
}

/**
 * 🔧 Predict maintenance issues
 */
export async function predictMaintenanceIssues(
    tenantId: string,
    branchId: string
): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = [];
    
    try {
        // Get maintenance history
        const maintenanceRef = collection(db, 'requests');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
        
        const q = query(
            maintenanceRef,
            where('tenantId', '==', tenantId),
            where('branch', '==', branchId),
            where('department', '==', 'maintenance'),
            where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
        );
        
        const snapshot = await getDocs(q);
        
        // Count issues by room and type
        const roomIssues: Record<string, { count: number; types: string[] }> = {};
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const room = data.roomNumber;
            const type = data.category || 'other';
            
            if (!roomIssues[room]) {
                roomIssues[room] = { count: 0, types: [] };
            }
            roomIssues[room].count++;
            if (!roomIssues[room].types.includes(type)) {
                roomIssues[room].types.push(type);
            }
        });
        
        // Find rooms with recurring issues
        Object.entries(roomIssues).forEach(([room, data]) => {
            if (data.count >= 3) {
                predictions.push({
                    type: 'maintenance',
                    confidence: Math.min(95, 60 + data.count * 5),
                    prediction: `الغرفة ${room}: ${data.count} مشاكل صيانة متكررة (${data.types.join(', ')})`,
                    data: { roomNumber: room, issueCount: data.count, types: data.types },
                    suggestedAction: 'جدولة فحص شامل للغرفة',
                    priority: data.count >= 5 ? 'high' : 'medium',
                });
            }
        });
    } catch (error) {
        logger.error('Error predicting maintenance:', error, 'smartPredictionService');
    }
    
    return predictions;
}

/**
 * 🎯 Get all predictions
 */
export async function getAllPredictions(
    tenantId: string,
    branchId: string
): Promise<PredictionResult[]> {
    const [cleaning, inventory, staffing, maintenance] = await Promise.all([
        predictCleaningNeeds(tenantId, branchId),
        predictInventoryShortages(tenantId, branchId),
        predictStaffingNeeds(tenantId, branchId),
        predictMaintenanceIssues(tenantId, branchId),
    ]);
    
    return [...cleaning, ...inventory, ...staffing, ...maintenance]
        .sort((a, b) => {
            // Sort by priority then confidence
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (pDiff !== 0) return pDiff;
            return b.confidence - a.confidence;
        });
}

// ============================================================
// HELPERS
// ============================================================

function calculateVariance(count: number, total: number): number {
    const expected = total / 24; // expected per hour
    return Math.abs(count - expected) / total;
}

function isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

export default {
    predictBusyHours,
    predictCleaningNeeds,
    predictInventoryShortages,
    predictStaffingNeeds,
    predictMaintenanceIssues,
    getAllPredictions,
};
