import React, { useState, useEffect } from 'react';
import {
    Award, Plus, Trash2, Edit2, Save, X, Star, Zap, Crown,
    Medal, Trophy, ThumbsUp, Heart, Shield, Flag, Sparkles,
    Eye, Timer, Wrench, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Achievement } from '../../types';
import { haptic, playSound } from '../../utils/uxEffects';
import { logger } from '../../services/loggerService';
import {
    subscribeToAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    deleteAchievementsBatch,
    createAchievementsBatch
} from '../../services/achievementService';
import { useTranslation } from 'react-i18next';

const ICONS = [
    { name: 'Award', icon: Award },
    { name: 'Star', icon: Star },
    { name: 'Zap', icon: Zap },
    { name: 'Crown', icon: Crown },
    { name: 'Medal', icon: Medal },
    { name: 'Trophy', icon: Trophy },
    { name: 'ThumbsUp', icon: ThumbsUp },
    { name: 'Heart', icon: Heart },
    { name: 'Shield', icon: Shield },
    { name: 'Flag', icon: Flag },
    { name: 'Eye', icon: Eye },
    { name: 'Timer', icon: Timer },
    { name: 'Wrench', icon: Wrench },
    { name: 'Clock', icon: Clock }
];

const COLORS = [
    'text-yellow-400', 'text-blue-400', 'text-green-400', 'text-purple-400',
    'text-red-400', 'text-pink-400', 'text-orange-400', 'text-cyan-400'
];

const BG_COLORS = [
    'bg-yellow-500/20', 'bg-blue-500/20', 'bg-green-500/20', 'bg-purple-500/20',
    'bg-red-500/20', 'bg-pink-500/20', 'bg-orange-500/20', 'bg-cyan-500/20'
];

const DEFAULT_ACHIEVEMENTS: Partial<Achievement>[] = Array.from({ length: 20 }, (_, i) => {
    const points = (i + 1) * 100;
    // Names for key milestones
    let name = `المستوى ${i + 1}`;
    if (points === 500) name = 'مشرف برونزي';
    if (points === 1000) name = 'مشرف فضي';
    if (points === 1500) name = 'مشرف ذهبي';
    if (points === 2000) name = 'عضو فرع الكورنيش الماسي';

    return {
        name,
        description: `الوصول إلى ${points} نقطة تراكمية`,
        points: 0, // Points Reward is 0 for ranks (it's a status)
        icon: points >= 1500 ? 'Crown' : (points >= 1000 ? 'Medal' : 'Star'),
        color: points >= 2000 ? 'text-cyan-400' : (points >= 1500 ? 'text-yellow-400' : 'text-blue-400'),
        bgColor: points >= 2000 ? 'bg-cyan-500/20' : (points >= 1500 ? 'bg-yellow-500/20' : 'bg-blue-500/20'),
        isRepeatable: false,
        category: 'rank',
        requirement: { type: 'points', value: points }
    };
});

import { useUX } from '../../context/UXContext';

export const AchievementsTab: React.FC = () => {
    const { user } = useAuth();
    const { haptic, playSound, success, error: showError } = useUX();
    const [achievements, setAchievements] = useState<Achievement[]>([]);

    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    // Form State (Always Rank Mode)
    const [formData, setFormData] = useState<Partial<Achievement>>({
        name: '',
        description: '',
        points: 0,
        icon: 'Star',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        isRepeatable: false,
        category: 'rank',
        requirement: { type: 'points', value: 100 }
    } as any);

    const { tenantId } = useTenant();

    // ✅ Null Safety: Check tenantId before subscribing
    useEffect(() => {
        if (!tenantId) {
            logger.warn('AchievementsTab: Missing tenantId', null, 'AchievementsTab');
            setLoading(false);
            return;
        }

        // ✅ Architecture: Use service instead of direct Firebase call
        const unsubscribe = subscribeToAchievements(tenantId, (achievements) => {
            // ✅ Null Safety: Ensure achievements is never undefined
            setAchievements(achievements || []);
            setLoading(false);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [tenantId]);

    const handleSave = async () => {
        if (!tenantId || !formData.name || !formData.requirement?.value) return;

        try {
            if (editingId) {
                await updateDoc(doc(db, `tenants/${tenantId}/achievements`, editingId), {
                    ...formData,
                    category: 'rank', // Enforce Ref
                    active: true, // ✅ FIX: Ensure achievement is active
                    updatedAt: serverTimestamp()
                });
                haptic('success');
            } else {
                await addDoc(collection(db, `tenants/${tenantId}/achievements`), {
                    ...formData,
                    category: 'rank', // Enforce Ref
                    active: true, // ✅ FIX: Ensure achievement is active by default
                    createdAt: serverTimestamp()
                });
                haptic('success');
                playSound('success');
            }
            resetForm();
        } catch (error) {
            logger.error('Error saving achievement', error, 'AchievementsTab');
            haptic('error');
        }
    };

    const handleDelete = async (id: string) => {
        // ✅ Null Safety: Check tenantId
        if (!tenantId) {
            logger.warn('Cannot delete achievement: Missing tenantId', null, 'AchievementsTab');
            return;
        }

        if (!window.confirm(t('admin.achievements.deleteConfirm') || 'هل أنت متأكد من حذف هذه الرتبة؟')) return;

        try {
            // ✅ Architecture: Use service instead of direct Firebase call
            const result = await deleteAchievement(tenantId, id);
            if (result.success) {
                haptic('success');
            } else {
                throw new Error(result.error || 'Failed to delete achievement');
            }
        } catch (error: any) {
            logger.error('Error deleting achievement', error, 'AchievementsTab');
            haptic('error');
        }
    };

    const loadDefaults = async () => {
        // ✅ Null Safety: Check tenantId
        if (!tenantId) {
            logger.warn('Cannot load defaults: Missing tenantId', null, 'AchievementsTab');
            return;
        }

        // Confirmation Dialog
        if (!window.confirm(t('admin.achievements.loadDefaultsConfirm') || '⚠️ تنبيه: سيتم حذف جميع الرتب الحالية واستبدالها بنظام "السلّم الوظيفي" التلقائي من 100 إلى 2000 نقطة.\nهل أنت متأكد؟')) return;

        setLoading(true);
        try {
            // 1. Delete ALL existing achievements
            const achievementIds = achievements.map(ach => ach.id);
            if (achievementIds.length > 0) {
                const deleteResult = await deleteAchievementsBatch(tenantId, achievementIds);
                if (!deleteResult.success) {
                    throw new Error(deleteResult.error || 'Failed to delete existing achievements');
                }
            }

            // 2. Add New Defaults
            const createResult = await createAchievementsBatch(
                tenantId,
                DEFAULT_ACHIEVEMENTS.map(ach => ({
                    ...ach,
                    active: true
                } as Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>))
            );

            if (!createResult.success) {
                throw new Error(createResult.error || 'Failed to create default achievements');
            }

            haptic('success');
            playSound('success');
            success(t('admin.achievements.loadDefaultsSuccess') || 'تم تفعيل نظام الرتب التلقائي بنجاح! 🚀');
        } catch (err: any) {
            logger.error('Error loading defaults', err, 'AchievementsTab');
            showError(t('admin.achievements.loadDefaultsError') || 'حدث خطأ أثناء التحديث');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setIsAdding(false);
        setFormData({
            name: '',
            description: '',
            points: 0,
            icon: 'Star',
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/20',
            isRepeatable: false,
            category: 'rank',
            requirement: { type: 'points', value: 100 }
        } as any);
    };

    const startEdit = (ach: Achievement) => {
        setEditingId(ach.id);
        setFormData(ach);
        setIsAdding(true);
    };

    const renderIcon = (iconName: string, className: string) => {
        const IconComponent = ICONS.find(i => i.name === iconName)?.icon || Award;
        return <IconComponent className={className} />;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white">نظام الرتب والترقيات</h2>
                    <p className="text-white/40 text-sm">إدارة سلم الترقيات التلقائي بناءً على النقاط المكتسبة</p>
                </div>
                {!isAdding && (
                    <div className="flex gap-2">
                        <button
                            onClick={loadDefaults}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl font-medium hover:bg-white/10 transition-colors"
                            title="تحميل نظام المستويات القياسي"
                        >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            <span className="hidden sm:inline">إنشاء السلم الوظيفي (100-2000)</span>
                        </button>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            رتبة جديدة
                        </button>
                    </div>
                )}
            </div>

            {isAdding && (
                <div className="glass-dark p-6 rounded-2xl border border-purple-500/20 animate-fadeIn mb-8">
                    <h3 className="text-lg font-bold text-white mb-4">{editingId ? 'تعديل الرتبة' : 'إضافة رتبة جديدة'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-white/40 mb-1">اسم الرتبة</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="مثال: مشرف ذهبي"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-purple-500/50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-white/40 mb-1">الوصف</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="وصف مختصر"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-purple-500/50"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-purple-400 mb-1 font-bold">النقاط المطلوبة للترقية (Threshold)</label>
                                <input
                                    type="number"
                                    value={(formData as any).points || (formData.requirement?.value || 0)}
                                    onChange={e => setFormData({ ...formData, requirement: { type: 'points', value: parseInt(e.target.value) || 0 }, points: parseInt(e.target.value) } as any)}
                                    className="w-full bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-2 text-white outline-none focus:border-purple-500 font-mono text-lg"
                                    placeholder="مثال: 500"
                                />
                                <p className="text-[10px] text-white/40 mt-1">سيتم منح الرتبة تلقائياً للموظف عند الوصول لهذا الرصيد التراكمي.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-white/40 mb-2">الأيقونة</label>
                                <div className="flex flex-wrap gap-2">
                                    {ICONS.map(({ name }) => (
                                        <button
                                            key={name}
                                            onClick={() => setFormData({ ...formData, icon: name })}
                                            className={`p-2 rounded-lg transition-all ${formData.icon === name ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                                        >
                                            {renderIcon(name, "w-5 h-5")}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-white/40 mb-2">اللون</label>
                                <div className="flex flex-wrap gap-2">
                                    {COLORS.map((color, idx) => (
                                        <button
                                            key={color}
                                            onClick={() => setFormData({ ...formData, color, bgColor: BG_COLORS[idx] } as any)}
                                            className={`w-6 h-6 rounded-full border-2 ${(formData as any).color === color ? 'border-white' : 'border-transparent'}`}
                                            style={{ backgroundColor: color.replace('text-', 'bg-').replace('-400', '-400') }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/5">
                        <button
                            onClick={resetForm}
                            className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!formData.name}
                            className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 ${formData.name ? 'bg-purple-500 text-white hover:bg-purple-400' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                        >
                            <Save className="w-4 h-4" />
                            حفظ الرتبة
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {achievements.map((ach) => (
                    <div key={ach.id} className="glass-card p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-24 h-24 ${(ach as any).bgColor} blur-2xl rounded-full -mr-10 -mt-10 opacity-50`} />

                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl ${(ach as any).bgColor} flex items-center justify-center ${(ach as any).color}`}>
                                    {renderIcon(ach.icon || 'Award', "w-6 h-6")}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{ach.name}</h3>
                                    <div className="flex items-center gap-1 text-yellow-500 font-mono text-sm">
                                        <span className="font-black">+{Math.round((ach as any).points || (ach as any).requirement?.value || 0)}</span>
                                        <span className="text-[10px] opacity-70">نقطة</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => startEdit(ach)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(ach.id)}
                                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {ach.description && (
                            <p className="mt-3 text-sm text-white/50 relative z-10 leading-relaxed">
                                {ach.description}
                            </p>
                        )}
                    </div>
                ))}

                {!loading && achievements.length === 0 && !isAdding && (
                    <div className="col-span-full py-12 text-center text-white/30 border border-dashed border-white/10 rounded-2xl">
                        <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>لا توجد أوسمة مضافة بعد</p>
                        <button onClick={() => setIsAdding(true)} className="text-yellow-500 hover:underline mt-2 text-sm">أضف أول وسام</button>
                    </div>
                )}
            </div>
        </div >
    );
};
