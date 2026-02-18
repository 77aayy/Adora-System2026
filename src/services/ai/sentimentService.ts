/**
 * AI Guest Sentiment Analysis Service
 * Phase 7: Revenue & Experience Optimization
 */

// Re-verification trigger
import { generateAIContent } from './geminiService';
import { logger } from '../loggerService';

export interface SentimentResult {
    sentiment: 'Positive' | 'Neutral' | 'Negative';
    severity: 'CRITICAL' | 'MODERATE' | 'LOW';
    issue?: 'Staff' | 'Cleanliness' | 'AC' | 'Water' | 'Electricity' | 'Safety' | 'Food' | 'Wait Time' | 'Other';
    score: number; // 0 to 1
    summary?: string;
    suggestedRecovery?: string;
}

/**
 * ⚡ Analyzes guest feedback text using Gemini 1.5 Flash
 * Rules for Adora Crisis Management:
 * CRITICAL: Infrastructure failure (AC, Water, Electricity, Safety).
 * MODERATE: Service failure (Staff, Food, Wait Time).
 */
export const analyzeFeedback = async (text: string): Promise<SentimentResult> => {
    if (!text || text.trim().length === 0) {
        return { sentiment: 'Neutral', severity: 'LOW', score: 0.5 };
    }

    const prompt = `
    Classify the following hotel guest feedback:
    Feedback: "${text}"

    Instructions:
    1. Sentiment: Positive, Neutral, or Negative.
    2. Severity Classification:
       - CRITICAL: Infrastructure failures (AC, Water, Electricity, Safety, Leaks).
       - MODERATE: Service issues (Staff behavior, Food quality, Wait times, Minibar).
       - LOW: Minor suggestions or positive feedback.
    3. Issue: Identify the specific category (Staff, Cleanliness, AC, Water, Electricity, Safety, Food, Wait Time, Other).
    4. Recovery: Suggest a brief recovery action (e.g., "Offer 15% discount", "Send free dessert", "Immediate Manager apology").
    5. Score: A confidence score from 0.0 to 1.0.

    Return ONLY a valid JSON object:
    {
        "sentiment": "...", 
        "severity": "...",
        "issue": "...", 
        "score": 0.0, 
        "summary": "brief summary",
        "suggestedRecovery": "..."
    }
    `;

    try {
        const responseText = await generateAIContent(prompt);

        // Clean up response
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanJson);

        return {
            sentiment: result.sentiment || 'Neutral',
            severity: result.severity || 'LOW',
            issue: result.issue,
            score: typeof result.score === 'number' ? result.score : 0.5,
            summary: result.summary,
            suggestedRecovery: result.suggestedRecovery
        };
    } catch (error) {
        logger.error('Sentiment Analysis Failed:', error, 'sentimentService');
        return { sentiment: 'Neutral', severity: 'LOW', score: 0.5 };
    }
};

export default {
    analyzeFeedback
};
