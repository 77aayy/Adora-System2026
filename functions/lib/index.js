"use strict";
/**
 * Cloud Functions for Adora Hotel Management
 * Calendar Sync - Fetches seasons from external calendars
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyFetch = exports.fetchCalendarData = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const cheerio = __importStar(require("cheerio"));
admin.initializeApp();
// ============================================================
// HELPER: Extract dates from text (Arabic/English)
// ============================================================
function extractDatesFromText(text) {
    // Common date patterns
    const patterns = [
        // Arabic: 20 مارس 2026
        /(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*(\d{4})?/gi,
        // English: March 20, 2026
        /(\w+)\s+(\d{1,2}),?\s*(\d{4})?/gi,
        // ISO: 2026-03-20
        /(\d{4})-(\d{2})-(\d{2})/g
    ];
    const arabicMonths = {
        'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3,
        'مايو': 4, 'يونيو': 5, 'يوليو': 6, 'أغسطس': 7,
        'سبتمبر': 8, 'أكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11
    };
    const englishMonths = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
    };
    const dates = [];
    // Try Arabic pattern
    const arabicMatch = text.match(/(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*(\d{4})?/gi);
    if (arabicMatch) {
        arabicMatch.forEach(match => {
            var _a;
            const parts = match.match(/(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s*(\d{4})?/i);
            if (parts) {
                const day = parseInt(parts[1]);
                const month = (_a = arabicMonths[parts[2]]) !== null && _a !== void 0 ? _a : 0;
                const year = parts[3] ? parseInt(parts[3]) : new Date().getFullYear();
                dates.push(new Date(year, month, day));
            }
        });
    }
    // Try ISO pattern
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/g);
    if (isoMatch) {
        isoMatch.forEach(match => {
            dates.push(new Date(match));
        });
    }
    if (dates.length >= 2) {
        return { start: dates[0], end: dates[1] };
    }
    else if (dates.length === 1) {
        return { start: dates[0], end: dates[0] };
    }
    return {};
}
// ============================================================
// HELPER: Parse HTML page for calendar events
// ============================================================
async function parseCalendarPage(url) {
    const seasons = [];
    try {
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ar,en;q=0.9'
            },
            timeout: 10000
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        // Common patterns for calendar tables
        $('table tr, .event, .holiday, .calendar-item, article').each((i, el) => {
            const text = $(el).text().trim();
            // Look for holiday/event keywords
            const holidayKeywords = [
                'عيد الفطر', 'عيد الأضحى', 'اليوم الوطني', 'يوم التأسيس',
                'إجازة', 'عطلة', 'رأس السنة', 'الإسراء والمعراج',
                'Eid', 'National Day', 'Holiday', 'Break', 'Vacation'
            ];
            const hasKeyword = holidayKeywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
            if (hasKeyword && text.length < 500) {
                const dates = extractDatesFromText(text);
                if (dates.start) {
                    // Extract event name
                    let name = '';
                    for (const kw of holidayKeywords) {
                        if (text.includes(kw)) {
                            name = kw;
                            break;
                        }
                    }
                    seasons.push({
                        name: name,
                        nameAr: name,
                        startDate: dates.start.toISOString().split('T')[0],
                        endDate: (dates.end || dates.start).toISOString().split('T')[0],
                        source: new URL(url).hostname,
                        type: 'holiday'
                    });
                }
            }
        });
    }
    catch (error) {
        console.error(`Error parsing ${url}:`, error);
    }
    return seasons;
}
// ============================================================
// CLOUD FUNCTION: Fetch Calendar Data
// ============================================================
exports.fetchCalendarData = functions
    .region('me-central1') // Middle East region for better latency
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    const { urls } = data;
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'يرجى توفير روابط صالحة');
    }
    // Limit to 5 URLs max to prevent abuse
    const limitedUrls = urls.slice(0, 5);
    const results = [];
    for (const url of limitedUrls) {
        try {
            // Validate URL
            new URL(url);
            const seasons = await parseCalendarPage(url);
            results.push({
                success: true,
                seasons,
                errors: [],
                source: url
            });
        }
        catch (error) {
            results.push({
                success: false,
                seasons: [],
                errors: [error instanceof Error ? error.message : 'خطأ غير معروف'],
                source: url
            });
        }
    }
    // Combine all seasons
    const allSeasons = results.flatMap(r => r.seasons);
    // Remove duplicates based on name and date
    const uniqueSeasons = allSeasons.filter((season, index, self) => index === self.findIndex(s => s.nameAr === season.nameAr && s.startDate === season.startDate));
    return {
        success: true,
        totalFound: uniqueSeasons.length,
        seasons: uniqueSeasons,
        sources: results.map(r => ({
            url: r.source,
            success: r.success,
            count: r.seasons.length,
            errors: r.errors
        }))
    };
});
// ============================================================
// CLOUD FUNCTION: Simple Proxy (Fallback)
// ============================================================
exports.proxyFetch = functions
    .region('me-central1')
    .runWith({
    timeoutSeconds: 30,
    memory: '128MB'
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    const { url } = data;
    try {
        new URL(url);
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 10000
        });
        const html = await response.text();
        return {
            success: true,
            html: html.substring(0, 100000), // Limit response size
            contentType: response.headers.get('content-type')
        };
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'فشل في جلب البيانات');
    }
});
//# sourceMappingURL=index.js.map