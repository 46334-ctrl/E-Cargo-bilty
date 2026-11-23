import React from 'react';

/**
 * 1. Admin Control Center Logo
 * Modern armored security shield with beveled facet layers, top security crest,
 * and a centered padlock with a keyhole control emblem.
 */
export function AdminShieldLogo({ size = 24, className = '', style = {}, ...props }) {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={style}
      aria-label="Admin Security Shield"
      {...props}
    >
      <defs>
        <linearGradient id="admin-shield-shimmer" x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.26" />
        </linearGradient>
      </defs>

      {/* Outer armored shield shape */}
      <path
        d="M16 2.5L26.5 7.2C26.5 17.8 21.2 25.4 16 29.5C10.8 25.4 5.5 17.8 5.5 7.2L16 2.5Z"
        fill="url(#admin-shield-shimmer)"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Left shield bevel highlight */}
      <path
        d="M16 4.2L7.2 8.2C7.2 17 11.5 23.6 16 27.2V4.2Z"
        fill="currentColor"
        fillOpacity="0.16"
      />

      {/* Inner beveled rim */}
      <path
        d="M16 5.8L23.8 9.4C23.8 17.2 19.8 23.5 16 26.8C12.2 23.5 8.2 17.2 8.2 9.4L16 5.8Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.4"
        strokeDasharray="1.5 1"
        fill="none"
      />

      {/* Security Shield Crest Node / Top Crown */}
      <path
        d="M16 4.8L17.2 7.2L19.8 7.5L17.8 9.3L18.4 11.8L16 10.5L13.6 11.8L14.2 9.3L12.2 7.5L14.8 7.2L16 4.8Z"
        fill="currentColor"
        fillOpacity="0.85"
      />

      {/* Padlock Shackle */}
      <path
        d="M12.8 15V12.8C12.8 11.03 14.23 9.6 16 9.6C17.77 9.6 19.2 11.03 19.2 12.8V15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Padlock Body with cut-out keyhole */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.8 14.5C9.8 14.5 9 15.3 9 16.3V21.2C9 22.2 9.8 23 10.8 23H21.2C22.2 23 23 22.2 23 21.2V16.3C23 15.3 22.2 14.5 21.2 14.5H10.8ZM16 16.8C16.8 16.8 17.4 17.4 17.4 18.2C17.4 18.7 17.1 19.2 16.7 19.4L17 21.2H15L15.3 19.4C14.9 19.2 14.6 18.7 14.6 18.2C14.6 17.4 15.2 16.8 16 16.8Z"
        fill="currentColor"
        fillOpacity="0.95"
      />

      {/* Horizontal security pulse / control bar */}
      <line x1="8" y1="16.5" x2="10" y2="16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="22" y1="16.5" x2="24" y2="16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 2. Truck Owner Portal Logo
 * Sleek, detailed modern heavy semi-truck / Class 8 freight truck viewed from an aggressive
 * aerodynamic front angle with roof fairing, panoramic windshield, chrome grille, and LED lights.
 */
export function TruckOwnerSemiLogo({ size = 24, className = '', style = {}, ...props }) {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={style}
      aria-label="Semi-Truck Freight Logo"
      {...props}
    >
      <defs>
        <linearGradient id="semi-cab-gradient" x1="16" y1="3" x2="16" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Top aerodynamic wind-deflector roof spoiler */}
      <path
        d="M11 3.5C11 3.5 13.5 3 16 3C18.5 3 21 3.5 21 3.5L23.2 6.5H8.8L11 3.5Z"
        fill="currentColor"
        fillOpacity="0.9"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />

      {/* Triple Rooftop Cab Marker Lights */}
      <circle cx="13.5" cy="5" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="16" cy="4.8" r="0.8" fill="currentColor" fillOpacity="0.4" />
      <circle cx="18.5" cy="5" r="0.8" fill="currentColor" fillOpacity="0.4" />

      {/* Main Aero Cab Body */}
      <path
        d="M8.2 6.8H23.8C24.6 6.8 25.2 7.4 25.4 8.2L26.8 16C27 16.8 26.4 17.5 25.6 17.5H6.4C5.6 17.5 5 16.8 5.2 16L6.6 8.2C6.8 7.4 7.4 6.8 8.2 6.8Z"
        fill="url(#semi-cab-gradient)"
        fillOpacity="0.22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Curved Aerodynamic Windshield */}
      <path
        d="M8.8 8.2H23.2L24.4 13.5H7.6L8.8 8.2Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      {/* Windshield Center Division Pillar */}
      <line x1="16" y1="8.2" x2="16" y2="13.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
      {/* Windshield Glare Reflection Streak */}
      <line x1="11" y1="9.2" x2="14" y2="9.2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.4" />

      {/* Aero Side Mirrors */}
      <path d="M4 9.5H5.8V13.8H4C3.6 13.8 3.3 13.5 3.3 13V10.3C3.3 9.8 3.6 9.5 4 9.5Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M28 9.5H26.2V13.8H28C28.4 13.8 28.7 13.5 28.7 13V10.3C28.7 9.8 28.4 9.5 28 9.5Z" fill="currentColor" fillOpacity="0.9" />

      {/* Modern Massive Front Grille */}
      <rect
        x="9.5"
        y="15"
        width="13"
        height="7.8"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      {/* Grille Horizontal Chrome Fin Slats */}
      <line x1="11" y1="17" x2="21" y2="17" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="11" y1="19" x2="21" y2="19" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <line x1="11" y1="21" x2="21" y2="21" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      {/* Grille Center Emblem Crown */}
      <circle cx="16" cy="19" r="1.2" fill="currentColor" />

      {/* Angular High-Tech LED Headlight Clusters */}
      <path
        d="M6.2 18.2L8.5 17.5V19.8L6.5 20.2C6.1 20.2 5.8 19.8 5.9 19.4L6.2 18.2Z"
        fill="currentColor"
        fillOpacity="0.95"
      />
      <path
        d="M25.8 18.2L23.5 17.5V19.8L25.5 20.2C25.9 20.2 26.2 19.8 26.1 19.4L25.8 18.2Z"
        fill="currentColor"
        fillOpacity="0.95"
      />

      {/* Lower Heavy-Duty Bumper with Skid Guard */}
      <path
        d="M4.5 23.2H27.5C28.1 23.2 28.5 23.7 28.3 24.3L27.6 26.5C27.4 27.1 26.8 27.5 26.2 27.5H5.8C5.2 27.5 4.6 27.1 4.4 26.5L3.7 24.3C3.5 23.7 3.9 23.2 4.5 23.2Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      {/* Lower Bumper Fog Light Insets */}
      <rect x="6.8" y="24.5" width="3" height="1.2" rx="0.6" fill="currentColor" fillOpacity="0.3" />
      <rect x="22.2" y="24.5" width="3" height="1.2" rx="0.6" fill="currentColor" fillOpacity="0.3" />
      {/* Front Skid Guard Center Slits */}
      <line x1="14" y1="25" x2="14" y2="26.2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="16" y1="25" x2="16" y2="26.2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
      <line x1="18" y1="25" x2="18" y2="26.2" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />

      {/* Visible Heavy Front Wheels / Tires under Fenders */}
      <rect x="4.2" y="21" width="2" height="4.5" rx="1" fill="currentColor" fillOpacity="0.95" />
      <rect x="25.8" y="21" width="2" height="4.5" rx="1" fill="currentColor" fillOpacity="0.95" />
    </svg>
  );
}

/**
 * 3. Cargo Transporter Hub Logo
 * Modern logistics logo combining an isometric corrugated shipping container with
 * dynamic transport velocity arrows and corner casting locks.
 */
export function CargoTransporterLogo({ size = 24, className = '', style = {}, ...props }) {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={style}
      aria-label="Shipping Container Logistics Logo"
      {...props}
    >
      <defs>
        <linearGradient id="container-top-gradient" x1="5" y1="7" x2="27" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Isometric Shipping Container: Top Roof Deck */}
      <path
        d="M10 6L25 9.5L22 13L7 9.5L10 6Z"
        fill="url(#container-top-gradient)"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Roof reinforcement ribs */}
      <line x1="13" y1="7.5" x2="11.2" y2="9.8" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="16.5" y1="8.3" x2="14.7" y2="10.6" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="20" y1="9.1" x2="18.2" y2="11.4" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.5" />

      {/* Isometric Shipping Container: Long Corrugated Side Panel */}
      <path
        d="M7 9.5L22 13V22.5L7 19V9.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Vertical Corrugation Flutes / Ribs along container side */}
      <line x1="9.5" y1="10.2" x2="9.5" y2="19.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="12" y1="10.8" x2="12" y2="20.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="14.5" y1="11.4" x2="14.5" y2="20.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="17" y1="12" x2="17" y2="21.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="19.5" y1="12.6" x2="19.5" y2="22" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

      {/* Isometric Shipping Container: End Cargo Door Panel */}
      <path
        d="M22 13L27 10.5V19.5L22 22.5V13Z"
        fill="currentColor"
        fillOpacity="0.45"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Door vertical lock rods & center seam */}
      <line x1="24.5" y1="11.8" x2="24.5" y2="21" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* Door handles / cam latches */}
      <rect x="23.8" y="15.5" width="1.4" height="2" rx="0.3" fill="currentColor" />

      {/* Corner Castings (Twist Lock blocks at visible corners) */}
      <rect x="6.2" y="8.8" width="1.6" height="1.6" rx="0.4" fill="currentColor" />
      <rect x="6.2" y="18.2" width="1.6" height="1.6" rx="0.4" fill="currentColor" />
      <rect x="21.2" y="21.7" width="1.6" height="1.6" rx="0.4" fill="currentColor" />
      <rect x="26.2" y="18.7" width="1.6" height="1.6" rx="0.4" fill="currentColor" />
      <rect x="26.2" y="9.7" width="1.6" height="1.6" rx="0.4" fill="currentColor" />

      {/* Dynamic Logistics Express Velocity Arrow wrapping around */}
      <path
        d="M3 24C5.5 25.5 9 26.2 13 26.2C21 26.2 27.5 22.5 29 17.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="16 2"
      />
      {/* Forward Arrowhead on the upper dynamic motion loop */}
      <path
        d="M23 4.5L29 7L24.5 11.5L25.8 7.8L23 4.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Trailing speed spark */}
      <circle cx="5" cy="22" r="1.2" fill="currentColor" />
    </svg>
  );
}

/**
 * 4. Business Shipper Center Logo
 * Modern commercial shipping logo with stacked cargo warehouse cartons, packaging sealing tape,
 * barcode label, fragile orientation arrow, and dispatch speed rays on a loading pallet.
 */
export function BusinessShipperLogo({ size = 24, className = '', style = {}, ...props }) {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={style}
      aria-label="Commercial Shipping Packages Logo"
      {...props}
    >
      <defs>
        <linearGradient id="parcel-top-gradient" x1="4" y1="12" x2="28" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Base Heavy Shipping Pallet / Ground Loading Platform */}
      <path
        d="M4 27.5H28M7 25.5H25M9 27.5V29M23 27.5V29M16 27.5V29"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Primary Master Cargo Box (Lower Warehouse Carton) */}
      {/* Front Face of Master Box */}
      <path
        d="M5.5 16H20.5V25H5.5V16Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Right Side Isometric Depth of Master Box */}
      <path
        d="M20.5 16L26.5 12.5V21.5L20.5 25V16Z"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Top Face of Master Box */}
      <path
        d="M5.5 16L11.5 12.5H26.5L20.5 16H5.5Z"
        fill="url(#parcel-top-gradient)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Master Box Packaging Sealing Tape (Vertical Band) */}
      <path
        d="M12 16V25M15 13.5L13.8 16"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 1"
        strokeOpacity="0.7"
      />
      {/* Barcode & Commercial Shipping Label on Master Carton */}
      <rect x="7.5" y="18" width="4" height="4.5" rx="0.5" fill="currentColor" fillOpacity="0.85" />
      <line x1="8.5" y1="19.2" x2="10.5" y2="19.2" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.3" />
      <line x1="8.5" y1="20.4" x2="10.5" y2="20.4" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.3" />
      <line x1="8.5" y1="21.6" x2="10.5" y2="21.6" stroke="currentColor" strokeWidth="0.6" strokeOpacity="0.3" />

      {/* Fragile / Handle with Care Up-Arrow Stamp on Master Box */}
      <path
        d="M16 19.5L17.5 18L19 19.5M17.5 18V22"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Secondary Parcel / Express Consignment Carton Stacked on Top */}
      {/* Front Face of Top Parcel */}
      <path
        d="M13 5.5H24V12.5H13V5.5Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Top Face of Top Parcel */}
      <path
        d="M13 5.5L16.5 3H27.5L24 5.5H13Z"
        fill="currentColor"
        fillOpacity="0.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Right Side Face of Top Parcel */}
      <path
        d="M24 5.5L27.5 3V10L24 12.5V5.5Z"
        fill="currentColor"
        fillOpacity="0.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />

      {/* Top Parcel Central Security Tape Band */}
      <path
        d="M18.5 5.5V12.5M22 3.8L20.2 5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.8"
      />

      {/* Outbound Commercial Dispatch Speed Rays / Wings (Top Left) */}
      <path
        d="M3 8L7 6M2 11.5L6 9.8M4 14.5L7.5 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

