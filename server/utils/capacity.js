/**
 * Truck Capacity Calculation & Parsing Utility
 * Normalizes all weights to Kilograms (kg) for exact numeric calculation and validation.
 */

/**
 * Parses any weight/capacity value or string into numeric Kilograms (kg).
 * Supports Tons, Kg, Maund / Mann, Grams, and numeric presets.
 * 
 * @param {string|number} raw - The weight or capacity value (e.g. "25 Tons", "8000 kg", "15", 25000)
 * @param {boolean} defaultIsTon - If true and raw is a number <= 100 with no unit, treat as Tons (typical for truck presets).
 * @returns {number} Weight in Kilograms (rounded to 2 decimal places)
 */
function parseWeightToKg(raw, defaultIsTon = false) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return 0;
    if (defaultIsTon && raw <= 100) return Math.round(raw * 1000);
    return Math.round(raw);
  }

  const str = String(raw).trim().toLowerCase();
  if (!str) return 0;

  // Extract primary numeric value
  const match = str.match(/([\d,]+(?:\.\d+)?)/);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  if (isNaN(num)) return 0;

  if (str.includes('ton')) {
    return Math.round(num * 1000);
  }
  if (str.includes('maund') || str.includes('mann') || str.includes('من')) {
    return Math.round(num * 40);
  }
  if (str.includes('kg') || str.includes('kilo')) {
    return Math.round(num);
  }
  if (str.includes('quintal') || str.includes('qtl')) {
    return Math.round(num * 100);
  }
  if (str.includes('g') || str.includes('gram')) {
    return Math.round(num / 1000);
  }

  // If no unit is specified:
  if (defaultIsTon && num <= 100) {
    return Math.round(num * 1000);
  }
  return Math.round(num);
}

/**
 * Formats a weight in KG into clean, human-readable bilingual strings (e.g., "25,000 kg (25 Tons)")
 * 
 * @param {number} kg 
 * @returns {string}
 */
function formatWeightDisplay(kg) {
  const safeKg = Math.max(0, Math.round(kg || 0));
  if (safeKg >= 1000) {
    const tons = (safeKg / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 });
    return `${safeKg.toLocaleString('en-US')} kg (${tons} Tons)`;
  }
  return `${safeKg.toLocaleString('en-US')} kg`;
}

/**
 * Computes capacity metrics for a truck given its total capacity and list of active cargos/bookings.
 * 
 * @param {object} truck - Truck instance or plain object
 * @param {number|Array} activeCargosOrWeight - Either an already computed usedKg number or array of active cargos
 * @returns {object}
 */
function computeCapacityMetrics(truck, activeCargosOrWeight = 0) {
  // Determine total capacity in kg
  let totalKg = 0;
  if (truck.totalCapacity && Number(truck.totalCapacity) > 0) {
    totalKg = Math.round(Number(truck.totalCapacity));
  } else if (truck.total_capacity && Number(truck.total_capacity) > 0) {
    totalKg = Math.round(Number(truck.total_capacity));
  } else {
    totalKg = parseWeightToKg(truck.capacity, true);
  }

  // Fallback default: if truck has no capacity set, default to 15 Tons (15,000 kg)
  if (!totalKg || totalKg <= 0) {
    totalKg = 15000;
  }

  // Calculate used capacity in kg
  let usedKg = 0;
  if (typeof activeCargosOrWeight === 'number') {
    usedKg = Math.max(0, Math.round(activeCargosOrWeight));
  } else if (Array.isArray(activeCargosOrWeight)) {
    usedKg = activeCargosOrWeight.reduce((sum, c) => {
      const wt = parseWeightToKg(c.chargeableWeight || c.chargeable_weight || c.weight, false);
      return sum + wt;
    }, 0);
  }

  const remainingKg = Math.max(0, totalKg - usedKg);
  const fillPct = totalKg > 0 ? Math.min(100, Math.round((usedKg / totalKg) * 100)) : 0;

  let capacityStatus = 'available'; // Green
  if (fillPct >= 100 || remainingKg <= 0) {
    capacityStatus = 'full'; // Red
  } else if (fillPct >= 75) {
    capacityStatus = 'filling_up'; // Amber/Orange
  }

  return {
    total_capacity: totalKg,
    used_capacity: usedKg,
    remaining_capacity: remainingKg,
    fill_percentage: fillPct,
    capacity_status: capacityStatus,

    // camelCase aliases for modern JS
    totalCapacity: totalKg,
    usedCapacity: usedKg,
    remainingCapacity: remainingKg,
    fillPercentage: fillPct,
    capacityStatus: capacityStatus,

    // Formatted display strings
    total_capacity_display: formatWeightDisplay(totalKg),
    used_capacity_display: formatWeightDisplay(usedKg),
    remaining_capacity_display: formatWeightDisplay(remainingKg)
  };
}

module.exports = {
  parseWeightToKg,
  formatWeightDisplay,
  computeCapacityMetrics
};
