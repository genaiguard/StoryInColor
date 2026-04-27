"use client";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadDropProps {
  onFile: (file: File) => void;
  inputHint: string;
  disabled?: boolean;
  file?: File | null;
}

export function UploadDrop({ onFile, inputHint, disabled, file }: UploadDropProps) {
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    multiple: false,
    maxSize: MAX_BYTES,
    disabled,
    onDrop: (accepted, rejected) => {
      setError(null);
      if (rejected.length > 0) {
        const r = rejected[0].errors[0];
        setError(
          r.code === "file-too-large"
            ? "File is larger than 10MB."
            : r.code === "file-invalid-type"
            ? "Only PNG, JPG, or WEBP are allowed."
            : r.message
        );
        return;
      }
      if (accepted[0]) onFile(accepted[0]);
    },
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-colors ${
          isDragActive
            ? "border-orange-500 bg-orange-50"
            : "border-gray-300 bg-white hover:bg-gray-50"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input {...getInputProps()} />
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected upload"
              className="max-h-48 rounded-xl object-cover shadow-sm"
            />
            <span className="text-sm text-gray-600">
              Click to choose a different photo
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-base font-medium text-gray-800">
              {isDragActive ? "Drop the photo" : "Drag & drop your photo here"}
            </p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500">{inputHint}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
