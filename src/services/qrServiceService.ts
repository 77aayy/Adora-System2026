/**
 * QR Services Management Service
 * Dynamic QR services configuration for guest portal
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface QRServiceField {
    type: 'text' | 'number' | 'time' | 'date' | 'datetime' | 'select' | 'textarea' | 'boolean';
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>; // For select type
    min?: number;
    max?: number;
    defaultValue?: any;
}

export interface QRService {
    id: string;
    name: string; // Display name in Arabic
    nameEn?: string; // English name
    description?: string; // Service description
    icon?: string; // Emoji or icon identifier
    color?: string; // Color theme
    bgColor?: string; // Background color theme
    type: 'standard' | 'late_checkout' | 'airport_transfer' | 'special_request' | 'custom'; // Service type
    isActive: boolean;
    order: number; // Display order
    
    // Pricing
    hasPricing: boolean;
    price?: number;
    priceLabel?: string; // e.g., "رسوم الخروج المتأخر"
    
    // Time restrictions
    timeRestrictions?: {
        enabled: boolean;
        startTime?: string; // HH:mm format
        endTime?: string; // HH:mm format
        daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    };
    
    // Form fields
    fields: QRServiceField[];
    
    // Request creation
    requestType: string; // Maps to ServiceRequest type (e.g., 'other', 'bellman')
    targetDepartment: string; // Which department handles this
    
    // Metadata
    branchId: string;
    tenantId: string;
    createdAt: any;
    updatedAt: any;
    createdBy?: { id: string; name: string };
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Subscribe to QR services for a branch with real-time updates
 */
export const subscribeToQRServices = (
    branchId: string,
    tenantId: string,
    callback: (services: QRService[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'qr_services'),
        where('branchId', '==', branchId),
        where('tenantId', '==', tenantId),
        where('isActive', '==', true)
    );

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const services: QRService[] = [];

            snapshot.forEach(doc => {
                services.push({
                    id: doc.id,
                    ...doc.data()
                } as QRService);
            });

            // Sort by order
            services.sort((a, b) => (a.order || 0) - (b.order || 0));
            
            callback(services);
        },
        (error) => {
            console.error('Error subscribing to QR services:', error);
            callback([]);
        }
    );

    return unsubscribe;
};

/**
 * Get all QR services for a branch (admin)
 */
export const getQRServices = async (branchId: string, tenantId: string): Promise<QRService[]> => {
    try {
        const q = query(
            collection(db, 'qr_services'),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(q);
        const services: QRService[] = [];

        snapshot.forEach(doc => {
            services.push({
                id: doc.id,
                ...doc.data()
            } as QRService);
        });

        // Sort by order
        services.sort((a, b) => (a.order || 0) - (b.order || 0));

        return services;
    } catch (error) {
        console.error('Error getting QR services:', error);
        return [];
    }
};

/**
 * Create a new QR service
 */
export const createQRService = async (
    service: Omit<QRService, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
    userName: string
): Promise<string> => {
    try {
        const serviceData: Omit<QRService, 'id'> = {
            ...service,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: { id: userId, name: userName }
        };

        const docRef = doc(collection(db, 'qr_services'));
        await setDoc(docRef, serviceData);

        return docRef.id;
    } catch (error) {
        console.error('Error creating QR service:', error);
        throw error;
    }
};

/**
 * Update a QR service
 */
export const updateQRService = async (
    serviceId: string,
    updates: Partial<QRService>,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const serviceRef = doc(db, 'qr_services', serviceId);
        await updateDoc(serviceRef, {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: userId, name: userName }
        });
    } catch (error) {
        console.error('Error updating QR service:', error);
        throw error;
    }
};

/**
 * Delete a QR service
 */
export const deleteQRService = async (serviceId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'qr_services', serviceId));
    } catch (error) {
        console.error('Error deleting QR service:', error);
        throw error;
    }
};

/**
 * Create a service request from QR service submission
 */
export const createRequestFromQRService = async (
    serviceId: string,
    roomNumber: string,
    guestName: string,
    guestIdentity?: string,
    guestPhone?: string,
    formData: Record<string, any> = {},
    branchId: string,
    tenantId: string
): Promise<string> => {
    try {
        // Get service details
        const serviceRef = doc(db, 'qr_services', serviceId);
        const serviceSnap = await getDoc(serviceRef);

        if (!serviceSnap.exists()) {
            throw new Error('QR Service not found');
        }

        const service = serviceSnap.data() as QRService;

        // Build request notes from form data
        let notes = service.description || '';
        if (Object.keys(formData).length > 0) {
            const formNotes = Object.entries(formData)
                .map(([key, value]) => {
                    const field = service.fields.find(f => f.key === key);
                    const label = field?.label || key;
                    return `${label}: ${value}`;
                })
                .join('\n');
            notes = notes ? `${notes}\n\n${formNotes}` : formNotes;
        }

        // Calculate price if applicable
        let totalPrice = service.price || 0;
        // Add logic to calculate additional pricing from form fields if needed

        // Create request
        const requestData: any = {
            type: service.requestType || 'other',
            serviceType: service.requestType || 'other',
            roomNumber,
            guestName,
            guestIdentity,
            guestPhone,
            status: 'PENDING_RECEPTION',
            priority: 'normal',
            source: 'QR',
            notes,
            branch: branchId,
            tenantId,
            originDepartment: 'reception',
            currentDepartment: service.targetDepartment || 'reception',
            createdAt: Timestamp.now(),
            createdBy: {
                id: 'guest',
                name: guestName
            },
            // Link to QR service
            qrServiceId: serviceId,
            qrServiceName: service.name,
            // Store form data
            qrServiceFormData: formData,
            // Store price if applicable
            ...(totalPrice > 0 && { price: totalPrice, priceLabel: service.priceLabel })
        };

        // If it's an emergency/other type, mark accordingly
        if (service.requestType === 'other') {
            requestData.isEmergency = true;
            requestData.emergencyStatus = 'pending';
            requestData.emergencyTargetDepartment = service.targetDepartment;
        }

        // Add scheduled time if provided in form data
        if (formData.scheduledTime || formData.scheduledDate) {
            const scheduledAt = formData.scheduledTime 
                ? new Date(formData.scheduledTime)
                : formData.scheduledDate 
                ? new Date(formData.scheduledDate)
                : null;
            
            if (scheduledAt) {
                requestData.scheduledDate = Timestamp.fromDate(scheduledAt);
                requestData.scheduledAt = Timestamp.fromDate(scheduledAt);
                requestData.status = 'SCHEDULED';
            }
        }

        const { addDoc } = await import('firebase/firestore');
        const docRef = await addDoc(collection(db, 'requests'), requestData);

        return docRef.id;
    } catch (error) {
        console.error('Error creating request from QR service:', error);
        throw error;
    }
};

/**
 * Default service templates
 */
export const getDefaultServiceTemplates = (): Partial<QRService>[] => [
    {
        name: 'الخروج المتأخر',
        nameEn: 'Late Checkout',
        description: 'طلب الخروج في وقت متأخر',
        icon: '🕐',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        type: 'late_checkout',
        hasPricing: true,
        price: 100,
        priceLabel: 'رسوم الخروج المتأخر',
        timeRestrictions: {
            enabled: true,
            startTime: '12:00',
            endTime: '18:00'
        },
        fields: [
            {
                type: 'time',
                key: 'checkoutTime',
                label: 'وقت الخروج',
                required: true
            },
            {
                type: 'text',
                key: 'reason',
                label: 'سبب التأخير (اختياري)',
                placeholder: 'مثال: رحلة مسائية'
            }
        ],
        requestType: 'other',
        targetDepartment: 'reception'
    },
    {
        name: 'التوصيل للمطار',
        nameEn: 'Airport Transfer',
        description: 'طلب خدمة التوصيل للمطار',
        icon: '✈️',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        type: 'airport_transfer',
        hasPricing: true,
        price: 150,
        priceLabel: 'رسوم التوصيل',
        fields: [
            {
                type: 'select',
                key: 'scheduleType',
                label: 'نوع الجدولة',
                required: true,
                options: [
                    { value: 'now', label: 'الآن' },
                    { value: 'scheduled', label: 'مجدول' }
                ]
            },
            {
                type: 'datetime',
                key: 'scheduledTime',
                label: 'وقت التوصيل',
                required: true
            },
            {
                type: 'text',
                key: 'flightNumber',
                label: 'رقم الرحلة (اختياري)',
                placeholder: 'مثال: SV123'
            },
            {
                type: 'number',
                key: 'passengers',
                label: 'عدد المسافرين',
                required: true,
                min: 1,
                max: 10,
                defaultValue: 1
            }
        ],
        requestType: 'bellman',
        targetDepartment: 'bellman'
    }
];
