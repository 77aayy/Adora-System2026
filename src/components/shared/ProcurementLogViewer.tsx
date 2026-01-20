/**
 * Procurement Log Viewer Component
 * Shows procurement history and receipt records for departments
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    X, History, Package, Truck, CheckCircle, AlertTriangle,
    Clock, User, FileText, Download, Printer, ChevronDown,
    ChevronUp, RefreshCw, ShoppingCart, Filter, Calendar,
    ArrowLeft, ArrowRight, Receipt
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader } from '../common/AdoraLoader';
import { useTranslation } from 'react-i18next';
import {
    getProcurementLogs, getDepartmentProcurementLogs, getDepartmentReceipts,
    ProcurementLogEntry, ReceiptRecord, STAGE_CONFIG, ProcurementStage
} from '../../services/procurementNotificationService';

// ============================================================
// TYPES
// ============================================================

interface ProcurementLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: 'department' | 'procurement';
    department?: string;
    requestId?: string; // If viewing specific request
}

type TabType = 'logs' | 'receipts';

// ============================================================
// STAGE ICONS
// ============================================================

const StageIcon: React.FC<{ stage: ProcurementStage; className?: string }> = ({ stage, className = "w-5 h-5" }) => {
    const icons: Record<ProcurementStage, React.ReactNode> = {
        SUBMITTED: <ShoppingCart className={className} />,
        PENDING_APPROVAL: <Clock className={className} />,
        APPROVED: <CheckCircle className={className} />,
        REJECTED: <X className={className} />,
        PURCHASING: <ShoppingCart className={className} />,
        PARTIAL_PURCHASE: <AlertTriangle className={className} />,
        PURCHASED: <Package className={className} />,
        DELIVERED: <Truck className={className} />,
        PARTIAL_RECEIPT: <Receipt className={className} />,
        FULL_RECEIPT: <CheckCircle className={className} />,
        SHORTAGE: <AlertTriangle className={className} />,
        OVERAGE: <AlertTriangle className={className} />,
        BACKORDER_CREATED: <RefreshCw className={className} />,
        COMPLETED: <CheckCircle className={className} />,
    };
    return <>{icons[stage]}</>;
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ProcurementLogViewer: React.FC<ProcurementLogViewerProps> = ({
    isOpen,
    onClose,
    mode = 'department',
    department,
    requestId,
}) => {
    const { user, branchId, tenantId } = useAuth();
    const { haptic, success } = useUX();
    
    // State
    const [activeTab, setActiveTab] = useState<TabType>('logs');
    const [logs, setLogs] = useState<ProcurementLogEntry[]>([]);
    const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);
    
    // Load data
    const loadData = useCallback(async () => {
        if (!tenantId || !branchId) return;
        
        setLoading(true);
        try {
            const deptToUse = department || (user as any)?.department || '';
            
            if (requestId) {
                // Load logs for specific request
                const logsData = await getProcurementLogs(requestId, tenantId);
                setLogs(logsData);
            } else {
                // Load department logs
                const logsData = await getDepartmentProcurementLogs(tenantId, branchId, deptToUse, 100);
                setLogs(logsData);
            }
            
            // Load receipts
            const receiptsData = await getDepartmentReceipts(tenantId, branchId, deptToUse, 100);
            setReceipts(receiptsData);
        } catch (err) {
            console.error('Error loading procurement logs:', err);
        }
        setLoading(false);
    }, [tenantId, branchId, department, user, requestId]);
    
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, loadData]);
    
    // Print
    const handlePrint = () => {
        const deptName = department || (user as any)?.department || 'القسم';
        
        const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>سجل المشتريات - ${deptName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 10pt; padding: 20mm; }
        .header { text-align: center; border-bottom: 2px solid #14b8a6; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 16pt; color: #14b8a6; }
        table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 20px; }
        th { background: #14b8a6; color: white; padding: 8px; text-align: right; }
        td { border-bottom: 1px solid #eee; padding: 8px; }
        .stage-icon { font-size: 14pt; }
        .shortage { color: #ef4444; }
        .overage { color: #f59e0b; }
        .success { color: #22c55e; }
    </style>
</head>
<body>
    <div class="header">
        <h1>سجل المشتريات - ${deptName}</h1>
        <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p>
    </div>
    
    <h2>سجل العمليات</h2>
    <table>
        <thead>
            <tr>
                <th>التاريخ</th>
                <th>المرحلة</th>
                <th>الوصف</th>
                <th>المنفذ</th>
            </tr>
        </thead>
        <tbody>
            ${logs.map(log => `
                <tr>
                    <td>${log.timestamp.toLocaleString('ar-SA')}</td>
                    <td><span class="stage-icon">${STAGE_CONFIG[log.stage]?.icon || '📋'}</span> ${STAGE_CONFIG[log.stage]?.title || log.stage}</td>
                    <td>${log.description}</td>
                    <td>${log.actorName}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <h2>سجل الاستلام</h2>
    <table>
        <thead>
            <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المتوقع</th>
                <th>المستلم</th>
                <th>الفرق</th>
                <th>المستلم بواسطة</th>
            </tr>
        </thead>
        <tbody>
            ${receipts.map(receipt => `
                <tr>
                    <td>${receipt.receivedAt.toLocaleString('ar-SA')}</td>
                    <td>${receipt.type === 'full' ? '✅ كامل' : receipt.type === 'shortage' ? '⚠️ عجز' : receipt.type === 'overage' ? '📈 زيادة' : '📋 جزئي'}</td>
                    <td>${receipt.totalExpected}</td>
                    <td>${receipt.totalReceived}</td>
                    <td class="${receipt.totalDifference < 0 ? 'shortage' : receipt.totalDifference > 0 ? 'overage' : 'success'}">${receipt.totalDifference}</td>
                    <td>${receipt.receivedBy.name}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>
        `;
        
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(printContent);
            win.document.close();
            win.onafterprint = () => win.close();
            setTimeout(() => win.print(), 500);
        }
        
        haptic('success');
        success('جاري الطباعة...');
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                            <History className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">سجل المشتريات</h2>
                            <p className="text-white/50 text-sm">
                                {requestId ? `طلب #${requestId.slice(0, 8)}` : department || 'القسم'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="p-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                            title={t('common.print') || 'طباعة'}
                        >
                            <Printer className="w-5 h-5" />
                        </button>
                        <button
                            onClick={loadData}
                            className="p-2.5 rounded-xl bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/10 text-white/60 hover:text-red-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-white/10 px-4">
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                            activeTab === 'logs'
                                ? 'border-orange-500 text-orange-400'
                                : 'border-transparent text-white/50 hover:text-white'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        سجل العمليات
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-xs">{logs.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('receipts')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                            activeTab === 'receipts'
                                ? 'border-orange-500 text-orange-400'
                                : 'border-transparent text-white/50 hover:text-white'
                        }`}
                    >
                        <Receipt className="w-4 h-4" />
                        سجل الاستلام
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-xs">{receipts.length}</span>
                    </button>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <AdoraLoader size="lg" message="جاري تحميل السجل..." />
                        </div>
                    ) : activeTab === 'logs' ? (
                        // Logs Tab
                        <div className="space-y-2">
                            {logs.length === 0 ? (
                                <div className="text-center py-20 text-white/40">
                                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p>لا توجد عمليات مسجلة</p>
                                </div>
                            ) : (
                                logs.map((log, idx) => {
                                    const config = STAGE_CONFIG[log.stage] || { title: log.stage, icon: '📋', color: 'gray' };
                                    const isExpanded = expandedLog === log.id;
                                    
                                    return (
                                        <div
                                            key={log.id || idx}
                                            className={`rounded-xl bg-white/5 border border-white/10 overflow-hidden transition-all cursor-pointer hover:bg-white/10`}
                                            onClick={() => setExpandedLog(isExpanded ? null : log.id!)}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-start gap-3">
                                                    {/* Stage Icon */}
                                                    <div className={`w-10 h-10 rounded-xl bg-${config.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                                                        <span className="text-xl">{config.icon}</span>
                                                    </div>
                                                    
                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-medium">{config.title}</span>
                                                        </div>
                                                        <p className="text-white/60 text-sm mt-1 line-clamp-1">{log.description}</p>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {log.timestamp.toLocaleString('ar-SA')}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <User className="w-3 h-3" />
                                                                {log.actorName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Expand Icon */}
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-5 h-5 text-white/40" />
                                                    ) : (
                                                        <ChevronDown className="w-5 h-5 text-white/40" />
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Expanded Details */}
                                            {isExpanded && log.items && log.items.length > 0 && (
                                                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                                                    <p className="text-white/50 text-xs mb-2">العناصر:</p>
                                                    <div className="space-y-2">
                                                        {log.items.map((item, i) => (
                                                            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-black/20">
                                                                <span className="text-white text-sm">{item.name}</span>
                                                                <div className="flex items-center gap-3 text-sm">
                                                                    <span className="text-white/50">طلب: {item.requestedQty}</span>
                                                                    {item.purchasedQty !== undefined && (
                                                                        <span className="text-blue-400">شراء: {item.purchasedQty}</span>
                                                                    )}
                                                                    {item.receivedQty !== undefined && (
                                                                        <span className="text-green-400">استلام: {item.receivedQty}</span>
                                                                    )}
                                                                    {item.shortage !== undefined && item.shortage > 0 && (
                                                                        <span className="text-red-400">عجز: {item.shortage}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {log.totalCost && (
                                                        <p className="text-white/50 text-sm mt-3">
                                                            التكلفة الإجمالية: <span className="text-green-400 font-bold">{log.totalCost} ريال</span>
                                                        </p>
                                                    )}
                                                    
                                                    {log.notes && (
                                                        <p className="text-white/50 text-sm mt-2">
                                                            ملاحظات: <span className="text-white/70">{log.notes}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        // Receipts Tab
                        <div className="space-y-3">
                            {receipts.length === 0 ? (
                                <div className="text-center py-20 text-white/40">
                                    <Receipt className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p>لا توجد سجلات استلام</p>
                                </div>
                            ) : (
                                receipts.map((receipt, idx) => {
                                    const isExpanded = expandedReceipt === receipt.id;
                                    const typeConfig = {
                                        full: { label: 'استلام كامل', icon: '✅', color: 'green' },
                                        partial: { label: 'استلام جزئي', icon: '📋', color: 'orange' },
                                        shortage: { label: 'عجز', icon: '⚠️', color: 'red' },
                                        overage: { label: 'زيادة', icon: '📈', color: 'yellow' },
                                    }[receipt.type];
                                    
                                    return (
                                        <div
                                            key={receipt.id || idx}
                                            className={`rounded-xl border overflow-hidden transition-all cursor-pointer ${
                                                receipt.type === 'shortage' ? 'bg-red-500/10 border-red-500/30' :
                                                receipt.type === 'overage' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                                receipt.type === 'full' ? 'bg-green-500/10 border-green-500/30' :
                                                'bg-white/5 border-white/10'
                                            } hover:opacity-90`}
                                            onClick={() => setExpandedReceipt(isExpanded ? null : receipt.id!)}
                                        >
                                            <div className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl">{typeConfig.icon}</span>
                                                        <div>
                                                            <p className="text-white font-medium">{typeConfig.label}</p>
                                                            <p className="text-white/50 text-xs">
                                                                {receipt.receivedAt.toLocaleString('ar-SA')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-left">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-center">
                                                                <p className="text-white/50 text-xs">متوقع</p>
                                                                <p className="text-white font-bold">{receipt.totalExpected}</p>
                                                            </div>
                                                            <ArrowRight className="w-4 h-4 text-white/30" />
                                                            <div className="text-center">
                                                                <p className="text-white/50 text-xs">مستلم</p>
                                                                <p className="text-green-400 font-bold">{receipt.totalReceived}</p>
                                                            </div>
                                                            {receipt.totalDifference !== 0 && (
                                                                <>
                                                                    <span className="text-white/30">=</span>
                                                                    <div className="text-center">
                                                                        <p className="text-white/50 text-xs">فرق</p>
                                                                        <p className={`font-bold ${receipt.totalDifference < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                                                                            {receipt.totalDifference > 0 ? '+' : ''}{receipt.totalDifference}
                                                                        </p>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-5 h-5 text-white/40" />
                                                    ) : (
                                                        <ChevronDown className="w-5 h-5 text-white/40" />
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Expanded Items */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
                                                    {/* Items Table */}
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="text-white/50 text-xs">
                                                                    <th className="text-right pb-2">العنصر</th>
                                                                    <th className="text-center pb-2">متوقع</th>
                                                                    <th className="text-center pb-2">مستلم</th>
                                                                    <th className="text-center pb-2">الفرق</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {receipt.items.map((item, i) => (
                                                                    <tr key={i} className="border-t border-white/5">
                                                                        <td className="py-2 text-white">{item.name}</td>
                                                                        <td className="py-2 text-center text-white/70">{item.expected}</td>
                                                                        <td className="py-2 text-center text-green-400">{item.received}</td>
                                                                        <td className={`py-2 text-center font-medium ${
                                                                            item.difference < 0 ? 'text-red-400' :
                                                                            item.difference > 0 ? 'text-yellow-400' :
                                                                            'text-green-400'
                                                                        }`}>
                                                                            {item.difference > 0 ? '+' : ''}{item.difference}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    
                                                    {/* Backorder Info */}
                                                    {receipt.backorderCreated && (
                                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                                            <RefreshCw className="w-4 h-4 text-blue-400" />
                                                            <span className="text-blue-400 text-sm">
                                                                تم إنشاء طلب جديد للكمية الناقصة تلقائياً
                                                            </span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Receiver Info */}
                                                    <div className="flex items-center justify-between text-sm text-white/50">
                                                        <span>استلم بواسطة: <span className="text-white">{receipt.receivedBy.name}</span></span>
                                                        {receipt.notes && (
                                                            <span>ملاحظات: <span className="text-white/70">{receipt.notes}</span></span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProcurementLogViewer;
