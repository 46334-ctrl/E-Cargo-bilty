import React from 'react';

/**
 * Universal GpsMapPin component rendering the official Google Maps / GPS pin logo.
 * Replaces Lucide MapPin and generic GPS indicators across the entire application.
 */
export default function GpsMapPin({
  size = 16,
  className = '',
  style = {},
  alt = 'Map Location',
  pulse = false,
  ...props
}) {
  const width = typeof size === 'number' ? size : parseInt(size, 10) || 16;
  const height = Math.round(width * 1.43);

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 leading-none select-none ${pulse ? 'relative' : ''} ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        ...style
      }}
    >
      {pulse && (
        <span
          className="absolute -bottom-0.5 w-2 h-2 rounded-full bg-orange-500 animate-ping opacity-75 pointer-events-none"
        />
      )}
      <img
        src="/images/map-pin.webp"
        alt={alt}
        width={width}
        height={height}
        className="w-full h-full object-contain pointer-events-none select-none block"
        loading="eager"
        decoding="async"
        onError={(e) => {
          // Fallback to root path if subpath fails in certain environments
          if (e.currentTarget.src.includes('/images/')) {
            e.currentTarget.src = '/map-pin.webp';
          }
        }}
        {...props}
      />
    </span>
  );
}

