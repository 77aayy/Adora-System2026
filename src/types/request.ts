/**
 * Unified Request Type
 * Used across all departments: Reception, Bellman, Housekeeping, Maintenance
 */

import { Timestamp } from 'firebase/firestore';

export enum RequestType {
    CLEANING = 'cleaning',
    MAINTENANCE = 'maintenance',
    BELLMAN = 'bellman',
    AMENITIES = 'amenities',
    VIP_SERVICE = 'vip_service',
    INSPECTION = 'inspection',
    LAUNDRY = 'laundry',
    MINIBAR = 'minibar',
    COFFEE = 'coffee',
    PROCUREMENT = 'procurement', // ✅ New type for procurement tasks
    OTHER = 'other'
}

export enum RequestStatus {
    // Reception statuses
    PENDING_RECEPTION = 'PENDING_RECEPTION',
    CONFIRMED = 'CONFIRMED',

    // Department statuses
    IN_PROGRESS = 'IN_PROGRESS',
    WAITING_INSPECTION = 'WAITING_INSPECTION',
    WAITING_MAINTENANCE = 'WAITING_MAINTENANCE',

    // Maintenance specific
    MAINTENANCE_PENDING = 'MAINTENANCE_PENDING',
    MAINTENANCE_IN_PROGRESS = 'MAINTENANCE_IN_PROGRESS',
    PENDING_MAINTENANCE = 'PENDING_MAINTENANCE',

    // Housekeeping specific
    PENDING_HOUSEKEEPING = 'PENDING_HOUSEKEEPING',
    CLEANING_IN_PROGRESS = 'CLEANING_IN_PROGRESS',

    // Final statuses
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    WAITING_PARTS = 'WAITING_PARTS',

    // Transfer statuses
    TRANSFERRED_TO_CLEANING = 'TRANSFERRED_TO_CLEANING',
    TRANSFERRED_TO_MAINTENANCE = 'TRANSFERRED_TO_MAINTENANCE'
}

export enum RequestPriority {
    NORMAL = 'normal',
    URGENT = 'urgent',
    EMERGENCY = 'emergency'
}

export enum RequestSource {
    RECEPTION = 'reception',
    GUEST = 'guest',
    AUTO = 'auto'
}

export interface RequestTimeline {
    created: Timestamp;
    confirmed?: Timestamp;
    started?: Timestamp;
    completed?: Timestamp;
    cancelled?: Timestamp;
}

export interface RequestAssignment {
    id: string;
    name: string;
    department?: string;
}

export interface InspectionReport {
    roomStatus: 'clean' | 'needs_cleaning' | 'needs_maintenance';
    cleanliness?: number; // 1-5
    minibar?: Record<string, number>;
    damages?: string;
    damagePhoto?: string;
    lostItems?: string;
    notes?: string;
    photos?: string[];
}

export interface MaintenanceDetails {
    category?: 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';
    description?: string;
    urgency?: 'low' | 'medium' | 'high';
    estimatedTime?: number; // minutes
    actualTime?: number;
    parts?: string[];
    cost?: number;
}

export interface BellmanDetails {
    needsCart?: boolean;
    luggageCount?: number;
    checkInTime?: Timestamp;
    checkOutTime?: Timestamp;
    roomCardId?: string;
    guestCount?: number;
    adults?: number;
    children?: number;
}

export interface Request {
    id: string;
    type: RequestType;
    status: RequestStatus;
    priority: RequestPriority;
    source: RequestSource;

    // Location
    roomNumber: string;
    floor?: number;

    // Guest info
    guestName: string;
    guestPhone?: string;
    guestIdentity?: string;

    // Branch/Hotel
    branch: string;
    tenantId: string; // ✅ Multi-tenancy support (Strict)
    hotelId?: string;

    // Assignment
    createdBy: RequestAssignment;
    confirmedBy?: RequestAssignment;
    assignedTo?: RequestAssignment;
    completedBy?: RequestAssignment;

    // Timing
    createdAt: Timestamp;
    confirmedAt?: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    scheduledDate?: Timestamp;
    targetCompletionTime?: Timestamp; // ✅ Target time for bonus/penalty logic
    timeline?: RequestTimeline;

    // Details (type-specific)
    details?: Record<string, any>;
    inspectionReport?: InspectionReport;
    maintenanceDetails?: MaintenanceDetails;
    bellmanDetails?: BellmanDetails;

    // Additional
    notes?: string;
    photos?: string[];
    rating?: number;
    feedback?: string;

    // Parent/child requests
    parentRequestId?: string;
    childRequestIds?: string[];

    // Metadata
    isDelayed?: boolean;
    isCancelled?: boolean;
    cancelReason?: string;
    modifiedAt?: Timestamp;
    modifiedBy?: RequestAssignment;

    // WhatsApp-style tracking (Phase 11)
    currentDepartment?: string; // القسم الحالي الذي عنده الطلب
    originDepartment?: string; // القسم الأصلي الذي أنشأ الطلب
    deliveredAt?: Timestamp; // وقت وصول الطلب للقسم
    viewedBy?: {
        userId: string;
        userName: string;
        department: string;
        viewedAt: Timestamp;
    }[];
    
    // ✅ Request Journey Tracking (Complete Workflow)
    departmentHistory?: Array<{
        department: string; // القسم
        status: string; // حالة الطلب في هذا القسم
        enteredAt: Timestamp; // وقت دخول الطلب للقسم
        exitedAt?: Timestamp; // وقت خروج الطلب من القسم
        handledBy?: {
            id: string;
            name: string;
        }; // من قام بالتعامل
        notes?: string; // ملاحظات
        nextDepartment?: string; // القسم التالي (إذا انتقل)
    }>;
}

export interface CreateRequestInput {
    type: RequestType;
    roomNumber: string;
    guestName: string;
    priority?: RequestPriority;
    source?: RequestSource;
    details?: Record<string, any>;
    notes?: string;
    scheduledDate?: Date;
    targetCompletionTime?: Date; // ✅ Added
    photos?: string[];
    tenantId: string; // ✅ Multi-tenancy support (Strict)
}

export interface UpdateRequestInput {
    status?: RequestStatus;
    priority?: RequestPriority;
    assignedTo?: RequestAssignment;
    notes?: string;
    details?: Record<string, any>;
}

/**
 * WhatsApp-style read receipt status
 * Used for tracking request visibility across departments
 */
export type ReadReceiptStatus = 'sent' | 'delivered' | 'read';

/**
 * ServiceRequest - Extended Request interface for Reception Dashboard
 * Compatible with legacy code while using new Request structure
 */
export interface ServiceRequest extends Omit<Request, 'type' | 'status' | 'priority'> {
    type: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'laundry' | 'minibar' | 'inspection' | 'extension' | 'other';
    status: 'PENDING' | 'PENDING_RECEPTION' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_INSPECTION' | 'SCHEDULED' | 'WAITING_PARTS';
    priority: 'normal' | 'urgent' | 'scheduled';
    // Extended fields for Reception-specific use
    serviceType?: string;
    source?: 'bellman_checkout' | 'reception_direct' | 'QR';
    guestStatus?: 'in' | 'out';
    isEmergency?: boolean;
    emergencyStatus?: 'pending' | 'acknowledged' | 'in_progress' | 'completed';
    acknowledgedBy?: { id: string; name: string } | null;
    acknowledgedAt?: Timestamp | null;
    emergencyTargetDepartment?: string;
    inspectionResult?: 'clean' | 'damages' | 'missing_items';
    inspectionPhoto?: string;
    inspectionNotes?: string;
    inspectedBy?: { id: string; name: string };
    minibarConsumption?: Array<{
        productId: string;
        productName: string;
        quantity: number;
        pricePerUnit: number;
        total: number;
    }>;
    minibarTotal?: number;
    scheduledAt?: Timestamp; // Alias for scheduledDate
    // Additional compatibility fields
    [key: string]: any;
}