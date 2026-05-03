'use client';

import { type ReactNode } from 'react';
import {
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type UseControllerProps,
} from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField as RHFFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface FormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>
  extends UseControllerProps<TFieldValues, TName> {
  label: string;
  description?: string;
  required?: boolean;
  /** Render-prop receives field props from react-hook-form Controller. */
  children: (field: ControllerRenderProps<TFieldValues, TName>) => ReactNode;
}

/**
 * FormField — opinionated wrapper around react-hook-form Controller +
 * shadcn Form/Label/Control/Message. Renders inline error message with
 * aria-describedby wired automatically. Use inside a `<Form {...rhf}>`
 * provider.
 */
export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ label, description, required, children, ...controller }: FormFieldProps<TFieldValues, TName>) {
  return (
    <RHFFormField
      {...controller}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {required ? <span className="text-destructive"> *</span> : null}
          </FormLabel>
          <FormControl>{children(field)}</FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export { Form };
