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
    BookOpen
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
        <div className={`rounded-xl overflow-hidden ${compact ? 'mb-3' : 'mb-6'}`}>
            {/* Quick Guide - Always Visible */}
            <div className={`p-4 bg-gradient-to-r ${themeConfig.primary} border ${themeConfig.border}`}
                 style={{ borderRadius: isExpanded ? '12px 12px 0 0' : '12px' }}>
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${themeConfig.bg} flex-shrink-0`}>
                        {icon || <Info className={`w-5 h-5 ${themeConfig.text}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`font-bold ${themeConfig.text} mb-1 flex items-center gap-2`}>
                            📍 {title}
                        </h3>
                        <p className="text-sm text-white/80 font-mono bg-slate-800/50 px-3 py-2 rounded-lg">
                            {quickGuide}
                        </p>
                    </div>
                    {(steps || tips || warnings || affects) && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${themeConfig.text}`}
                        >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (steps || tips || warnings || affects) && (
                <div className={`p-4 bg-slate-800/50 border border-t-0 ${themeConfig.border} rounded-b-xl space-y-4`}>
                    
                    {/* What This Affects */}
                    {affects && affects.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                                <ArrowRight className="w-4 h-4 text-amber-400" />
                                سيؤثر على:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {affects.map((item, i) => (
                                    <span key={i} className="text-xs bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full border border-amber-500/20">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Steps */}
                    {steps && steps.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-cyan-400" />
                                الخطوات:
                            </h4>
                            <div className="space-y-2">
                                {steps.map((step, i) => (
                                    <div key={i} className={`flex items-start gap-3 p-2 rounded-lg ${
                                        step.status === 'done' ? 'bg-green-500/10' :
                                        step.status === 'current' ? 'bg-blue-500/10 border border-blue-500/30' :
                                        'bg-white/5'
                                    }`}>
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            step.status === 'done' ? 'bg-green-500 text-white' :
                                            step.status === 'current' ? 'bg-blue-500 text-white' :
                                            'bg-white/20 text-white/60'
                                        }`}>
                                            {step.status === 'done' ? <CheckCircle className="w-4 h-4" /> : i + 1}
                                        </span>
                                        <div className="flex-1">
                                            <span className={`text-sm ${
                                                step.status === 'done' ? 'text-green-400' :
                                                step.status === 'current' ? 'text-blue-300 font-medium' :
                                                'text-white/70'
                                            }`}>
                                                {step.title}
                                            </span>
                                            {step.description && (
                                                <p className="text-xs text-white/50 mt-0.5">{step.description}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    {tips && tips.length > 0 && (
                        <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <h4 className="text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                                <Lightbulb className="w-4 h-4" />
                                نصائح:
                            </h4>
                            <ul className="space-y-1">
                                {tips.map((tip, i) => (
                                    <li key={i} className="text-xs text-cyan-300 flex items-start gap-2">
                                        <span className="text-cyan-400">•</span>
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings && warnings.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                تنبيهات:
                            </h4>
                            <ul className="space-y-1">
                                {warnings.map((warn, i) => (
                                    <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                                        <span className="text-red-400">⚠</span>
                                        {warn}
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

/** Help for Create Manager page (Owner) */
export const CreateManagerHelp: React.FC = () => (
    <ContextualHelp
        title="إنشاء مدير فندق جديد"
        quickGuide="أدخل البيانات → حدد الباقة → أنشئ الحساب → يصله PIN للدخول"
        theme="amber"
        affects={[
            'عدد المديرين النشطين',
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
