/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Lost & Found Modal Component
 * Extracted from ReceptionDashboard for better code organization
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUX } from '../../../context/UXContext';
import { subscribeToLostFound, returnItem, LostFoundItem } from '../../../services/lostFoundService';
import { createLiveFeedEntry } from '../../../services/liveFeedService';
import { logger } from '../../../services/loggerService';
import { CheckCircle2, X, Package } from 'lucide-react';
import { AdoraLoader } from '../../common/AdoraLoader';
import { getTimeAgo } from '../../../utils/dateUtils';

interface LostFoundModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    tenantId: string;
    userId: string;
    userName: string;
}

export const LostFoundModal: React.FC<LostFoundModalProps> = ({ 
    isOpen, 
    onClose, 
    branchId, 
    tenantId, 
    userId, 
    userName 
}) => {
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language;
    const { success, error } = useUX();
    const [items, setItems] = useState<LostFoundItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'log'>('active');
    
    // ✅ UX: Smooth fade-in animation
    const [isVisible, setIsVisible] = React.useState(false);
    
    React.useEffect(() => {
        if (isOpen) {
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const unsubscribe = subscribeToLostFound(branchId, (data) => {
            setItems(data);
            setLoading(false);
        });
        return unsubscribe;
    }, [isOpen, branchId]);

    // ✅ Filter items based on tab
    const activeItems = useMemo(() => items.filter(i => i.status === 'found' || i.status === 'claimed'), [items]);
    const logItems = useMemo(() => items.filter(i => i.status === 'returned' || i.status === 'disposed'), [items]);

    const handleReturnItem = async (itemId: string) => {
        try {
            // ✅ FIX: Pass tenantId for tenant-scoped collection
            const item = items.find(i => i.id === itemId);
            if (!item?.tenantId) {
                throw new Error('tenantId is required');
            }
            await returnItem(itemId, { id: userId, name: userName }, tenantId);
            
            // ✅ Create Live Feed entry for return (using service)
            try {
                const item = items.find(i => i.id === itemId);
                if (item) {
                    await createLiveFeedEntry({
                        type: 'missing_items_returned',
                        branchId: branchId,
                        tenantId: tenantId,
                        roomNumber: item.roomNumber || '',
                        description: `${t('reception.lostFoundDeliverySuccess').split(' ')[0]}: ${item.description}`,
                        photoUrl: item.imageUrl || null,
                        returnedBy: { id: userId, name: userName },
                        status: 'returned',
                        itemId: itemId
                    });
                }
            } catch (e) {
                // Silent fail - live feed is non-critical
            }

            success(t('reception.lostFoundDeliverySuccess'));
        } catch (err: any) {
            logger.error('Error returning item', err, 'LostFoundModal');
            error(t('reception.lostFoundDeliveryFailed') + ' ' + (err.message || t('reception.unknownError')));
        }
    };

    // ✅ Format date with dynamic locale based on current language
    const formatDate = useCallback((timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
        return date.toLocaleString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }, [currentLanguage]);

    if (!isOpen) return null;

    return (
        <div className="adora-modal-backdrop">
            <div className="adora-modal-v2 w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh]">
                {/* Header */}
                <div className="adora-modal-header-v2">
                    <div className="flex items-center gap-3">
                        <div className="adora-modal-icon" style={{ background: 'var(--theme-accent-purple-light)', color: 'var(--theme-accent-purple)' }}>
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="adora-modal-title-v2">{t('reception.lostAndFound')}</h2>
                            <p className="adora-modal-subtitle">{t('reception.lostAndFound')} {t('reception.inspection')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="adora-modal-close-v2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'active'
                                ? 'bg-teal-500 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/20'
                        }`}
                    >
                        {t('reception.activeTab')} ({activeItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('log')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === 'log'
                                ? 'bg-teal-500 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/20'
                        }`}
                    >
                        {t('reception.logTab')} ({logItems.length})
                    </button>
                </div>

                {/* Content */}
                <div className="adora-modal-body-v2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" message={t('reception.loading')} />
                        </div>
                    ) : (activeTab === 'active' ? activeItems : logItems).length === 0 ? (
                        <div className="adora-empty">
                            <div className="adora-empty-icon">
                                <Package className="w-8 h-8" />
                            </div>
                            <p className="adora-empty-description">
                                {activeTab === 'active' ? t('reception.noActiveLostItems') : t('reception.logEmpty')}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12">
                            {(activeTab === 'active' ? activeItems : logItems).map(item => (
                                <div key={item.id} className="adora-card p-5 sm:p-6 hover:shadow-lg transition-all duration-200 group">
                                    {/* Header */}
                                    <div className="flex items-start gap-4 mb-4">
                                        {item.imageUrl ? (
                                            <img
                                                src={item.imageUrl}
                                                alt={item.description}
                                                className="w-16 h-16 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl adora-bg-tertiary flex items-center justify-center text-2xl">
                                                📦
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="adora-text-primary font-medium text-sm mb-1">{item.description}</p>
                                            <p className="adora-text-tertiary text-xs">{t('reception.roomLabel')} {item.roomNumber || '-'}</p>
                                        </div>
                                        <span className={`adora-badge ${
                                            item.status === 'found' ? 'adora-badge-blue' :
                                            item.status === 'claimed' ? 'adora-badge-yellow' :
                                            item.status === 'returned' ? 'adora-badge-green' :
                                            'adora-badge-teal'
                                        } text-xs font-bold`}>
                                            {item.status === 'found' ? t('reception.foundStatus') :
                                             item.status === 'claimed' ? t('reception.claimedStatus') :
                                             item.status === 'returned' ? t('reception.returnedStatus') : t('reception.disposedStatus')}
                                        </span>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 mb-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="adora-text-tertiary">{t('reception.foundDate')}</span>
                                            <span className="adora-text-secondary">{formatDate(item.createdAt)}</span>
                                        </div>
                                        {item.foundBy && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="adora-text-tertiary">{t('reception.foundBy')}</span>
                                                <span className="adora-text-secondary">{item.foundBy.name}</span>
                                            </div>
                                        )}
                                        {item.returnedBy && item.returnedAt && (
                                            <div className="adora-info-box green" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem' }}>
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="font-bold">{t('reception.returnedLabel')}</span>
                                                    <span className="opacity-80">{formatDate(item.returnedAt)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="opacity-60">{t('reception.returnedBy')}</span>
                                                    <span className="opacity-80">{item.returnedBy.name}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs mt-1">
                                                    <span className="opacity-60">{t('reception.timeLabel')}</span>
                                                    <span className="opacity-80">{getTimeAgo(item.returnedAt, t)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {item.status !== 'returned' && item.status !== 'disposed' && (
                                        <button
                                            onClick={() => handleReturnItem(item.id)}
                                            className="adora-btn adora-btn-primary w-full"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            {t('reception.returnItemButton')}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
