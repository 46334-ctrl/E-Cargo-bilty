import React from 'react';

/**
 * 3D Cargo / Parcel Delivery & Location Tracking Icon
 * Used across the application for "Post Cargo" actions, tabs, and step cards.
 */
export default function PostCargoIcon({
  size = 24,
  className = '',
  style = {},
  alt = 'Post Cargo',
  ...props
}) {
  const numSize = typeof size === 'number' ? size : parseInt(size, 10) || 24;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 leading-none select-none ${className}`}
      style={{
        width: `${numSize}px`,
        height: `${numSize}px`,
        ...style
      }}
    >
      <img
        src="/images/post-cargo.avif"
        alt={alt}
        width={numSize}
        height={numSize}
        className="w-full h-full object-contain pointer-events-none select-none block drop-shadow-xs"
        loading="eager"
        decoding="async"
        onError={(e) => {
          if (e.currentTarget.src.includes('/images/')) {
            e.currentTarget.src = '/post-cargo.avif';
          }
        }}
        {...props}
      />
    </span>
  );
}

