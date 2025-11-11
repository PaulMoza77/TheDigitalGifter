import React from "react";

type PreviewCardProps = {
  beforeImage: string | null;
  afterImage: string | null;
};

export default function PreviewCard({ beforeImage, afterImage }: PreviewCardProps) {
  return (
    <div className="flex gap-6 max-w-4xl mx-auto mt-10">
      <div className="flex-1 flex flex-col items-center">
        <h3 className="text-lg font-semibold mb-2">Before</h3>
        {beforeImage ? (
          <img src={beforeImage} alt="Before" className="rounded-lg shadow-md max-h-96 object-contain" />
        ) : (
          <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            No image uploaded
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col items-center">
        <h3 className="text-lg font-semibold mb-2">After</h3>
        {afterImage ? (
          <img src={afterImage} alt="After" className="rounded-lg shadow-md max-h-96 object-contain" />
        ) : (
          <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            No image generated yet
          </div>
        )}
      </div>
    </div>
  );
}
