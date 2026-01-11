/**
 * Empty State Component
 * Beautiful empty states with helpful messages and actions
 * Adora Hotel Management System V2
 */

import React from 'react';
import { LucideIcon, Inbox, Search, Database, Package, Bell, History, Users, BedDouble } from 'lucide-react';

interface EmptyStateProps {
    icon?: LucideIcon;
    iconSize?: number;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    iconSize = 64,
    title,
    description,
    action,
    className = '',
    size = 'md',
}) => {
    const sizeClasses = {
        sm: 'py-8',
        md: 'py-12',
        lg: 'py-16',
    };

    const iconSizeClasses = {
        sm: 'w-12 h-12',
        md: 'w-16 h-16',
        lg: 'w-20 h-20',
    };

    const titleSizeClasses = {
        sm: 'text-base',
        md: 'text-lg',
        lg: 'text-xl',
    };

    return (
        <div className={`flex flex-col items-center justify-center text-center ${sizeClasses[size]} ${className}`}>
            {/* Icon */}
            {Icon && (
                <div
                    className={`${iconSizeClasses[size]} rounded-full bg-white/5 flex items-center justify-center mb-4 animate-fade-in-up`}
                    style={{ animationDelay: '0ms' }}
                >
                    <Icon className="w-1/2 h-1/2 text-white/20" size={iconSize} />
                </div>
            )}

            {/* Title */}
            <h3
                className={`${titleSizeClasses[size]} font-bold text-white/60 mb-2 animate-fade-in-up`}
                style={{ animationDelay: '100ms' }}
            >
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p
                    className="text-sm text-white/40 max-w-md mx-auto mb-6 animate-fade-in-up"
                    style={{ animationDelay: '200ms' }}
                >
                    {description}
                </p>
            )}

            {/* Action Button */}
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-6 py-3 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all flex items-center gap-2 animate-fade-in-up hover:scale-105 active:scale-95"
                    style={{ animationDelay: '300ms' }}
                >
                    {action.icon && <action.icon className="w-5 h-5" />}
                    {action.label}
                </button>
            )}
        </div>
    );
};

/**
 * Common Empty State Presets
 */
export const EmptyStates = {
    NoRequests: ({ onCreate }: { onCreate?: () => void }) => (
        <EmptyState
            icon={Inbox}
            title="لا توجد طلبات"
            description="لم يتم إنشاء أي طلبات بعد. يمكنك إنشاء طلب جديد الآن."
            action={onCreate ? { label: 'إنشاء طلب جديد', onClick: onCreate } : undefined}
        />
    ),

    NoResults: ({ onClear }: { onClear?: () => void }) => (
        <EmptyState
            icon={Search}
            title="لا توجد نتائج"
            description="لم نتمكن من العثور على أي نتائج تطابق بحثك. جرب كلمات أخرى."
            action={onClear ? { label: 'مسح البحث', onClick: onClear } : undefined}
        />
    ),

    NoData: ({ message }: { message?: string }) => (
        <EmptyState
            icon={Database}
            title="لا توجد بيانات"
            description={message || "لا توجد بيانات متاحة للعرض."}
        />
    ),

    NoItems: ({ onCreate }: { onCreate?: () => void }) => (
        <EmptyState
            icon={Package}
            title="لا توجد عناصر"
            description="لا توجد عناصر في هذه القائمة. أضف عنصراً جديداً للبدء."
            action={onCreate ? { label: 'إضافة عنصر', onClick: onCreate } : undefined}
        />
    ),

    NoNotifications: () => (
        <EmptyState
            icon={Bell}
            title="لا توجد إشعارات"
            description="جميع الإشعارات محدثة. لا توجد إشعارات جديدة."
        />
    ),

    NoHistory: () => (
        <EmptyState
            icon={History}
            title="لا يوجد سجل"
            description="لا يوجد سجل للأنشطة بعد. سيظهر هنا عندما تكون هناك أنشطة."
        />
    ),

    NoEmployees: ({ onAdd }: { onAdd?: () => void }) => (
        <EmptyState
            icon={Users}
            title="لا يوجد موظفون"
            description="لم يتم إضافة أي موظفين بعد. أضف موظفاً جديداً للبدء."
            action={onAdd ? { label: 'إضافة موظف', onClick: onAdd } : undefined}
        />
    ),

    NoRooms: ({ onAdd }: { onAdd?: () => void }) => (
        <EmptyState
            icon={BedDouble}
            title="لا توجد غرف"
            description="لم يتم إضافة أي غرف بعد. أضف غرفة جديدة للبدء."
            action={onAdd ? { label: 'إضافة غرفة', onClick: onAdd } : undefined}
        />
    ),
};

export default EmptyState;
