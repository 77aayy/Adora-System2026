/**
 * Retry Utility
 * Retries failed async operations with exponential backoff
 */

export interface RetryOptions {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryAsync<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoffMultiplier = 2,
        onRetry
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxAttempts) {
                throw lastError;
            }

            // Call retry callback if provided
            if (onRetry) {
                onRetry(attempt, lastError);
            }

            // Calculate delay with exponential backoff
            const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);

            console.warn(
                `Retry attempt ${attempt}/${maxAttempts} after ${delay}ms:`,
                lastError.message
            );

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Retry a Firestore operation
 */
export async function retryFirestoreOperation<T>(
    operation: () => Promise<T>,
    operationName: string = 'Firestore operation'
): Promise<T> {
    return retryAsync(operation, {
        maxAttempts: 3,
        delayMs: 500,
        onRetry: (attempt, error) => {
            console.log(`Retrying ${operationName} (attempt ${attempt}):`, error.message);
        }
    });
}
