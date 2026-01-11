/**
 * 🪝 React Hook لقاعدة البيانات
 * Adora Hotel Management System V3
 * 
 * هذا الـ Hook يوفر واجهة سهلة لاستخدام قاعدة البيانات من أي مكون React
 */

import { useState, useEffect, useCallback } from 'react';
import { database } from './index';
import type {
    DocumentData,
    DocumentSnapshot,
    QuerySnapshot,
    QueryOptions
} from './types';

// ============================================================
// Hook للحصول على مستند واحد
// ============================================================

export function useDocument<T = DocumentData>(
    collection: string,
    docId: string | null,
    realtime = false
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!docId) {
            setData(null);
            setLoading(false);
            return;
        }

        if (realtime) {
            // Real-time subscription
            const unsubscribe = database.subscribeToDocument<T>(
                collection,
                docId,
                (snapshot) => {
                    setData(snapshot.data);
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            // One-time fetch
            setLoading(true);
            database.getDocument<T>(collection, docId)
                .then((snapshot) => {
                    setData(snapshot.data);
                    setError(null);
                })
                .catch((err) => {
                    setError(err.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [collection, docId, realtime]);

    return { data, loading, error };
}

// ============================================================
// Hook للحصول على مجموعة مستندات
// ============================================================

export function useCollection<T = DocumentData>(
    collection: string,
    options?: QueryOptions,
    realtime = false
) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (realtime) {
            // Real-time subscription
            const unsubscribe = database.subscribeToCollection<T>(
                collection,
                (snapshot) => {
                    setData(snapshot.docs.map(d => d.data!));
                    setLoading(false);
                },
                options
            );
            return () => unsubscribe();
        } else {
            // One-time fetch
            setLoading(true);
            database.getDocuments<T>(collection, options)
                .then((snapshot) => {
                    setData(snapshot.docs.map(d => d.data!));
                    setError(null);
                })
                .catch((err) => {
                    setError(err.message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [collection, JSON.stringify(options), realtime]);

    return { data, loading, error };
}

// ============================================================
// Hook للعمليات على المستندات
// ============================================================

export function useDatabaseOperations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = useCallback(async <T = DocumentData>(
        collection: string,
        data: T
    ): Promise<string | null> => {
        setLoading(true);
        setError(null);
        try {
            const id = await database.addDocument(collection, data);
            return id;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const set = useCallback(async <T = DocumentData>(
        collection: string,
        docId: string,
        data: T,
        merge = false
    ): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            await database.setDocument(collection, docId, data, merge);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const update = useCallback(async (
        collection: string,
        docId: string,
        data: Partial<DocumentData>
    ): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            await database.updateDocument(collection, docId, data);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const remove = useCallback(async (
        collection: string,
        docId: string
    ): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            await database.deleteDocument(collection, docId);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return { add, set, update, remove, loading, error };
}

// ============================================================
// Hook للمصادقة
// ============================================================

export function useAuth() {
    const [user, setUser] = useState(database.getCurrentUser());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = database.onAuthStateChanged((user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        setLoading(true);
        const result = await database.signInWithEmail({ email, password });
        setLoading(false);
        return result;
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        setLoading(true);
        const result = await database.signUpWithEmail({ email, password });
        setLoading(false);
        return result;
    }, []);

    const signOut = useCallback(async () => {
        await database.signOut();
    }, []);

    return { user, loading, signIn, signUp, signOut };
}

// ============================================================
// Hook للتخزين
// ============================================================

export function useStorage() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const upload = useCallback(async (path: string, file: File | Blob) => {
        setUploading(true);
        setProgress(0);
        setError(null);
        try {
            const result = await database.uploadFile(path, file);
            setProgress(100);
            return result;
        } catch (err: any) {
            setError(err.message);
            return null;
        } finally {
            setUploading(false);
        }
    }, []);

    const remove = useCallback(async (path: string) => {
        try {
            await database.deleteFile(path);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }, []);

    const getUrl = useCallback(async (path: string) => {
        try {
            return await database.getDownloadURL(path);
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    }, []);

    return { upload, remove, getUrl, uploading, progress, error };
}
