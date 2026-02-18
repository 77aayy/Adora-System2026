/**
 * Throttled navigate to prevent "Throttling navigation" from react-router.
 * Use for replace navigations in useEffects that may run in quick succession.
 */

import { useCallback, useRef } from 'react';
import { useNavigate, NavigateOptions } from 'react-router-dom';

const REPLACE_THROTTLE_MS = 400;

export function useThrottledNavigate() {
    const navigate = useNavigate();
    const lastReplaceAt = useRef(0);
    const lastReplaceTo = useRef<string | null>(null);

    const throttledNavigate = useCallback(
        (to: string, options?: NavigateOptions) => {
            const isReplace = options?.replace === true;
            if (!isReplace) {
                navigate(to, options);
                return;
            }
            const now = Date.now();
            if (now - lastReplaceAt.current < REPLACE_THROTTLE_MS && lastReplaceTo.current === to) {
                return;
            }
            lastReplaceAt.current = now;
            lastReplaceTo.current = to;
            navigate(to, options);
        },
        [navigate]
    );

    return throttledNavigate;
}
