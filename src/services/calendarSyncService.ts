/**
 * Calendar Sync Service
 * Handles syncing seasons from external calendar sources
 * Adora Hotel Management System
 */

import { db } from './firebase';
import {
    doc,
    getDoc,
    setDoc,
    Timestamp,
    collection,
    addDoc
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

export interface CalendarSource {
    id: string;
    name: string;
    url: string;
    enabled: boolean;
}

export interface CalendarSettings {
    sources: CalendarSource[];
    lastSyncAt: Timestamp | null;
    autoSync: boolean;
}

export interface ParsedSeason {
    name: string;
    nameAr: string;
    startDate: Date;
    endDate: Date;
    source: string;
    type: 'holiday' | 'academic' | 'custom';
}

export interface SyncResult {
    success: boolean;
    added: number;
    skipped: number;
    errors: string[];
    seasons: ParsedSeason[];
}

// ============================================================
// DEFAULT SOURCES
// ============================================================

export const DEFAULT_CALENDAR_SOURCES: CalendarSource[] = [
    {
        id: 'moe_sa',
        name: 'تقويم وزارة التعليم السعودية',
        url: 'https://moe.gov.sa/ar/education/generaleducation/pages/academiccalendar.aspx',
        enabled: true
    },
    {
        id: 'saudi_calendars_academic',
        name: 'تقويم السعودية - الأكاديمي',
        url: 'https://saudicalendars.com/academic-calendar/',
        enabled: true
    },
    {
        id: 'saudi_calendars_events',
        name: 'تقويم السعودية - المناسبات العامة',
        url: 'https://saudicalendars.com/general-events/',
        enabled: true
    }
];

// ============================================================
// MOCK DATA - Saudi Seasons 2026
// ============================================================

const MOCK_SEASONS_2026: ParsedSeason[] = [
    {
        name: 'Eid Al-Fitr',
        nameAr: 'عيد الفطر المبارك',
        startDate: new Date('2026-03-20'),
        endDate: new Date('2026-03-30'),
        source: 'moe_sa',
        type: 'holiday'
    },
    {
        name: 'Eid Al-Adha',
        nameAr: 'عيد الأضحى المبارك',
        startDate: new Date('2026-05-27'),
        endDate: new Date('2026-06-06'),
        source: 'moe_sa',
        type: 'holiday'
    },
    {
        name: 'Saudi National Day',
        nameAr: 'اليوم الوطني السعودي',
        startDate: new Date('2026-09-22'),
        endDate: new Date('2026-09-24'),
        source: 'saudi_calendars',
        type: 'holiday'
    },
    {
        name: 'Mid-Year Break',
        nameAr: 'إجازة منتصف العام',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-01-25'),
        source: 'moe_sa',
        type: 'academic'
    },
    {
        name: 'Summer Break',
        nameAr: 'الإجازة الصيفية',
        startDate: new Date('2026-06-20'),
        endDate: new Date('2026-09-01'),
        source: 'moe_sa',
        type: 'academic'
    },
    {
        name: 'Founding Day',
        nameAr: 'يوم التأسيس',
        startDate: new Date('2026-02-22'),
        endDate: new Date('2026-02-23'),
        source: 'saudi_calendars',
        type: 'holiday'
    }
];

// ============================================================
// FIRESTORE FUNCTIONS
// ============================================================

/**
 * Get calendar sources for a tenant (shared across all branches)
 */
export const getCalendarSources = async (tenantId: string): Promise<CalendarSettings> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings/calendarSources`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as CalendarSettings;
        }

        // Return defaults if not configured
        return {
            sources: DEFAULT_CALENDAR_SOURCES,
            lastSyncAt: null,
            autoSync: false
        };
    } catch (error) {
        console.error('Error getting calendar sources:', error);
        return {
            sources: DEFAULT_CALENDAR_SOURCES,
            lastSyncAt: null,
            autoSync: false
        };
    }
};

/**
 * Save calendar sources for a tenant
 */
export const saveCalendarSources = async (
    tenantId: string,
    settings: CalendarSettings
): Promise<void> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings/calendarSources`);
        await setDoc(docRef, settings, { merge: true });
    } catch (error) {
        console.error('Error saving calendar sources:', error);
        throw error;
    }
};

/**
 * Add a new calendar source
 */
export const addCalendarSource = async (
    tenantId: string,
    source: Omit<CalendarSource, 'id'>
): Promise<CalendarSource> => {
    const settings = await getCalendarSources(tenantId);
    const newSource: CalendarSource = {
        ...source,
        id: `src_${Date.now()}`
    };

    settings.sources.push(newSource);
    await saveCalendarSources(tenantId, settings);

    return newSource;
};

/**
 * Remove a calendar source
 */
export const removeCalendarSource = async (
    tenantId: string,
    sourceId: string
): Promise<void> => {
    const settings = await getCalendarSources(tenantId);
    settings.sources = settings.sources.filter(s => s.id !== sourceId);
    await saveCalendarSources(tenantId, settings);
};

/**
 * Toggle a calendar source
 */
export const toggleCalendarSource = async (
    tenantId: string,
    sourceId: string,
    enabled: boolean
): Promise<void> => {
    const settings = await getCalendarSources(tenantId);
    const source = settings.sources.find(s => s.id === sourceId);
    if (source) {
        source.enabled = enabled;
        await saveCalendarSources(tenantId, settings);
    }
};

// ============================================================
// SYNC FUNCTIONS
// ============================================================

import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Sync seasons from external sources
 * Tries Cloud Function first, falls back to mock data if unavailable
 */
export const syncSeasonsFromSources = async (
    tenantId: string,
    existingSeasonNames: string[]
): Promise<SyncResult> => {
    try {
        const settings = await getCalendarSources(tenantId);
        const enabledSources = settings.sources.filter(s => s.enabled);

        if (enabledSources.length === 0) {
            return {
                success: false,
                added: 0,
                skipped: 0,
                errors: ['لا توجد مصادر مفعلة للمزامنة'],
                seasons: []
            };
        }

        let allSeasons: ParsedSeason[] = [];
        let usedMock = false;

        // Try Cloud Function first
        try {
            const functions = getFunctions(undefined, 'me-central1');
            const fetchCalendarData = httpsCallable(functions, 'fetchCalendarData');

            const urls = enabledSources.map(s => s.url);
            const result = await fetchCalendarData({ urls });
            const data = result.data as {
                success: boolean;
                seasons: Array<{
                    name: string;
                    nameAr: string;
                    startDate: string;
                    endDate: string;
                    source: string;
                    type: string;
                }>;
            };

            if (data.success && data.seasons.length > 0) {
                allSeasons = data.seasons.map(s => ({
                    name: s.name,
                    nameAr: s.nameAr,
                    startDate: new Date(s.startDate),
                    endDate: new Date(s.endDate),
                    source: s.source,
                    type: s.type as 'holiday' | 'academic' | 'custom'
                }));
            }
        } catch (cloudError) {
            console.warn('Cloud Function unavailable, using mock data:', cloudError);
            usedMock = true;

            // Fallback to mock data
            allSeasons = MOCK_SEASONS_2026.filter(
                s => enabledSources.some(src => src.id === s.source || src.id.includes(s.source))
            );
        }

        // Filter out existing seasons
        const newSeasons = allSeasons.filter(
            s => !existingSeasonNames.some(
                name => name.includes(s.nameAr) || s.nameAr.includes(name)
            )
        );

        const skipped = allSeasons.length - newSeasons.length;

        // Update last sync time
        settings.lastSyncAt = Timestamp.now();
        await saveCalendarSources(tenantId, settings);

        return {
            success: true,
            added: newSeasons.length,
            skipped,
            errors: usedMock ? ['تم استخدام البيانات المحلية (Cloud Function غير متوفر)'] : [],
            seasons: newSeasons
        };

    } catch (error) {
        console.error('Error syncing seasons:', error);
        return {
            success: false,
            added: 0,
            skipped: 0,
            errors: [error instanceof Error ? error.message : 'حدث خطأ غير متوقع'],
            seasons: []
        };
    }
};

/**
 * Get last sync timestamp
 */
export const getLastSyncTime = async (branchId: string): Promise<Date | null> => {
    const settings = await getCalendarSources(branchId);
    return settings.lastSyncAt?.toDate() || null;
};
