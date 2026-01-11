/**
 * Tenant Deployment Service
 * Calls Cloud Functions to securely deploy Firebase configuration
 * 
 * ⚠️ Service Account operations happen on the server via Cloud Functions
 * 
 * Adora Hotel Management System V3
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { autoDestructServiceAccount } from './secureStorageService';

// ============================================================
// TYPES
// ============================================================

interface DeployRequest {
    tenantId: string;
    serviceAccountJson: string;
    firestoreRules?: string;
    firestoreIndexes?: string;
}

interface DeployResult {
    success: boolean;
    message: string;
    details?: {
        rulesDeployed: boolean;
        indexesDeployed: boolean;
        seedingCompleted: boolean;
    };
}

interface TestConnectionResult {
    success: boolean;
    message: string;
    projectId?: string;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Deploy Firebase configuration to a tenant's project via Cloud Function
 * This is the SECURE way to handle Service Account operations
 * 
 * @param tenantId - The tenant ID
 * @param serviceAccountJson - The client's Service Account JSON string
 * @param firestoreRules - Optional Firestore Rules to store
 * @param firestoreIndexes - Optional Firestore Indexes JSON to store
 */
export async function deployTenantFirebase(
    tenantId: string,
    serviceAccountJson: string,
    firestoreRules?: string,
    firestoreIndexes?: string
): Promise<DeployResult> {
    try {
        const functions = getFunctions(getApp(), 'us-central1');
        const deployFn = httpsCallable<DeployRequest, DeployResult>(functions, 'deployTenantFirebase');
        
        const result = await deployFn({
            tenantId,
            serviceAccountJson,
            firestoreRules,
            firestoreIndexes,
        });
        
        // ✅ AUTO-DESTRUCT: Clear Service Account immediately after successful deployment
        if (result.data.success) {
            autoDestructServiceAccount();
            console.log('🔐✅ Service Account auto-destructed after successful deployment');
        }
        
        return result.data;
    } catch (error: any) {
        console.error('❌ deployTenantFirebase error:', error);
        
        // Handle Firebase Functions errors
        if (error.code === 'functions/unauthenticated') {
            return {
                success: false,
                message: '❌ يجب تسجيل الدخول لتنفيذ هذه العملية',
            };
        }
        
        if (error.code === 'functions/permission-denied') {
            return {
                success: false,
                message: '❌ ليس لديك صلاحية لتنفيذ هذه العملية',
            };
        }
        
        if (error.code === 'functions/invalid-argument') {
            return {
                success: false,
                message: error.message || '❌ البيانات المدخلة غير صحيحة',
            };
        }
        
        return {
            success: false,
            message: `❌ حدث خطأ: ${error.message || 'خطأ غير معروف'}`,
        };
    }
}

/**
 * Test connection to a tenant's Firebase project via Cloud Function
 * Used before full deployment to verify credentials
 * 
 * @param serviceAccountJson - The client's Service Account JSON string
 */
export async function testTenantConnectionSecure(
    serviceAccountJson: string
): Promise<TestConnectionResult> {
    try {
        const functions = getFunctions(getApp(), 'us-central1');
        const testFn = httpsCallable<{ serviceAccountJson: string }, TestConnectionResult>(
            functions, 
            'testTenantConnection'
        );
        
        const result = await testFn({ serviceAccountJson });
        
        return result.data;
    } catch (error: any) {
        console.error('❌ testTenantConnection error:', error);
        
        return {
            success: false,
            message: `❌ فشل اختبار الاتصال: ${error.message || 'خطأ غير معروف'}`,
        };
    }
}

/**
 * Get the Core Config Templates (Rules & Indexes) from the system settings
 * These are stored by the owner/super-admin in the hidden settings tab
 */
export async function getCoreConfigTemplates(): Promise<{
    firestoreRules: string;
    firestoreIndexes: string;
} | null> {
    try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        
        const docRef = doc(db, 'system', 'core_config_template');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                firestoreRules: data.firestoreRules || '',
                firestoreIndexes: data.firestoreIndexes || '',
            };
        }
        
        return null;
    } catch (error) {
        console.error('❌ getCoreConfigTemplates error:', error);
        return null;
    }
}

/**
 * Full deployment flow:
 * 1. Get Core Config Templates
 * 2. Test connection with Service Account
 * 3. Deploy if test passes
 * 4. Return results
 */
export async function fullTenantDeployment(
    tenantId: string,
    serviceAccountJson: string
): Promise<DeployResult> {
    // Step 1: Test connection first
    console.log('🔄 Step 1: Testing connection...');
    const testResult = await testTenantConnectionSecure(serviceAccountJson);
    
    if (!testResult.success) {
        return {
            success: false,
            message: `فشل اختبار الاتصال: ${testResult.message}`,
        };
    }
    
    console.log('✅ Connection test passed');
    
    // Step 2: Get Core Config Templates
    console.log('🔄 Step 2: Getting core config templates...');
    const templates = await getCoreConfigTemplates();
    
    // Step 3: Deploy
    console.log('🔄 Step 3: Deploying...');
    const deployResult = await deployTenantFirebase(
        tenantId,
        serviceAccountJson,
        templates?.firestoreRules,
        templates?.firestoreIndexes
    );
    
    return deployResult;
}

export default {
    deployTenantFirebase,
    testTenantConnectionSecure,
    getCoreConfigTemplates,
    fullTenantDeployment,
};
