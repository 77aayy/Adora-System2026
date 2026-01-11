/**
 * Responsive Optimization Utilities
 * Shared classes and helpers for mobile-first design
 * Supports: Mobile, Tablet, Desktop, TV (Full HD, 2K, 4K)
 */

export const responsiveClasses = {
  // Container padding
  // Mobile: p-3, Tablet: p-4, Desktop: p-6, TV: p-8 (max-width container)
  container: 'p-3 sm:p-4 lg:p-6 3xl:p-8 3xl:max-w-7xl 3xl:mx-auto',
  containerWithBottom: 'p-3 sm:p-4 lg:p-6 3xl:p-8 3xl:max-w-7xl 3xl:mx-auto pb-24 sm:pb-32',
  containerLarge: 'p-3 sm:p-4 lg:p-6 3xl:p-8 3xl:max-w-[1920px] 3xl:mx-auto',
  
  // Header
  // Mobile: text-xl, Tablet: text-2xl, Desktop: text-3xl, TV: text-4xl
  headerTitle: 'text-xl sm:text-2xl lg:text-3xl 3xl:text-4xl font-bold',
  headerSubtitle: 'text-sm sm:text-base lg:text-lg 3xl:text-xl',
  
  // Buttons
  // Mobile: w-9, Tablet: w-10, Desktop: w-12, TV: w-14
  iconButton: 'w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 3xl:w-14 3xl:h-14',
  iconButtonSmall: 'w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 3xl:w-12 3xl:h-12',
  buttonPadding: 'px-3 py-2 sm:px-4 sm:py-2.5 lg:px-6 lg:py-3 3xl:px-8 3xl:py-4',
  buttonText: 'text-sm sm:text-base lg:text-lg 3xl:text-xl',
  
  // Icons
  // Mobile: w-4, Tablet: w-5, Desktop: w-6, TV: w-8
  iconSmall: 'w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 3xl:w-8 3xl:h-8',
  iconMedium: 'w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 3xl:w-10 3xl:h-10',
  iconLarge: 'w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 3xl:w-12 3xl:h-12',
  
  // Cards
  // Mobile: p-3, Tablet: p-4, Desktop: p-6, TV: p-8
  cardPadding: 'p-3 sm:p-4 lg:p-6 3xl:p-8',
  cardGap: 'gap-2 sm:gap-3 lg:gap-4 3xl:gap-6',
  cardRounded: 'rounded-xl lg:rounded-2xl 3xl:rounded-3xl',
  
  // Text
  // Mobile: text-base, Tablet: text-lg, Desktop: text-xl, TV: text-2xl
  textLarge: 'text-xl sm:text-2xl lg:text-3xl 3xl:text-4xl',
  textMedium: 'text-base sm:text-lg lg:text-xl 3xl:text-2xl',
  textSmall: 'text-sm sm:text-base lg:text-lg 3xl:text-xl',
  textXSmall: 'text-xs sm:text-sm lg:text-base 3xl:text-lg',
  
  // Grids
  // Mobile: 1-2 cols, Tablet: 2-3 cols, Desktop: 3-4 cols, TV: 4-6 cols
  gridCols1: 'grid-cols-1',
  gridCols2: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5 5xl:grid-cols-6',
  gridCols3: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6',
  gridCols4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6',
  gridColsStats: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 3xl:grid-cols-6 4xl:grid-cols-8',
  
  // Gaps
  gridGap: 'gap-2 sm:gap-3 lg:gap-4 3xl:gap-6',
  gridGapSmall: 'gap-1.5 sm:gap-2 lg:gap-3 3xl:gap-4',
  gridGapLarge: 'gap-3 sm:gap-4 lg:gap-6 3xl:gap-8',
  
  // Touch
  touch: 'touch-manipulation active:scale-95 transition-transform',
  
  // Spacing
  mbSection: 'mb-4 sm:mb-6 lg:mb-8 3xl:mb-12',
  mbCard: 'mb-2 sm:mb-3 lg:mb-4 3xl:mb-6',
  mtSection: 'mt-4 sm:mt-6 lg:mt-8 3xl:mt-12',
  
  // Modal sizes
  // Mobile: full width, Tablet: max-w-md, Desktop: max-w-2xl, TV: max-w-4xl (centered)
  modalSmall: 'w-full sm:max-w-md lg:max-w-lg 3xl:max-w-xl 3xl:mx-auto',
  modalMedium: 'w-full sm:max-w-lg lg:max-w-2xl 3xl:max-w-3xl 3xl:mx-auto',
  modalLarge: 'w-full sm:max-w-2xl lg:max-w-4xl 3xl:max-w-6xl 3xl:mx-auto',
  modalXLarge: 'w-full sm:max-w-4xl lg:max-w-6xl 3xl:max-w-7xl 3xl:mx-auto',
  
  // Table responsive
  tableWrapper: 'overflow-x-auto -webkit-overflow-scrolling-touch',
  tableText: 'text-xs sm:text-sm lg:text-base 3xl:text-lg',
  tablePadding: 'px-2 py-1 sm:px-3 sm:py-2 lg:px-4 lg:py-3 3xl:px-6 3xl:py-4',
  
  // Max width containers for large screens
  maxWidthContainer: 'max-w-7xl 3xl:max-w-[1920px] 4xl:max-w-[2560px] 5xl:max-w-[3840px] mx-auto',
  maxWidthContent: 'max-w-6xl 3xl:max-w-7xl 4xl:max-w-[1920px] 5xl:max-w-[2560px] mx-auto',
};

// Backward compatibility
export const mobileClasses = responsiveClasses;
