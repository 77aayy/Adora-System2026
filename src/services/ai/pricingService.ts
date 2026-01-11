/**
 * Smart Pricing Engine (Revenue AI)
 * Phase 7: Revenue & Experience Optimization
 */

import { generateAIContent } from './geminiService';

export interface PricingRecommendation {
    suggestedPrice: number;
    percentageChange: number;
    reasoning: string;
    strategy: 'PREMIUM' | 'FLASH_DEAL' | 'STANDARD';
}

export interface PricingInput {
    occupancyRate: number; // 0-100
    maintenanceLoad: number; // count of rooms in maintenance
    basePrice: number;
    competitorInsight?: string;
}

/**
 * 💹 Generates dynamic pricing recommendations using Gemini 1.5 Flash
 */
export const getPricingRecommendation = async (data: PricingInput): Promise<PricingRecommendation> => {
    const { occupancyRate, maintenanceLoad, basePrice, competitorInsight } = data;

    const prompt = `
    Act as Adora (the Senior Revenue Manager Assistant) for a high-end hotel system.
    Analyze the following data to recommend a dynamic room rate:
    - Occupancy: ${occupancyRate}%
    - Maintenance Load: ${maintenanceLoad} rooms unavailable (broken)
    - Base Price: ${basePrice} SAR
    ${competitorInsight ? `- Competitor Insight: ${competitorInsight}` : ''}

    Rules:
    1. If occupancy > 80%, increase price (PREMIUM strategy).
    2. If maintenance load is high (>15% total capacity), increase price due to limited supply.
    3. If occupancy < 30%, suggest a Flash Deal discount (FLASH_DEAL strategy).
    4. Safety Guard: Suggested price must NOT drop more than 20% below basePrice (${basePrice * 0.8} min).
    5. Reasoning must be in Arabic (brief and professional).

    Return ONLY a valid JSON object:
    {
        "suggestedPrice": number,
        "percentageChange": number,
        "reasoning": "Arabic brief",
        "strategy": "PREMIUM | FLASH_DEAL | STANDARD"
    }
    `;

    try {
        const responseText = await generateAIContent(prompt);

        // Clean up response in case Gemini adds markdown backticks
        const cleanJson = responseText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanJson);

        // Apply Hard Safety Rule: Max 20% Discount
        const minPrice = basePrice * 0.8;
        let finalPrice = result.suggestedPrice;
        let finalPercent = result.percentageChange;

        if (finalPrice < minPrice) {
            finalPrice = minPrice;
            finalPercent = -20;
        }

        return {
            suggestedPrice: Math.round(finalPrice),
            percentageChange: finalPercent,
            reasoning: result.reasoning || 'تم احتساب السعر بناءً على خوارزميات العرض والطلب',
            strategy: result.strategy || 'STANDARD'
        };
    } catch (error) {
        console.error('Pricing AI Failed:', error);
        // Fallback to base price
        return {
            suggestedPrice: basePrice,
            percentageChange: 0,
            reasoning: 'عذراً، تعذر الاتصال بمحرك الذكاء الاصطناعي. تم استخدام السعر الأساسي.',
            strategy: 'STANDARD'
        };
    }
};

export default {
    getPricingRecommendation
};
