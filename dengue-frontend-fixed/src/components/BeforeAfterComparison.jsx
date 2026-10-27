import React, { useState } from 'react';

const ImageWithFallback = ({ src, alt, className }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <span className="text-4xl mb-1">🖼️</span>
        <span className="text-xs">No image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
};

const BeforeAfterComparison = ({ beforeUrl, afterUrl, beforeLabel = 'Before Cleanup', afterLabel = 'After Cleanup' }) => {
  const [expandedImage, setExpandedImage] = useState(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {/* Before */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-700">{beforeLabel}</p>
          </div>
          <button
            onClick={() => beforeUrl && setExpandedImage({ url: beforeUrl, label: beforeLabel })}
            className="block w-full rounded-xl overflow-hidden border-2 border-amber-200 hover:border-amber-400 transition-colors"
          >
            <ImageWithFallback
              src={beforeUrl}
              alt={beforeLabel}
              className="w-full h-44 object-cover"
            />
          </button>
          <p className="text-xs text-center text-gray-500">Citizen submitted</p>
        </div>

        {/* After */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-gray-700">{afterLabel}</p>
          </div>
          <button
            onClick={() => afterUrl && setExpandedImage({ url: afterUrl, label: afterLabel })}
            className="block w-full rounded-xl overflow-hidden border-2 border-green-200 hover:border-green-400 transition-colors"
          >
            <ImageWithFallback
              src={afterUrl}
              alt={afterLabel}
              className="w-full h-44 object-cover"
            />
          </button>
          <p className="text-xs text-center text-gray-500">Inspector submitted</p>
        </div>
      </div>

      {/* Lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-80"
          onClick={() => setExpandedImage(null)}
        >
          <div className="max-w-lg w-full">
            <p className="text-white text-center font-semibold mb-3">{expandedImage.label}</p>
            <img
              src={expandedImage.url}
              alt={expandedImage.label}
              className="w-full rounded-xl max-h-[75vh] object-contain"
            />
            <p className="text-gray-400 text-center text-sm mt-3">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </>
  );
};

export default BeforeAfterComparison;
