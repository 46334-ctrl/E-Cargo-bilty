import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import Tilt3DCard from './Tilt3DCard';

/**
 * ChamakRibbon - Removed as requested by user.
 */
export const ChamakRibbon = () => null;

/**
 * TruckMorBadge - Majestic Truck Art Peacock ("مور") badge.
 * Shows only the selected language (either Urdu or English, never both).
 */
export const TruckMorBadge = ({ text, subtext, className = '', light = false }) => {
  const { isUrdu, t } = useLanguage();
  const label = isUrdu ? (text || t('badgePeacock')) : (subtext || t('badgePeacock'));
  const tone = light
    ? 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 shadow-2xs'
    : 'border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#0B1325]/92 text-slate-800 dark:text-slate-100 hover:border-orange-500/40 dark:hover:border-orange-400/40 shadow-xs dark:shadow-[0_6px_16px_rgba(2,6,23,0.45)]';
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs transition-all select-none ${tone} ${className}`}>
      <span className="inline-flex items-center shrink-0 rounded-md bg-white px-1 py-0.5 shadow-2xs preserve-light">
        <img src="/logo.jpg?v=2" alt="E-CARGO-BILTY" className="w-7 h-5 object-contain select-none shrink-0" />
      </span>
      <span className={isUrdu ? 'font-urdu font-black text-xs text-slate-900 dark:text-slate-100' : 'font-sans font-bold text-xs tracking-tight text-slate-800 dark:text-slate-100'}>
        {label}
      </span>
    </div>
  );
};

/**
 * NazarBattuBadge - Removed as requested by user.
 */
export const NazarBattuBadge = () => null;

/**
 * TruckPatternBorder - Removed as requested by user.
 */
export const TruckPatternBorder = () => null;

/**
 * TruckGhungrooTrim - Decorative hanging brass bells & tassels found under truck bumpers.
 */
export const TruckGhungrooTrim = ({ className = '' }) => (
  <div className={`flex items-center justify-center gap-2 py-1 ${className}`}>
    {Array.from({ length: 20 }).map((_, i) => (
      <div key={i} className="flex flex-col items-center">
        <div className="w-[1.5px] h-2 bg-gradient-to-b from-slate-300 to-orange-400"></div>
        <div className={`w-2 h-2 rounded-full ${i % 2 === 0 ? 'bg-[#F89020] border border-orange-700' : 'bg-slate-600 border border-slate-800'} shadow-xs`}></div>
      </div>
    ))}
  </div>
);

/**
 * TruckLotusArchBadge - Mughal arched jharoka badge with lotus flower rosette & vibrant borders.
 * Shows only the selected language (either Urdu or English, never both).
 */
export const TruckLotusArchBadge = ({ text, subtext = '', className = '', light = null }) => {
  const { isUrdu, t } = useLanguage();
  const label = isUrdu ? (text || t('heritageBadge')) : (subtext || t('heritageBadge'));
  const tone = light === true
    ? 'border-slate-200 bg-white shadow-2xs text-slate-800'
    : light === false
    ? 'border-white/15 bg-[#0B1325]/92 shadow-[0_6px_16px_rgba(2,6,23,0.45)] text-slate-100'
    : 'border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#0B1325]/92 text-slate-800 dark:text-slate-100 shadow-2xs';
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${tone} ${className}`}>
      <span className={isUrdu
        ? 'font-urdu font-bold text-xs text-slate-900 dark:text-slate-100'
        : 'font-sans font-bold text-xs text-slate-800 dark:text-slate-100'
      }>
        {label}
      </span>
    </div>
  );
};

/**
 * AjrakRibbon - Removed as requested by user.
 */
export const AjrakRibbon = () => null;

/**
 * TruckBackground - Fixed Viewport Pakistani Decorated Truck Art backdrop.
 * Supports optional frosted glossy blur + GPU-composited mouse parallax depth.
 */
export const TruckBackground = ({
  image = '/images/peacock_truck_art_bg.jpg',
  opacity = 'opacity-100',
  overlay = false,
  glossyBlur = false,
  className = ''
}) => (
  <div className={`fixed inset-0 pointer-events-none overflow-hidden z-0 select-none ${className}`}>
    <img
      src={image}
      alt="Pakistani Decorated Cargo Truck"
      className={`w-full h-full object-cover object-center ${glossyBlur ? 'transition-transform duration-300 ease-out' : ''} ${opacity}`}
      style={{
        filter: glossyBlur ? 'blur(6px) contrast(1.06) saturate(1.22)' : undefined,
        transform: glossyBlur
          ? 'translate3d(calc(var(--mx, 0) * -14px), calc(var(--my, 0) * -10px), 0) scale(1.07)'
          : undefined
      }}
      decoding="async"
      loading="eager"
    />
    {glossyBlur && (
      <>
        {/* Frosted Obsidian Glass & Warm/Cyan Atmospheric Gradient Scrim */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(11, 19, 37, 0.48) 34%, rgba(6, 11, 22, 0.62) 66%, rgba(6, 11, 22, 0.82) 100%), radial-gradient(circle at 22% 20%, rgba(249, 115, 22, 0.18) 0%, transparent 48%), radial-gradient(circle at 80% 78%, rgba(34, 211, 238, 0.15) 0%, transparent 50%)'
          }}
        />
        {/* Dynamic Glossy Specular Sheen Layer driven by Parallax (--mx, --my) */}
        <div
          aria-hidden="true"
          className="absolute -inset-24 pointer-events-none transition-transform duration-300 ease-out"
          style={{
            transform: 'translate3d(calc(var(--mx, 0) * 28px), calc(var(--my, 0) * 20px), 0)',
            background:
              'radial-gradient(680px circle at 50% 35%, rgba(255, 255, 255, 0.10) 0%, rgba(249, 115, 22, 0.06) 35%, transparent 70%)'
          }}
        />
      </>
    )}
    {overlay && <div className="absolute inset-0 bg-slate-900/15 pointer-events-none" />}
  </div>
);

// Backward compatibility alias so any remaining imports resolve safely
export const AjrakBackground = TruckBackground;

/**
 * TruckPhotoShowcase - Rich display card featuring authentic Pakistani decorated trucks.
 * Used on the landing page and dashboards to proudly showcase Khyber & Sindh truck art.
 * Shows only the selected language (Urdu or English, never both at once).
 */
export const TruckPhotoShowcase = ({
  image = '/images/peacock_truck_art_bg.jpg',
  caption = 'ای کارگو بلٹی • محفوظ اور بااعتماد ترسیل',
  subcaption = 'Commercial Fleet • Verified Freight Transit Across Pakistan',
  tag = 'محفوظ ترسیل',
  tagEn = 'Safe Transit',
  dark = false,
  className = '',
  onClick,
  ctaLabel
}) => {
  const { isUrdu } = useLanguage();
  const activeTitle = isUrdu ? caption : subcaption;
  const activeTag = isUrdu ? tag : tagEn;
  const isInteractive = typeof onClick === 'function';

  const handleKeyDown = (e) => {
    if (!isInteractive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <Tilt3DCard
      maxTilt={3.5}
      scale={1.012}
      glareOpacity={0.18}
      glareRoundedClass="rounded-2xl"
      className={className}
    >
      <div
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        className={`relative rounded-2xl overflow-hidden border transition-colors duration-200 group ${
          isInteractive ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400/70' : ''
        } ${
          dark
            ? 'border-white/15 bg-slate-900 shadow-lg hover:border-orange-400/60'
            : 'border-slate-200/90 shadow-sm hover:shadow-lg bg-white hover:border-slate-300'
        }`}
      >
        <div className="relative h-56 sm:h-64 overflow-hidden bg-slate-900">
          <img
            src={image}
            alt={activeTitle}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/20" />
          <div className="absolute inset-0 p-3 sm:p-3.5 flex flex-col justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/20 text-white text-[11px] font-mono font-bold uppercase tracking-wider shadow-sm">
                {activeTag}
              </span>
            </div>
            <div className="text-white flex flex-col gap-2 min-w-0">
              <div className={`min-w-0 ${isUrdu ? 'border-r-2 border-[#F89020] pr-2.5 text-right' : 'border-l-2 border-[#F89020] pl-2.5 text-left'}`}>
                <p className={isUrdu ? "font-urdu text-base sm:text-xl font-black text-white leading-snug line-clamp-2" : "font-sans text-[13px] sm:text-base font-bold text-white leading-snug line-clamp-2"}>
                  {activeTitle}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                {ctaLabel ? (
                  <span
                    className={`${isUrdu ? 'font-urdu text-xs' : 'font-mono text-[10px] sm:text-[11px]'} inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-orange-500/95 group-hover:bg-orange-400 text-white font-bold shadow-md whitespace-nowrap shrink-0 transition-colors`}
                  >
                    <span>{ctaLabel}</span>
                    <span aria-hidden="true">{isUrdu ? '←' : '→'}</span>
                  </span>
                ) : <span />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Tilt3DCard>
  );
};

/**
 * SindhiTruckTexture - Removed as requested by user.
 */
export const SindhiTruckTexture = () => null;

/**
 * TruckTaj - Removed as requested by user.
 */
export const TruckTaj = () => null;

/**
 * FloralRosette - Removed as requested by user.
 */
export const FloralRosette = () => null;

/**
 * UrduMotto / TruckPoetry - Removed as requested by user.
 */
export const UrduMotto = () => null;

/**
 * TruckPoetryBanner - Traditional decorated poetry ribbon found across truck body panels.
 * Shows only the selected language (either Urdu or English, never both).
 */
export const TruckPoetryBanner = ({
  text,
  subtext,
  className = '',
  light = null
}) => {
  const { isUrdu, t } = useLanguage();
  const mainText = isUrdu ? (text || t('poetryBanner')) : (subtext || t('poetryBanner'));
  const secondaryText = isUrdu ? t('poetrySubtext') : t('poetrySubtext');
  const isLight = light === true;
  const isDark = light === false;
  return (
    <div className={`relative px-4 py-2.5 rounded-2xl border text-center overflow-hidden transition-colors duration-200 ${
      isLight
        ? 'border-slate-200 bg-white shadow-xs hover:shadow-sm'
        : isDark
        ? 'border-white/15 bg-[#0B1325]/94 shadow-[0_12px_28px_rgba(2,6,23,0.48)] hover:border-white/25'
        : 'border-slate-200 dark:border-white/15 bg-white/95 dark:bg-[#0B1325]/94 shadow-xs dark:shadow-[0_12px_28px_rgba(2,6,23,0.48)] hover:border-slate-300 dark:hover:border-white/25'
    } ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-1 dark:h-[2px] bg-[#F89020]" />
      <div className="flex items-center justify-center gap-2 sm:gap-3 min-w-0">
        <span className={isUrdu
          ? 'font-urdu text-base sm:text-lg font-black leading-snug text-slate-900 dark:text-white'
          : 'font-sans text-xs sm:text-sm font-black leading-snug text-slate-900 dark:text-white'
        }>
          {mainText}
        </span>
      </div>
      {secondaryText && (
        <p className={`text-[10px] tracking-wider font-bold mt-0.5 text-slate-500 dark:text-slate-300 ${isUrdu ? 'font-urdu' : 'font-mono uppercase'}`}>
          {secondaryText}
        </p>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-1 dark:h-[2px] bg-[#F89020] opacity-85" />
    </div>
  );
};

/**
 * WorkshopBadge - Decorative artisan/workshop badge.
 * Shows only the selected language (either Urdu or English, never both).
 */
export const WorkshopBadge = ({ className = '', dark = true }) => {
  const { isUrdu, t } = useLanguage();
  return (
    <div className={`flex items-center gap-2 text-[11px] ${dark ? 'text-slate-300' : 'text-slate-700'} ${isUrdu ? 'font-urdu' : 'font-mono'} ${className}`}>
      <span className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-xs ${dark ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-[#F89020]'}`}></span>
      <span className={`font-bold ${dark ? 'text-slate-100' : 'text-slate-800'}`}>
        {t('badgeWorkshop')}
      </span>
    </div>
  );
};
