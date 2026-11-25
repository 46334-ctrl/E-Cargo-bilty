import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Scale,
  DollarSign,
  AlertCircle,
  Loader2,
  FileText,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { convertToTons } from '../data/logisticsData';

/**
 * ItemizedReceivingModal
 * Allows Transporters to inspect each declared product item at the loading dock,
 * count actual received quantities, detect shortages, record official Shortage
 * Endorsements, and recalculate cargo weight and pro-rated freight.
 */
export default function ItemizedReceivingModal({
  isOpen,
  onClose,
  cargo,
  onConfirmVerification,
  isSubmitting = false,
  isUrdu = false
}) {
  const [items, setItems] = useState([]);
  const [shortageNote, setShortageNote] = useState('');
  const [shortageAction, setShortageAction] = useState('accept_with_endorsement'); // 'accept_with_endorsement' | 'reject_shortage'
  const [pickupOtp, setPickupOtp] = useState('');
  const [validationError, setValidationError] = useState('');

  // Initialize product items when cargo opens
  useEffect(() => {
    if (!cargo) return;

    let initialProducts = [];
    if (Array.isArray(cargo.products) && cargo.products.length > 0) {
      initialProducts = cargo.products.map((p, idx) => {
        const declared = Math.max(1, parseInt(p.qty || p.quantity) || 1);
        const received = p.receivedQty !== undefined ? Math.max(0, parseInt(p.receivedQty)) : declared;
        return {
          id: idx,
          name: p.name || p.title || `Item #${idx + 1}`,
          declaredQty: declared,
          receivedQty: received,
          unitWeight: parseFloat(p.unitWeight) || 0,
          weightUnit: p.weightUnit || 'ton',
          lengthCm: p.lengthCm || p.length,
          widthCm: p.widthCm || p.width,
          heightCm: p.heightCm || p.height,
          dimensionUnit: p.dimensionUnit || 'cm',
          type: p.type || 'General Cargo',
          condition: p.condition || (received < declared ? 'Short' : 'Intact'),
          note: p.note || ''
        };
      });
    } else {
      // Fallback single consignment item
      const parsedWeight = parseFloat(cargo.chargeableWeight || cargo.weight) || 1;
      initialProducts = [
        {
          id: 0,
          name: cargo.title || 'General Consignment',
          declaredQty: 1,
          receivedQty: 1,
          unitWeight: parsedWeight,
          weightUnit: 'ton',
          type: 'General Cargo',
          condition: 'Intact',
          note: ''
        }
      ];
    }

    setItems(initialProducts);
    setShortageNote(cargo.shortageNote || '');
    setShortageAction('accept_with_endorsement');
    setPickupOtp('');
    setValidationError('');
  }, [cargo, isOpen]);

  // Calculations
  const metrics = useMemo(() => {
    let totalDeclared = 0;
    let totalReceived = 0;
    let verifiedWeightTons = 0;
    let declaredWeightTons = 0;

    items.forEach(it => {
      const dec = Math.max(0, parseInt(it.declaredQty) || 0);
      const rec = Math.max(0, parseInt(it.receivedQty) || 0);
      totalDeclared += dec;
      totalReceived += rec;

      const unitTons = convertToTons(it.unitWeight, it.weightUnit || 'ton');
      declaredWeightTons += (dec * unitTons);
      verifiedWeightTons += (rec * unitTons);
    });

    const shortage = Math.max(0, totalDeclared - totalReceived);
    const hasShortage = shortage > 0;
    const isExcess = totalReceived > totalDeclared;

    // Pro-rated fare suggestion if shortage
    const baseTotalFare = Number(cargo?.totalFare || cargo?.baseFare || 0);
    const proRatedFare = (hasShortage && totalDeclared > 0 && baseTotalFare > 0)
      ? Math.max(1000, Math.round(baseTotalFare * (totalReceived / totalDeclared)))
      : baseTotalFare;

    return {
      totalDeclared,
      totalReceived,
      shortage,
      hasShortage,
      isExcess,
      verifiedWeightTons: Math.max(0.01, verifiedWeightTons),
      declaredWeightTons: Math.max(0.01, declaredWeightTons),
      proRatedFare
    };
  }, [items, cargo]);

  if (!isOpen || !cargo) return null;

  const handleQtyChange = (idx, val) => {
    setValidationError('');
    setItems(prev => {
      const copy = [...prev];
      const sanitized = typeof val === 'string' ? val.replace(/-/g, '').replace(/[eE]/g, '') : val;
      const num = sanitized === '' ? 0 : Math.max(0, parseInt(sanitized) || 0);
      copy[idx] = {
        ...copy[idx],
        receivedQty: num,
        condition: num < copy[idx].declaredQty ? 'Short' : 'Intact'
      };
      return copy;
    });
  };

  const handleSetAll = (idx) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        receivedQty: copy[idx].declaredQty,
        condition: 'Intact'
      };
      return copy;
    });
  };

  const handleAdjustQty = (idx, delta) => {
    setValidationError('');
    setItems(prev => {
      const copy = [...prev];
      const cur = copy[idx].receivedQty || 0;
      const next = Math.max(0, cur + delta);
      copy[idx] = {
        ...copy[idx],
        receivedQty: next,
        condition: next < copy[idx].declaredQty ? 'Short' : 'Intact'
      };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (metrics.totalReceived === 0 && shortageAction !== 'reject_shortage') {
      setValidationError(
        isUrdu
          ? 'کل وصول شدہ اشیاء 0 نہیں ہو سکتیں۔ اگر پورا مال غائب ہے تو مال مسترد کریں۔'
          : 'Total received quantity cannot be 0. If entire cargo is missing, choose "Reject Consignment".'
      );
      return;
    }

    if (metrics.hasShortage && shortageAction === 'accept_with_endorsement' && !shortageNote.trim()) {
      setValidationError(
        isUrdu
          ? 'کمی / شارٹیج کی صورت میں ڈاک پر کی گئی تصدیق کی وجہ / تفصیل درج کرنا لازمی ہے۔'
          : 'A shortage discrepancy statement is required for carrier legal protection.'
      );
      return;
    }

    if (shortageAction !== 'reject_shortage') {
      const trimmedOtp = pickupOtp.trim();
      if (!trimmedOtp || trimmedOtp.length !== 4 || !/^\d{4}$/.test(trimmedOtp)) {
        setValidationError(
          isUrdu
            ? '4 ہندسوں کا شِپر ہینڈ اوور او ٹی پی (OTP) درج کرنا لازمی ہے۔'
            : '4-digit Shipper Handover OTP is required to confirm physical receiving.'
        );
        return;
      }
    }

    const payload = {
      pickupOtp: pickupOtp.trim(),
      status: shortageAction === 'reject_shortage' ? 'Rejected' : 'Accepted',
      rejectionReason: shortageAction === 'reject_shortage'
        ? (shortageNote.trim() || `Rejected due to cargo shortage: ${metrics.shortage} items missing.`)
        : undefined,
      hasShortage: metrics.hasShortage,
      shortageNote: metrics.hasShortage ? shortageNote.trim() : null,
      receivingVerification: {
        verifiedAt: new Date().toISOString(),
        totalDeclaredQty: metrics.totalDeclared,
        totalReceivedQty: metrics.totalReceived,
        totalShortageQty: metrics.shortage,
        hasShortage: metrics.hasShortage,
        shortageAction,
        shortageNote: shortageNote.trim(),
        declaredWeightTons: Number(metrics.declaredWeightTons.toFixed(2)),
        verifiedWeightTons: Number(metrics.verifiedWeightTons.toFixed(2)),
        items: items.map(it => ({
          name: it.name,
          declaredQty: it.declaredQty,
          receivedQty: it.receivedQty,
          shortageQty: Math.max(0, it.declaredQty - it.receivedQty),
          condition: it.condition,
          unitWeight: it.unitWeight,
          weightUnit: it.weightUnit
        }))
      },
      products: items.map(it => ({
        ...it,
        qty: it.receivedQty, // verified active count
        declaredQty: it.declaredQty,
        shortageQty: Math.max(0, it.declaredQty - it.receivedQty)
      })),
      chargeableWeight: `${metrics.verifiedWeightTons.toFixed(2)} Tons`,
      weight: `${metrics.verifiedWeightTons.toFixed(2)} Tons`,
      fareStatus: 'Agreed'
    };

    if (onConfirmVerification) {
      await onConfirmVerification(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-[#0B1325] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl text-left overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-500/40 text-orange-700 dark:text-orange-300 flex items-center justify-center shrink-0 shadow-2xs">
              <ClipboardCheck size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {isUrdu ? 'اشیاء کی گنتی اور کمی (Shortage) کی تصدیق' : 'Itemized Receiving & Shortage Verification'}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 shrink-0">
                  REQ-{cargo.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {isUrdu
                  ? `ڈاک پر موصول ہونے والے سامان کی تصدیق کریں تاکہ آپ کو منزل پر غائب سامان کا ذمہ دار نہ ٹھہرایا جائے`
                  : `Count received units at loading dock to protect against transit loss liabilities`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-slate-800 dark:text-slate-200">
          
          {/* Consignment summary pill */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Consignment</span>
              <p className="font-bold text-slate-900 dark:text-white truncate text-sm mt-0.5">{cargo.title}</p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] font-mono mt-0.5">
                From: <strong className="text-slate-800 dark:text-slate-200">{cargo.businessOwnerName || 'Shipper'}</strong> &middot; {cargo.origin} &rarr; {cargo.destination}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Agreed Freight</span>
              <p className="font-bold font-mono text-emerald-700 dark:text-emerald-400 text-sm mt-0.5">
                Rs. {Number(cargo.totalFare || cargo.baseFare || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Verification Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Package size={14} className="text-orange-600" />
                <span>{isUrdu ? 'اشیاء کی فہرست اور تعداد کی تصدیق:' : 'Itemized Product Count at Loading Dock:'}</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {items.length} {items.length === 1 ? 'Product Line' : 'Product Lines'}
              </span>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => {
                const isShort = it.receivedQty < it.declaredQty;
                const isComplete = it.receivedQty === it.declaredQty;
                const diff = it.declaredQty - it.receivedQty;

                return (
                  <div
                    key={it.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isShort
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Product details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{it.name}</h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {it.type}
                          </span>
                          {isShort ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-mono">
                              ⚠️ Shortage (-{diff})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono">
                              ✓ Full ({it.declaredQty}/{it.declaredQty})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          Declared: <strong className="text-slate-800 dark:text-slate-200">{it.declaredQty} units</strong>
                          {it.unitWeight > 0 && ` · ${it.unitWeight} ${it.weightUnit}/unit`}
                          {it.lengthCm && ` · ${it.lengthCm}x${it.widthCm}x${it.heightCm} ${it.dimensionUnit}`}
                        </p>
                      </div>

                      {/* Right: Actual Received Counter & Quick Controls */}
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleAdjustQty(idx, -1)}
                            className="px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer select-none"
                            title="Subtract 1"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            onKeyDown={(e) => {
                              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                            }}
                            value={it.receivedQty}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            aria-label={`Received count for ${it.name}`}
                            className="w-16 text-center py-1.5 text-xs sm:text-sm font-mono font-bold bg-transparent text-slate-900 dark:text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAdjustQty(idx, 1)}
                            className="px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer select-none"
                            title="Add 1"
                          >
                            +
                          </button>
                        </div>

                        {/* Reset to Declared Button */}
                        <button
                          type="button"
                          onClick={() => handleSetAll(idx)}
                          className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                            isComplete
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                              : 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-100'
                          }`}
                          title="Set to full declared count"
                        >
                          All ({it.declaredQty})
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discrepancy & Verification Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Declared Items</span>
              <p className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-0.5">
                {metrics.totalDeclared} units
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${
              metrics.hasShortage
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
            }`}>
              <span className="text-[10px] uppercase font-bold block">Received Items</span>
              <p className="font-mono font-bold text-sm sm:text-base mt-0.5">
                {metrics.totalReceived} units
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${
              metrics.hasShortage
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'
                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              <span className="text-[10px] uppercase font-bold block">Shortage</span>
              <p className="font-mono font-bold text-sm sm:text-base mt-0.5">
                {metrics.hasShortage ? `-${metrics.shortage} missing` : '0 missing'}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Verified Weight</span>
              <p className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-0.5">
                {metrics.verifiedWeightTons.toFixed(2)} Tons
              </p>
            </div>
          </div>

          {/* Conditional Alert: Shortage Discrepancy Found */}
          {metrics.hasShortage ? (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-500/70 p-4 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-amber-900 dark:text-amber-200 text-sm">
                    {isUrdu ? '⚠️ اشیاء کی کمی (Shortage) ریکارڈ کی جا رہی ہے' : '⚠️ Shortage Discrepancy Detected'}
                  </h4>
                  <p className="text-xs text-amber-950 dark:text-amber-100 mt-1 leading-relaxed">
                    {isUrdu
                      ? `گاہک نے ${metrics.totalDeclared} اشیاء کا اعلان کیا تھا لیکن ڈاک پر صرف ${metrics.totalReceived} اشیاء موصول ہوئیں (${metrics.shortage} اشیاء کم ہیں)۔ ای-بلٹی پر یہ کمی درج کی جائے گی تاکہ منزل پر آپ کو نقصان کا ذمہ دار نہ ٹھہرایا جا سکے۔`
                      : `Consignor declared ${metrics.totalDeclared} packages, but only ${metrics.totalReceived} were counted at the dock (${metrics.shortage} units missing). An official Shortage Endorsement will be recorded on the e-Bilty.`}
                  </p>
                </div>
              </div>

              {/* Shortage Action Radio Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2 transition-all ${
                  shortageAction === 'accept_with_endorsement'
                    ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-400/30'
                    : 'bg-amber-100/50 dark:bg-slate-800/40 border-amber-200 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="shortageAction"
                    value="accept_with_endorsement"
                    checked={shortageAction === 'accept_with_endorsement'}
                    onChange={() => setShortageAction('accept_with_endorsement')}
                    className="mt-0.5 text-orange-600"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {isUrdu ? 'کمی کی تصدیق کے ساتھ قبول کریں' : 'Accept with Shortage Endorsement'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Issue e-Bilty for verified {metrics.totalReceived} units. Carrier protected from shortage claim.
                    </p>
                  </div>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2 transition-all ${
                  shortageAction === 'reject_shortage'
                    ? 'bg-white dark:bg-slate-900 border-red-500 ring-2 ring-red-400/30'
                    : 'bg-amber-100/50 dark:bg-slate-800/40 border-amber-200 dark:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="shortageAction"
                    value="reject_shortage"
                    checked={shortageAction === 'reject_shortage'}
                    onChange={() => setShortageAction('reject_shortage')}
                    className="mt-0.5 text-red-600"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-red-700 dark:text-red-400">
                      {isUrdu ? 'سامان مسترد کریں (Reject)' : 'Reject Consignment'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Decline shipment until business owner recounts and sends full quantity.
                    </p>
                  </div>
                </label>
              </div>

              {/* Mandatory Shortage Statement Textarea */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-950 dark:text-amber-200">
                  {isUrdu ? 'ڈاک پر کمی کی تفصیل / ریمارکس (لازمی) *' : 'Dock Inspection Discrepancy Statement (Required) *'}
                </label>
                <textarea
                  rows={2}
                  value={shortageNote}
                  onChange={(e) => setShortageNote(e.target.value)}
                  placeholder={
                    isUrdu
                      ? 'مثلاً: گودام پر وصولی کے وقت صرف 85 کارٹن موصول ہوئے۔ 15 کارٹن لوڈنگ کے وقت کم پائے گئے۔ ڈرائیور نے گنتی کی تصدیق کی۔'
                      : 'e.g. Counted at origin terminal dock. Shipper provided only 85 cartons out of 100 declared. 15 cartons short at loading. Driver endorsed count.'
                  }
                  className="w-full p-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/50 p-3.5 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {isUrdu
                  ? `تمام ${metrics.totalDeclared} اشیاء مکمل اور درست حالت میں وصول کرلی گئیں۔ کوئی شارٹیج نہیں پائی گئی۔`
                  : `All ${metrics.totalDeclared} declared items counted and verified intact. No shortages detected.`}
              </span>
            </div>
          )}

          {/* Shipper Handover OTP (Warehouse Gate-Pass Code) Verification Input */}
          {shortageAction !== 'reject_shortage' && (
            <div className="bg-gradient-to-r from-orange-50/90 to-amber-50/90 dark:from-orange-950/40 dark:to-amber-950/30 border-2 border-orange-400 dark:border-orange-500/60 p-4 rounded-2xl space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200/80 dark:border-orange-500/30 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-[#EA580C] shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {isUrdu ? 'شِپر ہینڈ اوور او ٹی پی (گودام گیٹ پاس کوڈ) *' : 'Shipper Handover OTP (Warehouse Gate-Pass Code) *'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-orange-800 dark:text-orange-200 font-bold bg-orange-100 dark:bg-orange-900/60 px-2.5 py-0.5 rounded-full border border-orange-300 dark:border-orange-700">
                  {isUrdu ? '4 ہندسوں کا کوڈ' : '4-Digit Code'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isUrdu
                  ? 'یہ 4 ہندسوں کا خفیہ کوڈ فیکٹری یا گودام مینیجر سے حاصل کریں جب تمام سامان ٹرک پر لوڈ اور گن لیا جائے۔'
                  : 'Obtain this 4-digit code from the factory/warehouse manager once all items are physically verified and loaded.'}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <div className="relative max-w-[200px]">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pickupOtp}
                    onChange={(e) => {
                      setValidationError('');
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPickupOtp(val);
                    }}
                    placeholder="••••"
                    className="w-full text-center tracking-[0.5em] font-mono font-black text-2xl py-2 px-3 rounded-xl border-2 border-orange-400 dark:border-orange-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-300 dark:focus:ring-orange-800 transition-all shadow-inner"
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pickupOtp.length === 4 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> {isUrdu ? '4 ہندسے درج ہو گئے' : 'Ready to authenticate'}
                    </span>
                  ) : (
                    isUrdu ? 'برائے مہربانی 4 ہندسے درج کریں' : 'Enter 4 digits provided by shipper at loading bay'
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="btn-outline px-4 py-2.5 text-xs font-bold rounded-xl cursor-pointer"
            >
              {isUrdu ? 'منسوخ' : 'Cancel'}
            </button>

            {metrics.hasShortage && shortageAction === 'reject_shortage' ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
                <span>{isUrdu ? 'کمی کی وجہ سے مال مسترد کریں' : `Reject Consignment (${metrics.shortage} items short)`}</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-5 py-2.5 text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>
                  {metrics.hasShortage
                    ? (isUrdu ? `شارٹیج کے اندراج کے ساتھ قبول کریں (${metrics.totalReceived} اشیاء)` : `Confirm & Accept with Shortage (${metrics.totalReceived} units)`)
                    : (isUrdu ? `مکمل گنتی کی توثیق کے ساتھ قبول کریں (${metrics.totalReceived} اشیاء)` : `Confirm & Accept Full Receipt (${metrics.totalReceived} units)`)}
                </span>
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
