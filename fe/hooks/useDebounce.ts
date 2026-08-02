import { useEffect, useState } from "react";

/**
 * hooks/useDebounce.ts
 *
 * Returns `value`, but only updates after `delay`ms of no further
 * changes — used to debounce real-time field validation (phone/email)
 * so errors don't flash on every keystroke while the user is still
 * mid-type. See lib/validators.ts for the validators this is paired
 * with.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
