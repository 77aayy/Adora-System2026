/**
 * Daily Tips Widget Component
 * Shows daily tips and progress circles with REAL data
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw, TrendingUp, Clock, Star } from 'lucide-react';
import { useDailyTips } from '../../services/dailyTipsService';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        background: 'var(--theme-bg-secondary, #ffffff)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid var(--theme-border-primary, #e2e8f0)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden', // ✅ Fix overflow issue
    },
    tipSection: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '16px',
    },
    tipIcon: {
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        background: 'rgba(13, 148, 136, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    tipContent: {
        flex: 1,
        minWidth: 0, // ✅ Fix text overflow
    },
    tipLabel: {
        fontSize: '0.75rem',
        color: '#0D9488',
        fontWeight: 600,
        marginBottom: '4px',
    },
    tipText: {
        fontSize: '0.85rem',
        color: 'var(--theme-text-primary, #1e293b)', // ✅ Dark text for light mode
        lineHeight: 1.5,
        wordWrap: 'break-word' as any, // ✅ Prevent overflow
    },
    refreshBtn: {
        background: 'transparent',
        border: 'none',
        color: '#0D9488',
        cursor: 'pointer',
        padding: '4px',
    },
    progressGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px', // ✅ Reduced gap to prevent overflow
    },
    progressCard: {
        background: 'var(--theme-bg-tertiary, #f8fafc)',
        borderRadius: '12px',
        padding: '10px', // ✅ Reduced padding
        textAlign: 'center' as const,
    },
    circleWrapper: {
        position: 'relative',
        width: '50px', // ✅ Slightly smaller
        height: '50px',
        margin: '0 auto 6px',
    },
    circleValue: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.9rem',
        fontWeight: 700,
        color: 'var(--theme-text-primary, #1e293b)', // ✅ Dark text for light mode
    },
    progressLabel: {
        fontSize: '0.7rem',
        color: 'var(--theme-text-secondary, #64748b)', // ✅ Proper secondary color
    },
};

// ============================================================
// PROGRESS CIRCLE SVG
// ============================================================

interface ProgressCircleProps {
    value: number;
    max: number;
    color: string;
    size?: number;
}

const ProgressCircle: React.FC<ProgressCircleProps> = ({ value, max, color, size = 60 }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = max > 0 ? Math.min(value / max, 1) : 0;
    const offset = circumference - (percentage * circumference);

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle - theme aware */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="var(--theme-border-primary, #e2e8f0)"
                strokeWidth="5"
            />
            {/* Progress circle */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
        </svg>
    );
};

// ============================================================
// COMPONENT
// ============================================================

interface DailyTipsWidgetProps {
    department?: string;
}

export const DailyTipsWidget: React.FC<DailyTipsWidgetProps> = ({
    department,
}) => {
    const { user } = useAuth();
    const { tip, nextTip } = useDailyTips(department);
    const [refreshing, setRefreshing] = useState(false);
    
    // ✅ Real stats from Firebase
    const [todayTasks, setTodayTasks] = useState(0);
    const [totalTasks, setTotalTasks] = useState(0);
    const [avgTime, setAvgTime] = useState(0);
    const [avgRating, setAvgRating] = useState(0);
    const [loading, setLoading] = useState(true);
    
    const branchId = (user as any)?.branch || (user as any)?.branchId || 'default';
    const tenantId = (user as any)?.tenantId;

    // ✅ Load real stats from Firebase
    useEffect(() => {
        const loadStats = async () => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayTimestamp = Timestamp.fromDate(today);

                const constraints: any[] = [where('branch', '==', branchId)];
                if (tenantId) constraints.push(where('tenantId', '==', tenantId));
                constraints.push(orderBy('createdAt', 'desc'));
                constraints.push(limit(200));

                const q = query(collection(db, 'requests'), ...constraints);
                const snapshot = await getDocs(q);

                let todayCount = 0;
                let completedCount = 0;
                let totalResponseTime = 0;
                let totalRating = 0;
                let ratedCount = 0;

                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    // Count today's tasks
                    if (data.createdAt && data.createdAt.toDate() >= today) {
                        todayCount++;
                    }

                    // Count completed tasks & calculate avg response time
                    if (data.status === 'COMPLETED') {
                        completedCount++;
                        if (data.completedAt && data.createdAt) {
                            const responseTime = (data.completedAt.toDate().getTime() - data.createdAt.toDate().getTime()) / 60000; // minutes
                            totalResponseTime += responseTime;
                        }
                    }

                    // Calculate average rating
                    if (data.rating) {
                        totalRating += data.rating;
                        ratedCount++;
                    }
                });

                setTodayTasks(todayCount);
                setTotalTasks(snapshot.size);
                setAvgTime(completedCount > 0 ? Math.round(totalResponseTime / completedCount) : 0);
                setAvgRating(ratedCount > 0 ? parseFloat((totalRating / ratedCount).toFixed(1)) : 0);
                
            } catch (error) {
                console.error('Failed to load daily stats:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [branchId, tenantId]);

    const handleRefresh = () => {
        setRefreshing(true);
        nextTip();
        setTimeout(() => setRefreshing(false), 500);
    };

    return (
        <div style={styles.container}>
            {/* Daily Tip */}
            <div style={styles.tipSection}>
                <div style={styles.tipIcon}>
                    <Lightbulb size={20} color="#0D9488" />
                </div>
                <div style={styles.tipContent}>
                    <div style={styles.tipLabel}>💡 نصيحة اليوم</div>
                    <div style={styles.tipText}>
                        {tip?.text || 'جاري التحميل...'}
                    </div>
                </div>
                <button
                    style={styles.refreshBtn}
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? <AdoraLoaderInline size={16} /> : <RefreshCw size={16} />}
                </button>
            </div>

            {/* Progress Circles - ✅ Real Data from Firebase */}
            <div style={styles.progressGrid}>
                <div style={styles.progressCard}>
                    <div style={styles.circleWrapper}>
                        <ProgressCircle value={todayTasks} max={Math.max(totalTasks, 10)} color="#22C55E" />
                        <div style={styles.circleValue}>{loading ? '-' : todayTasks}</div>
                    </div>
                    <div style={styles.progressLabel}>
                        <TrendingUp size={12} style={{ marginLeft: '4px' }} />
                        مهام اليوم
                    </div>
                </div>

                <div style={styles.progressCard}>
                    <div style={styles.circleWrapper}>
                        <ProgressCircle value={avgTime} max={60} color="#F59E0B" />
                        <div style={styles.circleValue}>{loading ? '-' : `${avgTime}د`}</div>
                    </div>
                    <div style={styles.progressLabel}>
                        <Clock size={12} style={{ marginLeft: '4px' }} />
                        متوسط الوقت
                    </div>
                </div>

                <div style={styles.progressCard}>
                    <div style={styles.circleWrapper}>
                        <ProgressCircle value={avgRating} max={5} color="#8B5CF6" />
                        <div style={styles.circleValue}>{loading ? '-' : avgRating || '0'}</div>
                    </div>
                    <div style={styles.progressLabel}>
                        <Star size={12} style={{ marginLeft: '4px' }} />
                        التقييم
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyTipsWidget;
