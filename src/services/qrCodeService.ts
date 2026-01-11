/**
 * QR Code Service
 * Generate and scan QR codes
 * Adora Hotel Management System V2
 * 
 * 🔐 SECURITY UPDATE: Now supports secure token-based URLs
 * Legacy functions are deprecated and will be removed in V3
 */

import { generateSecureAccessToken } from './secureAccessService';

// ============================================================
// TYPES
// ============================================================

interface QROptions {
    size?: number;
    color?: string;
    bgColor?: string;
    margin?: number;
    logo?: string;
    logoSize?: number;
}

interface QRData {
    roomNumber: string;
    floor?: string;
    branch: string;
    type: 'room' | 'service' | 'menu' | 'feedback';
    additionalData?: Record<string, string>;
}

interface SecureQRData {
    roomNumber: string;
    branchId: string;
    tenantId: string;
    floor?: string;
    createdBy: string;
}

// ============================================================
// QR GENERATION (Using API)
// ============================================================

/**
 * Generate QR code URL
 */
export const generateQRUrl = (data: string, options: QROptions = {}): string => {
    const size = options.size || 200;
    const color = (options.color || '#1a1a2e').replace('#', '');
    const bgColor = (options.bgColor || 'ffffff').replace('#', '');
    const margin = options.margin || 1;

    // Using QR Server API (free, no key required)
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&color=${color}&bgcolor=${bgColor}&margin=${margin}`;
};

/**
 * Generate QR code as image element
 */
export const generateQRImage = (data: string, options: QROptions = {}): HTMLImageElement => {
    const img = new Image();
    img.src = generateQRUrl(data, options);
    img.alt = 'QR Code';
    img.width = options.size || 200;
    img.height = options.size || 200;
    return img;
};

/**
 * Generate QR code for room
 * @deprecated Use generateSecureRoomQR instead - this exposes room number in URL (IDOR vulnerability)
 */
export const generateRoomQR = (qrData: QRData, baseUrl: string = window.location.origin): string => {
    console.warn('⚠️ DEPRECATED: generateRoomQR is insecure. Use generateSecureRoomQR instead.');
    const params = new URLSearchParams({
        room: qrData.roomNumber,
        branch: qrData.branch,
        type: qrData.type,
        ...(qrData.floor && { floor: qrData.floor }),
        ...(qrData.additionalData && qrData.additionalData)
    });

    const url = `${baseUrl}/guest?${params.toString()}`;
    return generateQRUrl(url, { size: 250 });
};

/**
 * 🔐 Generate SECURE QR code for room (Token-based)
 * This is the recommended method - prevents IDOR attacks
 */
export const generateSecureRoomQR = async (
    data: SecureQRData,
    options: QROptions = {}
): Promise<{ qrUrl: string; accessUrl: string; token: string }> => {
    // Generate secure token
    const { token, fullUrl } = await generateSecureAccessToken(
        data.roomNumber,
        data.branchId,
        data.tenantId,
        data.createdBy
    );
    
    // Generate QR image URL from the secure access URL
    const qrUrl = generateQRUrl(fullUrl, { 
        size: options.size || 250,
        color: options.color,
        bgColor: options.bgColor
    });
    
    console.log(`🔐 Secure QR generated for Room ${data.roomNumber}`);
    
    return { qrUrl, accessUrl: fullUrl, token };
};

/**
 * Generate service menu QR
 */
export const generateMenuQR = (branch: string, menuType: 'coffee' | 'food' | 'minibar'): string => {
    const url = `${window.location.origin}/menu/${menuType}?branch=${branch}`;
    return generateQRUrl(url, { size: 200, color: '#059669' });
};

/**
 * Generate feedback QR
 */
export const generateFeedbackQR = (roomNumber: string, branch: string, requestId?: string): string => {
    const params = new URLSearchParams({
        room: roomNumber,
        branch,
        ...(requestId && { request: requestId })
    });

    const url = `${window.location.origin}/feedback?${params.toString()}`;
    return generateQRUrl(url, { size: 200, color: '#d97706' });
};

// ============================================================
// QR DOWNLOAD
// ============================================================

/**
 * Download QR code as image
 */
export const downloadQR = async (data: string, filename: string, options: QROptions = {}): Promise<void> => {
    const url = generateQRUrl(data, options);

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filename}.png`;
        link.click();

        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Failed to download QR:', error);

        // Fallback: open in new tab
        window.open(url, '_blank');
    }
};

/**
 * Download room QR
 * @deprecated Use downloadSecureRoomQR instead
 */
export const downloadRoomQR = (roomNumber: string, branch: string): Promise<void> => {
    console.warn('⚠️ DEPRECATED: downloadRoomQR is insecure. Use downloadSecureRoomQR instead.');
    const qrData: QRData = {
        roomNumber,
        branch,
        type: 'room'
    };

    return downloadQR(
        `${window.location.origin}/guest?room=${roomNumber}&branch=${branch}`,
        `room-${roomNumber}-qr`,
        { size: 500 }
    );
};

/**
 * 🔐 Download SECURE room QR
 */
export const downloadSecureRoomQR = async (
    data: SecureQRData,
    filename?: string
): Promise<void> => {
    const { accessUrl } = await generateSecureRoomQR(data);
    return downloadQR(accessUrl, filename || `room-${data.roomNumber}-qr-secure`, { size: 500 });
};

// ============================================================
// QR PRINT
// ============================================================

/**
 * Print QR code with room info
 * @deprecated Use printSecureRoomQR instead
 */
export const printRoomQR = (roomNumber: string, floor: string, branch: string): void => {
    console.warn('⚠️ DEPRECATED: printRoomQR is insecure. Use printSecureRoomQR instead.');
    const qrUrl = generateRoomQR({ roomNumber, floor, branch, type: 'room' });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>QR - غرفة ${roomNumber}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }
                .card {
                    border: 2px solid #1a1a2e;
                    border-radius: 20px;
                    padding: 30px;
                    text-align: center;
                    max-width: 300px;
                }
                .room-number {
                    font-size: 48px;
                    font-weight: bold;
                    color: #1a1a2e;
                    margin-bottom: 10px;
                }
                .floor {
                    color: #666;
                    margin-bottom: 20px;
                }
                .qr-code {
                    margin: 20px 0;
                }
                .instructions {
                    font-size: 12px;
                    color: #888;
                    margin-top: 15px;
                }
                .logo {
                    font-size: 24px;
                    margin-bottom: 15px;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="logo">🏨</div>
                <div class="room-number">${roomNumber}</div>
                <div class="floor">الدور ${floor}</div>
                <img class="qr-code" src="${qrUrl}" alt="QR Code" width="200" height="200">
                <div class="instructions">
                    امسح الرمز لطلب الخدمات<br>
                    Scan for services
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

/**
 * 🔐 Print SECURE QR code with room info
 */
export const printSecureRoomQR = async (
    data: SecureQRData
): Promise<void> => {
    const { qrUrl } = await generateSecureRoomQR(data);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>QR - غرفة ${data.roomNumber}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }
                .card {
                    border: 2px solid #1a1a2e;
                    border-radius: 20px;
                    padding: 30px;
                    text-align: center;
                    max-width: 300px;
                }
                .room-number {
                    font-size: 48px;
                    font-weight: bold;
                    color: #1a1a2e;
                    margin-bottom: 10px;
                }
                .floor {
                    color: #666;
                    margin-bottom: 20px;
                }
                .qr-code {
                    margin: 20px 0;
                }
                .instructions {
                    font-size: 12px;
                    color: #888;
                    margin-top: 15px;
                }
                .logo {
                    font-size: 24px;
                    margin-bottom: 15px;
                }
                .secure-badge {
                    background: #10b981;
                    color: white;
                    font-size: 10px;
                    padding: 4px 8px;
                    border-radius: 10px;
                    margin-top: 10px;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="logo">🏨</div>
                <div class="room-number">${data.roomNumber}</div>
                <div class="floor">الدور ${data.floor || '-'}</div>
                <img class="qr-code" src="${qrUrl}" alt="QR Code" width="200" height="200">
                <div class="instructions">
                    امسح الرمز لطلب الخدمات<br>
                    Scan for services
                </div>
                <div class="secure-badge">🔐 رابط آمن</div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

/**
 * Print multiple room QRs
 * @deprecated Will be updated to use secure tokens in V3
 */
export const printMultipleRoomQRs = (rooms: { number: string; floor: string }[], branch: string): void => {
    console.warn('⚠️ DEPRECATED: printMultipleRoomQRs will be updated to use secure tokens.');
    const qrCards = rooms.map(room => {
        const qrUrl = generateRoomQR({ roomNumber: room.number, floor: room.floor, branch, type: 'room' });
        return `
            <div class="card">
                <div class="room-number">${room.number}</div>
                <div class="floor">الدور ${room.floor}</div>
                <img src="${qrUrl}" alt="QR" width="150" height="150">
            </div>
        `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>QR Codes - All Rooms</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                    padding: 20px;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                .card {
                    border: 1px solid #ddd;
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    page-break-inside: avoid;
                }
                .room-number {
                    font-size: 28px;
                    font-weight: bold;
                }
                .floor {
                    color: #666;
                    font-size: 12px;
                    margin-bottom: 10px;
                }
                @media print {
                    .card { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <h1 style="text-align: center; margin-bottom: 30px;">رموز QR للغرف</h1>
            <div class="grid">${qrCards}</div>
            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); window.close(); }, 1000);
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

// ============================================================
// QR SCANNER
// ============================================================

/**
 * Check if camera is available
 */
export const isCameraAvailable = async (): Promise<boolean> => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
    } catch {
        return false;
    }
};

/**
 * Parse scanned QR data
 */
export const parseQRData = (url: string): QRData | null => {
    try {
        const parsed = new URL(url);
        const params = parsed.searchParams;

        const room = params.get('room');
        const branch = params.get('branch');
        const type = params.get('type') as QRData['type'];

        if (!room || !branch) return null;

        return {
            roomNumber: room,
            branch,
            type: type || 'room',
            floor: params.get('floor') || undefined
        };
    } catch {
        return null;
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

export const useQRCode = () => {
    const [generating, setGenerating] = useState(false);

    const generate = useCallback((data: string, options?: QROptions) => {
        return generateQRUrl(data, options);
    }, []);

    const generateRoom = useCallback((token: string, roomNumber?: string, floor?: string) => {
        return generateRoomQR({ roomNumber: roomNumber || '', branch: '', floor: floor || '', type: 'room' });
    }, []);

    const download = useCallback(async (data: string, filename: string, options?: QROptions) => {
        setGenerating(true);
        await downloadQR(data, filename, options);
        setGenerating(false);
    }, []);

    const printRoom = useCallback((token: string, roomNumber: string, floor: string) => {
        printRoomQR(token, roomNumber, floor);
    }, []);

    return {
        generate,
        generateRoom,
        download,
        printRoom,
        printMultiple: printMultipleRoomQRs,
        generating
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Core
    generateQRUrl,
    generateQRImage,
    
    // 🔐 SECURE (Recommended)
    generateSecureRoomQR,
    downloadSecureRoomQR,
    printSecureRoomQR,
    
    // ⚠️ DEPRECATED (Will be removed in V3)
    generateRoomQR,
    downloadRoomQR,
    printRoomQR,
    printMultipleRoomQRs,
    
    // Menu & Feedback
    generateMenuQR,
    generateFeedbackQR,
    
    // Utils
    downloadQR,
    isCameraAvailable,
    parseQRData,
    useQRCode
};
