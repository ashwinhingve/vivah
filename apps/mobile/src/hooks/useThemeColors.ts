import { useColorScheme } from 'react-native';
import { palette, type ThemeColors } from '../theme/tokens';

/**
 * Resolves the active color palette from the OS color scheme.
 * Use for props that can't take a className (ActivityIndicator color,
 * placeholderTextColor, tab bar options, StatusBar). NativeWind classes
 * switch automatically via the CSS variables in global.css.
 */
export function useThemeColors(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? palette.dark : palette.light, isDark };
}
