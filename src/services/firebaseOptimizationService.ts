/**
 * Firebase Optimization Service
 * استراتيجية ذكية لتقليل استهلاك Firebase والبقاء في Free Tier
 * 
 * 🎯 أهداف التوفير:
 * - Firestore: 50K reads/day → نستهلك 10K فقط
 * - Firestore: 20K writes/day → نستهلك 5K فقط
 * - Storage: 5GB → نستهلك 1GB فقط
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    limit,
    orderBy,
    startAfter,
    getDocs,
    writeBatch,
    onSnapshot,
    DocumentSnapshot,
    QueryConstraint,
    Timestamp
} from 'firebase/firestore';

// ============================================================
// 📊 USAGE TRACKER - تتبع الاستهلاك
// ============================================================

interface UsageStats {
    reads: number;
    writes: number;
    deletes: number;
    date: string;
}

const USAGE_KEY = 'adora_firebase_usage';
const DAILY_LIMITS = {
    reads: 50000,   // Free tier limit
    writes: 20000,
    deletes: 20000,
    // 🎯 Our targets (20% of limit for safety)
    targetReads: 10000,
    targetWrites: 4000,
    targetDeletes: 4000
};

/**
 * Get today's usage stats
 */
export function getTodayUsage(): UsageStats {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(USAGE_KEY);
    
    if (stored) {
        const usage = JSON.parse(stored) as UsageStats;
        if (usage.date === today) return usage;
    }
    
    // Reset for new day
    const newUsage: UsageStats = { reads: 0, writes: 0, deletes: 0, date: today };
    localStorage.setItem(USAGE_KEY, JSON.stringify(newUsage));
    return newUsage;
}

/**
 * Track a read operation
 */
export function trackRead(count: number = 1): void {
    const usage = getTodayUsage();
    usage.reads += count;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    
    // Warn if approaching limit
    if (usage.reads > DAILY_LIMITS.targetReads * 0.8) {
        console.warn(`⚠️ Firebase Reads at ${Math.round(usage.reads / DAILY_LIMITS.targetReads * 100)}% of target`);
    }
}

/**
 * Track a write operation
 */
export function trackWrite(count: number = 1): void {
    const usage = getTodayUsage();
    usage.writes += count;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    
    if (usage.writes > DAILY_LIMITS.targetWrites * 0.8) {
        console.warn(`⚠️ Firebase Writes at ${Math.round(usage.writes / DAILY_LIMITS.targetWrites * 100)}% of target`);
    }
}

/**
 * Check if we should throttle operations
 */
export function shouldThrottle(): { reads: boolean; writes: boolean } {
    const usage = getTodayUsage();
    return {
        reads: usage.reads > DAILY_LIMITS.targetReads,
        writes: usage.writes > DAILY_LIMITS.targetWrites
    };
}

// ============================================================
// 🗄️ LOCAL CACHE - التخزين المحلي الذكي
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in ms
}

const CACHE_PREFIX = 'adora_cache_';

// TTL configurations (in milliseconds)
export const CACHE_TTL = {
    settings: 24 * 60 * 60 * 1000,      // 24 hours - Settings rarely change
    rooms: 5 * 60 * 1000,                // 5 minutes - Rooms change frequently
    employees: 60 * 60 * 1000,           // 1 hour - Employee list stable
    departments: 24 * 60 * 60 * 1000,    // 24 hours - Rarely change
    roomStatuses: 24 * 60 * 60 * 1000,   // 24 hours - Rarely change
    pointsConfig: 12 * 60 * 60 * 1000,   // 12 hours
    achievements: 24 * 60 * 60 * 1000,   // 24 hours - Ranks
    requests: 30 * 1000,                  // 30 seconds - Need fresh data
    notifications: 60 * 1000,             // 1 minute
};

/**
 * Set cache with TTL
 */
export function setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
    };
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
        // localStorage full - clear old entries
        clearOldCache();
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
        } catch {
            console.warn('Cache storage full');
        }
    }
}

/**
 * Get from cache if valid
 */
export function getCache<T>(key: string): T | null {
    try {
        const stored = localStorage.getItem(CACHE_PREFIX + key);
        if (!stored) return null;
        
        const entry = JSON.parse(stored) as CacheEntry<T>;
        const age = Date.now() - entry.timestamp;
        
        if (age < entry.ttl) {
            return entry.data;
        }
        
        // Expired - remove
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
    } catch {
        return null;
    }
}

/**
 * Clear cache for a key pattern
 */
export function clearCache(pattern?: string): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
            if (!pattern || key.includes(pattern)) {
                localStorage.removeItem(key);
            }
        }
    });
}

/**
 * Clear old cache entries
 */
function clearOldCache(): void {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
            try {
                const entry = JSON.parse(localStorage.getItem(key) || '{}');
                if (entry.timestamp && (now - entry.timestamp > entry.ttl)) {
                    localStorage.removeItem(key);
                }
            } catch {
                localStorage.removeItem(key);
            }
        }
    });
}

// ============================================================
// 📖 SMART READ - قراءة ذكية مع Cache
// ============================================================

/**
 * Smart document read with caching
 * يقرأ من الكاش أولاً، ولو مش موجود يقرأ من Firebase
 */
export async function smartGetDoc<T>(
    path: string,
    ttl: number = CACHE_TTL.settings
): Promise<T | null> {
    const cacheKey = path.replace(/\//g, '_');
    
    // 1. Try cache first
    const cached = getCache<T>(cacheKey);
    if (cached !== null) {
        console.log(`📦 Cache hit: ${path}`);
        return cached;
    }
    
    // 2. Check throttle
    if (shouldThrottle().reads) {
        console.warn('⚠️ Read throttled - returning null');
        return null;
    }
    
    // 3. Read from Firebase
    try {
        const docRef = doc(db, path);
        const docSnap = await getDoc(docRef);
        trackRead();
        
        if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as T;
            setCache(cacheKey, data, ttl);
            return data;
        }
        return null;
    } catch (error) {
        console.error(`Error reading ${path}:`, error);
        return null;
    }
}

/**
 * Smart collection query with caching
 */
export async function smartQuery<T>(
    collectionPath: string,
    constraints: QueryConstraint[] = [],
    ttl: number = CACHE_TTL.requests,
    cacheKey?: string
): Promise<T[]> {
    const key = cacheKey || `${collectionPath}_${JSON.stringify(constraints)}`.replace(/\//g, '_');
    
    // 1. Try cache
    const cached = getCache<T[]>(key);
    if (cached !== null) {
        console.log(`📦 Cache hit: ${collectionPath}`);
        return cached;
    }
    
    // 2. Check throttle
    if (shouldThrottle().reads) {
        console.warn('⚠️ Query throttled');
        return [];
    }
    
    // 3. Query Firebase
    try {
        const colRef = collection(db, collectionPath);
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        trackRead(snapshot.docs.length || 1);
        
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as T[];
        
        setCache(key, data, ttl);
        return data;
    } catch (error) {
        console.error(`Error querying ${collectionPath}:`, error);
        return [];
    }
}

// ============================================================
// ✏️ SMART WRITE - كتابة ذكية مع Batching
// ============================================================

interface PendingWrite {
    path: string;
    data: any;
    operation: 'set' | 'update' | 'delete';
    timestamp: number;
}

let pendingWrites: PendingWrite[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
const BATCH_DELAY = 2000; // 2 seconds - جمع الكتابات
const MAX_BATCH_SIZE = 500; // Firebase limit

/**
 * Queue a write operation for batching
 */
export function queueWrite(
    path: string,
    data: any,
    operation: 'set' | 'update' | 'delete' = 'set'
): void {
    // Add to pending
    pendingWrites.push({
        path,
        data,
        operation,
        timestamp: Date.now()
    });
    
    // Clear existing timeout
    if (batchTimeout) {
        clearTimeout(batchTimeout);
    }
    
    // Process immediately if batch is full
    if (pendingWrites.length >= MAX_BATCH_SIZE) {
        processBatch();
        return;
    }
    
    // Schedule batch processing
    batchTimeout = setTimeout(processBatch, BATCH_DELAY);
}

/**
 * Process all pending writes as a batch
 */
async function processBatch(): Promise<void> {
    if (pendingWrites.length === 0) return;
    
    const writes = [...pendingWrites];
    pendingWrites = [];
    
    // Check throttle
    if (shouldThrottle().writes) {
        console.warn('⚠️ Writes throttled - queueing for later');
        // Store for later
        const stored = localStorage.getItem('adora_pending_writes');
        const existing = stored ? JSON.parse(stored) : [];
        localStorage.setItem('adora_pending_writes', JSON.stringify([...existing, ...writes]));
        return;
    }
    
    try {
        const batch = writeBatch(db);
        
        writes.forEach(write => {
            const docRef = doc(db, write.path);
            
            switch (write.operation) {
                case 'set':
                    batch.set(docRef, write.data, { merge: true });
                    break;
                case 'update':
                    batch.update(docRef, write.data);
                    break;
                case 'delete':
                    batch.delete(docRef);
                    break;
            }
        });
        
        await batch.commit();
        trackWrite(writes.length);
        console.log(`✅ Batch committed: ${writes.length} operations`);
        
        // Clear related caches
        writes.forEach(write => {
            clearCache(write.path.split('/')[0]);
        });
        
    } catch (error) {
        console.error('Batch write failed:', error);
        // Re-queue failed writes
        pendingWrites = [...writes, ...pendingWrites];
    }
}

/**
 * Force process pending writes (call before page unload)
 */
export async function flushWrites(): Promise<void> {
    if (batchTimeout) {
        clearTimeout(batchTimeout);
    }
    await processBatch();
}

// ============================================================
// 👂 SMART LISTENERS - مستمعين أذكياء
// ============================================================

interface ListenerConfig {
    path: string;
    constraints?: QueryConstraint[];
    callback: (data: any) => void;
    debounceMs?: number;
}

const activeListeners = new Map<string, () => void>();

/**
 * Create a smart listener with deduplication
 * لو فيه listener موجود على نفس الـ path، يستخدمه بدل ما يعمل جديد
 */
export function smartListen(
    id: string,
    config: ListenerConfig
): () => void {
    // Kill existing listener on same ID
    if (activeListeners.has(id)) {
        activeListeners.get(id)!();
        activeListeners.delete(id);
    }
    
    let lastData: string = '';
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const colRef = collection(db, config.path);
    const q = config.constraints 
        ? query(colRef, ...config.constraints)
        : query(colRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        // Track read
        trackRead(snapshot.docChanges().length || 1);
        
        // Get data
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Deduplicate - don't fire if data hasn't changed
        const dataString = JSON.stringify(data);
        if (dataString === lastData) return;
        lastData = dataString;
        
        // Debounce callback
        if (config.debounceMs) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                config.callback(data);
            }, config.debounceMs);
        } else {
            config.callback(data);
        }
    });
    
    activeListeners.set(id, unsubscribe);
    return unsubscribe;
}

/**
 * Cleanup all listeners
 */
export function cleanupAllListeners(): void {
    activeListeners.forEach(unsub => unsub());
    activeListeners.clear();
}

// ============================================================
// 📊 AGGREGATION - تجميع البيانات
// ============================================================

/**
 * Aggregate daily stats into a single document
 * بدل ما نحفظ 1000 document للنقاط، نجمعهم في document واحد
 */
export async function aggregateDailyStats(
    tenantId: string,
    branchId: string,
    date: string
): Promise<void> {
    const statsPath = `tenants/${tenantId}/branches/${branchId}/daily_stats/${date}`;
    
    // Check if already aggregated
    const cached = getCache<any>(`stats_${date}`);
    if (cached?.aggregated) return;
    
    // This would normally aggregate from multiple sources
    // For now, just mark as aggregated
    await setDoc(doc(db, statsPath), {
        aggregated: true,
        timestamp: Timestamp.now()
    }, { merge: true });
    
    trackWrite();
}

// ============================================================
// 🧹 CLEANUP - التنظيف التلقائي
// ============================================================

/**
 * Archive old data (move to cold storage)
 * البيانات القديمة (أكثر من 30 يوم) تتنقل لمكان تاني أرخص
 */
export async function archiveOldData(
    tenantId: string,
    collectionName: string,
    daysOld: number = 30
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Query old documents
    const colRef = collection(db, `tenants/${tenantId}/${collectionName}`);
    const q = query(
        colRef,
        where('createdAt', '<', Timestamp.fromDate(cutoffDate)),
        limit(100) // Process in chunks
    );
    
    const snapshot = await getDocs(q);
    trackRead(snapshot.docs.length);
    
    if (snapshot.empty) return 0;
    
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(docSnap => {
        // Move to archive collection
        const archiveRef = doc(db, `tenants/${tenantId}/archive/${collectionName}_${docSnap.id}`);
        batch.set(archiveRef, {
            ...docSnap.data(),
            archivedAt: Timestamp.now(),
            originalCollection: collectionName
        });
        
        // Delete original
        batch.delete(docSnap.ref);
    });
    
    await batch.commit();
    trackWrite(snapshot.docs.length * 2); // Set + Delete
    
    console.log(`📦 Archived ${snapshot.docs.length} documents from ${collectionName}`);
    return snapshot.docs.length;
}

// ============================================================
// 📈 USAGE REPORT
// ============================================================

/**
 * Get usage report for dashboard
 */
export function getUsageReport(): {
    today: UsageStats;
    limits: typeof DAILY_LIMITS;
    percentages: { reads: number; writes: number; deletes: number };
    status: 'healthy' | 'warning' | 'critical';
} {
    const today = getTodayUsage();
    
    const percentages = {
        reads: Math.round((today.reads / DAILY_LIMITS.targetReads) * 100),
        writes: Math.round((today.writes / DAILY_LIMITS.targetWrites) * 100),
        deletes: Math.round((today.deletes / DAILY_LIMITS.targetDeletes) * 100)
    };
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (percentages.reads > 80 || percentages.writes > 80) status = 'warning';
    if (percentages.reads > 100 || percentages.writes > 100) status = 'critical';
    
    return { today, limits: DAILY_LIMITS, percentages, status };
}

// ============================================================
// 🚀 INITIALIZATION
// ============================================================

/**
 * Initialize optimization service
 */
export function initOptimization(): void {
    // Process any pending writes from previous session
    const stored = localStorage.getItem('adora_pending_writes');
    if (stored) {
        const writes = JSON.parse(stored);
        localStorage.removeItem('adora_pending_writes');
        writes.forEach((w: PendingWrite) => queueWrite(w.path, w.data, w.operation));
    }
    
    // Cleanup old cache on startup
    clearOldCache();
    
    // Flush writes before page unload
    window.addEventListener('beforeunload', () => {
        flushWrites();
    });
    
    console.log('✅ Firebase Optimization Service initialized');
}

export default {
    // Cache
    setCache,
    getCache,
    clearCache,
    CACHE_TTL,
    // Smart operations
    smartGetDoc,
    smartQuery,
    queueWrite,
    flushWrites,
    // Listeners
    smartListen,
    cleanupAllListeners,
    // Tracking
    getTodayUsage,
    getUsageReport,
    shouldThrottle,
    // Maintenance
    archiveOldData,
    aggregateDailyStats,
    // Init
    initOptimization
};
