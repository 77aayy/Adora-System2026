/**
 * General Instructions View
 * Displays hotel constitution and department-specific instructions
 * Shows employee rights (ما له) and obligations (ما عليه)
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { X, BookOpen, Users, Shield, AlertCircle, FileText, List, CheckCircle2, Info, Building2, Zap, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
    subscribeToInstructions,
    type HotelConstitution,
    type DepartmentType
} from '../../services/generalInstructionsService';

interface GeneralInstructionsViewProps {
    department: string;
    isOpen: boolean;
    onClose: () => void;
}

const DEPARTMENTS: Record<string, string> = {
    'reception': 'الاستقبال',
    'housekeeping': 'الهاوس كيبنج',
    'maintenance': 'الصيانة',
    'bellman': 'البيلمان',
    'coffee_shop': 'الكوفي شوب',
    'procurement': 'المشتريات',
    'all': 'جميع الأقسام'
};

export const GeneralInstructionsView: React.FC<GeneralInstructionsViewProps> = ({ department, isOpen, onClose }) => {
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    const [constitution, setConstitution] = useState<HotelConstitution>({
        generalPolicies: [],
        employeeRights: [],
        employeeObligations: [],
        departmentInstructions: {},
        procedures: []
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'constitution' | 'rights' | 'obligations' | 'department' | 'procedures'>('constitution');

    useEffect(() => {
        if (!isOpen || !tenantId || !department) return;

        const unsubscribe = subscribeToInstructions(
            tenantId,
            department,
            branchId,
            (data) => {
                setConstitution(data);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [isOpen, tenantId, department, branchId]);

    if (!isOpen) return null;

    const deptName = DEPARTMENTS[department] || department;
    const deptInstructions = constitution.departmentInstructions[department] || [];

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 3xl:p-8" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-lg sm:max-w-2xl lg:max-w-4xl 3xl:max-w-6xl 4xl:max-w-7xl max-h-[90vh] overflow-hidden rounded-xl sm:rounded-2xl 3xl:rounded-3xl modal-enter flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">دستور الفندق والتعليمات العامة</h2>
                            <p className="text-sm text-white/60">{deptName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-4 border-b border-white/10 overflow-x-auto flex-shrink-0">
                    {[
                        { id: 'constitution', label: 'دستور الفندق', icon: <BookOpen className="w-4 h-4" /> },
                        { id: 'rights', label: 'ما له (حقوق)', icon: <Shield className="w-4 h-4" /> },
                        { id: 'obligations', label: 'ما عليه (واجبات)', icon: <AlertCircle className="w-4 h-4" /> },
                        { id: 'department', label: `تعليمات ${deptName}`, icon: <Building2 className="w-4 h-4" />, count: deptInstructions.length },
                        { id: 'procedures', label: 'إجراءات العمل', icon: <FileText className="w-4 h-4" /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                                activeTab === tab.id
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                    : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/20'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <>
                            {/* دستور الفندق */}
                            {activeTab === 'constitution' && (
                                <div className="space-y-6">
                                    {constitution.generalPolicies.length === 0 ? (
                                        <div className="text-center py-12 text-white/40">
                                            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p>لا توجد سياسات عامة</p>
                                        </div>
                                    ) : (
                                        constitution.generalPolicies.map((instruction, idx) => (
                                            <div
                                                key={instruction.id}
                                                className="glass-card p-6 rounded-xl border border-white/10 hover:border-blue-500/30 transition-all"
                                            >
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                        <BookOpen className="w-5 h-5 text-blue-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-bold text-lg mb-2">
                                                            {instruction.titleAr || instruction.title}
                                                        </h3>
                                                        {instruction.section && (
                                                            <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium">
                                                                {instruction.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="prose prose-invert max-w-none">
                                                    <div 
                                                        className="text-white/80 leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: (instruction.contentAr || instruction.content).replace(/\n/g, '<br />') }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* حقوق الموظفين (ما له) */}
                            {activeTab === 'rights' && (
                                <div className="space-y-6">
                                    {constitution.employeeRights.length === 0 ? (
                                        <div className="text-center py-12 text-white/40">
                                            <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p>لا توجد حقوق محددة</p>
                                        </div>
                                    ) : (
                                        constitution.employeeRights.map((instruction, idx) => (
                                            <div
                                                key={instruction.id}
                                                className="glass-card p-6 rounded-xl border border-green-500/30 bg-green-500/5 hover:border-green-500/50 transition-all"
                                            >
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-bold text-lg mb-2">
                                                            {instruction.titleAr || instruction.title}
                                                        </h3>
                                                        {instruction.section && (
                                                            <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium">
                                                                {instruction.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="prose prose-invert max-w-none">
                                                    <div 
                                                        className="text-white/80 leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: (instruction.contentAr || instruction.content).replace(/\n/g, '<br />') }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* واجبات الموظفين (ما عليه) */}
                            {activeTab === 'obligations' && (
                                <div className="space-y-6">
                                    {constitution.employeeObligations.length === 0 ? (
                                        <div className="text-center py-12 text-white/40">
                                            <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p>لا توجد واجبات محددة</p>
                                        </div>
                                    ) : (
                                        constitution.employeeObligations.map((instruction, idx) => (
                                            <div
                                                key={instruction.id}
                                                className="glass-card p-6 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 transition-all"
                                            >
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                        <AlertCircle className="w-5 h-5 text-orange-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-bold text-lg mb-2">
                                                            {instruction.titleAr || instruction.title}
                                                        </h3>
                                                        {instruction.section && (
                                                            <span className="px-2 py-1 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-medium">
                                                                {instruction.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="prose prose-invert max-w-none">
                                                    <div 
                                                        className="text-white/80 leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: (instruction.contentAr || instruction.content).replace(/\n/g, '<br />') }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* تعليمات القسم */}
                            {activeTab === 'department' && (
                                <div className="space-y-6">
                                    {deptInstructions.length === 0 ? (
                                        <div className="text-center py-12 text-white/40">
                                            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p>لا توجد تعليمات خاصة بقسم {deptName}</p>
                                        </div>
                                    ) : (
                                        deptInstructions.map((instruction, idx) => (
                                            <div
                                                key={instruction.id}
                                                className="glass-card p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 transition-all"
                                            >
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                        <Info className="w-5 h-5 text-blue-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-bold text-lg mb-2">
                                                            {instruction.titleAr || instruction.title}
                                                        </h3>
                                                        {instruction.section && (
                                                            <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium">
                                                                {instruction.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="prose prose-invert max-w-none">
                                                    <div 
                                                        className="text-white/80 leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: (instruction.contentAr || instruction.content).replace(/\n/g, '<br />') }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* إجراءات العمل */}
                            {activeTab === 'procedures' && (
                                <div className="space-y-6">
                                    {constitution.procedures.length === 0 ? (
                                        <div className="text-center py-12 text-white/40">
                                            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                            <p>لا توجد إجراءات محددة</p>
                                        </div>
                                    ) : (
                                        constitution.procedures.map((instruction, idx) => (
                                            <div
                                                key={instruction.id}
                                                className="glass-card p-6 rounded-xl border border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50 transition-all"
                                            >
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                        <List className="w-5 h-5 text-purple-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="text-white font-bold text-lg mb-2">
                                                            {instruction.titleAr || instruction.title}
                                                        </h3>
                                                        {instruction.section && (
                                                            <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium">
                                                                {instruction.section}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="prose prose-invert max-w-none">
                                                    <div 
                                                        className="text-white/80 leading-relaxed whitespace-pre-line"
                                                        dangerouslySetInnerHTML={{ __html: (instruction.contentAr || instruction.content).replace(/\n/g, '<br />') }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors font-medium"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};
