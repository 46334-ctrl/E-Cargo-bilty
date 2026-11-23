/**
 * Proximity and Geospatial Prioritization Engine for E-Cargo-Bilty
 * Ranks transporters, fleet trucks, and shipments relative to the user's base city/hub.
 */
import { normalizeCity, getIntercityDistance } from './fareCalculator';

export const PAKISTAN_CITIES = [
  { id: 'lahore', name: 'Lahore', label: 'Lahore (Punjab Hub)', province: 'Punjab' },
  { id: 'karachi', name: 'Karachi', label: 'Karachi (Sindh / Port Hub)', province: 'Sindh' },
  { id: 'islamabad', name: 'Islamabad', label: 'Islamabad (Federal Capital)', province: 'Federal' },
  { id: 'rawalpindi', name: 'Rawalpindi', label: 'Rawalpindi (Twin Cities Hub)', province: 'Punjab' },
  { id: 'faisalabad', name: 'Faisalabad', label: 'Faisalabad (Textile Hub)', province: 'Punjab' },
  { id: 'multan', name: 'Multan', label: 'Multan (South Punjab Hub)', province: 'Punjab' },
  { id: 'peshawar', name: 'Peshawar', label: 'Peshawar (KP Transit Gateway)', province: 'Khyber Pakhtunkhwa' },
  { id: 'quetta', name: 'Quetta', label: 'Quetta (Balochistan Hub)', province: 'Balochistan' },
  { id: 'gujranwala', name: 'Gujranwala', label: 'Gujranwala (Industrial Hub)', province: 'Punjab' },
  { id: 'sialkot', name: 'Sialkot', label: 'Sialkot (Export Logistics City)', province: 'Punjab' },
  { id: 'sukkur', name: 'Sukkur', label: 'Sukkur (Upper Sindh Gateway)', province: 'Sindh' },
  { id: 'hyderabad', name: 'Hyderabad', label: 'Hyderabad (Sindh)', province: 'Sindh' },
  { id: 'gwadar', name: 'Gwadar', label: 'Gwadar (Deep Sea Port)', province: 'Balochistan' },
  { id: 'hub', name: 'Hub', label: 'Hub Chowki (Balochistan / KHI Border)', province: 'Balochistan' }
];

/**
 * Calculates road distance between two cities for proximity sorting.
 * Returns 0 if identical city.
 */
export const getProximityDistance = (cityA, cityB) => {
  if (!cityA || !cityB) return 9999;
  const a = normalizeCity(cityA);
  const b = normalizeCity(cityB);

  if (!a || !b) return 9999;
  if (a === b) return 0; // Same city

  // Islamabad and Rawalpindi twin cities
  if ((a === 'islamabad' && b === 'rawalpindi') || (a === 'rawalpindi' && b === 'islamabad')) {
    return 15;
  }

  return getIntercityDistance(a, b);
};

/**
 * Returns stylized proximity badge information based on distance in km
 */
export const getProximityBadge = (distanceKm, isUrdu = false) => {
  if (distanceKm === 0) {
    return {
      isLocal: true,
      text: isUrdu ? '📍 آپ کے شہر میں (مقامی ہب)' : '📍 In Your City / Local Hub (0 km)',
      shortText: isUrdu ? 'مقامی ہب (0 کلومیٹر)' : 'Local Hub (0 km)',
      color: 'emerald',
      className: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-600/40'
    };
  }

  if (distanceKm <= 150) {
    return {
      isLocal: false,
      isNearby: true,
      text: isUrdu ? `📍 قریبی ہب (${distanceKm} کلومیٹر)` : `📍 Nearby Hub (${distanceKm} km away)`,
      shortText: isUrdu ? `قریبی (${distanceKm} کلومیٹر)` : `Nearby (${distanceKm} km)`,
      color: 'orange',
      className: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-600/40'
    };
  }

  if (distanceKm < 9000) {
    return {
      isLocal: false,
      isNearby: false,
      text: isUrdu ? `📍 دوسرے شہر میں (${distanceKm} کلومیٹر)` : `📍 Regional Hub (${distanceKm} km away)`,
      shortText: isUrdu ? `${distanceKm} کلومیٹر` : `${distanceKm} km`,
      color: 'slate',
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15'
    };
  }

  return {
    isLocal: false,
    isNearby: false,
    text: isUrdu ? '📍 ملک بھر میں' : '📍 Nationwide Fleet',
    shortText: isUrdu ? 'ملک بھر میں' : 'Nationwide',
    color: 'slate',
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'
  };
};

/**
 * Sorts any list of items by proximity to a base city.
 * @param {Array} items List of items (transporters, trucks, cargo)
 * @param {String} baseCity Reference city of the active user
 * @param {Function} getCityFn Function to extract city name from each item
 * @param {Boolean} isUrdu
 */
export const sortByProximity = (items, baseCity = 'Lahore', getCityFn = (item) => item.city || item.loc || item.origin, isUrdu = false) => {
  if (!Array.isArray(items)) return [];
  const reference = baseCity || 'Lahore';

  const scored = items.map((item, index) => {
    const itemCity = getCityFn(item) || '';
    const distanceKm = getProximityDistance(reference, itemCity);
    const badge = getProximityBadge(distanceKm, isUrdu);
    return {
      item,
      distanceKm,
      badge,
      originalIndex: index
    };
  });

  scored.sort((a, b) => {
    // Distance ascending: 0km (same city) comes first, then nearest
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return a.originalIndex - b.originalIndex;
  });

  return scored.map(s => ({
    ...s.item,
    _proximityDistance: s.distanceKm,
    _proximityBadge: s.badge
  }));
};

