/**
 * E-Cargo-Bilty Dynamic Tariff & Inter-City Fare Calculation Engine
 * Grounded in Pakistani National Highway Authority (NHA) Route Distances
 * Base Rate: Rs. 45 per Ton-km
 * Fuel Surcharge: 8%
 * Provincial Tax (PRA / SRB / KPRA / BRA): 16%
 */

// Major Pakistani logistics hub highway road distances (in Kilometers)
export const HIGHWAY_DISTANCES = {
  'karachi-lahore': 1210,
  'karachi-islamabad': 1410,
  'karachi-rawalpindi': 1400,
  'karachi-faisalabad': 1115,
  'karachi-multan': 890,
  'karachi-sukkur': 480,
  'karachi-quetta': 690,
  'karachi-peshawar': 1560,
  'karachi-gujranwala': 1280,
  'karachi-sialkot': 1320,
  'karachi-hyderabad': 160,
  'karachi-gwadar': 640,
  'karachi-hub': 45,

  'lahore-islamabad': 375,
  'lahore-rawalpindi': 365,
  'lahore-faisalabad': 180,
  'lahore-multan': 340,
  'lahore-peshawar': 510,
  'lahore-quetta': 1020,
  'lahore-sukkur': 760,
  'lahore-gujranwala': 70,
  'lahore-sialkot': 130,

  'faisalabad-islamabad': 360,
  'faisalabad-rawalpindi': 350,
  'faisalabad-multan': 240,
  'faisalabad-peshawar': 480,
  'faisalabad-sukkur': 630,

  'multan-islamabad': 540,
  'multan-rawalpindi': 530,
  'multan-sukkur': 430,
  'multan-peshawar': 680,
  'multan-quetta': 720,

  'islamabad-peshawar': 180,
  'rawalpindi-peshawar': 175,
  'islamabad-rawalpindi': 15,
  'rawalpindi-islamabad': 15,
  'islamabad-quetta': 900,
  'rawalpindi-quetta': 890,
  'islamabad-sukkur': 920,
  'rawalpindi-sukkur': 910,

  'sukkur-quetta': 390,
  'peshawar-quetta': 820,
};

// Vehicle Type tariff multipliers
export const VEHICLE_MULTIPLIERS = {
  '18-Wheeler Trailer': 1.25,
  '22-Wheeler': 1.30,
  'Container (40ft)': 1.20,
  'Container (20ft)': 1.10,
  'Full Body Truck': 1.15,
  'Half Body Truck': 1.00,
  'Mini Truck': 0.85,
  'Shehzore / Pickup': 0.75,
};

// Payment terms options
export const PAYMENT_TERMS_OPTIONS = [
  { id: 'Prepaid', label: 'Prepaid (Paid by Consignor at Dispatch)', code: 'PREPAID' },
  { id: 'To-Pay', label: 'To-Pay / Freight on Delivery (FOD)', code: 'TO-PAY (FOD)' },
  { id: 'Billed Net-30', label: 'Billed on Corporate Account (Net-30)', code: 'CORP-NET30' },
];

// Special Cargo Handling classifications
export const SPECIAL_HANDLING_FLAGS = [
  { id: 'fragile', label: 'Fragile Goods (Glass/Ceramics)', urdu: 'نازک سامان (شیشہ/سیرامک)', color: 'amber', icon: 'AlertTriangle' },
  { id: 'cold_chain', label: 'Perishable / Cold-Chain (Food/Pharma)', urdu: 'منجمد / خراب ہونے والا (خوراک/ادویات)', color: 'cyan', icon: 'Snowflake' },
  { id: 'hazmat', label: 'Hazardous Material (Hazmat - Fuel/Chemicals)', urdu: 'خطرناک مواد (کیمیکلز/ایندھن)', color: 'rose', icon: 'Flame' },
  { id: 'upright', label: 'Keep Upright / Do Not Stack', urdu: 'سیدھا رکھیں / اوپر وزن نہ ڈالیں', color: 'purple', icon: 'ArrowUp' },
];

// Packaging Types
export const PACKAGING_TYPES = [
  'Cartons / Boxes',
  'Wooden Crates',
  'Pallets',
  'Gunny Sacks (Boriyan)',
  'Steel Drums',
  'Bales (Gaanth)',
  'Loose Bulk Cargo'
];

/**
 * Clean and normalize a city name to match dictionary keys
 */
export const normalizeCity = (city) => {
  if (!city || typeof city !== 'string') return '';
  const clean = city.toLowerCase().trim();
  const knownCities = [
    'karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad',
    'multan', 'peshawar', 'quetta', 'sukkur', 'gujranwala',
    'sialkot', 'hyderabad', 'gwadar', 'hub'
  ];
  for (const k of knownCities) {
    if (clean.includes(k)) return k;
  }
  return clean.split(/[\s,]+/)[0];
};

/**
 * Retrieve highway distance between any two Pakistani cities.
 * If exact route isn't listed, returns an intelligent estimate based on Pakistani geography.
 */
export const getIntercityDistance = (origin, destination) => {
  const o = normalizeCity(origin);
  const d = normalizeCity(destination);

  if (!o || !d || o === d) return 50; // Intra-city / local haul

  const directKey = `${o}-${d}`;
  const reverseKey = `${d}-${o}`;

  if (HIGHWAY_DISTANCES[directKey]) return HIGHWAY_DISTANCES[directKey];
  if (HIGHWAY_DISTANCES[reverseKey]) return HIGHWAY_DISTANCES[reverseKey];

  // Try via Karachi or Lahore triangulation if unknown
  if (HIGHWAY_DISTANCES[`karachi-${o}`] && HIGHWAY_DISTANCES[`karachi-${d}`]) {
    return Math.abs(HIGHWAY_DISTANCES[`karachi-${o}`] - HIGHWAY_DISTANCES[`karachi-${d}`]) + 60;
  }
  if (HIGHWAY_DISTANCES[`lahore-${o}`] && HIGHWAY_DISTANCES[`lahore-${d}`]) {
    return Math.abs(HIGHWAY_DISTANCES[`lahore-${o}`] - HIGHWAY_DISTANCES[`lahore-${d}`]) + 50;
  }

  return 350; // Default highway haul estimate
};

/**
 * Calculate Volumetric Weight from dimensions (Length x Width x Height in cm).
 * Standard IATA / Road Freight Formula: (L x W x H in cm) / 5000 = Volumetric Weight in KG.
 * Converted to Metric Tons for Bilty calculations (/ 1000).
 */
export const calculateVolumetricWeight = (lengthCm = 0, widthCm = 0, heightCm = 0, qty = 1) => {
  const l = parseFloat(lengthCm) || 0;
  const w = parseFloat(widthCm) || 0;
  const h = parseFloat(heightCm) || 0;
  const q = parseInt(qty) || 1;

  if (l <= 0 || w <= 0 || h <= 0) return { kg: 0, tons: 0 };

  const volumetricKgPerUnit = (l * w * h) / 5000;
  const totalVolumetricKg = volumetricKgPerUnit * q;
  const totalVolumetricTons = totalVolumetricKg / 1000;

  return {
    kg: Math.round(totalVolumetricKg * 10) / 10,
    tons: Math.round(totalVolumetricTons * 100) / 100
  };
};

/**
 * Calculate dynamic quotation breakdown
 * Base Rate = Distance (km) * Chargeable Tons * Rs. 45/Ton-km
 * Vehicle Multiplier: e.g. 18-Wheeler Trailer = 1.25x
 * Fuel Surcharge: 8%
 * Provincial Sales Tax (PRA / SRB): 16%
 */
export const calculateFreightTariff = ({
  origin,
  destination,
  chargeableTons = 1,
  vehicleType = 'Half Body Truck',
  handlingFlags = []
}) => {
  const distanceKm = getIntercityDistance(origin, destination);
  const tons = Math.max(0.5, parseFloat(chargeableTons) || 1);
  const multiplier = VEHICLE_MULTIPLIERS[vehicleType] || 1.0;
  
  // Rate per Ton-Km is Rs. 45
  const rawBase = distanceKm * tons * 45 * multiplier;
  // Floor at minimum booking fee of Rs. 15,000 for intercity, Rs. 8,000 for intracity
  const minFloor = distanceKm <= 60 ? 8000 : 15000;
  const baseFreight = Math.max(minFloor, Math.round(rawBase));

  // Handling surcharge (e.g. Hazmat or Cold-Chain adds 10% premium)
  let handlingPremiumPercent = 0;
  if (handlingFlags.includes('hazmat')) handlingPremiumPercent += 0.10;
  if (handlingFlags.includes('cold_chain')) handlingPremiumPercent += 0.08;
  if (handlingFlags.includes('fragile')) handlingPremiumPercent += 0.05;

  const handlingSurcharge = Math.round(baseFreight * handlingPremiumPercent);
  const adjustedBase = baseFreight + handlingSurcharge;

  // 8% Fuel Surcharge
  const fuelSurcharge = Math.round(adjustedBase * 0.08);

  // 16% Sales Tax (PRA/SRB)
  const salesTax = Math.round((adjustedBase + fuelSurcharge) * 0.16);

  // Total Freight
  const totalFreight = adjustedBase + fuelSurcharge + salesTax;

  return {
    distanceKm,
    tons,
    chargeableTons: tons,
    vehicleType,
    vehicleMultiplier: multiplier,
    baseFreight,
    baseFare: baseFreight,
    handlingSurcharge,
    fuelSurcharge,
    salesTax,
    taxAmount: salesTax,
    totalFreight,
    totalFare: totalFreight,
    formatted: {
      distance: `${distanceKm} km`,
      base: `Rs. ${baseFreight.toLocaleString()}`,
      fuel: `Rs. ${fuelSurcharge.toLocaleString()}`,
      tax: `Rs. ${salesTax.toLocaleString()}`,
      total: `Rs. ${totalFreight.toLocaleString()}`
    }
  };
};

export const stripCurrencyPrefix = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/^\s*(PKR|Rs\.?)\s*/i, '').trim();
};

export const formatFreightPrice = (val, fallback = 'Agreed / N/A') => {
  const cleaned = stripCurrencyPrefix(val);
  if (!cleaned) return fallback;
  return `Rs. ${cleaned}`;
};

export const stripWeightUnit = (val) => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\s*(metric\s*)?tons?$/i, '').trim();
};

export const parseWeightToKg = (raw, defaultIsTon = false) => {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return 0;
    if (defaultIsTon && raw <= 100) return Math.round(raw * 1000);
    return Math.round(raw);
  }

  const str = String(raw).trim().toLowerCase();
  if (!str) return 0;

  const match = str.match(/([\d,]+(?:\.\d+)?)/);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;

  if (str.includes('ton')) return Math.round(num * 1000);
  if (str.includes('maund') || str.includes('mann') || str.includes('من')) return Math.round(num * 40);
  if (str.includes('kg') || str.includes('kilo')) return Math.round(num);
  if (str.includes('quintal') || str.includes('qtl')) return Math.round(num * 100);
  if (str.includes('g') || str.includes('gram')) return Math.round(num / 1000);

  if (defaultIsTon && num <= 100) return Math.round(num * 1000);
  return Math.round(num);
};

export const formatWeightTons = (val, unitLabel = 'tons', fallback = '—') => {
  const cleaned = stripWeightUnit(val);
  if (!cleaned) return fallback;
  return `${cleaned} ${unitLabel}`;
};

/**
 * Direct Freight Bargaining Helpers & Dynamic Offer Presets
 */
export const BARGAIN_QUICK_INCREMENTS = [2000, 5000, 10000, 20000];

export const getQuickIncrements = (fare = 50000) => {
  const f = Number(fare) || 50000;
  if (f < 35000) {
    return [1000, 2000, 5000, 10000];
  }
  return [2000, 5000, 10000, 20000];
};

export const getBargainingPresets = (recommendedFareOrDistance = 50000, weightTons = null) => {
  let basePrice = 50000;
  if (weightTons !== null && weightTons !== undefined) {
    const dist = Number(recommendedFareOrDistance) || 350;
    const wt = Number(weightTons) || 5;
    basePrice = Math.max(8000, Math.round(dist * Math.max(0.5, wt) * 45 * 1.24));
  } else {
    basePrice = Math.max(5000, Number(recommendedFareOrDistance) || 50000);
  }

  const step = basePrice > 100000 ? 5000 : basePrice > 30000 ? 2000 : 1000;
  const p1 = Math.max(3000, Math.round((basePrice * 0.85) / step) * step);
  const p2 = Math.max(4000, Math.round((basePrice * 0.95) / step) * step);
  const p3 = Math.round(basePrice / step) * step;
  const p4 = Math.round((basePrice * 1.10) / step) * step;

  const set = new Set([p1, p2, p3, p4]);
  return Array.from(set).sort((a, b) => a - b);
};
