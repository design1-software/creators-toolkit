"use client";
// 📘 WHAT THIS FILE DOES: A drag-and-drop file upload component.
// Users can either drag a video file onto this area or click to browse.
// When a file is selected it calls the 'onFile' callback with the chosen File.
// 🔗 HTML file input: https://www.w3schools.com/tags/att_input_type_file.asp

import { useState, useRef, DragEvent, ChangeEvent } from "react";

// 📘 Props this component accepts from its parent.
type FileUploadProps = {
  onFile: (file: File) => void;  // called when the user picks a valid video file
  disabled?: boolean;             // when true, the upload area is greyed out
};

// 📘 This component renders a drag-and-drop zone that handles both dragging
// and clicking to select a file. It's a "controlled" component — the parent
// decides what to do with the file via the onFile callback.
export default function FileUpload({ onFile, disabled }: FileUploadProps) {
  // 📘 'isDragging' tracks whether the user is currently hovering with a file.
  // We use it to change the border color as a visual cue.
  const [isDragging, setIsDragging] = useState(false);

  // 📘 useRef gives us a reference to the hidden <input type="file"> element.
  // We trigger it programmatically when the user clicks the visible drop zone.
  const inputRef = useRef<HTMLInputElement>(null);

  // 📘 This function validates the file and calls onFile if it's a video.
  function handleFile(file: File) {
    // 📘 MIME types like "video/mp4" describe file formats.
    // We reject non-video files with a browser alert.
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file (MP4, MOV, etc.)");
      return;
    }
    onFile(file); // pass the valid file up to the parent page
  }

  // 📘 Drag event handlers — these fire as the user drags a file over the drop zone.
  // DragEvent is the TypeScript type for drag-and-drop browser events.
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); // required to allow dropping — stops browser default behavior
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    // 📘 e.dataTransfer.files is a FileList — an array-like object of dropped files.
    // We only handle the first file (index 0).
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // 📘 Called when the user picks a file via the file browser dialog.
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; // '?.' safely accesses files (might be null)
    if (file) handleFile(file);
  }

  return (
    <div
      // 📘 onClick opens the hidden file input when the drop zone is clicked.
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragging ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius: "16px",
        padding: "48px 32px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "border-color 0.2s, background-color 0.2s",
        backgroundColor: isDragging ? "rgba(124,58,237,0.05)" : "transparent",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {/* Drop zone icon */}
      <div className="text-5xl mb-4">🎬</div>

      {/* 📘 Primary instruction text */}
      <p className="font-semibold text-base mb-2" style={{ color: "var(--color-text)" }}>
        Drag & drop your video here
      </p>
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        or click to browse — MP4, MOV, WebM supported
      </p>

      {/* 📘 The actual <input type="file"> is hidden — we use the styled div above
          as the visible interface. 'accept' restricts the browser's file picker to videos. */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"       // only show video files in the file browser
        onChange={handleChange}
        style={{ display: "none" }} // hide the default ugly file input
        disabled={disabled}
      />
    </div>
  );
}
