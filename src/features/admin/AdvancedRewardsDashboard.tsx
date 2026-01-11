/**
 * Advanced Rewards Dashboard Component
 * View and manage employee rewards
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, TrendingUp, Crown, Medal, Award, RefreshCw, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRewardsSystem, RewardResult, getRewardsHistory, RewardHistoryItem } from '../../services/advancedRewardsService';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '20px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text-primary, #f8fafc)',
    },
    tabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
    },
    tab: {
        padding: '10px 20px',
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 500,
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    tabActive: {
        background: 'linear-gradient(135deg, #0D9488, #14B8A6)',
        color: 'white',
    },
    tabInactive: {
        background: 'rgba(255,255,255,0.05)',
        color: 'var(--text-secondary, #94a3b8)',
    },
    card: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px',
    },
    cardTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--text-primary, #f8fafc)',
    },
    runButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 24px',
        borderRadius: '10px',
        border: 'none',
        background: 'linear-gradient(135deg, #0D9488, #14B8A6)',
        color: 'white',
        fontSize: '0.9rem',
        fontWeight: 500,
        cursor: 'pointer',
    },
    winnersList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '12px',
    },
    winnerCard: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        borderRight: '4px solid',
    },
    rank: {
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
    },
    winnerInfo: {
        flex: 1,
    },
    winnerName: {
        fontWeight: 600,
        color: 'var(--text-primary, #f8fafc)',
    },
    winnerMeta: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary, #94a3b8)',
    },
    bonus: {
        fontSize: '1.1rem',
        fontWeight: 700,
        color: '#22C55E',
    },
    historyItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
};

// ============================================================
// COMPONENT
// ============================================================

interface AdvancedRewardsDashboardProps {
    hotelId?: string;
    branchId?: string;
}

export const AdvancedRewardsDashboard: React.FC<AdvancedRewardsDashboardProps> = ({
    hotelId: propsHotelId,
    branchId: propsBranchId,
}) => {
    const { tenantId, branchId: authBranchId } = useAuth();
    const hotelId = propsHotelId || tenantId || '';
    const branchId = propsBranchId || authBranchId || '';

    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'history'>('daily');
    const [history, setHistory] = useState<RewardHistoryItem[]>([]);

    const {
        loading,
        lastResult,
        runDailyRewards,
        runWeeklyRewards,
        runMonthlyRewards,
    } = useRewardsSystem(hotelId, branchId, tenantId || '');

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab, branchId]);

    const loadHistory = async () => {
        const data = await getRewardsHistory(branchId, 20);
        setHistory(data);
    };

    const handleRun = async () => {
        switch (activeTab) {
            case 'daily':
                await runDailyRewards();
                break;
            case 'weekly':
                await runWeeklyRewards();
                break;
            case 'monthly':
                await runMonthlyRewards();
                break;
        }
    };

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return <Crown size={20} color="#FFD700" />;
            case 2: return <Medal size={20} color="#C0C0C0" />;
            case 3: return <Medal size={20} color="#CD7F32" />;
            default: return <Award size={20} color="#94a3b8" />;
        }
    };

    const getRankColor = (rank: number) => {
        switch (rank) {
            case 1: return '#FFD700';
            case 2: return '#C0C0C0';
            case 3: return '#CD7F32';
            default: return '#64748b';
        }
    };

    const getPeriodLabel = (period: string) => {
        const labels: Record<string, string> = {
            daily: 'يومي',
            weekly: 'أسبوعي',
            monthly: 'شهري',
        };
        return labels[period] || period;
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>
                    <Trophy size={28} color="#FFD700" />
                    المكافآت المتقدمة
                </h1>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                {(['daily', 'weekly', 'monthly', 'history'] as const).map(tab => (
                    <button
                        key={tab}
                        style={{
                            ...styles.tab,
                            ...(activeTab === tab ? styles.tabActive : styles.tabInactive),
                        }}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'daily' && <Calendar size={16} />}
                        {tab === 'weekly' && <TrendingUp size={16} />}
                        {tab === 'monthly' && <Crown size={16} />}
                        {tab === 'history' && <Trophy size={16} />}
                        {tab === 'daily' && 'يومي'}
                        {tab === 'weekly' && 'أسبوعي'}
                        {tab === 'monthly' && 'شهري'}
                        {tab === 'history' && 'السجل'}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab !== 'history' ? (
                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        {activeTab === 'daily' && '🏆 حساب المكافآت اليومية'}
                        {activeTab === 'weekly' && '🌟 حساب المكافآت الأسبوعية'}
                        {activeTab === 'monthly' && '👑 حساب المكافآت الشهرية'}
                    </div>

                    <button
                        style={styles.runButton}
                        onClick={handleRun}
                        disabled={loading}
                    >
                        {loading ? (
                            <AdoraLoaderInline size={18} />
                        ) : (
                            <Play size={18} />
                        )}
                        حساب وتطبيق المكافآت
                    </button>

                    {/* Results */}
                    {lastResult && lastResult.period === activeTab && lastResult.winners.length > 0 && (
                        <div style={{ marginTop: '24px' }}>
                            <div style={styles.cardTitle}>
                                🎉 الفائزون ({lastResult.totalBonusAwarded} نقطة إجمالي)
                            </div>
                            <div style={styles.winnersList}>
                                {lastResult.winners.map(winner => (
                                    <div
                                        key={winner.employeeId}
                                        style={{
                                            ...styles.winnerCard,
                                            borderColor: getRankColor(winner.rank),
                                        }}
                                    >
                                        <div
                                            style={{
                                                ...styles.rank,
                                                background: `${getRankColor(winner.rank)}20`,
                                            }}
                                        >
                                            {getRankIcon(winner.rank)}
                                        </div>
                                        <div style={styles.winnerInfo}>
                                            <div style={styles.winnerName}>{winner.employeeName}</div>
                                            <div style={styles.winnerMeta}>
                                                {winner.department} • نقاط: {winner.score}
                                            </div>
                                        </div>
                                        <div style={styles.bonus}>+{winner.bonusPoints}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div style={styles.card}>
                    <div style={styles.cardTitle}>📜 سجل المكافآت</div>
                    {history.length > 0 ? (
                        history.map(item => (
                            <div key={item.id} style={styles.historyItem}>
                                <div>
                                    <div style={styles.winnerName}>
                                        {getRankIcon(item.rank)} {item.employeeName}
                                    </div>
                                    <div style={styles.winnerMeta}>
                                        {getPeriodLabel(item.period)} • المركز {item.rank}
                                    </div>
                                </div>
                                <div>
                                    <div style={styles.bonus}>+{item.bonusPoints}</div>
                                    <div style={styles.winnerMeta}>
                                        {item.awardedAt.toLocaleDateString('ar-SA')}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                            لا يوجد سجل مكافآت بعد
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdvancedRewardsDashboard;
