/**
 * useLoadingState Hook - Loading State Management for Async Operations
 * Adora Hotel Management System
 * 
 * FEATURES:
 * - Prevents double-clicks during async operations
 * - Automatic error handling with user-friendly messages
 * - Configurable success/error callbacks
 * - Loading spinner integration
 */

import { useState, useCallback } from 'react';
import { useUX } from '../context/UXContext';
import { getErrorMessage } from '../utils/errorHandler';

export interface LoadingStateOptions {
  successMessage?: string;
  errorMessage?: string;
  operation?: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  execute: <T>(
    asyncFn: () => Promise<T>,
    options?: LoadingStateOptions
  ) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for managing loading state of async operations
 * 
 * @example
 * ```tsx
 * const { isLoading, execute } = useLoadingState();
 * 
 * const handleSubmit = () => {
 *   execute(
 *     () => submitForm(data),
 *     {
 *       successMessage: 'تم الحفظ بنجاح',
 *       operation: 'save-form'
 *     }
 *   );
 * };
 * 
 * <button disabled={isLoading} onClick={handleSubmit}>
 *   {isLoading ? 'جاري الحفظ...' : 'حفظ'}
 * </button>
 * ```
 */
export function useLoadingState(): LoadingState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: errorToast } = useUX();

  const execute = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      options: LoadingStateOptions = {}
    ): Promise<T | null> => {
      const {
        successMessage,
        errorMessage,
        operation = 'operation',
        onSuccess,
        onError,
        showSuccessToast = true,
        showErrorToast = true,
      } = options;

      // Prevent double-click
      if (isLoading) {
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await asyncFn();

        // Success callback
        if (onSuccess) {
          onSuccess();
        }

        // Show success toast
        if (showSuccessToast && successMessage) {
          success(successMessage);
        }

        setIsLoading(false);
        return result;
      } catch (err: any) {
        // Get user-friendly error message
        const userErrorMessage = errorMessage || getErrorMessage(err, operation);

        setError(userErrorMessage);

        // Show error toast
        if (showErrorToast) {
          errorToast(userErrorMessage);
        }

        // Error callback
        if (onError) {
          onError(err);
        }

        setIsLoading(false);
        return null;
      }
    },
    [isLoading, success, errorToast]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    execute,
    reset,
  };
}

/**
 * Hook for managing multiple loading states (e.g., form with multiple submit buttons)
 */
export function useMultipleLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const { success, error: errorToast } = useUX();

  const isLoading = useCallback(
    (key: string) => loadingStates[key] || false,
    [loadingStates]
  );

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  }, []);

  const execute = useCallback(
    async <T,>(
      key: string,
      asyncFn: () => Promise<T>,
      options: LoadingStateOptions = {}
    ): Promise<T | null> => {
      const {
        successMessage,
        errorMessage,
        operation = 'operation',
        onSuccess,
        onError,
        showSuccessToast = true,
        showErrorToast = true,
      } = options;

      // Prevent double-click
      if (loadingStates[key]) {
        return null;
      }

      setLoading(key, true);

      try {
        const result = await asyncFn();

        if (onSuccess) {
          onSuccess();
        }

        if (showSuccessToast && successMessage) {
          success(successMessage);
        }

        setLoading(key, false);
        return result;
      } catch (err: any) {
        const userErrorMessage = errorMessage || getErrorMessage(err, operation);

        if (showErrorToast) {
          errorToast(userErrorMessage);
        }

        if (onError) {
          onError(err);
        }

        setLoading(key, false);
        return null;
      }
    },
    [loadingStates, setLoading, success, errorToast]
  );

  return {
    isLoading,
    execute,
    reset: (key: string) => setLoading(key, false),
  };
}
