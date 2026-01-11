/**
 * Minibar Product Types
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Minibar product in the system
 */
export interface MinibarProduct {
    id: string;
    name: string;
    nameEn?: string;
    price: number;
    category: 'beverage' | 'snack' | 'alcohol' | 'other';
    stock?: number;
    icon?: string;
    isActive?: boolean;
}

/**
 * Minibar consumption record
 */
export interface MinibarConsumption {
    productId: string;
    productName: string;
    quantity: number;
    pricePerUnit: number;
    total: number;
}

/**
 * Minibar settings (managed by admin)
 */
export interface MinibarSettings {
    products: MinibarProduct[];
    updatedAt?: Timestamp;
    updatedBy?: string;
}
