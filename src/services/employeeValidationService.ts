/**
 * Employee Validation Service
 * Validates employee existence, status, and permissions before assignment
 * Adora Hotel Management System
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface EmployeeValidationResult {
  valid: boolean;
  employee?: {
    id: string;
    name: string;
    department: string;
    role: string;
    active: boolean;
    branch: string;
  };
  error?: string;
}

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Validate employee exists and is active
 * ✅ SECURITY: Prevents assigning tasks to deleted/inactive employees
 */
export async function validateEmployee(
  employeeId: string,
  requiredDepartment?: string
): Promise<EmployeeValidationResult> {
  try {
    // Get employee document
    const employeeRef = doc(db, 'users', employeeId);
    const employeeSnap = await getDoc(employeeRef);

    // Check if employee exists
    if (!employeeSnap.exists()) {
      return {
        valid: false,
        error: 'الموظف غير موجود في النظام'
      };
    }

    const employeeData = employeeSnap.data();

    // Check if employee is active
    if (employeeData.active === false) {
      return {
        valid: false,
        error: `الموظف ${employeeData.name} غير نشط حالياً`
      };
    }

    // Check department if required
    if (requiredDepartment && employeeData.department !== requiredDepartment) {
      return {
        valid: false,
        error: `الموظف ${employeeData.name} ليس من قسم ${getDepartmentName(requiredDepartment)}`
      };
    }

    // Valid employee
    return {
      valid: true,
      employee: {
        id: employeeSnap.id,
        name: employeeData.name,
        department: employeeData.department,
        role: employeeData.role || 'employee',
        active: employeeData.active !== false,
        branch: employeeData.branch || 'default'
      }
    };
  } catch (error) {
    console.error('Employee validation error:', error);
    return {
      valid: false,
      error: 'فشل التحقق من بيانات الموظف'
    };
  }
}

/**
 * Validate multiple employees (for team assignments)
 */
export async function validateEmployees(
  employeeIds: string[],
  requiredDepartment?: string
): Promise<{
  valid: boolean;
  validEmployees: Array<{ id: string; name: string }>;
  invalidEmployees: Array<{ id: string; reason: string }>;
}> {
  const validEmployees: Array<{ id: string; name: string }> = [];
  const invalidEmployees: Array<{ id: string; reason: string }> = [];

  for (const employeeId of employeeIds) {
    const result = await validateEmployee(employeeId, requiredDepartment);
    
    if (result.valid && result.employee) {
      validEmployees.push({
        id: result.employee.id,
        name: result.employee.name
      });
    } else {
      invalidEmployees.push({
        id: employeeId,
        reason: result.error || 'غير صالح'
      });
    }
  }

  return {
    valid: invalidEmployees.length === 0,
    validEmployees,
    invalidEmployees
  };
}

/**
 * Check if employee can be assigned to a specific task type
 */
export async function canAssignTask(
  employeeId: string,
  taskType: 'cleaning' | 'maintenance' | 'bellman' | 'inspection' | 'other'
): Promise<{ canAssign: boolean; reason?: string }> {
  const result = await validateEmployee(employeeId);

  if (!result.valid) {
    return { canAssign: false, reason: result.error };
  }

  if (!result.employee) {
    return { canAssign: false, reason: 'بيانات الموظف غير متوفرة' };
  }

  // Map task types to required departments
  const departmentMap: Record<string, string[]> = {
    cleaning: ['housekeeping', 'admin'],
    maintenance: ['maintenance', 'admin'],
    bellman: ['bellman', 'admin'],
    inspection: ['housekeeping', 'reception', 'admin'],
    other: ['admin']
  };

  const allowedDepartments = departmentMap[taskType] || ['admin'];

  if (!allowedDepartments.includes(result.employee.department)) {
    return {
      canAssign: false,
      reason: `الموظف من قسم ${getDepartmentName(result.employee.department)} ولا يمكنه التعامل مع هذا النوع من المهام`
    };
  }

  return { canAssign: true };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDepartmentName(department: string): string {
  const names: Record<string, string> = {
    housekeeping: 'الهاوس كيبنج',
    maintenance: 'الصيانة',
    bellman: 'البيلمان',
    reception: 'الاستقبال',
    admin: 'الإدارة',
    kitchen: 'المطبخ',
    procurement: 'المشتريات'
  };

  return names[department] || department;
}
