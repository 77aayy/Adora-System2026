// Utility Functions
export * from './pointsCalculator';
export * from './soundService';
export * from './auditService';
export * from './errorHandler';
export * from './connectivityMonitor';
export * from './inputValidator';
export * from './roomHistory';
export * from './minibarRestocking';
export * from './smartSearch';
export * from './rewardsSystem';
export { getPointsConfig, updatePointsConfig, getPointsFor, clearPointsCache, DEFAULT_POINTS } from './pointsSettings';

// New utilities - explicit exports to avoid conflicts
export { getDateRange, isDateInRange, formatDateForDisplay, getPeriodLabel, useHistoryFilter, BELLMAN_ACTIONS, HOUSEKEEPING_ACTIONS, RECEPTION_ACTIONS } from './historyFilter';
export { addPointWithDetails, subscribeToPointsHistory, getReasonText, getPointsIcon, formatPoints } from './pointsTracker';
export { QUICK_ITEMS, getQuickItemsForDepartment, detectCurrentDepartment, getDeptNameAr, useProcurementCart } from './procurementCart';
export { calculateStats, getStatusLabelAr, getStatusClass, getServiceTypeLabelAr, generatePrintableReport, printReport, exportReportAsCSV } from './reportsEnhanced';
export { haptic, playSound, playRequestSound, fadeIn, shake, shakeElement, bounceSuccess, createRipple, setButtonLoading, getSpecificMessage } from './uxEffects';
export { generate8PMReport, generateShiftReport, generateRoomReport, sendReportViaWhatsApp, sendAutoReport8PM, scheduleAutoReport, cancelScheduledReport, getWhatsAppTemplate, saveWhatsAppTemplates, applyTemplate, getReportStats } from './autoReports';
