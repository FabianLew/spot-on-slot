"use client";

import { CircleAlert } from "lucide-react";
import { useId, useState, type DragEvent } from "react";
import { cn } from "./cn";

export interface ImagePickerLabels {
  choose: string;
  drop: string;
  hint: string;
  uploading: string;
  previewAlt: string;
}

/**
 * Arcade-style photo picker: a framed drop zone with a button, a preview of the current image, an uploading
 * state and an error. It only hands over the file; checking and uploading are the caller's job.
 */
export function ImagePicker({
  labels,
  onSelect,
  previewUrl,
  uploading = false,
  error,
  accept = "image/jpeg,image/png,image/webp",
  className,
}: {
  labels: ImagePickerLabels;
  onSelect: (file: File) => void;
  previewUrl?: string;
  uploading?: boolean;
  error?: string;
  accept?: string;
  className?: string;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !uploading) onSelect(file);
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "pattern-grid flex flex-col items-center gap-4 border-2 border-dashed border-border bg-card p-6 text-center",
          dragging && "border-solid border-primary",
        )}
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt={labels.previewAlt}
            className={cn("max-h-64 w-auto border-2 border-border object-contain", uploading && "opacity-50")}
          />
        )}
        <input
          id={inputId}
          type="file"
          accept={accept}
          disabled={uploading}
          className="peer sr-only"
          aria-label={labels.choose}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so choosing the same file again still fires a change.
            event.target.value = "";
            if (file) onSelect(file);
          }}
        />
        <label
          htmlFor={inputId}
          aria-hidden="true"
          className={cn(
            "font-display inline-flex h-10 cursor-pointer items-center bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
            uploading && "pointer-events-none opacity-50",
          )}
        >
          {labels.choose}
        </label>
        <span className="text-sm">{labels.drop}</span>
        <span className="text-xs text-muted-foreground">{labels.hint}</span>
        {uploading && (
          <p role="status" className="font-display text-sm">
            {labels.uploading}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
