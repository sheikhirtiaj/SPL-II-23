import React from 'react';

const MapLocationView = ({ latitude, longitude, locationText }) => {
  const hasCoords = latitude != null && longitude != null;

  return (
    <div className="da-map rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      {/* Location text bar */}
      <div className="da-map__header flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200">
        <span className="text-emerald-700 text-lg">📍</span>
        <div className="min-w-0">
          {locationText && (
            <p className="text-sm font-medium text-gray-800 truncate">{locationText}</p>
          )}
          {hasCoords ? (
            <p className="text-xs text-gray-500">
              {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
            </p>
          ) : (
            <p className="text-xs text-gray-400">Location coordinates not available</p>
          )}
        </div>
        {hasCoords && (
          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="da-map__link ml-auto text-xs font-medium text-emerald-700 hover:text-emerald-900 whitespace-nowrap flex-shrink-0"
          >
            Open in Maps ↗
          </a>
        )}
      </div>

      {/* Map embed */}
      {hasCoords ? (
        <iframe
          title="Complaint Location"
          width="100%"
          height="220"
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(longitude) - 0.005},${parseFloat(latitude) - 0.005},${parseFloat(longitude) + 0.005},${parseFloat(latitude) + 0.005}&layer=mapnik&marker=${latitude},${longitude}`}
          className="border-0 w-full"
        />
      ) : (
        <div className="h-36 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">🗺️</div>
            <p className="text-sm">Map unavailable — no coordinates provided</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLocationView;
