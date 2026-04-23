// src/theme/index.ts
// Central design token system supporting dynamic themes

export const BaseColors = {
  accent:       '#f97316',
  accentLight:  'rgba(249,115,22,0.15)',
  success:      '#22c55e',
  successLight: 'rgba(34,197,94,0.15)',
  danger:       '#ef4444',
  dangerLight:  'rgba(239,68,68,0.15)',
  warning:      '#f59e0b',
  warningLight: 'rgba(245,158,11,0.15)',
  info:         '#3b82f6',
  infoLight:    'rgba(59,130,246,0.15)',
}

export const DarkTheme = {
  ...BaseColors,
  bgPrimary:    '#0d0f14',
  bgCard:       '#13161e',
  bgSecondary:  '#181b24',
  bgTertiary:   '#1e2230',
  textPrimary:   '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted:     '#64748b',
  border:        '#1e2230',
  borderLight:   '#2d3347',
}

export const LightTheme = {
  ...BaseColors,
  bgPrimary:    '#f8fafc',
  bgCard:       '#ffffff',
  bgSecondary:  '#f1f5f9',
  bgTertiary:   '#e2e8f0',
  textPrimary:   '#0f172a',
  textSecondary: '#475569',
  textMuted:     '#64748b',
  border:        '#e2e8f0',
  borderLight:   '#cbd5e1',
}

// Default export (Dark) for backward compatibility while refactoring
export const Colors = DarkTheme

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const

export const Radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  full: 9999,
} as const

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
} as const

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
}
