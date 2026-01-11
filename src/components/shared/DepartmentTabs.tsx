/**
 * Department Tabs Component
 * Shows department tabs for employees with multiple department access
 * Adora Hotel Management System V3 - SaaS
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    Phone, 
    Sparkles, 
    BellRing, 
    Wrench, 
    ShoppingCart, 
    Coffee,
    Shield
} from 'lucide-react';

// ============================================================
// DEPARTMENT CONFIG
// ============================================================

interface DepartmentConfig {
    id: string;
    label: string;
    labelEn: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    route: string;
}

const DEPARTMENT_MAP: Record<string, DepartmentConfig> = {
    reception: {
        id: 'reception',
        label: 'الاستقبال',
        labelEn: 'Reception',
        icon: <Phone className="w-4 h-4" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        route: '/reception'
    },
    housekeeping: {
        id: 'housekeeping',
        label: 'النظافة',
        labelEn: 'Housekeeping',
        icon: <Sparkles className="w-4 h-4" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        route: '/housekeeping'
    },
    bellman: {
        id: 'bellman',
        label: 'البيلمان',
        labelEn: 'Bellman',
        icon: <BellRing className="w-4 h-4" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        route: '/bellman'
    },
    maintenance: {
        id: 'maintenance',
        label: 'الصيانة',
        labelEn: 'Maintenance',
        icon: <Wrench className="w-4 h-4" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        route: '/maintenance'
    },
    procurement: {
        id: 'procurement',
        label: 'المشتريات',
        labelEn: 'Procurement',
        icon: <ShoppingCart className="w-4 h-4" />,
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/20',
        route: '/procurement'
    },
    coffee_shop: {
        id: 'coffee_shop',
        label: 'الكافي شوب',
        labelEn: 'Coffee Shop',
        icon: <Coffee className="w-4 h-4" />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        route: '/coffee-shop'
    },
    admin: {
        id: 'admin',
        label: 'الإدارة',
        labelEn: 'Admin',
        icon: <Shield className="w-4 h-4" />,
        color: 'text-teal-400',
        bgColor: 'bg-teal-500/20',
        route: '/admin'
    }
};

// ============================================================
// COMPONENT PROPS
// ============================================================

interface DepartmentTabsProps {
    className?: string;
    compact?: boolean;
}

// ============================================================
// DEPARTMENT TABS COMPONENT
// ============================================================

export const DepartmentTabs: React.FC<DepartmentTabsProps> = ({
    className = '',
    compact = false
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    // Get allowed departments from user
    const allowedDepartments: string[] = React.useMemo(() => {
        if (!user) return [];
        
        // Managers and Owners can see all departments
        if (user.role === 'manager' || user.role === 'owner') {
            return Object.keys(DEPARTMENT_MAP);
        }

        // For employees, check the departments array
        const userDepartments = (user as any).departments;
        if (userDepartments && Array.isArray(userDepartments) && userDepartments.length > 0) {
            return userDepartments;
        }

        // Fallback to single department
        const singleDept = (user as any).department || user.department;
        if (singleDept) {
            return [singleDept];
        }

        return [];
    }, [user]);

    // Don't render if only one department (or none)
    if (allowedDepartments.length <= 1) {
        return null;
    }

    // Get current active department from route
    const currentDept = React.useMemo(() => {
        const path = location.pathname;
        for (const [key, config] of Object.entries(DEPARTMENT_MAP)) {
            if (path.startsWith(config.route)) {
                return key;
            }
        }
        return allowedDepartments[0] || 'reception';
    }, [location.pathname, allowedDepartments]);

    // Handle department switch
    const handleDeptSwitch = (deptId: string) => {
        const config = DEPARTMENT_MAP[deptId];
        if (config) {
            navigate(config.route);
        }
    };

    // Compact version (icon only)
    if (compact) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {allowedDepartments.map(deptId => {
                    const config = DEPARTMENT_MAP[deptId];
                    if (!config) return null;
                    
                    const isActive = currentDept === deptId;
                    return (
                        <button
                            key={deptId}
                            onClick={() => handleDeptSwitch(deptId)}
                            title={config.label}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                isActive 
                                    ? `${config.bgColor} ${config.color}` 
                                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                            }`}
                        >
                            {config.icon}
                        </button>
                    );
                })}
            </div>
        );
    }

    // Full version (icon + label)
    return (
        <div className={`flex items-center gap-2 overflow-x-auto pb-2 ${className}`}>
            {allowedDepartments.map(deptId => {
                const config = DEPARTMENT_MAP[deptId];
                if (!config) return null;
                
                const isActive = currentDept === deptId;
                return (
                    <button
                        key={deptId}
                        onClick={() => handleDeptSwitch(deptId)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${
                            isActive 
                                ? `${config.bgColor} ${config.color} border border-white/20` 
                                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
                        }`}
                    >
                        {config.icon}
                        <span className="text-sm font-medium">{config.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

// ============================================================
// HELPER HOOK
// ============================================================

export const useAllowedDepartments = () => {
    const { user } = useAuth();

    const allowedDepartments: string[] = React.useMemo(() => {
        if (!user) return [];
        
        // Managers and Owners can see all departments
        if (user.role === 'manager' || user.role === 'owner') {
            return Object.keys(DEPARTMENT_MAP);
        }

        // For employees, check the departments array
        const userDepartments = (user as any).departments;
        if (userDepartments && Array.isArray(userDepartments) && userDepartments.length > 0) {
            return userDepartments;
        }

        // Fallback to single department
        const singleDept = (user as any).department || user.department;
        if (singleDept) {
            return [singleDept];
        }

        return [];
    }, [user]);

    const hasMultipleDepartments = allowedDepartments.length > 1;
    const primaryDepartment = allowedDepartments[0] || null;

    const canAccessDepartment = (deptId: string) => {
        // Managers and Owners can access all
        if (user?.role === 'manager' || user?.role === 'owner') {
            return true;
        }
        return allowedDepartments.includes(deptId);
    };

    return {
        allowedDepartments,
        hasMultipleDepartments,
        primaryDepartment,
        canAccessDepartment,
        departmentMap: DEPARTMENT_MAP
    };
};

export default DepartmentTabs;
