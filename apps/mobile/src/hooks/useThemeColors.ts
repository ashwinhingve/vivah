import { palette, type ThemeColors } from '../theme/tokens';

/**
 * Returns the brand color palette for props that can't take a className
 * (ActivityIndicator color, placeholderTextColor, tab bar options, StatusBar).
 *
 * Locked to the light (warm ivory) palette: the website ships light-only and
 * the brand has no dark counterpart, so the app never follows the OS scheme.
 * The hook shape (`{ colors, isDark }`) is kept so call sites don't churn and
 * a future dark theme can slot back in here.
 */
export function useThemeColors(): { colors: ThemeColors; isDark: false } {
  return { colors: palette.light, isDark: false };
}
