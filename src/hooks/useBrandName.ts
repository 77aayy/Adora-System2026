/**
 * useBrandName Hook
 * Gets the brand/hotel name for the current user
 * Adora Hotel Management System
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to get the brand/hotel name for the current tenant
 * Works for both managers (direct hotelName) and employees (from tenant)
 */
export const useBrandName = (): string => {
    const { user, tenantId } = useAuth();
    const [brandName, setBrandName] = useState<string>('');

    useEffect(() => {
        const fetchBrandName = async () => {
            // 1. Manager/Owner has hotelName directly
            if (user?.hotelName) {
                setBrandName(user.hotelName);
                return;
            }

            // 2. Try to get from localStorage cache first
            const cachedBrand = localStorage.getItem(`brand_${tenantId}`);
            if (cachedBrand) {
                setBrandName(cachedBrand);
                return;
            }

            // 3. Fetch from tenant document
            if (tenantId && db) {
                try {
                    const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                    if (tenantDoc.exists()) {
                        const data = tenantDoc.data();
                        const name = data?.info?.hotelName || data?.hotelName || '';
                        if (name) {
                            setBrandName(name);
                            localStorage.setItem(`brand_${tenantId}`, name);
                        }
                    }
                } catch (error) {
                    console.warn('Error fetching brand name:', error);
                }
            }
        };

        fetchBrandName();
    }, [user?.hotelName, tenantId]);

    return brandName;
};

export default useBrandName;
