/**
 * Shared Components Index
 * Barrel file for shared components
 * Adora Hotel Management System V2
 */

// UI Components
export { default as VoiceInputButton } from './VoiceInputButton';
export { default as SmartSearch } from './SmartSearch';
export { default as RoomHistoryModal } from './RoomHistoryModal';
export { default as DailyTipsWidget } from './DailyTipsWidget';
export { default as LanguageSwitcher } from './LanguageSwitcher';
export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard } from './Skeleton';
export * from './SmartInsight';
export * from './RoomSelector';
export { ConfettiTrigger, useConfetti, fireConfetti } from './Confetti';

// Log Viewers
export { UnifiedHistoryModal } from './UnifiedHistoryModal';
export { AdvancedLogViewer } from './AdvancedLogViewer';
export { ProcurementLogViewer } from './ProcurementLogViewer';

// Points Progress
export { DepartmentPointsProgress, PointsProgressCard } from './DepartmentPointsProgress';

// Developer Signature
export { DeveloperSignature } from './DeveloperSignature';

// Department Navigation
export { DepartmentTabs, useAllowedDepartments } from './DepartmentTabs';