/**
 * Demo Auto-Destruct Cloud Function
 * ⏰ Daily Check: Freezes expired demo accounts automatically
 * Adora Hotel Management System V3
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// ============================================================
// TYPES
// ============================================================

interface DemoManager {
    id: string;
    tenantId: string;
    name: string;
    isDemo: boolean;
    licenseExpiry?: Timestamp | Date;
    status: 'active' | 'suspended' | 'expired' | 'frozen';
}

// ============================================================
// AUTO-DESTRUCT DAILY CHECK
// ============================================================

/**
 * Daily check for expired demo accounts
 * ⏰ Runs daily at midnight (0:00 UTC)
 * 🔐 Freezes expired demo accounts automatically
 * 
 * Schedule: Every day at 00:00 UTC (can be changed to local time)
 * Method: https.onRequest (can be changed to https.onSchedule with pubsub)
 */
export const checkExpiredDemoAccounts = functions.https.onRequest(async (req, res) => {
    try {
        const db = admin.firestore();
        const now = Timestamp.now();
        
        // ✅ Get all demo managers
        const managersRef = db.collection('users');
        const snapshot = await managersRef
            .where('role', '==', 'manager')
            .where('isDemo', '==', true)
            .where('status', '==', 'active')
            .get();
        
        const expiredManagers: DemoManager[] = [];
        
        // ✅ Check each demo manager
        snapshot.docs.forEach(doc => {
            const manager = doc.data() as DemoManager;
            manager.id = doc.id;
            
            // Check if license expired
            if (manager.licenseExpiry) {
                const expiryDate = manager.licenseExpiry instanceof Timestamp
                    ? manager.licenseExpiry.toDate()
                    : new Date(manager.licenseExpiry);
                
                // If expired, mark for freezing
                if (expiryDate < now.toDate()) {
                    expiredManagers.push(manager);
                }
            }
        });
        
        // ✅ Freeze expired accounts
        let frozenCount = 0;
        if (expiredManagers.length > 0) {
            const batch = db.batch();
            for (const manager of expiredManagers) {
                const managerRef = managersRef.doc(manager.id);
                batch.update(managerRef, {
                    status: 'frozen',
                    frozenAt: Timestamp.now(),
                    frozenReason: 'demo_expired'
                });
            }
            
            await batch.commit();
            frozenCount = expiredManagers.length;
        }
        
        const result = {
            success: true,
            checkedAt: now.toDate().toISOString(),
            totalDemoAccounts: snapshot.size,
            expiredCount: expiredManagers.length,
            frozenCount: frozenCount,
            expiredTenantIds: expiredManagers.map(m => m.tenantId)
        };
        
        functions.logger.info('Demo auto-destruct check completed', result);
        
        res.status(200).json(result);
    } catch (error: any) {
        functions.logger.error('Error in demo auto-destruct check', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Check and freeze a specific demo account by tenantId
 * 🔐 Called when accessing demo account to check expiry
 */
export const checkDemoAccountExpiry = functions.https.onCall(async (data, context) => {
    try {
        const { tenantId } = data;
        
        if (!tenantId) {
            throw new functions.https.HttpsError('invalid-argument', 'tenantId is required');
        }
        
        const db = admin.firestore();
        const managersRef = db.collection('users');
        const snapshot = await managersRef
            .where('tenantId', '==', tenantId)
            .where('isDemo', '==', true)
            .where('role', '==', 'manager')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return { expired: false, message: 'Account not found or not a demo account' };
        }
        
        const manager = snapshot.docs[0].data() as DemoManager;
        const now = Timestamp.now();
        
        // Check if expired
        if (manager.licenseExpiry) {
            const expiryDate = manager.licenseExpiry instanceof Timestamp
                ? manager.licenseExpiry.toDate()
                : new Date(manager.licenseExpiry);
            
            if (expiryDate < now.toDate()) {
                // Freeze the account
                const managerRef = managersRef.doc(snapshot.docs[0].id);
                await managerRef.update({
                    status: 'frozen',
                    frozenAt: Timestamp.now(),
                    frozenReason: 'demo_expired'
                });
                
                return {
                    expired: true,
                    message: 'Demo account has expired and has been frozen',
                    expiryDate: expiryDate.toISOString()
                };
            }
        }
        
        const expiryDate = manager.licenseExpiry 
            ? (manager.licenseExpiry instanceof Timestamp
                ? manager.licenseExpiry.toDate().toISOString()
                : new Date(manager.licenseExpiry).toISOString())
            : new Date().toISOString();
        
        return {
            expired: false,
            message: 'Demo account is still active',
            expiryDate: expiryDate
        };
    } catch (error: any) {
        functions.logger.error('Error checking demo account expiry', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
