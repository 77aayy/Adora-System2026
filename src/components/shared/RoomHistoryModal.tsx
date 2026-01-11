/**
 * Room History Modal Component
 * View complete history of a room
 * Adora Hotel Management System V2
 */

import React from 'react';
import { X, History, Loader2 } from 'lucide-react';
import {
    useRoomHistory,
    HistoryTabType,
    TAB_LABELS,
    TAB_ICONS,
    translateStatus,
    formatHistoryDate,
    RoomHistoryData,
} from '../../services/roomHistoryService';

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    modal: {
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' as const,
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary, #f8fafc)',
    },
    closeBtn: {
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        borderRadius: '8px',
        padding: '8px',
        color: 'var(--text-secondary, #94a3b8)',
        cursor: 'pointer',
    },
    tabs: {
        display: 'flex',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    tab: {
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid transparent',
        color: 'var(--text-secondary, #94a3b8)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.9rem',
        transition: 'all 0.2s ease',
    },
    tabActive: {
        color: '#0D9488',
        borderBottomColor: '#0D9488',
    },
    content: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '20px',
    },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px',
    },
    summaryCard: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '12px',
        textAlign: 'center' as const,
    },
    summaryValue: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: 'var(--text-primary, #f8fafc)',
    },
    summaryLabel: {
        fontSize: '0.75rem',
        color: 'var(--text-secondary, #94a3b8)',
        marginTop: '4px',
    },
    historyItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        marginBottom: '8px',
    },
    itemIcon: {
        fontSize: '1.2rem',
    },
    itemContent: {
        flex: 1,
    },
    itemTitle: {
        fontWeight: 500,
        color: 'var(--text-primary, #f8fafc)',
        marginBottom: '4px',
    },
    itemMeta: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary, #94a3b8)',
    },
    empty: {
        textAlign: 'center' as const,
        padding: '40px',
        color: 'var(--text-secondary, #94a3b8)',
    },
};

// ============================================================
// COMPONENT
// ============================================================

interface RoomHistoryModalProps {
    hotelId: string;
    branchId: string;
    roomNumber: string;
    isOpen: boolean;
    onClose: () => void;
}

export const RoomHistoryModal: React.FC<RoomHistoryModalProps> = ({
    hotelId,
    branchId,
    roomNumber,
    isOpen,
    onClose,
}) => {
    const session = { hotelId, branchId };
    const {
        data,
        loading,
        activeTab,
        setActiveTab,
    } = useRoomHistory(isOpen ? session : null, isOpen ? roomNumber : null);

    if (!isOpen) return null;

    const tabs: HistoryTabType[] = ['cleaning', 'requests', 'maintenance'];

    const getCurrentItems = (data: RoomHistoryData | null, tab: HistoryTabType) => {
        if (!data) return [];
        return data[tab] || [];
    };

    const items = getCurrentItems(data, activeTab);

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.title}>
                        <History size={24} />
                        سجل الغرفة {roomNumber}
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            style={{
                                ...styles.tab,
                                ...(activeTab === tab ? styles.tabActive : {}),
                            }}
                            onClick={() => setActiveTab(tab)}
                        >
                            <span>{TAB_ICONS[tab]}</span>
                            {TAB_LABELS[tab]}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {loading ? (
                        <div style={styles.empty}>
                            <Loader2 size={32} className="animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            {data && (
                                <div style={styles.summaryGrid}>
                                    <div style={styles.summaryCard}>
                                        <div style={styles.summaryValue}>{data.stats.totalCleanings}</div>
                                        <div style={styles.summaryLabel}>تنظيف</div>
                                    </div>
                                    <div style={styles.summaryCard}>
                                        <div style={styles.summaryValue}>{data.stats.totalRequests}</div>
                                        <div style={styles.summaryLabel}>طلبات</div>
                                    </div>
                                    <div style={styles.summaryCard}>
                                        <div style={styles.summaryValue}>{data.stats.totalMaintenance}</div>
                                        <div style={styles.summaryLabel}>صيانة</div>
                                    </div>
                                </div>
                            )}

                            {/* Items List */}
                            {items.length > 0 ? (
                                items.map((item: any) => (
                                    <div key={item.id} style={styles.historyItem}>
                                        <span style={styles.itemIcon}>{TAB_ICONS[activeTab]}</span>
                                        <div style={styles.itemContent}>
                                            <div style={styles.itemTitle}>
                                                {translateStatus(item.status)}
                                                {item.duration && ` (${item.duration})`}
                                            </div>
                                            <div style={styles.itemMeta}>
                                                {formatHistoryDate(item.timestamp || item.createdAt)}
                                                {item.employee && ` • ${item.employee}`}
                                                {item.assignedTo?.name && ` • ${item.assignedTo.name}`}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={styles.empty}>
                                    لا يوجد سجل {TAB_LABELS[activeTab]}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoomHistoryModal;
