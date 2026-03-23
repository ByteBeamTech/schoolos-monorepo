// Design tokens — single source of truth for all visual decisions
// All components import from here — never hardcode colors or spacing

export const tokens = {
  colors: {
    primary:   '#1a56db',
    secondary: '#6b7280',
    success:   '#057a55',
    warning:   '#c27803',
    danger:    '#c81e1e',
    info:      '#1c64f2',
    // Fee status colors
    paid:      '#057a55',
    overdue:   '#c81e1e',
    partial:   '#c27803',
    pending:   '#6b7280',
    // Attendance status colors
    present:   '#057a55',
    absent:    '#c81e1e',
    late:      '#c27803',
    holiday:   '#6b7280',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  fontSize: {
    xs:   '12px',
    sm:   '14px',
    base: '16px',
    lg:   '18px',
    xl:   '20px',
    '2xl':'24px',
    '3xl':'30px',
  },
} as const;

export type ColorToken     = keyof typeof tokens.colors;
export type SpacingToken   = keyof typeof tokens.spacing;
export type FontSizeToken  = keyof typeof tokens.fontSize;
