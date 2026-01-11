/**
 * 🔥 مزود Firebase
 * Adora Hotel Management System V3
 * 
 * التنفيذ الحالي لقاعدة البيانات باستخدام Firebase
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    runTransaction as fbRunTransaction,
    writeBatch,
    Timestamp,
    DocumentReference,
    Query
} from 'firebase/firestore';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as fbSignOut,
    onAuthStateChanged as fbOnAuthStateChanged,
    User as FirebaseUser
} from 'firebase/auth';
import {
    ref,
    uploadBytes,
    getDownloadURL as fbGetDownloadURL,
    deleteObject,
    listAll
} from 'firebase/storage';

import { db, auth, storage } from '../../../services/firebase';
import type { IDatabaseProvider, ITransaction, BatchOperation } from '../../DatabaseProvider';
import type {
    DocumentData,
    DocumentSnapshot,
    QuerySnapshot,
    QueryOptions,
    QueryFilter,
    UnsubscribeFunction,
    AuthUser,
    AuthCredential,
    AuthResult,
    UploadResult,
    StorageFile
} from '../../types';

// ============================================================
// تحويل Firebase User إلى AuthUser
// ============================================================

const toAuthUser = (user: FirebaseUser | null): AuthUser | null => {
    if (!user) return null;
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified
    };
};

// ============================================================
// تطبيق الفلاتر على Query
// ============================================================

const applyFilters = (baseQuery: Query, filters: QueryFilter[]): Query => {
    let q = baseQuery;
    for (const filter of filters) {
        q = query(q, where(filter.field, filter.operator, filter.value));
    }
    return q;
};

// ============================================================
// مزود Firebase
// ============================================================

export class FirebaseProvider implements IDatabaseProvider {
    readonly name = 'Firebase';

    get isInitialized(): boolean {
        return db !== null;
    }

    // ---- Firestore Operations ----

    async getDocument<T = DocumentData>(collectionPath: string, docId: string): Promise<DocumentSnapshot<T>> {
        if (!db) throw new Error('Firebase not initialized');
        
        const docRef = doc(db, collectionPath, docId);
        const snapshot = await getDoc(docRef);
        
        return {
            id: snapshot.id,
            data: snapshot.exists() ? (snapshot.data() as T) : null,
            exists: snapshot.exists()
        };
    }

    async getDocuments<T = DocumentData>(collectionPath: string, options?: QueryOptions): Promise<QuerySnapshot<T>> {
        if (!db) throw new Error('Firebase not initialized');
        
        let q: Query = collection(db, collectionPath);
        
        if (options?.filters) {
            q = applyFilters(q, options.filters);
        }
        
        if (options?.orderBy) {
            for (const order of options.orderBy) {
                q = query(q, orderBy(order.field, order.direction));
            }
        }
        
        if (options?.limit) {
            q = query(q, limit(options.limit));
        }
        
        if (options?.startAfter) {
            q = query(q, startAfter(options.startAfter));
        }
        
        const snapshot = await getDocs(q);
        
        return {
            docs: snapshot.docs.map(d => ({
                id: d.id,
                data: d.data() as T,
                exists: true
            })),
            empty: snapshot.empty,
            size: snapshot.size
        };
    }

    async addDocument<T = DocumentData>(collectionPath: string, data: T): Promise<string> {
        if (!db) throw new Error('Firebase not initialized');
        
        const colRef = collection(db, collectionPath);
        const docRef = await addDoc(colRef, {
            ...data,
            createdAt: Timestamp.now()
        });
        
        return docRef.id;
    }

    async setDocument<T = DocumentData>(collectionPath: string, docId: string, data: T, merge = false): Promise<void> {
        if (!db) throw new Error('Firebase not initialized');
        
        const docRef = doc(db, collectionPath, docId);
        await setDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        }, { merge });
    }

    async updateDocument(collectionPath: string, docId: string, data: Partial<DocumentData>): Promise<void> {
        if (!db) throw new Error('Firebase not initialized');
        
        const docRef = doc(db, collectionPath, docId);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        });
    }

    async deleteDocument(collectionPath: string, docId: string): Promise<void> {
        if (!db) throw new Error('Firebase not initialized');
        
        const docRef = doc(db, collectionPath, docId);
        await deleteDoc(docRef);
    }

    subscribeToDocument<T = DocumentData>(
        collectionPath: string,
        docId: string,
        callback: (doc: DocumentSnapshot<T>) => void
    ): UnsubscribeFunction {
        if (!db) throw new Error('Firebase not initialized');
        
        const docRef = doc(db, collectionPath, docId);
        
        return onSnapshot(docRef, (snapshot) => {
            callback({
                id: snapshot.id,
                data: snapshot.exists() ? (snapshot.data() as T) : null,
                exists: snapshot.exists()
            });
        });
    }

    subscribeToCollection<T = DocumentData>(
        collectionPath: string,
        callback: (docs: QuerySnapshot<T>) => void,
        options?: QueryOptions
    ): UnsubscribeFunction {
        if (!db) throw new Error('Firebase not initialized');
        
        let q: Query = collection(db, collectionPath);
        
        if (options?.filters) {
            q = applyFilters(q, options.filters);
        }
        
        if (options?.orderBy) {
            for (const order of options.orderBy) {
                q = query(q, orderBy(order.field, order.direction));
            }
        }
        
        if (options?.limit) {
            q = query(q, limit(options.limit));
        }
        
        return onSnapshot(q, (snapshot) => {
            callback({
                docs: snapshot.docs.map(d => ({
                    id: d.id,
                    data: d.data() as T,
                    exists: true
                })),
                empty: snapshot.empty,
                size: snapshot.size
            });
        });
    }

    async runTransaction<T>(updateFunction: (transaction: ITransaction) => Promise<T>): Promise<T> {
        if (!db) throw new Error('Firebase not initialized');
        
        return fbRunTransaction(db, async (fbTransaction) => {
            const transaction: ITransaction = {
                async get<D = DocumentData>(collectionPath: string, docId: string): Promise<DocumentSnapshot<D>> {
                    const docRef = doc(db!, collectionPath, docId);
                    const snapshot = await fbTransaction.get(docRef);
                    return {
                        id: snapshot.id,
                        data: snapshot.exists() ? (snapshot.data() as D) : null,
                        exists: snapshot.exists()
                    };
                },
                set<D = DocumentData>(collectionPath: string, docId: string, data: D): void {
                    const docRef = doc(db!, collectionPath, docId);
                    fbTransaction.set(docRef, data as any);
                },
                update(collectionPath: string, docId: string, data: Partial<DocumentData>): void {
                    const docRef = doc(db!, collectionPath, docId);
                    fbTransaction.update(docRef, data);
                },
                delete(collectionPath: string, docId: string): void {
                    const docRef = doc(db!, collectionPath, docId);
                    fbTransaction.delete(docRef);
                }
            };
            
            return updateFunction(transaction);
        });
    }

    async runBatch(operations: BatchOperation[]): Promise<void> {
        if (!db) throw new Error('Firebase not initialized');
        
        const batch = writeBatch(db);
        
        for (const op of operations) {
            const docRef = doc(db, op.collection, op.docId);
            
            switch (op.type) {
                case 'set':
                    batch.set(docRef, op.data, { merge: op.merge ?? false });
                    break;
                case 'update':
                    batch.update(docRef, op.data);
                    break;
                case 'delete':
                    batch.delete(docRef);
                    break;
            }
        }
        
        await batch.commit();
    }

    // ---- Auth Operations ----

    getCurrentUser(): AuthUser | null {
        return toAuthUser(auth?.currentUser ?? null);
    }

    async signInWithEmail(credentials: AuthCredential): Promise<AuthResult> {
        if (!auth) throw new Error('Firebase Auth not initialized');
        
        try {
            const result = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            return { user: toAuthUser(result.user) };
        } catch (error: any) {
            return { user: null, error: error.message };
        }
    }

    async signUpWithEmail(credentials: AuthCredential): Promise<AuthResult> {
        if (!auth) throw new Error('Firebase Auth not initialized');
        
        try {
            const result = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
            return { user: toAuthUser(result.user) };
        } catch (error: any) {
            return { user: null, error: error.message };
        }
    }

    async signOut(): Promise<void> {
        if (!auth) throw new Error('Firebase Auth not initialized');
        await fbSignOut(auth);
    }

    onAuthStateChanged(callback: (user: AuthUser | null) => void): UnsubscribeFunction {
        if (!auth) throw new Error('Firebase Auth not initialized');
        return fbOnAuthStateChanged(auth, (user) => callback(toAuthUser(user)));
    }

    // ---- Storage Operations ----

    async uploadFile(path: string, file: File | Blob): Promise<UploadResult> {
        if (!storage) throw new Error('Firebase Storage not initialized');
        
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await fbGetDownloadURL(snapshot.ref);
        
        return {
            url,
            path,
            size: snapshot.metadata.size
        };
    }

    async deleteFile(path: string): Promise<void> {
        if (!storage) throw new Error('Firebase Storage not initialized');
        
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
    }

    async getDownloadURL(path: string): Promise<string> {
        if (!storage) throw new Error('Firebase Storage not initialized');
        
        const storageRef = ref(storage, path);
        return fbGetDownloadURL(storageRef);
    }

    async listFiles(path: string): Promise<StorageFile[]> {
        if (!storage) throw new Error('Firebase Storage not initialized');
        
        const storageRef = ref(storage, path);
        const result = await listAll(storageRef);
        
        const files: StorageFile[] = [];
        for (const item of result.items) {
            const url = await fbGetDownloadURL(item);
            files.push({
                name: item.name,
                path: item.fullPath,
                url,
                size: 0, // Firebase doesn't provide size in listAll
                contentType: ''
            });
        }
        
        return files;
    }
}

// Singleton instance
export const firebaseProvider = new FirebaseProvider();
