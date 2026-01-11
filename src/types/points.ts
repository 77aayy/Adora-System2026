/**
 * Points & Gamification System Types
 */

import { Timestamp } from 'firebase/firestore';
import { Department } from './employee';

export enum PointAction {
    // Reception
    CREATE_REQUEST = 'create_request',
    CONFIRM_REQUEST = 'confirm_request',
    CONFIRM_URGENT = 'confirm_urgent',
    FAST_RESPONSE = 'fast_response',

    // Bellman
    CHECK_IN = 'check_in',
    CHECK_OUT = 'check_out',
    LUGGAGE_SERVICE = 'luggage_service',

    // Housekeeping
    CLEAN_ROOM = 'clean_room',
    INSPECTION = 'inspection',
    QUALITY_BONUS = 'quality_bonus',
    FAST_CLEANING = 'fast_cleaning',

    // Maintenance
    FIX_ISSUE = 'fix_issue',
    PREVENTIVE_MAINTENANCE = 'preventive_maintenance',
    EMERGENCY_FIX = 'emergency_fix',

    // General
    EXCELLENT_RATING = 'excellent_rating',
    GOOD_RATING = 'good_rating',
    DAILY_BONUS = 'daily_bonus',
    WEEK_BONUS = 'week_bonus',
    PENALTY = 'penalty'
}

export interface PointsSettings {
    department: Department;

    // Reception points
    create?: number;
    confirm?: number;
    confirmUrgent?: number;
    fastResponse?: number; // < 5 min

    // Bellman points
    checkIn?: number;
    checkOut?: number;
    luggageService?: number;

    // Housekeeping points
    cleanRoom?: number;
    inspection?: number;
    qualityBonus?: number;
    fastCleaning?: number;

    // Maintenance points
    fixIssue?: number;
    preventiveMaintenance?: number;
    emergencyFix?: number;

    // Rating points
    excellentRating?: number; // 5 stars
    goodRating?: number; // 4 stars

    // Bonuses
    dailyBonus?: number;
    weekBonus?: number;
}

export interface PointsTransaction {
    id: string;
    employeeId: string;
    employeeName: string;
    department: Department;

    // Transaction details
    action: PointAction;
    points: number;
    reason: string;
    reasonAr?: string;

    // Context
    relatedRequestId?: string;
    relatedRoomNumber?: string;

    // Timing
    createdAt: Timestamp;

    // Metadata
    isBonus?: boolean;
    isPenalty?: boolean;
    responseTime?: number; // for fast response bonuses
}

export interface PointsHistory {
    employeeId: string;
    transactions: PointsTransaction[];
    totalPoints: number;

    // Filters
    startDate?: Date;
    endDate?: Date;
    department?: Department;
    actionType?: PointAction;
}

export interface Leaderboard {
    period: 'today' | 'week' | 'month' | 'allTime';
    department?: Department;
    entries: LeaderboardEntry[];
    updatedAt: Timestamp;
}

export interface LeaderboardEntry {
    rank: number;
    employeeId: string;
    employeeName: string;
    department: Department;
    points: number;
    tasksCompleted: number;
    badge?: 'gold' | 'silver' | 'bronze';
    profilePhoto?: string;
}

export interface PointsBadge {
    name: string;
    nameAr: string;
    icon: string;
    color: string;
    minPoints: number;
    description?: string;
}
