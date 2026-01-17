/**
 * QR Room Manager - Smart QR Code System
 * 
 * Features:
 * - Generate one fixed QR per room (content is dynamic)
 * - Modern A4 print design with creative styling
 * - Track generated rooms to prevent duplicates
 * - Preview before printing
 * - Demo QR mode for trial buyers
 * - Shows room status (linked to Bellman check-in/out)
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    QrCode, Printer, Eye, Download, RefreshCw, Check, X,
    AlertTriangle, Info, Search, Filter, CheckCircle, XCircle,
    Smartphone, MapPin, Shield, Clock, Users, Building2,
    Sparkles, Copy, ExternalLink, Play, Pause, ShieldAlert
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { generateQRUrl } from '../../services/qrCodeService';
// 🔐 Secure Access Service
import { 
    generateSecureAccessToken, 
    deactivateToken 
} from '../../services/secureAccessService';
import { logger } from '../../services/loggerService';
// ✅ Architecture: Use services instead of direct Firebase calls
import { subscribeToRooms, updateRoom } from '../../services/roomService';
import { serverTimestamp } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface Room {
    id: string;
    number: string;
    floor?: string;
    type?: string;
    status?: 'available' | 'occupied' | 'maintenance' | 'cleaning';
    qrToken?: string;
    qrGeneratedAt?: Date;
    qrGeneratedBy?: string;
    isActive?: boolean; // Linked to Bellman check-in status
    currentGuestId?: string;
}

interface QRGenerationStats {
    total: number;
    generated: number;
    pending: number;
    active: number;
}

// ============================================================
// QR ROOM MANAGER COMPONENT
// ============================================================

export const QRRoomManager: React.FC<{ branchId: string; branchName: string; tenantId?: string }> = ({
    branchId,
    branchName,
    tenantId: propTenantId
}) => {
    const { tenantId: contextTenantId } = useTenant();
    const tenantId = propTenantId || contextTenantId;
    const { success, error: showError, haptic } = useUX();

    // State
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'generated' | 'pending'>('all');
    const [previewRoom, setPreviewRoom] = useState<Room | null>(null);
    const [showDemoMode, setShowDemoMode] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Base URL for QR codes
    const baseUrl = window.location.origin;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ============================================================
    // DATA FETCHING
    // ============================================================

    // ✅ Null Safety: Check required params before subscribing
    useEffect(() => {
        if (!tenantId || !branchId) {
            logger.warn('QRRoomManager: Missing tenantId or branchId', null, 'QRRoomManager');
            setLoading(false);
            return;
        }

        // ✅ Architecture: Use service instead of direct Firebase call
        // subscribeToRooms signature: (branchId, callback, tenantId, maxResults)
        const unsubscribe = subscribeToRooms(branchId, (roomsData) => {
            // ✅ Map to Room interface with QR fields
            const roomsWithQR = roomsData.map(room => ({
                ...room,
                qrGeneratedAt: (room as any).qrGeneratedAt?.toDate?.() || null,
                qrToken: (room as any).qrToken || undefined,
                qrGeneratedBy: (room as any).qrGeneratedBy || undefined,
                isActive: (room as any).isActive || false
            })) as Room[];
            
            // Sort by room number
            roomsWithQR.sort((a, b) => {
                const numA = parseInt(a.number) || 0;
                const numB = parseInt(b.number) || 0;
                return numA - numB;
            });
            
            setRooms(roomsWithQR);
            setLoading(false);
        }, tenantId, 1000); // ✅ Pass tenantId and maxResults

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [tenantId, branchId]);

    // ============================================================
    // STATISTICS
    // ============================================================

    const stats: QRGenerationStats = useMemo(() => {
        const total = rooms.length;
        const generated = rooms.filter(r => r.qrToken).length;
        const pending = total - generated;
        const active = rooms.filter(r => r.isActive).length;
        return { total, generated, pending, active };
    }, [rooms]);

    // ============================================================
    // FILTERED ROOMS
    // ============================================================

    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            // Search filter
            if (searchTerm && !room.number.includes(searchTerm)) return false;
            
            // Status filter
            if (filterStatus === 'generated' && !room.qrToken) return false;
            if (filterStatus === 'pending' && room.qrToken) return false;
            
            return true;
        });
    }, [rooms, searchTerm, filterStatus]);

    // ============================================================
    // GENERATE QR TOKEN
    // ============================================================

    const generateQRToken = async (room: Room) => {
        if (room.qrToken) {
            // Already generated - ask for confirmation to regenerate
            if (!window.confirm(`⚠️ الغرفة ${room.number} لديها QR مولّد بالفعل.\nهل تريد إعادة التوليد؟ (سيتم إبطال الرمز القديم)`)) {
                return;
            }
            // 🔐 Deactivate old token before generating new one
            try {
                await deactivateToken(room.qrToken, 'regenerated');
            } catch (e) {
                logger.warn('Could not deactivate old token', e, 'QRRoomManager');
            }
        }

        setGenerating(room.id);
        haptic?.('light');

        try {
            // 🔐 Generate secure token using secureAccessService
            const { token } = await generateSecureAccessToken(
                room.number,
                branchId,
                tenantId || '',
                'manager', // TODO: Add actual user ID from auth
                {
                    expiresInHours: 30 * 24, // ✅ 30 days expiry
                    maxDevices: 3,
                    roomCardId: room.currentGuestId
                }
            );
            
            // ✅ Architecture: Use service instead of direct Firebase call
            // ✅ Null Safety: Check required params
            if (!tenantId || !branchId) {
                throw new Error('Missing tenantId or branchId');
            }

            await updateRoom(tenantId, branchId, room.number, {
                qrToken: token,
                qrGeneratedAt: serverTimestamp() as any,
                qrGeneratedBy: 'manager'
            } as any);

            success?.(`✅ تم توليد QR آمن للغرفة ${room.number}`);
            haptic?.('success');
        } catch (err) {
            logger.error('Error generating QR', err, 'QRRoomManager');
            showError?.('حدث خطأ أثناء توليد الرمز');
            haptic?.('error');
        } finally {
            setGenerating(null);
        }
    };

    // ============================================================
    // GENERATE ALL PENDING
    // ============================================================

    const generateAllPending = async () => {
        const pendingRooms = rooms.filter(r => !r.qrToken);
        if (pendingRooms.length === 0) {
            showError?.('لا توجد غرف بانتظار التوليد');
            return;
        }

        if (!window.confirm(`سيتم توليد QR آمن لـ ${pendingRooms.length} غرفة.\nمتابعة؟`)) return;

        setGenerating('all');
        let successCount = 0;

        for (const room of pendingRooms) {
            try {
                // 🔐 Generate secure token for each room
                const { token } = await generateSecureAccessToken(
                    room.number,
                    branchId,
                    tenantId || '',
                    'manager',
                    {
                        expiresInHours: 30 * 24, // 30 days expiry
                        maxDevices: 3
                    }
                );
                
                // ✅ Architecture: Use service instead of direct Firebase call
                // ✅ Null Safety: Check required params
                if (!tenantId || !branchId) {
                    throw new Error('Missing tenantId or branchId');
                }

                await updateRoom(tenantId, branchId, room.number, {
                    qrToken: token,
                    qrGeneratedAt: serverTimestamp() as any,
                    qrGeneratedBy: 'manager'
                } as any);
                successCount++;
            } catch (err) {
                logger.error(`Error generating QR for room ${room.number}`, err, 'QRRoomManager');
            }
        }

        success?.(`✅ تم توليد ${successCount} من ${pendingRooms.length} QR آمن بنجاح`);
        setGenerating(null);
    };

    // ============================================================
    // BUILD QR URL
    // ============================================================

    /**
     * 🔐 Build secure QR URL - Uses token only (no room/branch exposed)
     */
    const buildQRUrl = (room: Room, isDemo: boolean = false): string => {
        if (!room.qrToken && !isDemo) return '';
        
        // 🔐 SECURE: Only send token, no room/branch info exposed
        if (isDemo) {
            // Demo mode - legacy format for preview only
            const params = new URLSearchParams({
                room: room.number,
                branch: branchId,
                tenantId: tenantId || '',
                demo: 'true'
            });
            return `${baseUrl}/guest?${params.toString()}`;
        }
        
        // 🔐 Production: Token-only URL
        return `${baseUrl}/guest?t=${room.qrToken}`;
    };

    // ============================================================
    // PRINT SINGLE QR (MODERN A4 DESIGN)
    // ============================================================

    const printSingleQR = (room: Room, isDemo: boolean = false) => {
        const qrUrl = buildQRUrl(room, isDemo);
        const qrImageUrl = generateQRUrl(qrUrl, { size: 300 });

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showError?.('يرجى السماح بالنوافذ المنبثقة للطباعة');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>QR - غرفة ${room.number}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    
                    body {
                        font-family: 'Cairo', sans-serif;
                        background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 40px;
                    }
                    
                    .card {
                        background: white;
                        border-radius: 32px;
                        padding: 50px;
                        max-width: 420px;
                        width: 100%;
                        box-shadow: 
                            0 25px 50px -12px rgba(0, 0, 0, 0.1),
                            0 0 0 1px rgba(20, 184, 166, 0.1);
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .card::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 8px;
                        background: linear-gradient(90deg, #14b8a6, #06b6d4, #0891b2);
                    }
                    
                    .hotel-name {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    
                    .hotel-name h1 {
                        font-size: 28px;
                        font-weight: 800;
                        background: linear-gradient(135deg, #0d9488, #0891b2);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    
                    .hotel-name p {
                        color: #64748b;
                        font-size: 14px;
                        margin-top: 4px;
                    }
                    
                    .room-badge {
                        background: linear-gradient(135deg, #14b8a6, #0d9488);
                        color: white;
                        padding: 16px 32px;
                        border-radius: 20px;
                        text-align: center;
                        margin: 20px auto;
                        display: inline-block;
                        width: 100%;
                    }
                    
                    .room-badge .label {
                        font-size: 14px;
                        opacity: 0.9;
                        margin-bottom: 4px;
                    }
                    
                    .room-badge .number {
                        font-size: 56px;
                        font-weight: 800;
                        line-height: 1;
                    }
                    
                    .room-badge .floor {
                        font-size: 14px;
                        opacity: 0.8;
                        margin-top: 8px;
                    }
                    
                    .qr-container {
                        background: #f8fafc;
                        border-radius: 24px;
                        padding: 30px;
                        text-align: center;
                        margin: 24px 0;
                        border: 2px dashed #e2e8f0;
                    }
                    
                    .qr-container img {
                        width: 220px;
                        height: 220px;
                        border-radius: 16px;
                    }
                    
                    .scan-text {
                        margin-top: 16px;
                        color: #475569;
                        font-size: 16px;
                        font-weight: 600;
                    }
                    
                    .scan-text span {
                        display: block;
                        font-size: 13px;
                        color: #94a3b8;
                        font-weight: 400;
                        margin-top: 4px;
                    }
                    
                    .features {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 12px;
                        margin-top: 24px;
                    }
                    
                    .feature {
                        text-align: center;
                        padding: 12px 8px;
                        background: #f0fdfa;
                        border-radius: 12px;
                    }
                    
                    .feature-icon {
                        font-size: 24px;
                        margin-bottom: 6px;
                    }
                    
                    .feature-text {
                        font-size: 11px;
                        color: #0d9488;
                        font-weight: 600;
                    }
                    
                    .footer {
                        margin-top: 24px;
                        padding-top: 20px;
                        border-top: 1px solid #e2e8f0;
                        text-align: center;
                    }
                    
                    .footer p {
                        font-size: 11px;
                        color: #94a3b8;
                    }
                    
                    .footer .wifi {
                        background: #fef3c7;
                        color: #92400e;
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-size: 12px;
                        margin-top: 12px;
                        display: inline-block;
                    }
                    
                    ${isDemo ? `
                    .demo-badge {
                        position: absolute;
                        top: 20px;
                        left: -40px;
                        background: #ef4444;
                        color: white;
                        padding: 8px 50px;
                        font-size: 12px;
                        font-weight: 700;
                        transform: rotate(-45deg);
                    }
                    ` : ''}
                    
                    @media print {
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        .card { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    ${isDemo ? '<div class="demo-badge">نسخة تجريبية</div>' : ''}
                    
                    <div class="hotel-name">
                        <h1>🏨 ${branchName}</h1>
                        <p>نظام خدمات الغرف الذكي</p>
                    </div>
                    
                    <div class="room-badge">
                        <div class="label">رقم الغرفة</div>
                        <div class="number">${room.number}</div>
                        ${room.floor ? `<div class="floor">الطابق ${room.floor}</div>` : ''}
                    </div>
                    
                    <div class="qr-container">
                        <img src="${qrImageUrl}" alt="QR Code" />
                        <div class="scan-text">
                            📱 امسح الرمز لطلب الخدمات
                            <span>Scan to request services</span>
                        </div>
                    </div>
                    
                    <div class="features">
                        <div class="feature">
                            <div class="feature-icon">☕</div>
                            <div class="feature-text">مشروبات</div>
                        </div>
                        <div class="feature">
                            <div class="feature-icon">🧹</div>
                            <div class="feature-text">تنظيف</div>
                        </div>
                        <div class="feature">
                            <div class="feature-icon">🔧</div>
                            <div class="feature-text">صيانة</div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>للمساعدة، تواصل مع الاستقبال - الخط الداخلي 0</p>
                        <div class="wifi">🌐 WiFi: ${branchName.replace(/\s/g, '_')}_Guest</div>
                    </div>
                </div>
                
                <script>
                    window.onload = () => setTimeout(() => window.print(), 500);
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();
    };

    // ============================================================
    // COPY LINK
    // ============================================================

    const copyLink = async (room: Room, isDemo: boolean = false) => {
        const url = buildQRUrl(room, isDemo);
        try {
            await navigator.clipboard.writeText(url);
            success?.('تم نسخ الرابط');
            haptic?.('success');
        } catch {
            showError?.('فشل نسخ الرابط');
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (!tenantId) {
        return (
            <div className="p-6 text-center text-white/60">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                <p>لا يمكن تحميل بيانات الغرف - المستأجر غير محدد</p>
            </div>
        );
    }

    return (
        <div className="solid-modal rounded-2xl overflow-hidden"
            style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
        >
            {/* Header */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                        <QrCode className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg" style={{ color: 'var(--theme-text-primary)' }}>
                            نظام QR الذكي للغرف
                        </h3>
                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                            {stats.generated}/{stats.total} غرفة مولّدة • {stats.active} نشطة
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Quick Stats */}
                    <div className="hidden sm:flex items-center gap-2 ml-4">
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-green-500/20 text-green-400">
                            ✅ {stats.generated}
                        </span>
                        <span className="px-2 py-1 rounded-lg text-xs font-bold bg-orange-500/20 text-orange-400">
                            ⏳ {stats.pending}
                        </span>
                    </div>
                    <RefreshCw className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                        style={{ color: 'var(--theme-text-tertiary)' }}
                    />
                </div>
            </div>

            {/* Content */}
            {!isCollapsed && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                    {/* Info Banner */}
                    <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 mb-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-teal-400 mb-1">نظام QR ذكي ومتكامل</p>
                                <ul className="text-xs space-y-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <li>• رمز QR ثابت لكل غرفة - المحتوى الرقمي هو المتغير</li>
                                    <li>• يعمل فقط عند تسجيل دخول النزيل من البيلمان</li>
                                    <li>• جهازين كحد أقصى لكل غرفة - مع تحقق جغرافي</li>
                                    <li>• جولة تعريفية للنزيل مرتين فقط ثم تختفي</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4"
                                style={{ color: 'var(--theme-text-tertiary)' }}
                            />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="بحث برقم الغرفة..."
                                className="w-full pr-10 pl-4 py-2 rounded-xl bg-white/5 border text-sm"
                                style={{
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)'
                                }}
                            />
                        </div>

                        {/* Filter */}
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="px-3 py-2 rounded-xl bg-white/5 border text-sm"
                            style={{
                                borderColor: 'var(--theme-border-primary)',
                                color: 'var(--theme-text-primary)'
                            }}
                        >
                            <option value="all">الكل ({stats.total})</option>
                            <option value="generated">مولّدة ({stats.generated})</option>
                            <option value="pending">بانتظار ({stats.pending})</option>
                        </select>

                        {/* Generate All Button */}
                        {stats.pending > 0 && (
                            <button
                                onClick={generateAllPending}
                                disabled={generating === 'all'}
                                className="px-4 py-2 rounded-xl bg-teal-500 text-white font-medium text-sm flex items-center gap-2 hover:bg-teal-600 disabled:opacity-50 transition-colors"
                            >
                                {generating === 'all' ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                توليد الكل ({stats.pending})
                            </button>
                        )}

                        {/* Demo Toggle */}
                        <button
                            onClick={() => setShowDemoMode(!showDemoMode)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                                showDemoMode
                                    ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50'
                                    : 'bg-white/5 hover:bg-white/10'
                            }`}
                            style={{ color: showDemoMode ? undefined : 'var(--theme-text-secondary)' }}
                        >
                            {showDemoMode ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            {showDemoMode ? 'إخفاء التجريبي' : 'وضع التجربة'}
                        </button>
                    </div>

                    {/* Demo Mode Info */}
                    {showDemoMode && (
                        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4">
                            <div className="flex items-center gap-2 text-purple-400 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-medium">وضع التجربة للمشترين المحتملين:</span>
                            </div>
                            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                                يفتح صفحة النزيل للعرض فقط، لا يمكن إرسال طلبات فعلية. مثالي لعرض النظام للعملاء المحتملين.
                            </p>
                        </div>
                    )}

                    {/* Rooms Table */}
                    {loading ? (
                        <div className="py-12 text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-teal-400" />
                            <p style={{ color: 'var(--theme-text-tertiary)' }}>جاري تحميل الغرف...</p>
                        </div>
                    ) : filteredRooms.length === 0 ? (
                        <div className="py-12 text-center">
                            <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p style={{ color: 'var(--theme-text-tertiary)' }}>
                                {searchTerm ? 'لا توجد نتائج' : 'لا توجد غرف مسجلة'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--theme-border-primary)' }}>
                                        <th className="text-right py-3 px-2 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>الغرفة</th>
                                        <th className="text-right py-3 px-2 font-medium hidden sm:table-cell" style={{ color: 'var(--theme-text-secondary)' }}>الطابق</th>
                                        <th className="text-center py-3 px-2 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>الحالة</th>
                                        <th className="text-center py-3 px-2 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>QR</th>
                                        <th className="text-center py-3 px-2 font-medium" style={{ color: 'var(--theme-text-secondary)' }}>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRooms.map((room) => (
                                        <tr 
                                            key={room.id}
                                            className="border-b hover:bg-white/5 transition-colors"
                                            style={{ borderColor: 'var(--theme-border-primary)' }}
                                        >
                                            {/* Room Number */}
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center font-bold text-teal-400">
                                                        {room.number}
                                                    </span>
                                                    {room.type && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5"
                                                            style={{ color: 'var(--theme-text-tertiary)' }}
                                                        >
                                                            {room.type}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Floor */}
                                            <td className="py-3 px-2 hidden sm:table-cell" style={{ color: 'var(--theme-text-secondary)' }}>
                                                {room.floor || '-'}
                                            </td>

                                            {/* Active Status (Bellman) */}
                                            <td className="py-3 px-2 text-center">
                                                {room.isActive ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                                                        <CheckCircle className="w-3 h-3" />
                                                        نشط
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
                                                        <XCircle className="w-3 h-3" />
                                                        غير نشط
                                                    </span>
                                                )}
                                            </td>

                                            {/* QR Status */}
                                            <td className="py-3 px-2 text-center">
                                                {room.qrToken ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-teal-500/20 text-teal-400">
                                                        <Check className="w-3 h-3" />
                                                        مولّد
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
                                                        <Clock className="w-3 h-3" />
                                                        بانتظار
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-2">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Generate/Regenerate */}
                                                    <button
                                                        onClick={() => generateQRToken(room)}
                                                        disabled={generating === room.id}
                                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                        title={room.qrToken ? 'إعادة التوليد' : 'توليد QR'}
                                                    >
                                                        {generating === room.id ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                                                        ) : (
                                                            <QrCode className={`w-4 h-4 ${room.qrToken ? 'text-teal-400' : 'text-orange-400'}`} />
                                                        )}
                                                    </button>

                                                    {/* Preview */}
                                                    {room.qrToken && (
                                                        <button
                                                            onClick={() => setPreviewRoom(room)}
                                                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                            title="معاينة"
                                                        >
                                                            <Eye className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                                                        </button>
                                                    )}

                                                    {/* Print */}
                                                    {room.qrToken && (
                                                        <button
                                                            onClick={() => printSingleQR(room)}
                                                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                            title="طباعة"
                                                        >
                                                            <Printer className="w-4 h-4 text-blue-400" />
                                                        </button>
                                                    )}

                                                    {/* Copy Link */}
                                                    {room.qrToken && (
                                                        <button
                                                            onClick={() => copyLink(room)}
                                                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                                            title="نسخ الرابط"
                                                        >
                                                            <Copy className="w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                                                        </button>
                                                    )}

                                                    {/* Demo Print (when demo mode active) */}
                                                    {showDemoMode && (
                                                        <button
                                                            onClick={() => printSingleQR(room, true)}
                                                            className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors"
                                                            title="طباعة نسخة تجريبية"
                                                        >
                                                            <Printer className="w-4 h-4 text-purple-400" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Preview Modal */}
            {previewRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="solid-modal rounded-2xl p-6 max-w-md w-full"
                        style={{ background: 'var(--theme-bg-primary)' }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg" style={{ color: 'var(--theme-text-primary)' }}>
                                معاينة QR - غرفة {previewRoom.number}
                            </h3>
                            <button
                                onClick={() => setPreviewRoom(null)}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-5 h-5" style={{ color: 'var(--theme-text-tertiary)' }} />
                            </button>
                        </div>

                        <div className="text-center p-6 rounded-xl" style={{ background: 'var(--theme-bg-secondary)' }}>
                            <img
                                src={generateQRUrl(buildQRUrl(previewRoom), { size: 250 })}
                                alt={`QR for room ${previewRoom.number}`}
                                className="mx-auto rounded-xl shadow-lg"
                            />
                            <p className="mt-4 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                📱 امسح الرمز بكاميرا الهاتف
                            </p>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => {
                                    printSingleQR(previewRoom);
                                    setPreviewRoom(null);
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-teal-500 text-white font-medium flex items-center justify-center gap-2 hover:bg-teal-600 transition-colors"
                            >
                                <Printer className="w-4 h-4" />
                                طباعة A4
                            </button>
                            <button
                                onClick={() => copyLink(previewRoom)}
                                className="px-4 py-2.5 rounded-xl bg-white/10 font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                <Copy className="w-4 h-4" />
                                نسخ
                            </button>
                            <a
                                href={buildQRUrl(previewRoom)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2.5 rounded-xl bg-white/10 font-medium flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                <ExternalLink className="w-4 h-4" />
                                فتح
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QRRoomManager;
