/**
 * Adora Features Index
 * Central export for all feature modules
 * 
 * Adora Hotel Management System V3
 */

// ============================================================
// GUEST FEATURES
// ============================================================

export { GuestChatWidget } from '../components/guest/GuestChatWidget';
export { VIPGuestTheme, VIPWelcomeBanner, VIPFloatingBadge, useVIPTheme } from '../components/guest/VIPGuestTheme';
export { QuickIssueReporter } from '../components/guest/QuickIssueReporter';
export { MicroFeedback } from '../components/guest/MicroFeedback';
export { OrderTimeline } from '../components/guest/OrderTimeline';

// ============================================================
// RECEPTION FEATURES
// ============================================================

export { ChatInbox } from '../components/reception/ChatInbox';
export { OperationsQuickView } from '../components/reception/OperationsQuickView';
export { BottleneckAlert } from '../components/reception/BottleneckAlert';
export { RoomBillCard } from '../components/reception/RoomBillCard';
export { PendingCoffeeOrders } from '../components/reception/PendingCoffeeOrders';

// ============================================================
// ADMIN FEATURES
// ============================================================

export { LiveChatMonitor } from '../components/admin/LiveChatMonitor';
export { ChatSettingsPage } from './admin/ChatSettingsPage';
export { GuestMessagingDashboard } from '../components/admin/GuestMessagingDashboard';
export { StaffLeaderboard } from '../components/admin/StaffLeaderboard';

// ============================================================
// SHARED FEATURES
// ============================================================

export { GuestRatingPrompt } from '../components/shared/GuestRatingPrompt';

// ============================================================
// SERVICES
// ============================================================

export * from '../services/smartChatService';
export * from '../services/guestLoyaltyService';
export * from '../services/coffeeShopFlowService';
export * from '../services/financialTrackingService';
export * from '../services/multiLanguageService';
export * from '../services/firebaseOptimizationService';
