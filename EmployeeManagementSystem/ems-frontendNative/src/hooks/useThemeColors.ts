// src/hooks/useThemeColors.ts
import { useTheme } from '../context/ThemeContext'

const dark = {
  // Backgrounds
  bgPrimary:   '#0f1117',
  bgSecondary: '#161b22',
  bgCard:      '#1a1f2e',
  bgTertiary:  '#21262d',

  // Text
  textPrimary:   '#e6edf3',
  textSecondary: '#8b949e',
  textMuted:     '#6e7681',

  // Brand / accent
  accent:      '#f97316',
  accentLight: '#f9731622',

  // Status
  success:      '#3fb950',
  successLight: '#3fb95022',
  danger:       '#f85149',
  dangerLight:  '#f8514922',
  warning:      '#d29922',
  warningLight: '#d2992222',
  info:         '#58a6ff',
  infoLight:    '#58a6ff22',

  // UI
  border:      '#30363d',
}

const light = {
  // Backgrounds
  bgPrimary:   '#f6f8fa',
  bgSecondary: '#ffffff',
  bgCard:      '#ffffff',
  bgTertiary:  '#eaeef2',

  // Text
  textPrimary:   '#1f2328',
  textSecondary: '#57606a',
  textMuted:     '#8c959f',

  // Brand / accent
  accent:      '#e8590c',
  accentLight: '#e8590c18',

  // Status
  success:      '#1a7f37',
  successLight: '#1a7f3718',
  danger:       '#cf222e',
  dangerLight:  '#cf222e18',
  warning:      '#9a6700',
  warningLight: '#9a670018',
  info:         '#0969da',
  infoLight:    '#0969da18',

  // UI
  border:      '#d0d7de',
}

export type AppColors = typeof dark

export function useThemeColors(): AppColors {
  const { isDark } = useTheme()
  return isDark ? dark : light
}
