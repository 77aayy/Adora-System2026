/**
 * Points Configuration V4 (Slim & Unified)
 * Complete admin interface for configuring all points values
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Star, Save, RefreshCw, Settings, Sparkles, ChevronDown, ChevronUp,
    UserPlus, CheckCircle2, ClipboardCheck, Bell, Wrench, ShoppingCart,
    Clock, Zap, AlertCircle, ThumbsUp, ThumbsDown, Award, Timer, DollarSign,
    Trophy, Gift, Coffee, FileText, Download, Info
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { haptic, playSound } from '../../utils/uxEffects';
import { getChallengeConfig, getAvailableMilestones, saveChallengeConfig } from '../../services/challengeService';
import { AchievementsTab } from './AchievementsTab';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { generateRulebookPDF, generateQuickSummaryPDF } from '../../services/pdfRulebookService';
import { logger } from '../../services/loggerService';

// ============================================================
// TYPES (Unified with pointsService)
// ============================================================

export interface FullPointsConfig {
    bellman: {
        checkin: number;
        checkout: number;
        complete: number;
        fast: number;
        fastTime: number;
        delay: number;
        delayTime: number;
    };
    housekeeping: {
        start: number;
        completeOccupied: number;
        completeCheckout: number;
        inspection: number;
        fast: number;
        fastTime: number;
        delay: number;
        delayTime: number;
    };
    maintenance: {
        complete: number;
        fast: number;
        fastTime: number;
        delay: number;
        delayTime: number;
    };
    // ✅ Coffee Shop timing settings
    coffeeShop: {
        complete: number;
        fast: number;
        fastTime: number;
        delay: number;
        delayTime: number;
    };
    procurement: {
        purchase: number;
        receive: number;
        early: number;
        ontime: number;
        delay: number;
        targetTime: number;
        targetTimeHousekeeping: number;
        targetTimeMaintenance: number;
        targetTimeReception: number;
    };
    reception: {
        create: number;
        confirm: number;
        complete: number;
        targetConfirmationTime: number;
        lateConfirmationTime: number;
        veryLateConfirmationTime: number;
        lateConfirmationPenalty: number;
        veryLateConfirmationPenalty: number;
    };
    // ✅ Scenario 3: Shift Handover Gamification
    shiftHandover: {
        acknowledgeNote: number; // Points for confirming a note
    };
    ratings: {
        enabled: boolean;
        excellent: number;
        veryGood: number;
        good: number;
        fair: number;
        poor: number;
    };
    financial: {
        exchangeRate: number;
        minRedemption: number;
    };
}

const DEFAULT_CONFIG: FullPointsConfig = {
    bellman: {
        checkin: 1,
        checkout: 1,
        complete: 1,
        fast: 2,
        fastTime: 10,
        delay: -1,
        delayTime: 20
    },
    housekeeping: {
        start: 1,
        completeOccupied: 1,
        completeCheckout: 1,
        inspection: 1,
        fast: 2,
        fastTime: 25,
        delay: -1,
        delayTime: 30
    },
    maintenance: {
        complete: 1,
        fast: 2,
        fastTime: 30,
        delay: -1,
        delayTime: 60
    },
    // ✅ Coffee Shop defaults
    coffeeShop: {
        complete: 1,
        fast: 2,
        fastTime: 10,      // Fast if under 10 minutes
        delay: -1,
        delayTime: 20      // Delayed if over 20 minutes
    },
    procurement: {
        purchase: 1,
        receive: 1,
        early: 2,
        ontime: 1,
        delay: -2,
        targetTime: 1440,
        targetTimeHousekeeping: 1440,
        targetTimeMaintenance: 2880,
        targetTimeReception: 1440
    },
    reception: {
        create: 2,
        confirm: 1,
        complete: 1,
        targetConfirmationTime: 3,
        lateConfirmationTime: 5,
        veryLateConfirmationTime: 10,
        lateConfirmationPenalty: -1,
        veryLateConfirmationPenalty: -2
    },
    shiftHandover: {
        acknowledgeNote: 1
    },
    ratings: {
        enabled: true,
        excellent: 3,
        veryGood: 2,
        good: 1,
        fair: 0,
        poor: -2
    },
    financial: {
        exchangeRate: 0.5,
        minRedemption: 100
    }
};

// ============================================================
// DEPARTMENT CONFIGS
// ============================================================

interface FieldConfig {
    key: string;
    label: string;
    icon: React.ReactNode;
    isBoolean?: boolean;
    min?: number;
    timeKey?: string;
    timeLabel?: string;
    isTimeField?: boolean; // New flag for dedicated time fields
}

interface DepartmentConfig {
    name: string;
    key: keyof FullPointsConfig;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
    fields: FieldConfig[];
}

// ============================================================
// SECTION DESCRIPTIONS (Transparency for managers)
// ============================================================

// Section descriptions - i18n-aware function
const getSectionDescriptions = (t: (key: string) => string): Record<string, { title: string; description: string; tip?: string }> => ({
    bellman: {
        title: t('pointsConfiguration.sections.bellman.title'),
        description: t('pointsConfiguration.sections.bellman.description'),
        tip: t('pointsConfiguration.sections.bellman.tip')
    },
    housekeeping: {
        title: t('pointsConfiguration.sections.housekeeping.title'),
        description: t('pointsConfiguration.sections.housekeeping.description'),
        tip: t('pointsConfiguration.sections.housekeeping.tip')
    },
    maintenance: {
        title: t('pointsConfiguration.sections.maintenance.title'),
        description: t('pointsConfiguration.sections.maintenance.description'),
        tip: t('pointsConfiguration.sections.maintenance.tip')
    },
    coffeeShop: {
        title: t('pointsConfiguration.sections.coffeeShop.title'),
        description: t('pointsConfiguration.sections.coffeeShop.description'),
        tip: t('pointsConfiguration.sections.coffeeShop.tip')
    },
    procurement: {
        title: t('pointsConfiguration.sections.procurement.title'),
        description: t('pointsConfiguration.sections.procurement.description'),
        tip: t('pointsConfiguration.sections.procurement.tip')
    },
    reception: {
        title: t('pointsConfiguration.sections.reception.title'),
        description: t('pointsConfiguration.sections.reception.description'),
        tip: t('pointsConfiguration.sections.reception.tip')
    },
    ratings: {
        title: t('pointsConfiguration.sections.ratings.title'),
        description: t('pointsConfiguration.sections.ratings.description'),
        tip: t('pointsConfiguration.sections.ratings.tip')
    },
    financial: {
        title: t('pointsConfiguration.sections.financial.title'),
        description: t('pointsConfiguration.sections.financial.description'),
        tip: t('pointsConfiguration.sections.financial.tip')
    }
});

// Departments config - i18n-aware function
const getDepartments = (t: (key: string) => string): DepartmentConfig[] => [
    {
        name: t('pointsConfiguration.departments.bellman'),
        key: 'bellman',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        icon: <Bell className="w-5 h-5" />,
        fields: [
            { key: 'checkin', label: t('pointsConfiguration.fields.checkin'), icon: <UserPlus className="w-4 h-4" /> },
            { key: 'complete', label: t('pointsConfiguration.fields.complete'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'fast', label: t('pointsConfiguration.fields.fast'), icon: <Zap className="w-4 h-4" />, timeKey: 'fastTime', timeLabel: t('pointsConfiguration.within') },
            { key: 'delay', label: t('pointsConfiguration.fields.delay'), icon: <AlertCircle className="w-4 h-4" />, min: -10, timeKey: 'delayTime', timeLabel: t('pointsConfiguration.after') }
        ]
    },
    {
        name: t('pointsConfiguration.departments.housekeeping'),
        key: 'housekeeping',
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        icon: <Sparkles className="w-5 h-5" />,
        fields: [
            { key: 'start', label: t('pointsConfiguration.fields.start'), icon: <Sparkles className="w-4 h-4" /> },
            { key: 'completeOccupied', label: t('pointsConfiguration.fields.completeOccupied'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'completeCheckout', label: t('pointsConfiguration.fields.completeCheckout'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'inspection', label: t('pointsConfiguration.fields.inspection'), icon: <ClipboardCheck className="w-4 h-4" /> },
            { key: 'fast', label: t('pointsConfiguration.fields.fast'), icon: <Zap className="w-4 h-4" />, timeKey: 'fastTime', timeLabel: t('pointsConfiguration.within') },
            { key: 'delay', label: t('pointsConfiguration.fields.delay'), icon: <AlertCircle className="w-4 h-4" />, min: -10, timeKey: 'delayTime', timeLabel: t('pointsConfiguration.after') }
        ]
    },
    {
        name: t('pointsConfiguration.departments.maintenance'),
        key: 'maintenance',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        icon: <Wrench className="w-5 h-5" />,
        fields: [
            { key: 'complete', label: t('pointsConfiguration.fields.completeMaintenance'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'fast', label: t('pointsConfiguration.fields.fast'), icon: <Zap className="w-4 h-4" />, timeKey: 'fastTime', timeLabel: t('pointsConfiguration.within') },
            { key: 'delay', label: t('pointsConfiguration.fields.delay'), icon: <AlertCircle className="w-4 h-4" />, min: -10, timeKey: 'delayTime', timeLabel: t('pointsConfiguration.after') }
        ]
    },
    {
        name: t('pointsConfiguration.departments.coffeeShop'),
        key: 'coffeeShop',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        icon: <Coffee className="w-5 h-5" />,
        fields: [
            { key: 'complete', label: t('pointsConfiguration.fields.complete'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'fast', label: t('pointsConfiguration.fields.fast'), icon: <Zap className="w-4 h-4" />, timeKey: 'fastTime', timeLabel: t('pointsConfiguration.within') },
            { key: 'delay', label: t('pointsConfiguration.fields.delay'), icon: <AlertCircle className="w-4 h-4" />, min: -10, timeKey: 'delayTime', timeLabel: t('pointsConfiguration.after') }
        ]
    },
    {
        name: t('pointsConfiguration.departments.procurement'),
        key: 'procurement',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        icon: <ShoppingCart className="w-5 h-5" />,
        fields: [
            { key: 'targetTimeHousekeeping', label: t('pointsConfiguration.fields.targetTimeHousekeeping'), icon: <Timer className="w-4 h-4" />, isTimeField: true },
            { key: 'targetTimeMaintenance', label: t('pointsConfiguration.fields.targetTimeMaintenance'), icon: <Timer className="w-4 h-4" />, isTimeField: true },
            { key: 'targetTimeReception', label: t('pointsConfiguration.fields.targetTimeReception'), icon: <Timer className="w-4 h-4" />, isTimeField: true },
            { key: 'purchase', label: t('pointsConfiguration.fields.purchase'), icon: <ShoppingCart className="w-4 h-4" /> },
            { key: 'receive', label: t('pointsConfiguration.fields.receive'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'early', label: t('pointsConfiguration.fields.early'), icon: <Zap className="w-4 h-4" /> },
            { key: 'ontime', label: t('pointsConfiguration.fields.ontime'), icon: <Clock className="w-4 h-4" /> },
            { key: 'delay', label: t('pointsConfiguration.fields.delayPenalty'), icon: <AlertCircle className="w-4 h-4" />, min: -10 }
        ]
    },
    {
        name: t('pointsConfiguration.departments.reception'),
        key: 'reception',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        icon: <Bell className="w-5 h-5" />,
        fields: [
            { key: 'create', label: t('pointsConfiguration.fields.create'), icon: <Bell className="w-4 h-4" /> },
            { key: 'confirm', label: t('pointsConfiguration.fields.confirm'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'complete', label: t('pointsConfiguration.fields.complete'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { key: 'targetConfirmationTime', label: t('pointsConfiguration.fields.targetConfirmationTime'), icon: <Timer className="w-4 h-4" />, isTimeField: true },
            { key: 'lateConfirmationPenalty', label: t('pointsConfiguration.fields.lateConfirmationPenalty'), icon: <AlertCircle className="w-4 h-4" />, min: -10, timeKey: 'lateConfirmationTime', timeLabel: t('pointsConfiguration.after') },
            { key: 'veryLateConfirmationPenalty', label: t('pointsConfiguration.fields.veryLateConfirmationPenalty'), icon: <AlertCircle className="w-4 h-4" />, min: -10, timeKey: 'veryLateConfirmationTime', timeLabel: t('pointsConfiguration.after') },
        ]
    },
    {
        name: t('pointsConfiguration.departments.ratings'),
        key: 'ratings',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        icon: <Star className="w-5 h-5" />,
        fields: [
            { key: 'enabled', label: t('pointsConfiguration.fields.enableRatings'), icon: <CheckCircle2 className="w-4 h-4" />, isBoolean: true },
            { key: 'excellent', label: t('pointsConfiguration.fields.excellent'), icon: <ThumbsUp className="w-4 h-4" /> },
            { key: 'veryGood', label: t('pointsConfiguration.fields.veryGood'), icon: <ThumbsUp className="w-4 h-4" /> },
            { key: 'good', label: t('pointsConfiguration.fields.good'), icon: <ThumbsUp className="w-4 h-4" /> },
            { key: 'fair', label: t('pointsConfiguration.fields.fair'), icon: <Clock className="w-4 h-4" /> },
            { key: 'poor', label: t('pointsConfiguration.fields.poor'), icon: <ThumbsDown className="w-4 h-4" />, min: -10 }
        ]
    },
    {
        name: t('pointsConfiguration.departments.financial'),
        key: 'financial' as any,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
        icon: <DollarSign className="w-5 h-5" />,
        fields: [
            { key: 'exchangeRate', label: t('pointsConfiguration.fields.exchangeRate'), icon: <DollarSign className="w-4 h-4" />, min: 0 },
            { key: 'minRedemption', label: t('pointsConfiguration.fields.minRedemption'), icon: <AlertCircle className="w-4 h-4" />, min: 0 }
        ]
    }
];

// ============================================================
// DEPARTMENT SECTION COMPONENT
// ============================================================

interface DepartmentSectionProps {
    dept: DepartmentConfig;
    values: any;
    onChange: (key: string, value: number | boolean) => void;
    expanded: boolean;
    onToggle: () => void;
}



const TimeUnitSelector: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
    // Determine unit
    let unit = 'minutes';
    let displayValue = value;

    if (value >= 1440 && value % 1440 === 0) {
        unit = 'days';
        displayValue = value / 1440;
    } else if (value >= 60 && value % 60 === 0) {
        unit = 'hours';
        displayValue = value / 60;
    }

    const handleUnitChange = (newUnit: string) => {
        if (newUnit === 'minutes') onChange(displayValue);
        if (newUnit === 'hours') onChange(displayValue * 60);
        if (newUnit === 'days') onChange(displayValue * 1440);
    };

    const handleValueChange = (newVal: number) => {
        if (unit === 'minutes') onChange(newVal);
        if (unit === 'hours') onChange(newVal * 60);
        if (unit === 'days') onChange(newVal * 1440);
    };

    return (
        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
            <input
                type="number"
                value={displayValue}
                onChange={(e) => handleValueChange(parseInt(e.target.value) || 0)}
                className="w-12 text-center bg-transparent text-white font-bold outline-none"
            />
            <div className="flex bg-black/20 rounded-md overflow-hidden">
                <button
                    onClick={() => handleUnitChange('minutes')}
                    className={`px-2 py-1 text-[10px] ${unit === 'minutes' ? 'bg-yellow-500 text-black' : 'text-white/40 hover:text-white'}`}
                >{t('pointsConfiguration.minutes')}</button>
                <button
                    onClick={() => handleUnitChange('hours')}
                    className={`px-2 py-1 text-[10px] ${unit === 'hours' ? 'bg-yellow-500 text-black' : 'text-white/40 hover:text-white'}`}
                >{t('pointsConfiguration.hours')}</button>
                <button
                    onClick={() => handleUnitChange('days')}
                    className={`px-2 py-1 text-[10px] ${unit === 'days' ? 'bg-yellow-500 text-black' : 'text-white/40 hover:text-white'}`}
                >{t('pointsConfiguration.days')}</button>
            </div>
        </div>
    );
};

const DepartmentSection: React.FC<DepartmentSectionProps> = ({
    dept, values, onChange, expanded, onToggle
}) => {
    const { t } = useTranslation();
    const sectionDesc = getSectionDescriptions(t)[dept.key];
    
    return (
        <div className="rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20" style={{ background: 'var(--theme-bg-secondary)' }}>
            {/* ✅ Section Description (Always Visible) */}
            {sectionDesc && (
                <div className={`px-5 py-3 border-b border-white/5 transition-all ${expanded ? 'bg-white/[0.02]' : ''}`}>
                    <div className="flex items-start gap-3">
                        <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${dept.color}`} />
                        <div className="space-y-1">
                            <p className={`text-xs font-bold ${dept.color}`}>{sectionDesc.title}</p>
                            <p className="text-[11px] text-white/50 leading-relaxed">{sectionDesc.description}</p>
                            {sectionDesc.tip && (
                                <p className="text-[10px] text-yellow-400/70 font-medium">{sectionDesc.tip}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${dept.bgColor} flex items-center justify-center ${dept.color}`}>
                        {dept.icon}
                    </div>
                    <div className="text-right">
                        <h3 className={`text-lg font-semibold ${dept.color}`}>{dept.name}</h3>
                        <p className="text-sm text-white/50">{t('pointsConfiguration.settingsCount', { count: dept.fields.length })}</p>
                    </div>
                </div>
                {expanded ? <ChevronUp className="w-5 h-5 text-white/40" /> : <ChevronDown className="w-5 h-5 text-white/40" />}
            </button>

            {expanded && (
                <div className="p-4 pt-0 space-y-2">
                    {dept.fields.map(field => (
                        <div
                            key={field.key}
                            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg ${dept.bgColor} flex items-center justify-center ${dept.color}`}>
                                    {field.icon}
                                </div>
                                <span className="text-white font-medium">{field.label}</span>
                            </div>

                            {field.isBoolean ? (
                                <button
                                    onClick={() => onChange(field.key, !values[field.key])}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${values[field.key] ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                >
                                    {values[field.key] ? t('pointsConfiguration.enabled') : t('pointsConfiguration.disabled')}
                                </button>
                            ) : field.isTimeField ? (
                                <TimeUnitSelector
                                    value={values[field.key] || 0}
                                    onChange={(val) => onChange(field.key, val)}
                                />
                            ) : (
                                <div className="flex items-center gap-4">
                                    {field.timeKey && (
                                        <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                            <span className="text-[10px] text-white/30 font-bold uppercase">{field.timeLabel === 'خلال' ? t('pointsConfiguration.within') : t('pointsConfiguration.after')}</span>
                                            <input
                                                type="number"
                                                value={values[field.timeKey] || 0}
                                                onChange={(e) => onChange(field.timeKey!, parseInt(e.target.value) || 0)}
                                                className="w-10 text-center text-xs font-bold bg-transparent text-blue-400 outline-none"
                                            />
                                            <span className="text-[8px] text-white/20">{t('pointsConfiguration.minutes')}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onChange(field.key, Math.max(field.min ?? -50, (values[field.key] || 0) - 1))}
                                            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all font-bold"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={values[field.key] || 0}
                                            onChange={(e) => onChange(field.key, parseInt(e.target.value) || 0)}
                                            className={`w-14 text-center text-lg font-black bg-white/5 rounded-lg py-1 border border-white/10 focus:outline-none focus:border-white/20 transition-all ${(values[field.key] || 0) < 0 ? 'text-red-400' : 'text-yellow-400'}`}
                                        />
                                        <button
                                            onClick={() => onChange(field.key, (values[field.key] || 0) + 1)}
                                            className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all font-bold"
                                        >
                                            +
                                        </button>
                                        <span className="text-white/40 text-[10px] mr-1">{t('pointsConfiguration.point')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

// ============================================================
// TYPES (Unified with pointsService)
// ============================================================

export const PointsConfiguration: React.FC = () => {
    const { t } = useTranslation();
    const { user, authReady } = useAuth();
    const [config, setConfig] = useState<FullPointsConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [activeTab, setActiveTab] = useState<'points' | 'achievements' | 'challenges'>('points');

    // Challenge Config State
    const [challengeConfig, setChallengeConfig] = useState<any>(null);
    const [challengeSyncing, setChallengeSyncing] = useState(false);
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [ranks, setRanks] = useState<any[]>([]);

    // ✅ CRITICAL FIX: Owner should use 'system-owner' or handle differently
    // Owner doesn't have a tenantId - they manage all tenants
    // For points config, owner should either:
    // 1. Select a specific tenant, OR
    // 2. Use a global/system config
    // For now, we'll use 'system-owner' as fallback for owner
    const tenantId = user?.tenantId || (user?.role === 'owner' ? 'system-owner' : null);
    
    // Hotel name for PDF
    const hotelName = (user as any)?.hotelName || (user as any)?.branchName || t('pointsConfiguration.defaultHotelName');

    // ✅ CRITICAL: Show loading while auth is not ready
    if (!authReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
                <AdoraLoader size="lg" message={t('pointsConfiguration.loadingUserData')} />
            </div>
        );
    }

    // ✅ CRITICAL: Show error if user is not authenticated
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
                <div className="text-center text-white">
                    <p className="text-xl mb-4">{t('pointsConfiguration.loginRequired')}</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        logger.info('PointsConfiguration initialized', { tenantId, userId: user?.id, role: user?.role }, 'PointsConfiguration');
        if (tenantId) {
            logger.info('Loading config for tenantId', { tenantId }, 'PointsConfiguration');
            loadConfig();
            loadRanks();
        } else {
            // ✅ CRITICAL: If no tenantId after auth is ready, stop loading
            logger.warn('No tenantId found, stopping loading', null, 'PointsConfiguration');
            setLoading(false);
        }
    }, [tenantId]);
    
    // Load ranks for PDF generation
    const loadRanks = async () => {
        if (!tenantId || !db) return;
        try {
            const ranksRef = collection(db, `tenants/${tenantId}/achievements`);
            const ranksSnap = await getDocs(ranksRef);
            const ranksData = ranksSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRanks(ranksData.sort((a: any, b: any) => a.minPoints - b.minPoints));
        } catch (e) {
            logger.error('Error loading ranks', e, 'PointsConfiguration');
        }
    };
    
    // Generate PDF Rulebook
    const handleGeneratePDF = async (type: 'full' | 'quick' = 'full') => {
        setGeneratingPDF(true);
        try {
            const today = new Date().toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (type === 'full') {
                await generateRulebookPDF(
                    config,
                    ranks.map(r => ({
                        id: r.id,
                        name: r.name,
                        minPoints: r.minPoints,
                        icon: r.icon,
                        description: r.description
                    })),
                    {
                        name: hotelName,
                        managerName: user?.name,
                        generatedDate: today
                    }
                );
            } else {
                await generateQuickSummaryPDF(config, hotelName);
            }
            
            haptic('success');
            playSound('success');
        } catch (error) {
            logger.error('PDF generation error', error, 'PointsConfiguration');
            haptic('error');
        } finally {
            setGeneratingPDF(false);
        }
    };

    const loadConfig = async () => {
        if (!tenantId) {
            logger.warn('loadConfig called without tenantId', null, 'PointsConfiguration');
            setLoading(false);
            return;
        }
        logger.info('Loading config', { tenantId }, 'PointsConfiguration');
        setLoading(true);
        try {
            // ✅ CRITICAL: Check db before use
            if (!db) {
                logger.error('Firebase Firestore not initialized', null, 'PointsConfiguration');
                setLoading(false);
                return;
            }

            // Load Points Config
            const configRef = doc(db, `tenants/${tenantId}/settings/pointsConfig`);
            const configSnap = await getDoc(configRef);

            if (configSnap.exists()) {
                const data = configSnap.data();
                setConfig({
                    bellman: { ...DEFAULT_CONFIG.bellman, ...data.bellman },
                    housekeeping: { ...DEFAULT_CONFIG.housekeeping, ...data.housekeeping },
                    maintenance: { ...DEFAULT_CONFIG.maintenance, ...data.maintenance },
                    procurement: { ...DEFAULT_CONFIG.procurement, ...data.procurement },
                    reception: { ...DEFAULT_CONFIG.reception, ...data.reception },
                    ratings: { ...DEFAULT_CONFIG.ratings, ...data.ratings },
                    financial: { ...DEFAULT_CONFIG.financial, ...data.financial },
                    shiftHandover: { ...DEFAULT_CONFIG.shiftHandover, ...data.shiftHandover },
                    coffeeShop: { ...DEFAULT_CONFIG.coffeeShop, ...data.coffeeShop }
                });
            }

            // Load Challenge Config (Parallel)
            try {
                const cfg = await getChallengeConfig(tenantId);
                setChallengeConfig(cfg);
            } catch (e) {
                logger.error('Error loading challenge config', e, 'PointsConfiguration');
            }

        } catch (error) {
            logger.error('Error loading points config', error, 'PointsConfiguration');
        } finally {
            logger.info('loadConfig finished', null, 'PointsConfiguration');
            setLoading(false);
        }
    };


    const loadChallengeConfig = async () => {
        if (!tenantId) return;
        try {
            // Static call instead of dynamic import
            const cfg = await getChallengeConfig(tenantId);

            // Ensure milestones is never empty for UI
            if (!cfg.milestones || cfg.milestones.length === 0) {
                cfg.milestones = getAvailableMilestones();
            }

            setChallengeConfig(cfg);
        } catch (e) {
            logger.error('Challenge load error', e, 'PointsConfiguration');
            // Quick fallback using static import
            setChallengeConfig({ isEnabled: true, milestones: getAvailableMilestones() });
        }
    };

    const handleUpdateMilestone = (index: number, field: string, value: any) => {
        if (!challengeConfig) return;
        const newMilestones = [...challengeConfig.milestones];
        newMilestones[index] = { ...newMilestones[index], [field]: value };
        setChallengeConfig({ ...challengeConfig, milestones: newMilestones });
    };

    const handleSaveChallengeConfig = async () => {
        if (!tenantId || !challengeConfig || !db) return;
        setChallengeSyncing(true);
        try {
            await saveChallengeConfig(tenantId, challengeConfig);
            haptic('success');
            playSound('success');
        } catch (err) {
            logger.error('Error', err, 'PointsConfiguration');
            haptic('error');
        } finally {
            setChallengeSyncing(false);
        }
    };

    const handleChange = (dept: keyof FullPointsConfig, key: string, value: number | boolean) => {
        setConfig(prev => ({
            ...prev,
            [dept]: { ...prev[dept], [key]: value }
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!tenantId || !db) {
            logger.error('Cannot save: tenantId or db is missing', null, 'PointsConfiguration');
            return;
        }
        setSaving(true);
        try {
            const configRef = doc(db, `tenants/${tenantId}/settings/pointsConfig`);
            await setDoc(configRef, {
                ...config,
                updatedAt: serverTimestamp(),
                updatedBy: { id: user?.id, name: user?.name }
            });

            setHasChanges(false);
            haptic('success');
            playSound('success');
        } catch (error) {
            logger.error('Error saving points config', error, 'PointsConfiguration');
            haptic('error');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setConfig(DEFAULT_CONFIG);
        setHasChanges(true);
    };

    const toggleDept = (key: string) => {
        setExpandedDepts(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const renderChallengeSettings = () => {
        if (!challengeConfig) return <div className="p-8 text-center text-slate-400">{t('pointsConfiguration.loadingSettings')}</div>;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-2xl transition-colors duration-300 p-6 border-b border-white/5" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                                <Trophy className="text-yellow-500" />
                                {t('pointsConfiguration.challenges.title')}
                            </h3>
                            <p className="text-sm text-slate-400">
                                {t('pointsConfiguration.challenges.description')}
                            </p>
                        </div>
                        <button
                            onClick={handleSaveChallengeConfig}
                            disabled={challengeSyncing}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            {challengeSyncing ? <AdoraLoaderInline size={20} /> : <Save className="w-5 h-5" />}
                            {t('pointsConfiguration.saveSettings')}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {challengeConfig.milestones.map((milestone: any, idx: number) => (
                            <div key={idx} className="bg-slate-800/50 p-5 rounded-2xl border border-white/5 flex items-center justify-between hover:border-yellow-500/30 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 group-hover:scale-110 transition-transform">
                                        <Gift className="w-6 h-6 text-yellow-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">{t('pointsConfiguration.challenges.day', { day: milestone.day })}</span>
                                            <div className="h-px w-8 bg-white/5" />
                                        </div>
                                        <input
                                            type="text"
                                            value={milestone.label}
                                            onChange={(e) => handleUpdateMilestone(idx, 'label', e.target.value)}
                                            className="bg-transparent text-white font-bold focus:outline-none border-b border-transparent focus:border-yellow-500/50 transition-colors w-full"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        value={milestone.rewardPoints}
                                        onChange={(e) => handleUpdateMilestone(idx, 'rewardPoints', parseInt(e.target.value) || 0)}
                                        className="w-24 bg-slate-900 border border-white/10 rounded-xl p-3 text-white font-black text-center focus:border-yellow-500 outline-none"
                                    />
                                    <span className="text-xs font-bold text-slate-400">{t('pointsConfiguration.point')}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-5 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="text-sm text-blue-300/80 leading-relaxed">
                            <p className="font-black text-blue-300 mb-1 text-base">{t('pointsConfiguration.challenges.smartRewards')}</p>
                            {t('pointsConfiguration.challenges.smartRewardsDescription')}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <AdoraLoader size="md" message={t('common.loading')} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-4">
                <button
                    onClick={() => setActiveTab('points')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'points' ? 'text-yellow-400' : 'text-white/40 hover:text-white'}`}
                >
                    {t('pointsConfiguration.pointsTab')}
                    {activeTab === 'points' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-400 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('achievements')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'achievements' ? 'text-yellow-400' : 'text-white/40 hover:text-white'}`}
                >
                    {t('pointsConfiguration.achievementsTab')}
                    {activeTab === 'achievements' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-400 rounded-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('challenges')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${activeTab === 'challenges' ? 'text-yellow-400' : 'text-white/40 hover:text-white'}`}
                >
                    {t('pointsConfiguration.challengesTab')}
                    {activeTab === 'challenges' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-400 rounded-full" />}
                </button>
            </div>

            {activeTab === 'challenges' && renderChallengeSettings()}

            {activeTab === 'achievements' && <AchievementsTab />}

            {activeTab === 'points' && (
                <>
                    {/* ✅ PDF Export Header */}
                    <div className="rounded-2xl p-4 border border-teal-500/20 mb-6 flex items-center justify-between flex-wrap gap-4" style={{ background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-teal-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-teal-300">{t('pointsConfiguration.downloadGuide')}</h3>
                                <p className="text-xs text-teal-400/60">{t('pointsConfiguration.downloadGuideDescription')}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleGeneratePDF('quick')}
                                disabled={generatingPDF}
                                className="px-4 py-2 rounded-xl bg-white/5 text-teal-300 hover:bg-teal-500/20 transition-all text-xs font-bold flex items-center gap-2 border border-teal-500/20"
                            >
                                <Download className="w-4 h-4" />
                                {t('pointsConfiguration.quickSummary')}
                            </button>
                            <button
                                onClick={() => handleGeneratePDF('full')}
                                disabled={generatingPDF}
                                className="px-5 py-2 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-all text-xs font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20"
                            >
                                {generatingPDF ? <AdoraLoaderInline size={16} /> : <FileText className="w-4 h-4" />}
                                {t('pointsConfiguration.downloadFullGuide')}
                            </button>
                        </div>
                    </div>

                    <div
                        className={`rounded-2xl transition-colors duration-300 p-6 border transition-all duration-300 cursor-pointer ${isCollapsed ? 'border-white/5 hover:border-yellow-500/20' : 'border-yellow-500/10'} mb-6`}
                        style={{ background: 'var(--theme-bg-secondary)' }}
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                    <Star className={`w-6 h-6 text-white transition-transform duration-500 ${isCollapsed ? '' : 'rotate-12'}`} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">{t('pointsConfiguration.title')}</h2>
                                    <p className="text-sm text-white/40">{t('pointsConfiguration.subtitle')}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {!isCollapsed && (
                                    <div className="flex gap-2 animate-fadeIn">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                            className="px-4 py-2 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                                        >
                                            {t('pointsConfiguration.reset')}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                            disabled={!hasChanges || saving}
                                            className={`px-6 py-2 rounded-xl font-black text-sm flex items-center gap-2 transition-all ${hasChanges ? 'bg-yellow-500 text-black hover:shadow-lg hover:shadow-yellow-500/20' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                                        >
                                            {saving ? <AdoraLoaderInline size={16} /> : <Save className="w-4 h-4" />}
                                            {t('pointsConfiguration.saveSettings')}
                                        </button>
                                    </div>
                                )}
                                <div className={`p-2 rounded-full bg-white/5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`}>
                                    <ChevronDown className="w-5 h-5 text-white/30" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {!isCollapsed && (
                        <div className="animate-fadeIn space-y-4">
                            {getDepartments(t).map(dept => (
                                <DepartmentSection
                                    key={dept.key}
                                    dept={dept}
                                    values={config[dept.key]}
                                    onChange={(key, value) => handleChange(dept.key, key, value)}
                                    expanded={expandedDepts.has(dept.key)}
                                    onToggle={() => toggleDept(dept.key)}
                                />
                            ))}

                            <div className="rounded-3xl transition-colors duration-300 p-5 border border-yellow-500/20 mt-8" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                <div className="flex items-start gap-4">
                                    <Sparkles className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-yellow-400 font-bold text-xs">{t('pointsConfiguration.systemAlert.title')}</p>
                                        <p className="text-yellow-400/70 text-[11px] leading-relaxed">
                                            {t('pointsConfiguration.systemAlert.message')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PointsConfiguration;
