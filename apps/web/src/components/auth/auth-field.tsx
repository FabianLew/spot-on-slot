"use client";

import type { ComponentProps } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Input } from "@spot-on-slot/ui";

/** Labelled text input bound to a form field, with its hint and error. */
export function AuthField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  ...input
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Pick<ComponentProps<"input">, "type" | "autoComplete" | "autoFocus" | "inputMode">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...input} {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
