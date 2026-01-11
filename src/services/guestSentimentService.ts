/**
 * Guest Sentiment Analysis Service 😊😐😢
 * Analyzes guest feedback and chat for sentiment
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import {
    collection, doc, setDoc, updateDoc, query,
    where, getDocs, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { logger } from './loggerService';
import { createAlert } from './smartAlertService';

// ============================================================
// TYPES
// ============================================================

export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export interface SentimentResult {
    sentiment: Sentiment;
    score: number; // -1 to 1
    confidence: number; // 0 to 100
    keywords: string[];
    urgency: 'low' | 'medium' | 'high';
}

export interface GuestMood {
    guestId?: string;
    roomNumber: string;
    overallSentiment: Sentiment;
    averageScore: number;
    interactions: number;
    lastInteraction: Timestamp;
    issues: string[];
    highlights: string[];
}

// ============================================================
// ARABIC SENTIMENT KEYWORDS
// ============================================================

const POSITIVE_KEYWORDS = [
    'ممتاز', 'رائع', 'جميل', 'شكرا', 'شكراً', 'مشكور', 'أحسنت', 'مذهل',
    'سعيد', 'مبسوط', 'جيد', 'حلو', 'نظيف', 'مريح', 'سريع', 'لذيذ',
    'محترم', 'راضي', 'تمام', 'عظيم', 'أفضل', 'ممتنّ', 'مميز', 'خرافي',
    'excellent', 'great', 'good', 'perfect', 'amazing', 'wonderful', 'happy',
    'thank', 'thanks', 'satisfied', 'clean', 'fast', 'nice',
];

const NEGATIVE_KEYWORDS = [
    'سيء', 'سيئ', 'مشكلة', 'مشاكل', 'بطيء', 'بطئ', 'متأخر', 'قذر',
    'وسخ', 'زعلان', 'غاضب', 'مستاء', 'محبط', 'سخيف', 'فاشل', 'فظيع',
    'مقرف', 'رديء', 'ضعيف', 'باطل', 'معطل', 'خربان', 'كسر', 'مكسور',
    'رائحة', 'نتن', 'حشرات', 'صراصير', 'نمل', 'ضوضاء', 'إزعاج',
    'bad', 'problem', 'slow', 'dirty', 'angry', 'upset', 'disappointed',
    'terrible', 'awful', 'broken', 'smell', 'noise', 'bug', 'cockroach',
];

const URGENT_KEYWORDS = [
    'طوارئ', 'عاجل', 'فورا', 'فوراً', 'الآن', 'حالاً', 'ضروري',
    'emergency', 'urgent', 'immediately', 'now', 'asap',
    'حريق', 'سرقة', 'إسعاف', 'شرطة', 'خطر', 'مرض', 'إصابة',
];

const COMPLAINT_KEYWORDS = [
    'شكوى', 'أشتكي', 'أريد المدير', 'غير مقبول', 'لن أعود', 'لن أزور',
    'complaint', 'manager', 'unacceptable', 'refund', 'compensation',
    'تعويض', 'استرجاع', 'مبلغ', 'فلوسي', 'حقي',
];

// ============================================================
// SENTIMENT ANALYSIS
// ============================================================

/**
 * Analyze text sentiment
 */
export function analyzeSentiment(text: string): SentimentResult {
    const normalizedText = text.toLowerCase();
    const words = normalizedText.split(/\s+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    let urgentCount = 0;
    const foundKeywords: string[] = [];
    
    // Count positive keywords
    for (const keyword of POSITIVE_KEYWORDS) {
        if (normalizedText.includes(keyword.toLowerCase())) {
            positiveCount++;
            foundKeywords.push(keyword);
        }
    }
    
    // Count negative keywords
    for (const keyword of NEGATIVE_KEYWORDS) {
        if (normalizedText.includes(keyword.toLowerCase())) {
            negativeCount++;
            foundKeywords.push(keyword);
        }
    }
    
    // Check for urgency
    for (const keyword of URGENT_KEYWORDS) {
        if (normalizedText.includes(keyword.toLowerCase())) {
            urgentCount++;
            foundKeywords.push(keyword);
        }
    }
    
    // Check for complaints
    const hasComplaint = COMPLAINT_KEYWORDS.some(k => 
        normalizedText.includes(k.toLowerCase())
    );
    
    // Calculate score (-1 to 1)
    const totalKeywords = positiveCount + negativeCount;
    let score = 0;
    
    if (totalKeywords > 0) {
        score = (positiveCount - negativeCount) / totalKeywords;
    }
    
    // Determine sentiment
    let sentiment: Sentiment;
    if (score >= 0.6) sentiment = 'very_positive';
    else if (score >= 0.2) sentiment = 'positive';
    else if (score >= -0.2) sentiment = 'neutral';
    else if (score >= -0.6) sentiment = 'negative';
    else sentiment = 'very_negative';
    
    // Determine urgency
    let urgency: 'low' | 'medium' | 'high' = 'low';
    if (urgentCount > 0 || hasComplaint) urgency = 'high';
    else if (negativeCount >= 2) urgency = 'medium';
    
    // Calculate confidence
    const confidence = Math.min(100, totalKeywords * 20 + (urgentCount * 30));
    
    return {
        sentiment,
        score: Math.round(score * 100) / 100,
        confidence,
        keywords: foundKeywords.slice(0, 5),
        urgency,
    };
}

/**
 * Analyze multiple messages for overall sentiment
 */
export function analyzeConversation(messages: string[]): SentimentResult {
    const results = messages.map(m => analyzeSentiment(m));
    
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const allKeywords = [...new Set(results.flatMap(r => r.keywords))];
    const highestUrgency = results.some(r => r.urgency === 'high') ? 'high' :
                          results.some(r => r.urgency === 'medium') ? 'medium' : 'low';
    
    let sentiment: Sentiment;
    if (avgScore >= 0.6) sentiment = 'very_positive';
    else if (avgScore >= 0.2) sentiment = 'positive';
    else if (avgScore >= -0.2) sentiment = 'neutral';
    else if (avgScore >= -0.6) sentiment = 'negative';
    else sentiment = 'very_negative';
    
    return {
        sentiment,
        score: Math.round(avgScore * 100) / 100,
        confidence: Math.round(results.reduce((sum, r) => sum + r.confidence, 0) / results.length),
        keywords: allKeywords,
        urgency: highestUrgency,
    };
}

// ============================================================
// GUEST MOOD TRACKING
// ============================================================

/**
 * Update guest mood based on new interaction
 */
export async function updateGuestMood(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    message: string,
    guestId?: string
): Promise<GuestMood> {
    try {
        const analysis = analyzeSentiment(message);
        const moodRef = doc(db, `tenants/${tenantId}/guestMoods`, `${branchId}_${roomNumber}`);
        
        // Get existing mood
        const existingSnapshot = await getDocs(query(
            collection(db, `tenants/${tenantId}/guestMoods`),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId)
        ));
        
        let mood: GuestMood;
        
        if (!existingSnapshot.empty) {
            const existing = existingSnapshot.docs[0].data() as GuestMood & { branchId: string };
            const newInteractions = existing.interactions + 1;
            const newAvgScore = (existing.averageScore * existing.interactions + analysis.score) / newInteractions;
            
            mood = {
                guestId: guestId || existing.guestId,
                roomNumber,
                overallSentiment: scoreToSentiment(newAvgScore),
                averageScore: Math.round(newAvgScore * 100) / 100,
                interactions: newInteractions,
                lastInteraction: Timestamp.now(),
                issues: [...existing.issues, ...analysis.keywords.filter(k => NEGATIVE_KEYWORDS.includes(k))].slice(-10),
                highlights: [...existing.highlights, ...analysis.keywords.filter(k => POSITIVE_KEYWORDS.includes(k))].slice(-10),
            };
        } else {
            mood = {
                guestId,
                roomNumber,
                overallSentiment: analysis.sentiment,
                averageScore: analysis.score,
                interactions: 1,
                lastInteraction: Timestamp.now(),
                issues: analysis.keywords.filter(k => NEGATIVE_KEYWORDS.includes(k)),
                highlights: analysis.keywords.filter(k => POSITIVE_KEYWORDS.includes(k)),
            };
        }
        
        await setDoc(moodRef, {
            ...mood,
            branchId,
            updatedAt: serverTimestamp(),
        });
        
        // Trigger alert for negative sentiment
        if (analysis.urgency === 'high' || analysis.sentiment === 'very_negative') {
            await createAlert(
                tenantId,
                branchId,
                'guest_complaint',
                `تنبيه: نزيل غير راضٍ - غرفة ${roomNumber}`,
                `تم اكتشاف عدم رضا من النزيل: "${message.substring(0, 100)}..."`,
                {
                    severity: analysis.urgency === 'high' ? 'critical' : 'warning',
                    roomNumber,
                    data: { sentiment: analysis.sentiment, keywords: analysis.keywords },
                }
            );
        }
        
        return mood;
    } catch (error) {
        logger.error('Error updating guest mood:', error, 'guestSentimentService');
        throw error;
    }
}

function scoreToSentiment(score: number): Sentiment {
    if (score >= 0.6) return 'very_positive';
    if (score >= 0.2) return 'positive';
    if (score >= -0.2) return 'neutral';
    if (score >= -0.6) return 'negative';
    return 'very_negative';
}

// ============================================================
// SENTIMENT REPORTS
// ============================================================

/**
 * Get sentiment summary for a branch
 */
export async function getBranchSentimentSummary(
    tenantId: string,
    branchId: string
): Promise<{
    totalGuests: number;
    sentimentDistribution: Record<Sentiment, number>;
    topIssues: { issue: string; count: number }[];
    topHighlights: { highlight: string; count: number }[];
    averageScore: number;
}> {
    try {
        const moodsRef = collection(db, `tenants/${tenantId}/guestMoods`);
        const q = query(moodsRef, where('branchId', '==', branchId));
        const snapshot = await getDocs(q);
        
        const distribution: Record<Sentiment, number> = {
            very_positive: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
            very_negative: 0,
        };
        
        const issueCount: Record<string, number> = {};
        const highlightCount: Record<string, number> = {};
        let totalScore = 0;
        
        snapshot.forEach(doc => {
            const mood = doc.data() as GuestMood;
            distribution[mood.overallSentiment]++;
            totalScore += mood.averageScore;
            
            mood.issues.forEach(issue => {
                issueCount[issue] = (issueCount[issue] || 0) + 1;
            });
            
            mood.highlights.forEach(highlight => {
                highlightCount[highlight] = (highlightCount[highlight] || 0) + 1;
            });
        });
        
        const sortedIssues = Object.entries(issueCount)
            .map(([issue, count]) => ({ issue, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        const sortedHighlights = Object.entries(highlightCount)
            .map(([highlight, count]) => ({ highlight, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        
        return {
            totalGuests: snapshot.size,
            sentimentDistribution: distribution,
            topIssues: sortedIssues,
            topHighlights: sortedHighlights,
            averageScore: snapshot.size > 0 ? Math.round((totalScore / snapshot.size) * 100) / 100 : 0,
        };
    } catch (error) {
        logger.error('Error getting sentiment summary:', error, 'guestSentimentService');
        return {
            totalGuests: 0,
            sentimentDistribution: { very_positive: 0, positive: 0, neutral: 0, negative: 0, very_negative: 0 },
            topIssues: [],
            topHighlights: [],
            averageScore: 0,
        };
    }
}

/**
 * Get emoji for sentiment
 */
export function getSentimentEmoji(sentiment: Sentiment): string {
    const emojis: Record<Sentiment, string> = {
        very_positive: '😍',
        positive: '😊',
        neutral: '😐',
        negative: '😕',
        very_negative: '😢',
    };
    return emojis[sentiment];
}

/**
 * Get color for sentiment
 */
export function getSentimentColor(sentiment: Sentiment): string {
    const colors: Record<Sentiment, string> = {
        very_positive: '#22c55e',
        positive: '#84cc16',
        neutral: '#eab308',
        negative: '#f97316',
        very_negative: '#ef4444',
    };
    return colors[sentiment];
}

export default {
    analyzeSentiment,
    analyzeConversation,
    updateGuestMood,
    getBranchSentimentSummary,
    getSentimentEmoji,
    getSentimentColor,
};
