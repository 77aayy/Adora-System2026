/**
 * Minibar Restocking Component
 * For recording consumed minibar items during room inspection
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Package, Plus, Minus, Check, X, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================================
// TYPES
// ============================================================

export interface MinibarProduct {
    id: string;
    name: string;
    price: number;
    category: 'beverage' | 'snack' | 'alcohol' | 'other';
    available: boolean;
}

export interface ConsumedItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

interface MinibarRestockingProps {
    products: MinibarProduct[];
    onSave: (consumedItems: ConsumedItem[], totalCost: number) => void;
    onCancel: () => void;
    roomNumber: string;
}

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '16px',
        padding: '20px',
        maxHeight: '80vh',
        overflow: 'auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: '16px',
    },
    title: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary, #f8fafc)',
    },
    roomBadge: {
        background: 'rgba(13, 148, 136, 0.2)',
        color: '#14B8A6',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.875rem',
    },
    productList: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        marginBottom: '20px',
    },
    productItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '12px 16px',
        transition: 'background 0.2s',
    },
    productInfo: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '4px',
    },
    productName: {
        color: 'var(--text-primary, #f8fafc)',
        fontWeight: 500,
    },
    productPrice: {
        color: 'var(--text-secondary, #94a3b8)',
        fontSize: '0.875rem',
    },
    quantityControl: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    quantityBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    minusBtn: {
        background: 'rgba(239, 68, 68, 0.2)',
        color: '#EF4444',
    },
    plusBtn: {
        background: 'rgba(34, 197, 94, 0.2)',
        color: '#22C55E',
    },
    quantity: {
        minWidth: '40px',
        textAlign: 'center' as const,
        fontSize: '1.125rem',
        fontWeight: 600,
        color: 'var(--text-primary, #f8fafc)',
    },
    summary: {
        background: 'rgba(13, 148, 136, 0.1)',
        border: '1px solid rgba(13, 148, 136, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
    },
    summaryRow: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        color: 'var(--text-secondary, #94a3b8)',
    },
    summaryTotal: {
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: '1.25rem',
        fontWeight: 600,
        color: '#14B8A6',
    },
    actions: {
        display: 'flex',
        gap: '12px',
    },
    cancelBtn: {
        flex: 1,
        padding: '12px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'transparent',
        color: 'var(--text-primary, #f8fafc)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '1rem',
    },
    saveBtn: {
        flex: 2,
        padding: '12px',
        borderRadius: '10px',
        border: 'none',
        background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '1rem',
        fontWeight: 600,
    },
};

// ============================================================
// COMPONENT
// ============================================================

export const MinibarRestocking: React.FC<MinibarRestockingProps> = ({
    products,
    onSave,
    onCancel,
    roomNumber,
}) => {
    const { t } = useTranslation();
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    // Initialize quantities
    useEffect(() => {
        const initial: Record<string, number> = {};
        products.forEach(p => { initial[p.id] = 0; });
        setQuantities(initial);
    }, [products]);

    // Update quantity
    const updateQuantity = (productId: string, delta: number) => {
        setQuantities(prev => ({
            ...prev,
            [productId]: Math.max(0, (prev[productId] || 0) + delta),
        }));
    };

    // Calculate consumed items
    const consumedItems: ConsumedItem[] = products
        .filter(p => (quantities[p.id] || 0) > 0)
        .map(p => ({
            productId: p.id,
            productName: p.name,
            quantity: quantities[p.id],
            unitPrice: p.price,
            total: quantities[p.id] * p.price,
        }));

    const totalCost = consumedItems.reduce((sum, item) => sum + item.total, 0);

    // Handle save
    const handleSave = () => {
        onSave(consumedItems, totalCost);
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.title}>
                    <Package size={24} />
                    <span>فحص الميني بار</span>
                </div>
                <span style={styles.roomBadge}>غرفة {roomNumber}</span>
            </div>

            {/* Product List */}
            <div style={styles.productList}>
                {products.filter(p => p.available).map(product => (
                    <div
                        key={product.id}
                        style={{
                            ...styles.productItem,
                            background: (quantities[product.id] || 0) > 0
                                ? 'rgba(13, 148, 136, 0.1)'
                                : 'rgba(255,255,255,0.05)',
                        }}
                    >
                        <div style={styles.productInfo}>
                            <span style={styles.productName}>{product.name}</span>
                            <span style={styles.productPrice}>
                                {product.price} ريال
                            </span>
                        </div>
                        <div style={styles.quantityControl}>
                            <button
                                style={{ ...styles.quantityBtn, ...styles.minusBtn }}
                                onClick={() => updateQuantity(product.id, -1)}
                                disabled={(quantities[product.id] || 0) === 0}
                            >
                                <Minus size={18} />
                            </button>
                            <span style={styles.quantity}>
                                {quantities[product.id] || 0}
                            </span>
                            <button
                                style={{ ...styles.quantityBtn, ...styles.plusBtn }}
                                onClick={() => updateQuantity(product.id, 1)}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary */}
            {consumedItems.length > 0 && (
                <div style={styles.summary}>
                    {consumedItems.map(item => (
                        <div key={item.productId} style={styles.summaryRow}>
                            <span>{item.productName} × {item.quantity}</span>
                            <span>{item.total} ريال</span>
                        </div>
                    ))}
                    <div style={styles.summaryTotal}>
                        <span>الإجمالي</span>
                        <span>{totalCost} ريال</span>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div style={styles.actions}>
                <button style={styles.cancelBtn} onClick={onCancel}>
                    <X size={18} />
                    إلغاء
                </button>
                <button style={styles.saveBtn} onClick={handleSave}>
                    <Check size={18} />
                    حفظ ({consumedItems.length} منتج)
                </button>
            </div>
        </div>
    );
};

export default MinibarRestocking;
