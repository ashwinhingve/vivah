import { ReactNode } from 'react';
import { Text, View } from 'react-native';

/**
 * InfoNote — the bordered informational box pattern shared by the auth and
 * home screens. Variants tint the border + optional title.
 */
type InfoNoteVariant = 'info' | 'warning' | 'success';

interface InfoNoteProps {
  children: ReactNode;
  variant?: InfoNoteVariant;
  title?: string;
  className?: string;
  testID?: string;
}

const borderClass: Record<InfoNoteVariant, string> = {
  info: 'border-teal/40',
  warning: 'border-warning/40',
  success: 'border-success/40',
};

const titleClass: Record<InfoNoteVariant, string> = {
  info: 'text-teal',
  warning: 'text-warning',
  success: 'text-success',
};

export function InfoNote({
  children,
  variant = 'info',
  title,
  className = '',
  testID,
}: InfoNoteProps) {
  return (
    <View
      testID={testID}
      className={`bg-surface border rounded-lg p-4 ${borderClass[variant]} ${className}`}
    >
      {title ? (
        <Text className={`text-sm font-semibold mb-1 ${titleClass[variant]}`}>
          {title}
        </Text>
      ) : null}
      <Text className="text-gold-muted text-xs leading-5">{children}</Text>
    </View>
  );
}
