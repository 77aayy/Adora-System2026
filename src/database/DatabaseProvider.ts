/**
 * 🔌 واجهة مزود قاعدة البيانات
 * Adora Hotel Management System V3
 * 
 * أي مزود جديد (Supabase, MongoDB, etc.) يجب أن يُنفذ هذه الواجهة
 */

import type {
    DocumentData,
    DocumentSnapshot,
    QuerySnapshot,
    QueryOptions,
    UnsubscribeFunction,
    AuthUser,
    AuthCredential,
    AuthResult,
    UploadResult,
    StorageFile
} from './types';

// ============================================================
// واجهة مزود قاعدة البيانات
// ============================================================

export interface IDatabaseProvider {
    // معلومات المزود
    readonly name: string;
    readonly isInitialized: boolean;

    // ---- Firestore Operations ----
    
    /** الحصول على مستند واحد */
    getDocument<T = DocumentData>(collection: string, docId: string): Promise<DocumentSnapshot<T>>;
    
    /** الحصول على عدة مستندات */
    getDocuments<T = DocumentData>(collection: string, options?: QueryOptions): Promise<QuerySnapshot<T>>;
    
    /** إنشاء مستند جديد (ID تلقائي) */
    addDocument<T = DocumentData>(collection: string, data: T): Promise<string>;
    
    /** إنشاء أو استبدال مستند */
    setDocument<T = DocumentData>(collection: string, docId: string, data: T, merge?: boolean): Promise<void>;
    
    /** تحديث مستند موجود */
    updateDocument(collection: string, docId: string, data: Partial<DocumentData>): Promise<void>;
    
    /** حذف مستند */
    deleteDocument(collection: string, docId: string): Promise<void>;
    
    /** الاستماع لتغييرات مستند واحد */
    subscribeToDocument<T = DocumentData>(
        collection: string,
        docId: string,
        callback: (doc: DocumentSnapshot<T>) => void
    ): UnsubscribeFunction;
    
    /** الاستماع لتغييرات مجموعة */
    subscribeToCollection<T = DocumentData>(
        collection: string,
        callback: (docs: QuerySnapshot<T>) => void,
        options?: QueryOptions
    ): UnsubscribeFunction;
    
    /** عمليات متعددة في transaction واحد */
    runTransaction<T>(
        updateFunction: (transaction: ITransaction) => Promise<T>
    ): Promise<T>;
    
    /** عمليات متعددة في batch واحد */
    runBatch(operations: BatchOperation[]): Promise<void>;

    // ---- Auth Operations ----
    
    /** الحصول على المستخدم الحالي */
    getCurrentUser(): AuthUser | null;
    
    /** تسجيل دخول بالإيميل وكلمة المرور */
    signInWithEmail(credentials: AuthCredential): Promise<AuthResult>;
    
    /** تسجيل مستخدم جديد */
    signUpWithEmail(credentials: AuthCredential): Promise<AuthResult>;
    
    /** تسجيل خروج */
    signOut(): Promise<void>;
    
    /** الاستماع لتغييرات حالة المصادقة */
    onAuthStateChanged(callback: (user: AuthUser | null) => void): UnsubscribeFunction;

    // ---- Storage Operations ----
    
    /** رفع ملف */
    uploadFile(path: string, file: File | Blob): Promise<UploadResult>;
    
    /** حذف ملف */
    deleteFile(path: string): Promise<void>;
    
    /** الحصول على رابط تحميل */
    getDownloadURL(path: string): Promise<string>;
    
    /** قائمة الملفات في مجلد */
    listFiles(path: string): Promise<StorageFile[]>;
}

// ============================================================
// واجهة Transaction
// ============================================================

export interface ITransaction {
    get<T = DocumentData>(collection: string, docId: string): Promise<DocumentSnapshot<T>>;
    set<T = DocumentData>(collection: string, docId: string, data: T): void;
    update(collection: string, docId: string, data: Partial<DocumentData>): void;
    delete(collection: string, docId: string): void;
}

// ============================================================
// أنواع Batch
// ============================================================

export type BatchOperation = 
    | { type: 'set'; collection: string; docId: string; data: DocumentData; merge?: boolean }
    | { type: 'update'; collection: string; docId: string; data: Partial<DocumentData> }
    | { type: 'delete'; collection: string; docId: string };
