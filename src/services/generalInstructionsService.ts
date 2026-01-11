/**
 * General Instructions Service
 * Allows manager to create and manage general instructions for departments
 * Employees can view department-specific instructions and hotel policies
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export type DepartmentType = 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'coffee_shop' | 'procurement' | 'all' | 'general';

export interface GeneralInstruction {
    id: string;
    
    // Content
    title: string;
    titleAr: string;
    content: string;
    contentAr: string;
    
    // Classification
    category: 'general_policy' | 'department_specific' | 'rights' | 'obligations' | 'procedures' | 'rules';
    targetDepartment: DepartmentType; // Which department this applies to ('all' means all departments, 'general' means hotel-wide policy)
    
    // Organization
    section: string; // e.g., 'دستور الفندق', 'حقوق الموظفين', 'واجبات الموظفين', 'إجراءات العمل'
    order: number; // Display order
    
    // Status
    isActive: boolean;
    createdAt: any;
    createdBy: { id: string; name: string };
    updatedAt?: any;
    updatedBy?: { id: string; name: string };
    
    // Tenant/Branch
    tenantId: string;
    branchId?: string; // If empty, applies to all branches in tenant
}

export interface HotelConstitution {
    // Sections
    generalPolicies: GeneralInstruction[]; // سياسات عامة
    employeeRights: GeneralInstruction[]; // حقوق الموظفين (ما له)
    employeeObligations: GeneralInstruction[]; // واجبات الموظفين (ما عليه)
    departmentInstructions: Record<string, GeneralInstruction[]>; // تعليمات خاصة بكل قسم
    procedures: GeneralInstruction[]; // إجراءات العمل
}

// ============================================================
// COLLECTION HELPERS
// ============================================================

const getInstructionsCollectionRef = (tenantId: string) => 
    collection(db, 'tenants', tenantId, 'general_instructions');
const getInstructionDocRef = (tenantId: string, instructionId: string) => 
    doc(db, 'tenants', tenantId, 'general_instructions', instructionId);

// ============================================================
// INSTRUCTION MANAGEMENT
// ============================================================

/**
 * Create general instruction
 */
export const createGeneralInstruction = async (
    tenantId: string,
    instruction: Omit<GeneralInstruction, 'id' | 'createdAt' | 'tenantId'>,
    managerId: string,
    managerName: string
): Promise<string> => {
    try {
        const instructionData: Omit<GeneralInstruction, 'id'> = {
            ...instruction,
            tenantId,
            createdAt: Timestamp.now(),
            createdBy: { id: managerId, name: managerName }
        };

        const docRef = doc(getInstructionsCollectionRef(tenantId));
        await setDoc(docRef, instructionData);

        return docRef.id;
    } catch (error) {
        console.error('Error creating general instruction:', error);
        throw error;
    }
};

/**
 * Update general instruction
 */
export const updateGeneralInstruction = async (
    tenantId: string,
    instructionId: string,
    updates: Partial<GeneralInstruction>,
    managerId: string,
    managerName: string
): Promise<void> => {
    try {
        await updateDoc(getInstructionDocRef(tenantId, instructionId), {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: managerId, name: managerName }
        });
    } catch (error) {
        console.error('Error updating general instruction:', error);
        throw error;
    }
};

/**
 * Delete/Deactivate general instruction
 */
export const deactivateGeneralInstruction = async (tenantId: string, instructionId: string): Promise<void> => {
    try {
        await updateDoc(getInstructionDocRef(tenantId, instructionId), {
            isActive: false,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error deactivating general instruction:', error);
        throw error;
    }
};

/**
 * Get instructions for a department
 */
export const getInstructionsForDepartment = async (
    tenantId: string,
    department: string,
    branchId?: string
): Promise<HotelConstitution> => {
    try {
        const q = query(
            getInstructionsCollectionRef(tenantId),
            where('isActive', '==', true)
        );

        const snapshot = await getDocs(q);
        const instructions: GeneralInstruction[] = [];

        snapshot.forEach(doc => {
            const data = doc.data() as GeneralInstruction;
            
            // Check branch targeting
            if (data.branchId && branchId && data.branchId !== branchId) {
                return; // Not for this branch
            }

            // Check department targeting
            if (data.targetDepartment !== 'all' && 
                data.targetDepartment !== 'general' && 
                data.targetDepartment !== department) {
                return; // Not for this department
            }

            instructions.push({
                id: doc.id,
                ...data
            });
        });

        // Organize by sections
        const constitution: HotelConstitution = {
            generalPolicies: instructions.filter(i => 
                i.targetDepartment === 'general' || i.targetDepartment === 'all'
            ).filter(i => i.category === 'general_policy' || i.section === 'دستور الفندق'),
            employeeRights: instructions.filter(i => 
                i.category === 'rights' || i.section === 'حقوق الموظفين'
            ),
            employeeObligations: instructions.filter(i => 
                i.category === 'obligations' || i.section === 'واجبات الموظفين'
            ),
            departmentInstructions: {},
            procedures: instructions.filter(i => 
                i.category === 'procedures' || i.section === 'إجراءات العمل'
            )
        };

        // Group department-specific instructions
        const deptSpecific = instructions.filter(i => 
            i.targetDepartment !== 'all' && 
            i.targetDepartment !== 'general' &&
            i.category === 'department_specific'
        );

        deptSpecific.forEach(instruction => {
            const dept = instruction.targetDepartment;
            if (!constitution.departmentInstructions[dept]) {
                constitution.departmentInstructions[dept] = [];
            }
            constitution.departmentInstructions[dept].push(instruction);
        });

        // Sort by order
        Object.keys(constitution).forEach(key => {
            if (Array.isArray((constitution as any)[key])) {
                (constitution as any)[key].sort((a: GeneralInstruction, b: GeneralInstruction) => 
                    (a.order || 0) - (b.order || 0)
                );
            }
        });

        return constitution;
    } catch (error) {
        console.error('Error getting instructions:', error);
        return {
            generalPolicies: [],
            employeeRights: [],
            employeeObligations: [],
            departmentInstructions: {},
            procedures: []
        };
    }
};

/**
 * Subscribe to instructions for a department (real-time)
 */
export const subscribeToInstructions = (
    tenantId: string,
    department: string,
    branchId: string | undefined,
    callback: (constitution: HotelConstitution) => void
): (() => void) => {
    const q = query(
        getInstructionsCollectionRef(tenantId),
        where('isActive', '==', true),
        orderBy('order', 'asc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const instructions: GeneralInstruction[] = [];

            snapshot.forEach(doc => {
                const data = doc.data() as GeneralInstruction;
                
                // Check branch targeting
                if (data.branchId && branchId && data.branchId !== branchId) {
                    return; // Not for this branch
                }

                // Check department targeting
                if (data.targetDepartment !== 'all' && 
                    data.targetDepartment !== 'general' && 
                    data.targetDepartment !== department) {
                    return; // Not for this department
                }

                instructions.push({
                    id: doc.id,
                    ...data
                });
            });

            // Organize by sections
            const constitution: HotelConstitution = {
                generalPolicies: instructions.filter(i => 
                    i.targetDepartment === 'general' || i.targetDepartment === 'all'
                ).filter(i => i.category === 'general_policy' || i.section === 'دستور الفندق'),
                employeeRights: instructions.filter(i => 
                    i.category === 'rights' || i.section === 'حقوق الموظفين'
                ),
                employeeObligations: instructions.filter(i => 
                    i.category === 'obligations' || i.section === 'واجبات الموظفين'
                ),
                departmentInstructions: {},
                procedures: instructions.filter(i => 
                    i.category === 'procedures' || i.section === 'إجراءات العمل'
                )
            };

            // Group department-specific instructions
            const deptSpecific = instructions.filter(i => 
                i.targetDepartment !== 'all' && 
                i.targetDepartment !== 'general' &&
                i.category === 'department_specific'
            );

            deptSpecific.forEach(instruction => {
                const dept = instruction.targetDepartment;
                if (!constitution.departmentInstructions[dept]) {
                    constitution.departmentInstructions[dept] = [];
                }
                constitution.departmentInstructions[dept].push(instruction);
            });

            // Sort by order
            Object.keys(constitution).forEach(key => {
                if (Array.isArray((constitution as any)[key])) {
                    (constitution as any)[key].sort((a: GeneralInstruction, b: GeneralInstruction) => 
                        (a.order || 0) - (b.order || 0)
                    );
                }
            });

            Object.keys(constitution.departmentInstructions).forEach(dept => {
                constitution.departmentInstructions[dept].sort((a, b) => 
                    (a.order || 0) - (b.order || 0)
                );
            });

            callback(constitution);
        },
        (error) => {
            console.error('Error subscribing to instructions:', error);
            callback({
                generalPolicies: [],
                employeeRights: [],
                employeeObligations: [],
                departmentInstructions: {},
                procedures: []
            });
        }
    );
};

/**
 * Get all instructions (for manager management)
 */
export const getAllInstructions = async (tenantId: string): Promise<GeneralInstruction[]> => {
    try {
        const q = query(
            getInstructionsCollectionRef(tenantId),
            orderBy('order', 'asc'),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GeneralInstruction));
    } catch (error) {
        console.error('Error getting all instructions:', error);
        return [];
    }
};

/**
 * Subscribe to all instructions (for manager management)
 */
export const subscribeToAllInstructions = (
    tenantId: string,
    callback: (instructions: GeneralInstruction[]) => void
): (() => void) => {
    const q = query(
        getInstructionsCollectionRef(tenantId),
        orderBy('order', 'asc'),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const instructions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as GeneralInstruction));
            callback(instructions);
        },
        (error) => {
            console.error('Error subscribing to all instructions:', error);
            callback([]);
        }
    );
};
