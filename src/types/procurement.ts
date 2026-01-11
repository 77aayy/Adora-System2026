/**
 * Procurement & Cart System Types
 */

import { Timestamp } from 'firebase/firestore';
import { Department } from './employee';
import { RequestPriority } from './request';

export interface ProcurementItem {
    id: string;
    name: string;
    quantity: number;
    priority: RequestPriority;
    notes?: string;
    photo?: string;
    photoUrl?: string;

    // Category
    category?: 'supplies' | 'equipment' | 'maintenance' | 'food' | 'other';

    // Status
    approved?: boolean;
    received?: boolean;

    // Metadata
    addedAt: Timestamp;
    addedBy: string;
}

export interface ProcurementCart {
    id?: string;
    department: Department;
    branch: string;

    // Items
    items: ProcurementItem[];
    totalItems: number;

    // Submitter
    submittedBy: {
        id: string;
        name: string;
    };

    // Status
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'completed';

    // Timing
    createdAt: Timestamp;
    submittedAt?: Timestamp;
    approvedAt?: Timestamp;
    completedAt?: Timestamp;

    // Approval
    approvedBy?: {
        id: string;
        name: string;
    };
    rejectionReason?: string;

    // Notes
    notes?: string;
}

export interface QuickItem {
    name: string;
    icon: string;
    category: string;
    defaultQuantity?: number;
    department?: Department;
    isPopular?: boolean;
}

export interface ProcurementRequest {
    id: string;
    cartId: string;
    department: Department;
    branch: string;

    // Summary
    totalItems: number;
    itemsSummary: string;

    // Status
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    priority: RequestPriority;

    // Timing
    createdAt: Timestamp;

    // People
    requestedBy: {
        id: string;
        name: string;
    };
    approvedBy?: {
        id: string;
        name: string;
    };

    // Notes
    notes?: string;
    rejectionReason?: string;
}

export interface ProcurementSettings {
    requiresApproval: boolean;
    approvalThreshold?: number; // number of items
    autoApproveForManagers?: boolean;
    notifyOnSubmit?: boolean;
    notifyOnApproval?: boolean;
}
