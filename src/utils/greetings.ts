/**
 * Dynamic Greetings System
 * Adora Hotel Management System
 * 
 * Provides time-based greetings with i18n support
 */

import { TFunction } from 'i18next';

// ============================================================
// TYPES
// ============================================================

export interface GreetingParts {
    emoji: string;
    timeGreeting: string;
    motivational: string;
    fullText: string;
}

// ============================================================
// MAIN FUNCTION
// ============================================================

/**
 * Get greeting parts with i18n support
 */
export const getGreetingParts = (name?: string, t?: TFunction): GreetingParts => {
    const hour = new Date().getHours();
    
    // Determine time period
    let emoji: string;
    let timeGreeting: string;
    let motivational: string;
    
    if (hour >= 5 && hour < 12) {
        emoji = '☀️';
        timeGreeting = t ? t('greetings.morning') : 'Good Morning';
        motivational = t ? t('greetings.motivationalMessages', { returnObjects: true })[Math.floor(Math.random() * 12)] : 'Have a great day';
    } else if (hour >= 12 && hour < 17) {
        emoji = '🌤️';
        timeGreeting = t ? t('greetings.afternoon') : 'Good Afternoon';
        motivational = t ? t('greetings.motivationalMessages', { returnObjects: true })[Math.floor(Math.random() * 12)] : 'Keep up the great work';
    } else if (hour >= 17 && hour < 21) {
        emoji = '🌅';
        timeGreeting = t ? t('greetings.evening') : 'Good Evening';
        motivational = t ? t('greetings.eveningMessages', { returnObjects: true })[Math.floor(Math.random() * 6)] : 'Have a peaceful evening';
    } else {
        emoji = '🌙';
        timeGreeting = t ? t('greetings.night') : 'Good Night';
        motivational = t ? t('greetings.eveningMessages', { returnObjects: true })[Math.floor(Math.random() * 6)] : 'Have a restful night';
    }
    
    // Fallback if t() returns array (shouldn't happen with proper i18n setup)
    if (Array.isArray(motivational)) {
        motivational = motivational[0] || 'Have a great day';
    }
    
    const fullText = name 
        ? `${emoji} ${timeGreeting}, ${motivational} ${t ? t('greetings.you') : 'you'} ${name}`
        : `${emoji} ${timeGreeting}, ${motivational}`;
    
    return {
        emoji,
        timeGreeting,
        motivational,
        fullText
    };
};

/**
 * Legacy function for backward compatibility
 */
export const getTimeGreeting = (t?: TFunction): { emoji: string; greeting: string } => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return { emoji: '☀️', greeting: t ? t('greetings.morning') : 'Good Morning' };
    } else if (hour >= 12 && hour < 17) {
        return { emoji: '🌤️', greeting: t ? t('greetings.afternoon') : 'Good Afternoon' };
    } else if (hour >= 17 && hour < 21) {
        return { emoji: '🌅', greeting: t ? t('greetings.evening') : 'Good Evening' };
    } else {
        return { emoji: '🌙', greeting: t ? t('greetings.night') : 'Good Night' };
    }
};
