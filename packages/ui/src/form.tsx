"use client";

import { CircleAlert } from "lucide-react";
import { Slot } from "radix-ui";
import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  type FormProviderProps,
} from "react-hook-form";
import { cn } from "./cn";
import { Label } from "./label";

type TranslateError = (message: string) => string;

const identity: TranslateError = (message) => message;
const TranslateErrorContext = createContext<TranslateError>(identity);

type FormProps<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformed = TFieldValues,
> = FormProviderProps<TFieldValues, TContext, TTransformed> & {
  translateError?: TranslateError;
};

// react-hook-form's FormProvider takes the form methods as props; they are
// forwarded untouched, only translateError is peeled off into context.
function Form<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformed = TFieldValues,
>({
  translateError = identity,
  children,
  ...methods
}: FormProps<TFieldValues, TContext, TTransformed>) {
  return (
    <TranslateErrorContext.Provider value={translateError}>
      <FormProvider {...methods}>{children}</FormProvider>
    </TranslateErrorContext.Provider>
  );
}

type FormFieldContextValue = { name: string };
const FormFieldContext = createContext<FormFieldContextValue | null>(null);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

const FormItemContext = createContext<{ id: string } | null>(null);

function useFormField() {
  const field = useContext(FormFieldContext);
  const item = useContext(FormItemContext);
  const { getFieldState, control } = useFormContext();
  const formState = useFormState({ control, name: field?.name });
  if (!field || !item) {
    throw new Error("useFormField must be used within <FormField> and <FormItem>");
  }
  const fieldState = getFieldState(field.name, formState);
  const { id } = item;
  return {
    id,
    name: field.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

function FormItem({ className, ...props }: ComponentProps<"div">) {
  const id = useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({ className, ...props }: ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();
  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-danger", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl(props: ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-invalid={!!error}
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function ErrorText({ children, className, ...props }: ComponentProps<"p"> & { children: ReactNode }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-sm text-danger", className)} {...props}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function FormMessage({ className, children, ...props }: ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const translate = useContext(TranslateErrorContext);
  const raw = error?.message;
  const body = raw ? translate(String(raw)) : children;
  if (!body) return null;
  return (
    <ErrorText data-slot="form-message" id={formMessageId} className={className} {...props}>
      {body}
    </ErrorText>
  );
}

function FormRootError({ className, ...props }: ComponentProps<"p">) {
  const { formState } = useFormContext();
  const translate = useContext(TranslateErrorContext);
  const raw = formState.errors.root?.server?.message ?? formState.errors.root?.message;
  if (!raw) return null;
  return (
    <ErrorText data-slot="form-root-error" role="alert" className={className} {...props}>
      {translate(String(raw))}
    </ErrorText>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  useFormField,
};
