/**
 * Dashboard Components Export
 * Barrel file for dashboard widgets
 * Adora Hotel Management System V2
 */

export { AnimatedChart } from './AnimatedChart';
export type { default as AnimatedChartProps } from './AnimatedChart';

export { Leaderboard } from './Leaderboard';
export type { LeaderboardEntry } from './Leaderboard';

export { ActivityFeed } from './ActivityFeed';
export type { ActivityItem } from './ActivityFeed';

export { ExportManager } from './ExportManager';
export type { ExportData } from './ExportManager';

// Department Widgets
export {
    DepartmentStats,
    QuickActionsBar,
    TaskProgress,
    FilterTabs
} from './DepartmentWidgets';
export type { DeptStatItem, QuickAction, FilterTab } from './DepartmentWidgets';
