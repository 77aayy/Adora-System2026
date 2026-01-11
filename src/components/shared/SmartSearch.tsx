/**
 * Smart Search Component
 * Multi-layer search with autocomplete
 * Adora Hotel Management System V2
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useSmartSearch, LayerResults, LAYER_CONFIG } from '../../services/smartSearchService';

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    input: {
        width: '100%',
        padding: '12px 44px 12px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        color: 'var(--text-primary, #f8fafc)',
        fontSize: '0.95rem',
        outline: 'none',
        transition: 'all 0.2s ease',
    },
    icon: {
        position: 'absolute',
        right: '14px',
        color: 'var(--text-secondary, #94a3b8)',
        pointerEvents: 'none' as const,
    },
    clearBtn: {
        position: 'absolute',
        left: '10px',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary, #94a3b8)',
        cursor: 'pointer',
        padding: '4px',
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: '8px',
        background: 'var(--bg-secondary, #1e293b)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        maxHeight: '400px',
        overflowY: 'auto' as const,
        zIndex: 1000,
    },
    layerSection: {
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    layerHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-secondary, #94a3b8)',
        textTransform: 'uppercase' as const,
    },
    resultItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
    },
    resultIcon: {
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: 'rgba(13, 148, 136, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
    },
    resultContent: {
        flex: 1,
        minWidth: 0,
    },
    resultTitle: {
        fontSize: '0.9rem',
        fontWeight: 500,
        color: 'var(--text-primary, #f8fafc)',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    resultSubtitle: {
        fontSize: '0.8rem',
        color: 'var(--text-secondary, #94a3b8)',
    },
    noResults: {
        padding: '24px',
        textAlign: 'center' as const,
        color: 'var(--text-secondary, #94a3b8)',
    },
    highlight: {
        background: 'rgba(13, 148, 136, 0.3)',
        borderRadius: '2px',
        padding: '0 2px',
    },
};

// ============================================================
// COMPONENT
// ============================================================

interface SmartSearchProps {
    hotelId: string;
    branchId: string;
    placeholder?: string;
    onSelect?: (type: string, id: string, item: any) => void;
}

export const SmartSearch: React.FC<SmartSearchProps> = ({
    hotelId,
    branchId,
    placeholder = 'بحث...',
    onSelect,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    const session = { hotelId, branchId };
    const { query, setQuery, results, loading, hasResults, clear } = useSmartSearch(session);

    const handleSelect = (type: string, id: string, item: any) => {
        onSelect?.(type, id, item);
        clear();
        inputRef.current?.blur();
    };

    const showDropdown = isFocused && query.length > 0;

    return (
        <div style={styles.container}>
            <div style={styles.inputWrapper}>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder={placeholder}
                    style={{
                        ...styles.input,
                        borderColor: isFocused ? '#0D9488' : 'rgba(255,255,255,0.1)',
                    }}
                />
                <span style={styles.icon}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </span>
                {query && (
                    <button style={styles.clearBtn} onClick={clear}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {showDropdown && (
                <div style={styles.dropdown}>
                    {hasResults ? (
                        results.map((layer: LayerResults) => (
                            <div key={layer.name} style={styles.layerSection}>
                                <div style={styles.layerHeader}>
                                    <span>{LAYER_CONFIG[layer.name]?.icon}</span>
                                    <span>{LAYER_CONFIG[layer.name]?.label}</span>
                                    <span>({layer.items.length})</span>
                                </div>
                                {layer.items.map((item) => (
                                    <div
                                        key={item.id}
                                        style={styles.resultItem}
                                        onClick={() => handleSelect(layer.name, item.id, item)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <div style={styles.resultIcon}>
                                            {LAYER_CONFIG[layer.name]?.icon}
                                        </div>
                                        <div style={styles.resultContent}>
                                            <div
                                                style={styles.resultTitle}
                                                dangerouslySetInnerHTML={{ __html: item.title }}
                                            />
                                            <div style={styles.resultSubtitle}>{item.subtitle}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    ) : (
                        <div style={styles.noResults}>
                            <Search size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <div>لا توجد نتائج لـ "{query}"</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SmartSearch;
