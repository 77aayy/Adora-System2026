/**
 * 📦 أنواع قاعدة البيانات الموحدة
 * Adora Hotel Management System V3
 * 
 * هذه الأنواع تُستخدم من كل المزودين (Firebase, Supabase, MongoDB, etc.)
 */

// ============================================================
// أنواع البيانات الأساسية
// ============================================================

export interface DocumentData {
    [key: string]: any;
}

export interface QueryFilter {
    field: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'array-contains';
    value: any;
}

export interface QueryOrder {
    field: string;
    direction: 'asc' | 'desc';
}

export interface QueryOptions {
    filters?: QueryFilter[];
    orderBy?: QueryOrder[];
    limit?: number;
    startAfter?: any;
}

export interface DocumentSnapshot<T = DocumentData> {
    id: string;
    data: T | null;
    exists: boolean;
}

export interface QuerySnapshot<T = DocumentData> {
    docs: DocumentSnapshot<T>[];
    empty: boolean;
    size: number;
}

// ============================================================
// أنواع المصادقة
// ============================================================

export interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
}

export interface AuthCredential {
    email: string;
    password: string;
}

export interface AuthResult {
    user: AuthUser | null;
    error?: string;
}

// ============================================================
// أنواع التخزين
// ============================================================

export interface UploadResult {
    url: string;
    path: string;
    size: number;
}

export interface StorageFile {
    name: string;
    path: string;
    url: string;
    size: number;
    contentType: string;
}

// ============================================================
// أنواع الاشتراك (Real-time)
// ============================================================

export type UnsubscribeFunction = () => void;

export type DocumentChangeType = 'added' | 'modified' | 'removed';

export interface DocumentChange<T = DocumentData> {
    type: DocumentChangeType;
    doc: DocumentSnapshot<T>;
}
