/**
 * Export Manager Component
 * Beautiful export options with PDF/Excel generation
 * Adora Hotel Management System V2
 */

import React, { useState } from 'react';
import {
    Download,
    FileText,
    FileSpreadsheet,
    Printer,
    Share2,
    Check,
    Loader2,
    Calendar,
    Filter,
    X,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface ExportData {
    headers: string[];
    rows: (string | number)[][];
    title: string;
    subtitle?: string;
}

interface ExportManagerProps {
    data: ExportData;
    filename?: string;
    onExportComplete?: (type: 'pdf' | 'excel' | 'print') => void;
}

type ExportType = 'pdf' | 'excel' | 'print' | 'share';

// ============================================================
// EXPORT OPTIONS
// ============================================================

const EXPORT_OPTIONS: {
    type: ExportType;
    icon: React.ComponentType<any>;
    label: string;
    color: string;
    gradient: string;
}[] = [
        {
            type: 'pdf',
            icon: FileText,
            label: 'PDF',
            color: '#EF4444',
            gradient: 'from-red-500 to-rose-600',
        },
        {
            type: 'excel',
            icon: FileSpreadsheet,
            label: 'Excel',
            color: '#10B981',
            gradient: 'from-emerald-500 to-green-600',
        },
        {
            type: 'print',
            icon: Printer,
            label: 'طباعة',
            color: '#6366F1',
            gradient: 'from-indigo-500 to-purple-600',
        },
        {
            type: 'share',
            icon: Share2,
            label: 'مشاركة',
            color: '#3B82F6',
            gradient: 'from-blue-500 to-cyan-600',
        },
    ];

// ============================================================
// EXPORT BUTTON COMPONENT
// ============================================================

const ExportButton: React.FC<{
    option: typeof EXPORT_OPTIONS[0];
    isLoading: boolean;
    isComplete: boolean;
    onClick: () => void;
}> = ({ option, isLoading, isComplete, onClick }) => {
    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className={`
                relative group flex flex-col items-center gap-2 p-4 rounded-xl
                bg-white/5 border border-white/10
                hover:bg-gradient-to-br hover:${option.gradient}
                hover:border-transparent hover:shadow-lg
                transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed
            `}
            style={{
                '--hover-shadow': `0 10px 30px ${option.color}30`,
            } as React.CSSProperties}
        >
            <div
                className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    bg-gradient-to-br ${option.gradient}
                    group-hover:scale-110 transition-transform duration-300
                `}
                style={{ boxShadow: `0 4px 15px ${option.color}40` }}
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : isComplete ? (
                    <Check className="w-5 h-5 text-white" />
                ) : (
                    <option.icon className="w-5 h-5 text-white" />
                )}
            </div>
            <span className="text-sm font-medium text-white/80 group-hover:text-white">
                {option.label}
            </span>

            {/* Hover glow effect */}
            <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(circle at center, ${option.color}10, transparent)`,
                }}
            />
        </button>
    );
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

function exportToCSV(data: ExportData, filename: string): void {
    const csvContent = [
        data.headers.join(','),
        ...data.rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
}

function exportToPDF(data: ExportData): void {
    // Create print-friendly content
    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>${data.title}</title>
            <style>
                * { font-family: 'Segoe UI', Tahoma, sans-serif; }
                body { padding: 40px; background: white; }
                h1 { color: #1e293b; margin-bottom: 8px; }
                h2 { color: #64748b; font-weight: normal; margin-bottom: 24px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f1f5f9; color: #334155; padding: 12px; text-align: right; border-bottom: 2px solid #e2e8f0; }
                td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; }
                tr:nth-child(even) { background: #f8fafc; }
                .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 12px; }
                .stats { display: flex; gap: 24px; margin-bottom: 24px; }
                .stat { background: #f1f5f9; padding: 16px 24px; border-radius: 8px; }
                .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
                .stat-label { color: #64748b; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>${data.title}</h1>
            ${data.subtitle ? `<h2>${data.subtitle}</h2>` : ''}
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${data.rows.length}</div>
                    <div class="stat-label">إجمالي السجلات</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${new Date().toLocaleDateString('ar-SA')}</div>
                    <div class="stat-label">تاريخ التقرير</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${data.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
            <div class="footer">
                تم إنشاء هذا التقرير بواسطة Adora Hotel Management System • ${new Date().toLocaleString('ar-SA')}
            </div>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
}

async function shareData(data: ExportData): Promise<void> {
    if (navigator.share) {
        try {
            await navigator.share({
                title: data.title,
                text: `${data.title}\n${data.rows.length} سجل`,
            });
        } catch (err) {
            // User cancelled or error
            console.log('Share cancelled');
        }
    } else {
        // Fallback: copy to clipboard
        const text = `${data.title}\n${data.headers.join(' | ')}\n${data.rows.map(r => r.join(' | ')).join('\n')}`;
        await navigator.clipboard.writeText(text);
    }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ExportManager: React.FC<ExportManagerProps> = ({
    data,
    filename = 'report',
    onExportComplete,
}) => {
    const [loadingType, setLoadingType] = useState<ExportType | null>(null);
    const [completeType, setCompleteType] = useState<ExportType | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleExport = async (type: ExportType) => {
        setLoadingType(type);

        try {
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 500));

            switch (type) {
                case 'pdf':
                    exportToPDF(data);
                    break;
                case 'excel':
                    exportToCSV(data, filename);
                    break;
                case 'print':
                    exportToPDF(data);
                    break;
                case 'share':
                    await shareData(data);
                    break;
            }

            setCompleteType(type);
            onExportComplete?.(type as 'pdf' | 'excel' | 'print');

            // Reset complete state
            setTimeout(() => setCompleteType(null), 2000);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setLoadingType(null);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-lg">
            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">تصدير التقرير</h3>
                            <p className="text-sm text-white/50">
                                {data.rows.length} سجل • {data.title}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/70 transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        خيارات
                    </button>
                </div>
            </div>

            {/* Export Options */}
            <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {EXPORT_OPTIONS.map(option => (
                        <ExportButton
                            key={option.type}
                            option={option}
                            isLoading={loadingType === option.type}
                            isComplete={completeType === option.type}
                            onClick={() => handleExport(option.type)}
                        />
                    ))}
                </div>
            </div>

            {/* Filter Panel (Expandable) */}
            {isOpen && (
                <div className="p-6 border-t border-white/5 bg-white/2">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-white/80">تصفية البيانات</span>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-white/50" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="block text-xs text-white/50 mb-2">من تاريخ</label>
                            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                                <Calendar className="w-4 h-4 text-white/40" />
                                <input
                                    type="date"
                                    className="bg-transparent text-white/80 text-sm w-full outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-2">إلى تاريخ</label>
                            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                                <Calendar className="w-4 h-4 text-white/40" />
                                <input
                                    type="date"
                                    className="bg-transparent text-white/80 text-sm w-full outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Section */}
            <div className="p-6 border-t border-white/5">
                <h4 className="text-sm font-medium text-white/60 mb-3">معاينة البيانات</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                {data.headers.slice(0, 5).map((header, i) => (
                                    <th
                                        key={i}
                                        className="text-right px-3 py-2 text-white/50 font-medium border-b border-white/10"
                                    >
                                        {header}
                                    </th>
                                ))}
                                {data.headers.length > 5 && (
                                    <th className="text-right px-3 py-2 text-white/30 font-medium border-b border-white/10">
                                        ...
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.slice(0, 3).map((row, i) => (
                                <tr key={i}>
                                    {row.slice(0, 5).map((cell, j) => (
                                        <td
                                            key={j}
                                            className="px-3 py-2 text-white/70 border-b border-white/5"
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                    {row.length > 5 && (
                                        <td className="px-3 py-2 text-white/30 border-b border-white/5">
                                            ...
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data.rows.length > 3 && (
                    <div className="text-center mt-3 text-xs text-white/40">
                        و {data.rows.length - 3} سجل آخر
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExportManager;
