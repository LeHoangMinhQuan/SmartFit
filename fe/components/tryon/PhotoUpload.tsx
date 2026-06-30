"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface PhotoUploadProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function PhotoUpload({ onFile, disabled }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File | null | undefined) {
    setError("");
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPEG, PNG, or WEBP images are accepted.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File must be under 10 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }

  function handleReset() {
    setPreview(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        className={clsx(
          "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition",
          dragging
            ? "border-black bg-gray-50"
            : "border-gray-300 hover:border-gray-500",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {preview ? (
          <img
            src={preview}
            alt="Your photo"
            className="max-h-64 rounded-lg object-contain"
          />
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Drop your photo here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-400">
              JPEG · PNG · WEBP — max 10 MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={disabled}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      {preview && (
        <button
          onClick={handleReset}
          disabled={disabled}
          className="self-start text-xs text-gray-400 hover:underline disabled:opacity-40"
        >
          Remove photo
        </button>
      )}
    </div>
  );
}
