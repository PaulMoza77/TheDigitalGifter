import React, { useState, useRef, useEffect } from "react";

type UploadCardProps = {
  onFileSelected: (file: File) => void;
};

export default function UploadCard({ onFileSelected }: UploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  }

  return (
    <div
      className={`border-4 rounded-xl p-12 cursor-pointer transition-colors duration-300 ${
        dragOver ? "border-[#f45c5c]" : "border-gray-300"
      } flex flex-col items-center justify-center text-center bg-white shadow-lg relative`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <div className="text-4xl mb-4 select-none">📁</div>
      <p className="text-gray-700 font-semibold mb-2">Drag & drop your photo here</p>
      <p className="text-gray-500 text-sm">or click to browse</p>
      {dragOver && (
        <div className="absolute inset-0 bg-[#f45c5c] opacity-20 rounded-xl pointer-events-none animate-pulse" />
      )}
    </div>
  );
}
