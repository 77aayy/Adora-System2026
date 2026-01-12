/**
 * Dynamic Greetings System
 * Adora Hotel Management System
 * 
 * يوفر تحيات ديناميكية حسب الوقت مع رسائل تحفيزية متنوعة
 */

// التحيات حسب الوقت
type TimeGreeting = {
    emoji: string;
    greeting: string;
};

// الرسائل التحفيزية
const motivationalMessages: string[] = [
    'يوم موفق',
    'يوم سعيد',
    'يوم مليء بالإنجازات',
    'بداية رائعة ليومك',
    'نتمنى لك التوفيق',
    'استمتع بيومك',
    'يوم مثمر',
    'نحن سعداء بوجودك',
    'أهلاً بعودتك',
    'وقت العمل الجاد',
    'استعد للإنجاز',
    'يوم جديد فرص جديدة',
];

// تحيات المساء المتنوعة
const eveningMessages: string[] = [
    'مساءً هادئاً',
    'ليلة سعيدة',
    'مساء الورد',
    'مساء مليء بالسلام',
    'نهاية يوم موفقة',
    'استراحة مستحقة قريباً',
];

/**
 * الحصول على التحية حسب الوقت الحالي
 */
export const getTimeGreeting = (): TimeGreeting => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return { emoji: '☀️', greeting: 'صباح الخير' };
    } else if (hour >= 12 && hour < 17) {
        return { emoji: '🌤️', greeting: 'مساء الخير' };
    } else if (hour >= 17 && hour < 21) {
        return { emoji: '🌅', greeting: 'مساء الخير' };
    } else {
        return { emoji: '🌙', greeting: 'مساء الخير' };
    }
};

/**
 * الحصول على رسالة تحفيزية عشوائية
 */
export const getMotivationalMessage = (): string => {
    const hour = new Date().getHours();
    
    // في المساء المتأخر استخدم رسائل المساء
    if (hour >= 20 || hour < 5) {
        return eveningMessages[Math.floor(Math.random() * eveningMessages.length)];
    }
    
    return motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
};

/**
 * الحصول على التحية الكاملة مع الاسم
 * مثال: "☀️ صباح الخير، يوم موفق يا محمد"
 */
export const getFullGreeting = (name: string): string => {
    const { emoji, greeting } = getTimeGreeting();
    const motivational = getMotivationalMessage();
    
    return `${emoji} ${greeting}، ${motivational} يا ${name}`;
};

/**
 * الحصول على التحية بدون اسم
 * مثال: "☀️ صباح الخير، يوم موفق"
 */
export const getGreetingWithoutName = (): string => {
    const { emoji, greeting } = getTimeGreeting();
    const motivational = getMotivationalMessage();
    
    return `${emoji} ${greeting}، ${motivational}`;
};

/**
 * الحصول على أجزاء التحية منفصلة للعرض المرن
 */
export interface GreetingParts {
    emoji: string;
    timeGreeting: string;
    motivational: string;
    fullText: string;
}

export const getGreetingParts = (name?: string): GreetingParts => {
    const { emoji, greeting: timeGreeting } = getTimeGreeting();
    const motivational = getMotivationalMessage();
    
    const fullText = name 
        ? `${emoji} ${timeGreeting}، ${motivational} يا ${name}`
        : `${emoji} ${timeGreeting}، ${motivational}`;
    
    return {
        emoji,
        timeGreeting,
        motivational,
        fullText
    };
};

/**
 * Hook-ready function that returns greeting data
 * Can be used with useState to update periodically
 */
export const createGreetingData = (userName: string, brandName?: string) => {
    const parts = getGreetingParts(userName);
    
    return {
        ...parts,
        userName,
        brandName: brandName || '',
        displayGreeting: `${parts.emoji} ${parts.timeGreeting}، ${parts.motivational} يا ${userName}`,
        brandDisplay: brandName ? `🏨 ${brandName}` : '',
    };
};
