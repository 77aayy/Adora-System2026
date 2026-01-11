/**
 * Onboarding Tour Hook
 * Manages tour state for each department
 * Adora Hotel Management System V2
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    hasCompletedTour, 
    markTourCompleted, 
    DepartmentTour 
} from '../services/onboardingService';
import { TourStep } from '../components/shared/TourGuide';

// ============================================================
// TOUR STEPS FOR EACH DEPARTMENT
// ============================================================

export const TOUR_STEPS: Record<DepartmentTour, TourStep[]> = {
    reception: [
        {
            target: '.stat-card-pro-compact',
            title: '📊 إحصائيات سريعة',
            description: 'هنا تجد ملخص سريع لعدد الطلبات الجديدة، قيد التنفيذ، والمكتملة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="quick-actions"]',
            title: '⚡ إنشاء طلب سريع',
            description: 'اضغط على أي زر لإنشاء طلب جديد بسرعة (تنظيف، صيانة، بيلمان، مشروبات)',
            placement: 'bottom'
        },
        {
            target: '[data-tour="search-box"]',
            title: '🔍 البحث السريع',
            description: 'ابحث عن الطلبات برقم الغرفة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="tabs"]',
            title: '📋 تصفية الطلبات',
            description: 'اختر بين عرض الطلبات الجديدة، قيد التنفيذ، أو المكتملة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="header-buttons"]',
            title: '🛠️ أدوات إضافية',
            description: 'من هنا يمكنك الوصول لسجل العمليات، ملاحظات الغرف، المشتريات، والمفقودات',
            placement: 'bottom'
        }
    ],

    housekeeping: [
        {
            target: '.stat-card-pro-compact',
            title: '📊 إحصائيات التنظيف',
            description: 'ملخص سريع: غرف جاهزة للبدء، قيد التنظيف، ومكتملة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="room-filter"]',
            title: '🏠 فلترة الغرف',
            description: 'اختر نوع الغرف: مشغولة، فارغة، أو جميعها',
            placement: 'bottom'
        },
        {
            target: '[data-tour="floor-filter"]',
            title: '🏢 فلترة بالطابق',
            description: 'اختر طابق معين لعرض غرفه فقط',
            placement: 'bottom'
        },
        {
            target: '[data-tour="task-list"]',
            title: '📝 قائمة المهام',
            description: 'اسحب على أي مهمة يميناً لبدئها، أو يساراً لإكمالها',
            placement: 'top'
        },
        {
            target: '[data-tour="header-buttons"]',
            title: '🛠️ أدوات إضافية',
            description: 'الوصول للفريق، المغسلة، المشتريات، وسجل العمليات',
            placement: 'bottom'
        }
    ],

    bellman: [
        {
            target: '.stat-card-pro-compact',
            title: '📊 إحصائيات البيلمان',
            description: 'عدد الغرف المشغولة، الطلبات النشطة، والأمتعة المعلقة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="checkin-button"]',
            title: '🚪 تسجيل دخول',
            description: 'اضغط هنا لتسجيل دخول نزيل جديد',
            placement: 'bottom'
        },
        {
            target: '[data-tour="requests-tab"]',
            title: '🔔 الطلبات',
            description: 'عرض جميع طلبات البيلمان النشطة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="luggage-tab"]',
            title: '🧳 الأمتعة',
            description: 'تتبع حالة الأمتعة وموقعها',
            placement: 'bottom'
        },
        {
            target: '[data-tour="header-buttons"]',
            title: '🛠️ أدوات إضافية',
            description: 'سجل العمليات، الفريق، والمشتريات',
            placement: 'bottom'
        }
    ],

    maintenance: [
        {
            target: '.stat-card-pro-compact',
            title: '📊 إحصائيات الصيانة',
            description: 'طلبات قيد التنفيذ، بانتظار البدء، ومكتملة اليوم',
            placement: 'bottom'
        },
        {
            target: '[data-tour="active-tab"]',
            title: '🔧 الطلبات النشطة',
            description: 'جميع طلبات الصيانة التي تحتاج متابعة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="completed-tab"]',
            title: '✅ المكتملة',
            description: 'سجل الطلبات المكتملة مع صور قبل وبعد',
            placement: 'bottom'
        },
        {
            target: '[data-tour="header-buttons"]',
            title: '🛠️ أدوات إضافية',
            description: 'المشتريات، سجل العمليات، والفريق',
            placement: 'bottom'
        }
    ],

    procurement: [
        {
            target: '.stat-card-pro-compact',
            title: '📊 إحصائيات المشتريات',
            description: 'طلبات بانتظار الموافقة، معتمدة، وقيد الشراء',
            placement: 'bottom'
        },
        {
            target: '[data-tour="pending-tab"]',
            title: '⏳ بانتظار الموافقة',
            description: 'طلبات تحتاج موافقة المدير',
            placement: 'bottom'
        },
        {
            target: '[data-tour="approved-tab"]',
            title: '✅ المعتمدة',
            description: 'طلبات تم تعميدها وجاهزة للشراء',
            placement: 'bottom'
        },
        {
            target: '[data-tour="request-card"]',
            title: '📦 بطاقة الطلب',
            description: 'تفاصيل كل طلب مع الإجراءات المتاحة',
            placement: 'top'
        }
    ],

    coffeeshop: [
        {
            target: '.stat-card-pro-compact',
            title: '📊 إحصائيات الكافي',
            description: 'طلبات بانتظار التحضير، جاهزة للتوصيل، ومكتملة',
            placement: 'bottom'
        },
        {
            target: '[data-tour="pending-orders"]',
            title: '☕ طلبات جديدة',
            description: 'الطلبات الواردة من الغرف والاستقبال',
            placement: 'bottom'
        },
        {
            target: '[data-tour="in-progress-orders"]',
            title: '🔥 قيد التحضير',
            description: 'الطلبات التي يتم تحضيرها حالياً',
            placement: 'bottom'
        },
        {
            target: '[data-tour="order-card"]',
            title: '📋 بطاقة الطلب',
            description: 'اضغط لعرض التفاصيل وتحديث الحالة',
            placement: 'top'
        }
    ],

    admin: [
        {
            target: '[data-tour="overview-stats"]',
            title: '📊 لوحة التحكم',
            description: 'نظرة عامة على أداء الفرع وإحصائيات الموظفين',
            placement: 'bottom'
        },
        {
            target: '[data-tour="sidebar"]',
            title: '📋 القائمة الجانبية',
            description: 'الوصول السريع لجميع أقسام الإدارة',
            placement: 'right'
        },
        {
            target: '[data-tour="employees"]',
            title: '👥 إدارة الموظفين',
            description: 'إضافة وتعديل وإدارة الموظفين',
            placement: 'bottom'
        },
        {
            target: '[data-tour="rooms"]',
            title: '🏨 إدارة الغرف',
            description: 'إعداد الغرف والطوابق',
            placement: 'bottom'
        },
        {
            target: '[data-tour="settings"]',
            title: '⚙️ الإعدادات',
            description: 'إعدادات النظام والتكاملات',
            placement: 'bottom'
        }
    ]
};

// ============================================================
// HOOK
// ============================================================

interface UseOnboardingTourResult {
    showTour: boolean;
    steps: TourStep[];
    startTour: () => void;
    closeTour: () => void;
    completeTour: () => void;
    isLoading: boolean;
}

export const useOnboardingTour = (department: DepartmentTour): UseOnboardingTourResult => {
    const { user } = useAuth();
    const [showTour, setShowTour] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasChecked, setHasChecked] = useState(false);

    // Get steps for this department
    const steps = TOUR_STEPS[department] || [];

    // Check if user has already completed the tour
    useEffect(() => {
        const checkTourStatus = async () => {
            if (!user?.id || hasChecked) return;

            setIsLoading(true);
            try {
                const completed = await hasCompletedTour(user.id, department);
                
                if (!completed) {
                    // Show tour after a short delay for better UX
                    setTimeout(() => {
                        setShowTour(true);
                    }, 1500);
                }
            } catch (error) {
                console.error('Error checking tour status:', error);
            } finally {
                setIsLoading(false);
                setHasChecked(true);
            }
        };

        checkTourStatus();
    }, [user?.id, department, hasChecked]);

    // Start tour manually
    const startTour = useCallback(() => {
        setShowTour(true);
    }, []);

    // Close tour without marking complete
    const closeTour = useCallback(() => {
        setShowTour(false);
    }, []);

    // Complete tour and mark in Firestore
    const completeTour = useCallback(async () => {
        setShowTour(false);
        
        if (user?.id) {
            try {
                await markTourCompleted(user.id, department);
            } catch (error) {
                console.error('Error marking tour completed:', error);
            }
        }
    }, [user?.id, department]);

    return {
        showTour,
        steps,
        startTour,
        closeTour,
        completeTour,
        isLoading
    };
};

export default useOnboardingTour;
