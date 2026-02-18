/**
 * 🔐 Secure Access Service
 * Adora Hotel Management System
 * 
 * Provides cryptographic token-based access for QR codes
 * Prevents IDOR (Insecure Direct Object Reference) attacks
 */

import { db } from './firebase';
import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs,
    Timestamp,
    deleteDoc
} from 'firebase/firestore';
import { sendSecurityAlert } from './securityAlertService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface SecureAccessToken {
    id: string;
    token: string;
    roomNumber: string;
    branchId: string;
    tenantId: string;
    createdAt: Date;
    expiresAt: Date | null; // null = never expires (until checkout)
    isActive: boolean;
    roomCardId?: string; // Link to active room card (check-in)
    usageCount: number;
    lastUsedAt: Date | null;
    createdBy: string;
    deviceFingerprints: string[]; // Allowed devices
    maxDevices: number;
}

export interface TokenValidationResult {
    valid: boolean;
    error?: string;
    errorCode?: 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'INACTIVE_TOKEN' | 'DEVICE_LIMIT' | 'NO_ACTIVE_CHECKIN' | 'SYSTEM_ERROR';
    data?: {
        roomNumber: string;
        branchId: string;
        tenantId: string;
        guestName?: string;
    };
}

// ============================================================
// SECURE TOKEN GENERATION
// ============================================================

/**
 * Generate cryptographically secure random token
 * Using Web Crypto API for better security
 */
const generateSecureRandomToken = (length: number = 32): string => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(length);
    
    // Use crypto.getRandomValues for secure randomness
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(randomValues);
    } else {
        // Fallback for older browsers (less secure)
        for (let i = 0; i < length; i++) {
            randomValues[i] = Math.floor(Math.random() * 256);
        }
    }
    
    let token = '';
    for (let i = 0; i < length; i++) {
        token += charset[randomValues[i] % charset.length];
    }
    
    return token;
};

/**
 * Generate a secure access token for a room
 * Called when generating QR code
 */
export const generateSecureAccessToken = async (
    roomNumber: string,
    branchId: string,
    tenantId: string,
    createdBy: string,
    options: {
        expiresInHours?: number | null; // null = never expires
        maxDevices?: number;
        roomCardId?: string;
    } = {}
): Promise<{ token: string; fullUrl: string }> => {
    if (!db) throw new Error('Firebase not initialized');
    
    const { expiresInHours = null, maxDevices = 3, roomCardId } = options;
    
    // Generate unique token
    const token = generateSecureRandomToken(32);
    const tokenId = `${tenantId}_${branchId}_${roomNumber}_${Date.now()}`;
    
    // Calculate expiry
    let expiresAt: Date | null = null;
    if (expiresInHours !== null) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    }
    
    // Deactivate any existing tokens for this room
    await deactivateExistingTokens(roomNumber, branchId, tenantId);
    
    // Create token document
    const tokenData: SecureAccessToken = {
        id: tokenId,
        token,
        roomNumber,
        branchId,
        tenantId,
        createdAt: new Date(),
        expiresAt,
        isActive: true,
        roomCardId,
        usageCount: 0,
        lastUsedAt: null,
        createdBy,
        deviceFingerprints: [],
        maxDevices
    };
    
    // Store in Firestore
    const tokensRef = collection(db, `tenants/${tenantId}/secureAccessTokens`);
    await setDoc(doc(tokensRef, tokenId), {
        ...tokenData,
        createdAt: Timestamp.fromDate(tokenData.createdAt),
        expiresAt: tokenData.expiresAt ? Timestamp.fromDate(tokenData.expiresAt) : null,
        lastUsedAt: null
    });
    
    // Also store token hash in room document for quick lookup
    const roomRef = doc(db, `tenants/${tenantId}/branches/${branchId}/rooms`, roomNumber);
    await updateDoc(roomRef, {
        qrToken: token,
        qrTokenCreatedAt: Timestamp.now()
    }).catch(() => {
        // Room doc might not exist, create it
        setDoc(roomRef, {
            number: roomNumber,
            qrToken: token,
            qrTokenCreatedAt: Timestamp.now()
        }, { merge: true });
    });
    
    // Generate full URL (without exposing room number)
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}/guest?t=${token}`;
    
    logger.info(`🔐 Secure token generated for Room ${roomNumber}`, undefined, 'secureAccessService');
    
    return { token, fullUrl };
};

/**
 * Deactivate existing tokens for a room
 */
const deactivateExistingTokens = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<void> => {
    if (!db) return;
    
    try {
        const tokensRef = collection(db, `tenants/${tenantId}/secureAccessTokens`);
        const q = query(
            tokensRef,
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        const deactivatePromises = snapshot.docs.map(d => 
            updateDoc(d.ref, { isActive: false })
        );
        
        await Promise.all(deactivatePromises);
    } catch (error) {
        logger.error('Error deactivating existing tokens:', error, 'secureAccessService');
    }
};

// ============================================================
// TOKEN VALIDATION
// ============================================================

/**
 * Validate a secure access token
 * Called when guest accesses the QR link
 */
export const validateSecureAccessToken = async (
    token: string,
    deviceFingerprint?: string
): Promise<TokenValidationResult> => {
    // ✅ SECURITY: No sensitive data in logs
    logger.debug('Starting token validation', { tokenLength: token.length }, 'secureAccessService');
    
    if (!db) {
        logger.error(`🔍 [validateSecureAccessToken] Firebase db is null!`, undefined, 'secureAccessService');
        return { 
            valid: false, 
            error: 'النظام غير متاح حالياً', 
            errorCode: 'SYSTEM_ERROR' 
        };
    }
    
    if (!token || token.length < 20) {
        logger.warn(`🔍 [validateSecureAccessToken] Token too short: ${token?.length || 0} chars`, undefined, 'secureAccessService');
        return { 
            valid: false, 
            error: 'رابط الوصول غير صالح', 
            errorCode: 'INVALID_TOKEN' 
        };
    }
    
    try {
        // Search for token across all tenants (since we don't know tenant from URL)
        // This is a global search - consider indexing for performance
        logger.debug('Searching for token across tenants', undefined, 'secureAccessService');
        const tenantsRef = collection(db, 'tenants');
        const tenantsSnapshot = await getDocs(tenantsRef);
        logger.debug(`Found ${tenantsSnapshot.docs.length} tenant(s) to search`, undefined, 'secureAccessService');
        
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            // ✅ SECURITY: No tenantId/token in logs
            const tokensRef = collection(db, `tenants/${tenantId}/secureAccessTokens`);
            const q = query(tokensRef, where('token', '==', token));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const tokenDoc = snapshot.docs[0];
                const tokenData = tokenDoc.data() as any;
                // ✅ SECURITY: Log validation success without sensitive data
                logger.debug('Token found', { isActive: tokenData.isActive }, 'secureAccessService');
                
                // Check if active
                if (!tokenData.isActive) {
                    // 🚨 Send security alert
                    await sendSecurityAlert('invalid_token', tenantId, {
                        roomNumber: tokenData.roomNumber,
                        branchId: tokenData.branchId,
                        token: token.substring(0, 8) + '...',
                        deviceFingerprint
                    }, 'محاولة استخدام رابط QR ملغي أو معطل');
                    
                    return { 
                        valid: false, 
                        error: 'عذراً، رابط الوصول الخاص بغرفتك غير نشط حالياً.\n\nقد يكون هذا بسبب تسجيل الخروج من الغرفة. يرجى التواصل مع الاستقبال لتجديد الرابط أو التحقق من حالة الحجز.\n\nنعتذر عن أي إزعاج ونتمنى لك إقامة سعيدة.', 
                        errorCode: 'INACTIVE_TOKEN' 
                    };
                }
                
                // Check expiry
                if (tokenData.expiresAt) {
                    const expiresAt = tokenData.expiresAt.toDate ? 
                        tokenData.expiresAt.toDate() : new Date(tokenData.expiresAt);
                    if (new Date() > expiresAt) {
                        // 🚨 Send security alert
                        await sendSecurityAlert('expired_token', tenantId, {
                            roomNumber: tokenData.roomNumber,
                            branchId: tokenData.branchId,
                            token: token.substring(0, 8) + '...',
                            deviceFingerprint
                        });
                        
                        return { 
                            valid: false, 
                            error: 'عذراً، انتهت صلاحية رابط الوصول الخاص بغرفتك.\n\nيرجى التواصل مع الاستقبال للحصول على رابط جديد. نحن في خدمتك دائماً.', 
                            errorCode: 'EXPIRED_TOKEN' 
                        };
                    }
                }
                
                // Check device limit
                if (deviceFingerprint) {
                    const existingDevices = tokenData.deviceFingerprints || [];
                    if (!existingDevices.includes(deviceFingerprint)) {
                        if (existingDevices.length >= (tokenData.maxDevices || 3)) {
                            // 🚨 Send HIGH severity alert - possible link sharing
                            await sendSecurityAlert('device_limit_exceeded', tenantId, {
                                roomNumber: tokenData.roomNumber,
                                branchId: tokenData.branchId,
                                token: token.substring(0, 8) + '...',
                                deviceFingerprint,
                                attemptCount: existingDevices.length + 1
                            });
                            
                            return { 
                                valid: false, 
                                error: 'عذراً، تم الوصول للحد الأقصى من الأجهزة المسموح بها لهذه الغرفة (3 أجهزة).\n\nإذا كنت بحاجة لاستخدام جهاز إضافي، يرجى التواصل مع الاستقبال وسنسعد بمساعدتك.', 
                                errorCode: 'DEVICE_LIMIT' 
                            };
                        }
                        // Add new device
                        await updateDoc(tokenDoc.ref, {
                            deviceFingerprints: [...existingDevices, deviceFingerprint]
                        });
                    }
                }
                
                // Update usage stats
                await updateDoc(tokenDoc.ref, {
                    usageCount: (tokenData.usageCount || 0) + 1,
                    lastUsedAt: Timestamp.now()
                });
                
                // Verify there's an active check-in for this room
                // ✅ SECURITY: No room/branch/tenant in logs
                logger.debug('Checking room card for active check-in', undefined, 'secureAccessService');
                const roomCardValid = await verifyActiveCheckIn(
                    tokenData.roomNumber,
                    tokenData.branchId,
                    tenantId
                );
                
                logger.info(`🔍 [QR Validation] Room card check result:`, {
                    valid: roomCardValid.valid,
                    error: roomCardValid.error,
                    guestName: roomCardValid.guestName
                });
                
                if (!roomCardValid.valid) {
                    // 🚨 Send alert - someone accessing room without check-in
                    await sendSecurityAlert('no_active_checkin', tenantId, {
                        roomNumber: tokenData.roomNumber,
                        branchId: tokenData.branchId,
                        token: token.substring(0, 8) + '...',
                        deviceFingerprint
                    });
                    
                    return { 
                        valid: false, 
                        error: roomCardValid.error || 'عذراً، يبدو أن غرفتك غير مسجلة دخول حالياً في النظام.\n\nيرجى التوجه إلى الاستقبال لإتمام عملية تسجيل الدخول أولاً. بعد ذلك، سيعمل رابط QR الخاص بغرفتك تلقائياً.\n\nنعتذر عن أي إزعاج ونتمنى لك إقامة سعيدة.', 
                        errorCode: 'NO_ACTIVE_CHECKIN' 
                    };
                }
                
                return {
                    valid: true,
                    data: {
                        roomNumber: tokenData.roomNumber,
                        branchId: tokenData.branchId,
                        tenantId,
                        guestName: roomCardValid.guestName
                    }
                };
            }
        }
        
        // Token not found in any tenant - possible manipulation attempt
        // 🚨 Send CRITICAL alert - this could be an attack
        await sendSecurityAlert('token_manipulation', 'system', {
            token: token.substring(0, 8) + '...',
            deviceFingerprint
        }, `محاولة وصول برابط QR غير موجود في النظام. قد يكون هجوم تخمين.`);
        
        return { 
            valid: false, 
            error: 'عذراً، الرابط الذي استخدمته غير صالح أو تم إلغاؤه.\n\nيرجى التأكد من أنك تستخدم الرابط الصحيح الموجود في غرفتك. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال للحصول على رابط جديد.', 
            errorCode: 'INVALID_TOKEN' 
        };
        
    } catch (error) {
        logger.error('Token validation error:', error, 'secureAccessService');
        return { 
            valid: false, 
            error: 'عذراً، حدث خطأ تقني غير متوقع أثناء التحقق من الرابط.\n\nيرجى المحاولة مرة أخرى بعد قليل. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال وسنسعد بمساعدتك فوراً.', 
            errorCode: 'SYSTEM_ERROR' 
        };
    }
};

/**
 * Verify there's an active check-in for the room
 */
const verifyActiveCheckIn = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<{ valid: boolean; error?: string; guestName?: string }> => {
    if (!db) return { valid: false, error: 'النظام غير متاح' };
    
    try {
        // Check for active room card
        // ✅ FIX: tenantId is optional in roomCards - some old records may not have it
        // ✅ FIX: branch might be stored as 'branch' or 'branchId' in roomCards
        logger.info(`🔍 [verifyActiveCheckIn] Searching for room card: Room ${roomNumber}, Branch ${branchId}, Tenant ${tenantId || 'not provided'}`, undefined, 'secureAccessService');
        const roomCardsRef = tenantId
            ? collection(db, `tenants/${tenantId}/roomCards`)
            : collection(db, 'roomCards');
        
        let snapshot: any = null;
        let foundRoomCard: any = null;
        
        const constraints1: any[] = [
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active'),
            where('branch', '==', branchId)
        ];
        const q1 = query(roomCardsRef, ...constraints1);
        snapshot = await getDocs(q1);
        logger.info(`🔍 [verifyActiveCheckIn] Query 1 (branch=${branchId}): ${snapshot.size} result(s)`, undefined, 'secureAccessService');
        
        if (snapshot.empty) {
            const constraints2 = [
                where('roomNumber', '==', roomNumber),
                where('branchId', '==', branchId),
                where('status', '==', 'active')
            ];
            const q2 = query(roomCardsRef, ...constraints2);
            snapshot = await getDocs(q2);
            logger.info(`🔍 [verifyActiveCheckIn] Query 2 (branchId): ${snapshot.size} result(s)`, undefined, 'secureAccessService');
        }
        
        // Strategy 4: If still no results, try just roomNumber and status (last resort)
        if (snapshot.empty) {
            logger.info(`🔍 [verifyActiveCheckIn] Trying with roomNumber only (last resort)...`, undefined, 'secureAccessService');
            const constraints4 = [
                where('roomNumber', '==', roomNumber),
                where('status', '==', 'active')
            ];
            const q4 = query(roomCardsRef, ...constraints4);
            snapshot = await getDocs(q4);
            logger.info(`🔍 [verifyActiveCheckIn] Query 4 (roomNumber only): ${snapshot.size} result(s)`, undefined, 'secureAccessService');
            
            // If we found results, verify branch matches manually
            if (!snapshot.empty) {
                const matchingCard = snapshot.docs.find((doc: any) => {
                    const data = doc.data();
                    return data.branch === branchId || data.branchId === branchId;
                });
                if (matchingCard) {
                    foundRoomCard = matchingCard.data();
                    logger.info(`🔍 [verifyActiveCheckIn] Found matching room card by manual branch check`, undefined, 'secureAccessService');
                } else {
                    logger.info(`🔍 [verifyActiveCheckIn] Found room cards but none match branch ${branchId}`, undefined, 'secureAccessService');
                    snapshot = { empty: true, docs: [] } as any;
                }
            }
        }
        
        if (snapshot.empty && !foundRoomCard) {
            return { 
                valid: false, 
                error: 'عذراً، يبدو أن غرفتك غير مسجلة دخول حالياً في النظام.\n\nيرجى التوجه إلى الاستقبال لإتمام عملية تسجيل الدخول أولاً. بعد ذلك، سيعمل رابط QR الخاص بغرفتك تلقائياً.\n\nنعتذر عن أي إزعاج ونتمنى لك إقامة سعيدة.' 
            };
        }
        
        // Get room card data
        const roomCard = foundRoomCard || snapshot.docs[0].data();
        
        logger.info(`🔍 [verifyActiveCheckIn] Found room card:`, {
            roomNumber: roomCard.roomNumber,
            branch: roomCard.branch,
            branchId: roomCard.branchId,
            tenantId: roomCard.tenantId,
            qrActive: roomCard.qrActive,
            status: roomCard.status
        });
        
        // ✅ Verify branch matches (check both 'branch' and 'branchId' fields)
        const roomCardBranch = roomCard.branch || roomCard.branchId;
        if (roomCardBranch && roomCardBranch !== branchId) {
            logger.warn(`🔍 [verifyActiveCheckIn] Branch mismatch! Token branch: ${branchId}, RoomCard branch: ${roomCardBranch}`, undefined, 'secureAccessService');
            return { 
                valid: false, 
                error: 'عذراً، يبدو أن هناك عدم تطابق في بيانات الفرع.\n\nيرجى التواصل مع الاستقبال للتحقق من صحة الرابط. نحن في خدمتك دائماً.' 
            };
        }
        
        // ✅ FIX: If tenantId was provided, verify it matches (for SaaS security)
        if (tenantId && roomCard.tenantId && roomCard.tenantId !== tenantId) {
            logger.warn(`🔍 [verifyActiveCheckIn] Tenant mismatch! Token tenant: ${tenantId}, RoomCard tenant: ${roomCard.tenantId}`, undefined, 'secureAccessService');
            return { 
                valid: false, 
                error: 'عذراً، يبدو أن هناك عدم تطابق في بيانات الفندق.\n\nيرجى التواصل مع الاستقبال للتحقق من صحة الرابط. نحن في خدمتك دائماً.' 
            };
        }
        
        // Check if QR is enabled for this room (defaults to true if not set)
        if (roomCard.qrActive === false) {
            logger.warn(`🔍 [verifyActiveCheckIn] QR is disabled for this room card`, undefined, 'secureAccessService');
            return { 
                valid: false, 
                error: 'عذراً، خدمة QR غير مفعلة لهذه الغرفة حالياً.\n\nيرجى التواصل مع الاستقبال لتفعيل الخدمة. نحن في خدمتك دائماً.' 
            };
        }
        
        logger.info(`✅ [verifyActiveCheckIn] Room card validation successful!`, undefined, 'secureAccessService');
        return { 
            valid: true, 
            guestName: roomCard.guestName || roomCard.guest_name 
        };
        
    } catch (error) {
        logger.error('Check-in verification error:', error, 'secureAccessService');
        return { valid: false, error: 'خطأ في التحقق من حالة الغرفة' };
    }
};

// ============================================================
// TOKEN LIFECYCLE MANAGEMENT
// ============================================================

/**
 * Deactivate a specific token by its value
 */
export const deactivateToken = async (
    token: string,
    reason: string = 'manual'
): Promise<void> => {
    if (!db || !token) return;
    
    try {
        // Search for token across all tenants
        const tenantsRef = collection(db, 'tenants');
        const tenantsSnapshot = await getDocs(tenantsRef);
        
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tenantId = tenantDoc.id;
            const tokensRef = collection(db, `tenants/${tenantId}/secureAccessTokens`);
            const q = query(tokensRef, where('token', '==', token));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const tokenDoc = snapshot.docs[0];
                await updateDoc(tokenDoc.ref, { 
                    isActive: false,
                    deactivatedAt: Timestamp.now(),
                    deactivationReason: reason
                });
                logger.info(`Token deactivated: ${reason}`, undefined, 'secureAccessService');
                return;
            }
        }
    } catch (error) {
        logger.error('Error deactivating token:', error, 'secureAccessService');
    }
};

/**
 * Deactivate token on checkout
 */
export const deactivateTokenOnCheckout = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<void> => {
    if (!db) return;
    
    await deactivateExistingTokens(roomNumber, branchId, tenantId);
    logger.info('Token deactivated on checkout', undefined, 'secureAccessService');
};

/**
 * Regenerate token (security rotation)
 */
export const regenerateToken = async (
    roomNumber: string,
    branchId: string,
    tenantId: string,
    regeneratedBy: string
): Promise<{ token: string; fullUrl: string }> => {
    return generateSecureAccessToken(roomNumber, branchId, tenantId, regeneratedBy);
};

// ============================================================
// URL ENCRYPTION (Additional Security Layer)
// ============================================================

/**
 * Simple XOR-based obfuscation for URL parameters
 * Not cryptographically secure, but adds a layer against casual tampering
 */
const XOR_KEY = 'AdoraSecure2026';

export const obfuscateUrlParams = (params: Record<string, string>): string => {
    const json = JSON.stringify(params);
    let obfuscated = '';
    
    for (let i = 0; i < json.length; i++) {
        const charCode = json.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
        obfuscated += String.fromCharCode(charCode);
    }
    
    return btoa(obfuscated); // Base64 encode
};

export const deobfuscateUrlParams = (encoded: string): Record<string, string> | null => {
    try {
        const obfuscated = atob(encoded);
        let json = '';
        
        for (let i = 0; i < obfuscated.length; i++) {
            const charCode = obfuscated.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length);
            json += String.fromCharCode(charCode);
        }
        
        return JSON.parse(json);
    } catch {
        return null;
    }
};

// ============================================================
// SECURITY AUDIT LOGGING
// ============================================================

export interface SecurityAuditLog {
    timestamp: Date;
    action: 'TOKEN_GENERATED' | 'TOKEN_VALIDATED' | 'TOKEN_REJECTED' | 'SUSPICIOUS_ACTIVITY';
    tokenId?: string;
    roomNumber?: string;
    branchId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    reason?: string;
}

export const logSecurityEvent = async (
    event: Omit<SecurityAuditLog, 'timestamp'>
): Promise<void> => {
    if (!db) return;
    
    try {
        const logsRef = collection(db, 'securityAuditLogs');
        await setDoc(doc(logsRef), {
            ...event,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        logger.error('Failed to log security event:', error, 'secureAccessService');
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get token info for admin view
 */
export const getTokenInfo = async (
    roomNumber: string,
    branchId: string,
    tenantId: string
): Promise<SecureAccessToken | null> => {
    if (!db) return null;
    
    try {
        const tokensRef = collection(db, `tenants/${tenantId}/secureAccessTokens`);
        const q = query(
            tokensRef,
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('isActive', '==', true)
        );
        
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        
        const data = snapshot.docs[0].data();
        return {
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            expiresAt: data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt) : null),
            lastUsedAt: data.lastUsedAt?.toDate?.() || (data.lastUsedAt ? new Date(data.lastUsedAt) : null)
        } as SecureAccessToken;
        
    } catch (error) {
        logger.error('Error getting token info:', error, 'secureAccessService');
        return null;
    }
};

/**
 * Check if legacy (insecure) URL parameters are being used
 */
export const isLegacyInsecureAccess = (searchParams: URLSearchParams): boolean => {
    const hasRoom = searchParams.has('room');
    const hasToken = searchParams.has('t') || searchParams.has('token');
    
    // If room is specified without token, it's insecure legacy access
    return hasRoom && !hasToken;
};

export default {
    generateSecureAccessToken,
    validateSecureAccessToken,
    deactivateTokenOnCheckout,
    regenerateToken,
    obfuscateUrlParams,
    deobfuscateUrlParams,
    logSecurityEvent,
    getTokenInfo,
    isLegacyInsecureAccess
};
