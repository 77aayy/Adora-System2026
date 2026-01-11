/**
 * 🗄️ قاعدة البيانات الموحدة
 * Adora Hotel Management System V3
 * 
 * ════════════════════════════════════════════════════════════════════
 * 🎯 للتبديل بين المزودين: غيّر سطر واحد فقط!
 * 
 * Firebase (الحالي):  export { firebaseProvider as database } from './providers/firebase/FirebaseProvider';
 * Supabase:          export { supabaseProvider as database } from './providers/supabase/SupabaseProvider';
 * ════════════════════════════════════════════════════════════════════
 */

// ============================================================
// 👇 غيّر هذا السطر فقط للتبديل بين المزودين
// ============================================================

export { firebaseProvider as database } from './providers/firebase/FirebaseProvider';
// export { supabaseProvider as database } from './providers/supabase/SupabaseProvider';

// ============================================================
// تصدير الأنواع (لا تتغير)
// ============================================================

export type { IDatabaseProvider, ITransaction, BatchOperation } from './DatabaseProvider';
export type {
    DocumentData,
    DocumentSnapshot,
    QuerySnapshot,
    QueryFilter,
    QueryOrder,
    QueryOptions,
    UnsubscribeFunction,
    AuthUser,
    AuthCredential,
    AuthResult,
    UploadResult,
    StorageFile,
    DocumentChangeType,
    DocumentChange
} from './types';

// ============================================================
// تصدير المزودين (للاستخدام المباشر إذا لزم الأمر)
// ============================================================

export { FirebaseProvider, firebaseProvider } from './providers/firebase/FirebaseProvider';
export { SupabaseProvider, supabaseProvider } from './providers/supabase/SupabaseProvider';

// ============================================================
// تصدير الـ Hooks
// ============================================================

export {
    useDocument,
    useCollection,
    useDatabaseOperations,
    useAuth as useDatabaseAuth,
    useStorage as useDatabaseStorage
} from './useDatabase';
