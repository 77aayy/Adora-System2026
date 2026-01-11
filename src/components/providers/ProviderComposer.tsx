/**
 * Provider Composer
 * Cleanly composes multiple React Context Providers
 * 
 * Benefits:
 * - Reduces nesting depth in App.tsx
 * - Improves readability
 * - Better performance (fewer re-renders)
 * - Easier to add/remove providers
 * 
 * Adora Hotel Management System V3
 */

import React, { ComponentType, ReactNode } from 'react';

// ============================================================
// TYPES
// ============================================================

type ProviderConfig<T = any> = {
    Component: ComponentType<{ children: ReactNode } & T>;
    props?: T;
};

interface ProviderComposerProps {
    children: ReactNode;
    providers: ProviderConfig[];
}

// ============================================================
// PROVIDER COMPOSER COMPONENT
// ============================================================

/**
 * Composes multiple providers into a single component
 * 
 * Usage:
 * ```tsx
 * <ProviderComposer
 *   providers={[
 *     { Component: ThemeProvider },
 *     { Component: AuthProvider },
 *     { Component: I18nProvider, props: { locale: 'ar' } },
 *   ]}
 * >
 *   <App />
 * </ProviderComposer>
 * ```
 */
export const ProviderComposer: React.FC<ProviderComposerProps> = ({
    children,
    providers
}) => {
    return providers.reduceRight(
        (acc, { Component, props = {} }) => (
            <Component {...props}>{acc}</Component>
        ),
        children as ReactNode
    );
};

// ============================================================
// HELPER: CREATE PROVIDERS ARRAY
// ============================================================

/**
 * Helper function to create a type-safe providers array
 * Useful for conditional providers
 */
export const createProviders = (
    ...providers: (ProviderConfig | false | null | undefined)[]
): ProviderConfig[] => {
    return providers.filter((p): p is ProviderConfig => Boolean(p));
};

// ============================================================
// HIGHER-ORDER COMPONENT VERSION
// ============================================================

/**
 * HOC version for class components or when needed
 */
export const withProviders = <P extends object>(
    WrappedComponent: ComponentType<P>,
    providers: ProviderConfig[]
) => {
    return function WithProviders(props: P) {
        return (
            <ProviderComposer providers={providers}>
                <WrappedComponent {...props} />
            </ProviderComposer>
        );
    };
};

// ============================================================
// UTILITY: COMBINE PROVIDERS
// ============================================================

/**
 * Utility to combine provider arrays
 * Useful for feature-specific provider groups
 */
export const combineProviders = (
    ...providerGroups: ProviderConfig[][]
): ProviderConfig[] => {
    return providerGroups.flat();
};

// ============================================================
// PRE-CONFIGURED PROVIDER GROUPS
// ============================================================

// These can be customized per project needs

/**
 * Core providers that are always needed
 */
export const CORE_PROVIDERS: ProviderConfig[] = [
    // Will be populated dynamically
];

/**
 * Feature providers that can be conditionally loaded
 */
export const FEATURE_PROVIDERS: ProviderConfig[] = [
    // Will be populated dynamically
];

export default ProviderComposer;
