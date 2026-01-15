import React from 'react';
import { Award, TrendingUp, Users, ArrowLeft, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { EmployeeBadgesDisplay } from '../../components/gamification/EmployeeBadgesDisplay';
import { AchievementsTab } from './AchievementsTab';

/**
 * GamificationPage - الشارات والرتب
 * 
 * For Managers/Owners: Shows AchievementsTab to manage ranks
 * For Employees: Shows their personal badges and progress
 */
export const GamificationPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    // ✅ FIX: Check if gamification feature is enabled
    const { isEnabled: isGamificationEnabled, loading: featureLoading } = useFeatureGate('gamification');
    
    const isManager = user?.role === 'manager' || user?.role === 'owner' || user?.role === 'admin';
    
    // ✅ FIX: Hide component if feature is disabled
    if (!featureLoading && !isGamificationEnabled) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--theme-gradient-page)' }}>
                <div className="max-w-md w-full glass rounded-3xl p-8 text-center border-t border-amber-500/20">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">الميزة غير متاحة</h1>
                    <p className="text-white/60 mb-8 leading-relaxed">
                        نظام الشارات والرتب غير مفعل حالياً. يرجى التواصل مع المالك لتفعيله.
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold transition-colors"
                    >
                        العودة
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 pb-20"
            style={{ background: 'var(--theme-gradient-page)' }}
        >
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{ 
                                background: 'var(--theme-bg-secondary)', 
                                border: '1px solid var(--theme-border-primary)',
                                color: 'var(--theme-text-secondary)'
                            }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                <Award className="w-6 h-6 text-yellow-500" />
                                الشارات والرتب
                            </h1>
                            <p className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                                {isManager ? 'إدارة نظام الترقيات والمكافآت' : 'تقدمك ورتبتك الحالية'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content based on role */}
                {isManager ? (
                    <div className="space-y-6">
                        {/* Manager View: Full Achievements Management */}
                        <div className="solid-modal rounded-2xl p-6"
                            style={{ 
                                background: 'var(--theme-bg-secondary)', 
                                border: '1px solid var(--theme-border-primary)' 
                            }}
                        >
                            <AchievementsTab />
                        </div>

                        {/* Preview Section */}
                        <div className="solid-modal rounded-2xl p-6"
                            style={{ 
                                background: 'var(--theme-bg-secondary)', 
                                border: '1px solid var(--theme-border-primary)' 
                            }}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-5 h-5 text-teal-400" />
                                <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                    معاينة كموظف
                                </h3>
                            </div>
                            <p className="text-sm mb-4" style={{ color: 'var(--theme-text-tertiary)' }}>
                                هكذا سيظهر النظام للموظفين في ملفاتهم الشخصية
                            </p>
                            <div className="border rounded-xl p-4" style={{ borderColor: 'var(--theme-border-primary)' }}>
                                <EmployeeBadgesDisplay />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Employee View: Personal Progress */
                    <EmployeeBadgesDisplay />
                )}
            </div>
        </div>
    );
};

export default GamificationPage;
