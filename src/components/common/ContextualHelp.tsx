/**
 * Contextual Help Component
 * Provides in-page guidance that persists for future reference
 * 
 * 🎯 Purpose: Help users understand where they are, what to do, and what it affects
 */

import React, { useState } from 'react';
import { 
    ChevronDown, 
    ChevronUp, 
    Info, 
    CheckCircle, 
    ArrowRight,
    Lightbulb,
    AlertTriangle,
    BookOpen,
    MapPin
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface HelpStep {
    title: string;
    description?: string;
    status?: 'done' | 'current' | 'pending';
}

export interface ContextualHelpProps {
    /** Main title - "أنت هنا لـ..." */
    title: string;
    /** Quick summary in one line */
    quickGuide: string;
    /** What this action affects */
    affects?: string[];
    /** Steps or workflow */
    steps?: HelpStep[];
    /** Important tips */
    tips?: string[];
    /** Warning messages */
    warnings?: string[];
    /** Color theme */
    theme?: 'teal' | 'amber' | 'purple' | 'cyan' | 'blue' | 'green';
    /** Show expanded by default */
    defaultExpanded?: boolean;
    /** Custom icon */
    icon?: React.ReactNode;
    /** Compact mode for smaller spaces */
    compact?: boolean;
}

// ============================================================
// THEME CONFIG
// ============================================================

const THEMES = {
    teal: {
        primary: 'from-teal-500/10 to-emerald-500/10',
        border: 'border-teal-500/20',
        text: 'text-teal-400',
        bg: 'bg-teal-500/10',
    },
    amber: {
        primary: 'from-amber-500/10 to-orange-500/10',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
    },
    purple: {
        primary: 'from-purple-500/10 to-pink-500/10',
        border: 'border-purple-500/20',
        text: 'text-purple-400',
        bg: 'bg-purple-500/10',
    },
    cyan: {
        primary: 'from-cyan-500/10 to-blue-500/10',
        border: 'border-cyan-500/20',
        text: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
    },
    blue: {
        primary: 'from-blue-500/10 to-indigo-500/10',
        border: 'border-blue-500/20',
        text: 'text-blue-400',
        bg: 'bg-blue-500/10',
    },
    green: {
        primary: 'from-green-500/10 to-emerald-500/10',
        border: 'border-green-500/20',
        text: 'text-green-400',
        bg: 'bg-green-500/10',
    },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
    title,
    quickGuide,
    affects,
    steps,
    tips,
    warnings,
    theme = 'teal',
    defaultExpanded = false,
    icon,
    compact = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const themeConfig = THEMES[theme];

    return (
        <div className={`rounded-xl sm:rounded-2xl overflow-hidden ${compact ? 'mb-3' : 'mb-6'} glass-card`}
             style={{
                 border: '1px solid var(--theme-border-primary)',
                 boxShadow: 'var(--theme-shadow-card, 0 4px 20px rgba(0, 0, 0, 0.12))',
             }}>
            {/* Quick Guide - Always Visible - ✅ Premium Design with Theme Support */}
            <div className={`p-4 sm:p-5 bg-gradient-to-r ${themeConfig.primary} border ${themeConfig.border} transition-all duration-300`}
                 style={{ 
                     borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                     background: theme === 'amber' 
                         ? 'linear-gradient(135deg, var(--theme-primary-500) 0%, var(--theme-primary-600) 100%)' 
                         : `linear-gradient(135deg, var(--theme-primary-400), var(--theme-primary-500))`,
                     borderColor: theme === 'amber' ? 'var(--theme-primary-500)' : 'var(--theme-border-primary)',
                     boxShadow: 'var(--theme-shadow-lg)',
                 }}>
                <div className="flex items-start gap-3 sm:gap-4">
                    {/* Icon Container - Premium Design */}
                    <div 
                        className="p-2.5 sm:p-3 rounded-xl flex-shrink-0"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border-primary)',
                            boxShadow: 'var(--theme-shadow-sm)',
                        }}
                    >
                        {icon || (
                            <Info 
                                className="w-5 h-5 sm:w-6 sm:h-6" 
                                style={{ color: 'var(--theme-primary-500)' }}
                            />
                        )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <h3 
                            className="font-bold text-base sm:text-lg mb-2 sm:mb-2.5 flex items-center gap-2 sm:gap-3"
                            style={{ color: 'var(--theme-text-primary)' }}
                        >
                            {icon ? null : (
                                <MapPin 
                                    className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" 
                                    style={{ color: 'var(--theme-primary-500)' }}
                                />
                            )}
                            {title}
                        </h3>
                        <div 
                            className="text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg leading-relaxed transition-all"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                color: 'var(--theme-text-secondary)',
                                border: '1px solid var(--theme-border-primary)',
                            }}
                        >
                            {quickGuide}
                        </div>
                    </div>
                    
                    {/* Expand Button */}
                    {(steps || tips || warnings || affects) && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-2 sm:p-2.5 rounded-lg transition-all flex-shrink-0 hover:scale-110 active:scale-95"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)',
                            }}
                        >
                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                            ) : (
                                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Details - Theme Compatible */}
            {isExpanded && (steps || tips || warnings || affects) && (
                <div 
                    className="p-4 sm:p-5 border border-t-0 rounded-b-xl space-y-4 transition-all duration-300"
                    style={{
                        background: 'var(--theme-bg-secondary)',
                        borderColor: 'var(--theme-border-primary)',
                    }}
                >
                    
                    {/* What This Affects - Theme Compatible */}
                    {affects && affects.length > 0 && (
                        <div className="space-y-3">
                            <h4 
                                className="text-sm sm:text-base font-semibold flex items-center gap-2"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                <ArrowRight 
                                    className="w-4 h-4 sm:w-5 sm:h-5" 
                                    style={{ color: 'var(--theme-primary-500)' }}
                                />
                                سيؤثر على:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {affects.map((item, i) => (
                                    <span 
                                        key={i} 
                                        className="text-xs sm:text-sm px-3 py-1.5 rounded-full font-medium transition-all hover:scale-105"
                                        style={{
                                            background: 'var(--theme-primary-100)',
                                            color: 'var(--theme-primary-700)',
                                            border: '1px solid var(--theme-primary-300)',
                                        }}
                                    >
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Steps - Premium Design */}
                    {steps && steps.length > 0 && (
                        <div className="space-y-3">
                            <h4 
                                className="text-sm sm:text-base font-semibold flex items-center gap-2"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                <BookOpen 
                                    className="w-4 h-4 sm:w-5 sm:h-5" 
                                    style={{ color: 'var(--theme-primary-500)' }}
                                />
                                الخطوات:
                            </h4>
                            <div className="space-y-2.5">
                                {steps.map((step, i) => (
                                    <div 
                                        key={i} 
                                        className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all hover:scale-[1.02]"
                                        style={{
                                            background: step.status === 'done' 
                                                ? 'var(--theme-success-50, rgba(34, 197, 94, 0.1))'
                                                : step.status === 'current'
                                                ? 'var(--theme-primary-50, rgba(20, 184, 166, 0.1))'
                                                : 'var(--theme-bg-tertiary)',
                                            border: `1px solid ${
                                                step.status === 'done'
                                                    ? 'var(--theme-success-300, rgba(34, 197, 94, 0.3))'
                                                    : step.status === 'current'
                                                    ? 'var(--theme-primary-300, rgba(20, 184, 166, 0.3))'
                                                    : 'var(--theme-border-primary)'
                                            }`,
                                            boxShadow: step.status === 'current' ? 'var(--theme-shadow-sm)' : 'none',
                                        }}
                                    >
                                        <span 
                                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 transition-all"
                                            style={{
                                                background: step.status === 'done' 
                                                    ? 'var(--theme-success-500, #22c55e)' 
                                                    : step.status === 'current'
                                                    ? 'var(--theme-primary-500)'
                                                    : 'var(--theme-bg-tertiary)',
                                                color: step.status === 'done' || step.status === 'current' 
                                                    ? 'white' 
                                                    : 'var(--theme-text-secondary)',
                                                border: step.status === 'done' || step.status === 'current'
                                                    ? 'none'
                                                    : '1px solid var(--theme-border-primary)',
                                            }}
                                        >
                                            {step.status === 'done' ? (
                                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                                            ) : (
                                                i + 1
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <span 
                                                className="text-sm sm:text-base font-medium block"
                                                style={{
                                                    color: step.status === 'done'
                                                        ? 'var(--theme-success-600, #16a34a)'
                                                        : step.status === 'current'
                                                        ? 'var(--theme-primary-600)'
                                                        : 'var(--theme-text-primary)',
                                                }}
                                            >
                                                {step.title}
                                            </span>
                                            {step.description && (
                                                <p 
                                                    className="text-xs sm:text-sm mt-1"
                                                    style={{ color: 'var(--theme-text-secondary)' }}
                                                >
                                                    {step.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tips - Theme Compatible */}
                    {tips && tips.length > 0 && (
                        <div 
                            className="p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
                            style={{
                                background: 'var(--theme-primary-50, rgba(20, 184, 166, 0.1))',
                                border: '1px solid var(--theme-primary-200, rgba(20, 184, 166, 0.2))',
                            }}
                        >
                            <h4 
                                className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2"
                                style={{ color: 'var(--theme-primary-600)' }}
                            >
                                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
                                نصائح:
                            </h4>
                            <ul className="space-y-2">
                                {tips.map((tip, i) => (
                                    <li 
                                        key={i} 
                                        className="text-xs sm:text-sm flex items-start gap-2.5"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        <span style={{ color: 'var(--theme-primary-500)' }}>•</span>
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Warnings - Theme Compatible */}
                    {warnings && warnings.length > 0 && (
                        <div 
                            className="p-4 sm:p-5 rounded-xl transition-all hover:scale-[1.01]"
                            style={{
                                background: 'var(--theme-error-50, rgba(239, 68, 68, 0.1))',
                                border: '1px solid var(--theme-error-200, rgba(239, 68, 68, 0.2))',
                            }}
                        >
                            <h4 
                                className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2"
                                style={{ color: 'var(--theme-error-600, #dc2626)' }}
                            >
                                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                                تنبيهات:
                            </h4>
                            <ul className="space-y-2">
                                {warnings.map((warn, i) => (
                                    <li 
                                        key={i} 
                                        className="text-xs sm:text-sm flex items-start gap-2.5"
                                        style={{ color: 'var(--theme-error-700, #b91c1c)' }}
                                    >
                                        <span>⚠</span>
                                        <span>{warn}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// PRE-BUILT HELP CONFIGS
// ============================================================

/** Help for Create Manager page (Owner) - Premium Design */
export const CreateManagerHelp: React.FC = () => (
    <ContextualHelp
        title="إنشاء مدير فندق جديد"
        quickGuide="أكمل بيانات المدير واختر الباقة لإتمام إنشاء الحساب"
        theme="amber"
        icon={<MapPin className="w-6 h-6" style={{ color: 'var(--theme-primary-500)' }} />}
        affects={[
            'عدد المشتركين النشطين',
            'إجمالي الإيرادات',
            'سجل الفواتير',
        ]}
        steps={[
            { title: 'أدخل اسم الفندق والمدير', status: 'current' },
            { title: 'اختر الباقة ومدة الترخيص' },
            { title: 'حدد السعر (أو استخدم الافتراضي)' },
            { title: 'اضغط إنشاء - سيتم توليد PIN تلقائياً' },
        ]}
        tips={[
            'السعر الافتراضي يمكن تغييره من الإعدادات',
            'كود PIN مكون من 6 أرقام فريد لكل مدير',
            'المدير يستلم رسالة بالبيانات تلقائياً',
        ]}
        warnings={[
            'لا يمكن تغيير اسم الفندق بعد الإنشاء',
            'حذف المدير يحذف كل بياناته وموظفيه',
        ]}
    />
);

/** Help for Employees Management page (Manager) */
export const EmployeesManagerHelp: React.FC = () => (
    <ContextualHelp
        title="إدارة الموظفين"
        quickGuide="أضف موظف → حدد القسم والفروع → سيحصل على PIN للدخول"
        theme="purple"
        affects={[
            'عدد الموظفين في كل قسم',
            'توزيع المهام التلقائي',
            'تقارير الأداء',
        ]}
        steps={[
            { title: 'اضغط + إضافة موظف' },
            { title: 'أدخل الاسم واختر الأقسام (يمكن اختيار أكثر من قسم)' },
            { title: 'حدد الفروع المسموح بها' },
            { title: 'سيتم توليد PIN تلقائياً' },
        ]}
        tips={[
            'الموظف يمكن أن يعمل في أقسام متعددة',
            'صفّر النقاط شهرياً لتتبع الأداء',
            'إيقاف الحساب لا يحذفه، فقط يمنع الدخول',
        ]}
        warnings={[
            'حذف موظف يحذف سجل نقاطه نهائياً',
            'لا يمكنك إيقاف حسابك أنت كمدير',
        ]}
    />
);

/** Help for Rooms Management page (Manager) */
export const RoomsManagerHelp: React.FC = () => (
    <ContextualHelp
        title="إدارة الغرف والأدوار"
        quickGuide="أضف غرف (فردي/جملة) → حدد الدور والنوع → الغرف جاهزة للحجز"
        theme="blue"
        affects={[
            'عدد الغرف المتاحة للحجز',
            'خريطة الفندق',
            'رموز QR للضيوف',
        ]}
        steps={[
            { title: 'اختر الفرع (لو عندك أكثر من فرع)' },
            { title: 'اضغط + إضافة غرفة' },
            { title: 'اختر: غرفة واحدة أو مجموعة غرف' },
            { title: 'حدد رقم الدور ونوع الغرفة' },
        ]}
        tips={[
            'إضافة مجموعة أسرع: حدد من 101 إلى 110 مثلاً',
            'يمكن تغيير نوع الغرفة لاحقاً',
            'الغرف الجديدة تكون "متاحة" تلقائياً',
        ]}
        warnings={[
            'حذف غرفة لا يمكن التراجع عنه',
            'غرفة مشغولة لا يمكن حذفها',
        ]}
    />
);

/** Help for QR Code Management */
export const QRManagerHelp: React.FC = () => (
    <ContextualHelp
        title="إدارة رموز QR"
        quickGuide="ولّد QR لكل غرفة → اطبعه → الضيف يمسحه للطلب"
        theme="green"
        affects={[
            'طريقة طلب الضيوف للخدمات',
            'تتبع طلبات كل غرفة',
            'أمان الوصول',
        ]}
        steps={[
            { title: 'اضغط "توليد QR" بجانب الغرفة' },
            { title: 'اطبع الـ QR وضعه في الغرفة' },
            { title: 'الضيف يمسح → يدخل آخر 4 أرقام جواله → يطلب' },
        ]}
        tips={[
            'QR آمن: لا يحتوي رقم الغرفة مباشرة',
            'يمكن إعادة توليد QR لو انتهت صلاحيته',
            'الطباعة الجماعية توفر الوقت',
        ]}
    />
);

export default ContextualHelp;
