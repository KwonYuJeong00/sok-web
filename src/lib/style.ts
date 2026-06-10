import type { CSSProperties } from 'react';

/** Lets inline styles carry CSS custom properties (--var) without type noise. */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as unknown as CSSProperties;
}
