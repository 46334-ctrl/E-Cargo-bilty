import { useState, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { lostCargoAPI, resolveAssetUrl } from '../../api';
import {
  AlertTriangle,
  X,
  Camera,
  UploadCloud,
  FileText,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Truck
} from 'lucide-react';
import GpsMapPin from '../GpsMapPin';

const ISSUE_TYPES = [
  { value: 'Not Delivered', labelEn: 'Cargo Not Delivered', labelUr: 'کارگو ڈیلیور نہیں ہوا', desc: 'Consignment never arrived at destination terminal' },
  { value: 'Missing Items', labelEn: 'Missing Items / Shortage', labelUr: 'اشیاء کی کمی / گمشدگی', desc: 'Some packages or cartons are missing from the shipment' },
  { value: 'Lost in Transit', labelEn: 'Lost in Transit', labelUr: 'راستے میں گمشدگی', desc: 'Vehicle or cargo unaccounted for along highway transit' },
  { value: 'Damaged', labelEn: 'Cargo Damaged / Broken', labelUr: 'نقصان زدہ / ٹوٹا ہوا مال', desc: 'Goods arrived broken, crushed, or water-damaged' },
];

export default function ReportMissingCargoModal({ isOpen, onClose, cargo, onReportSuccess }) {
  const { isUrdu } = useLanguage();
  const { toast } = useToast();

  const [issueType, setIssueType] = useState('Lost in Transit');
  const [description, setDescription] = useState('');
  const [lastKnownLocation, setLastKnownLocation] = useState(cargo?.destination || '');
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen || !cargo) return null;

  const biltyNo = `BLT-${cargo.id}`;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(isUrdu ? 'صرف تصویری فائلیں قبول کی جاتی ہیں' : 'Please upload an image file (PNG, JPG, WEBP)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(isUrdu ? 'تصویر کا سائز 10MB سے کم ہونا چاہیے' : 'Image file size must be under 10MB');
      return;
    }

    setEvidenceFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleRemovePhoto = () => {
    setEvidenceFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!description.trim()) {
      setFormError(isUrdu ? 'برائے مہربانی واقعے کی مکمل تفصیل درج کریں' : 'Please provide a detailed description of what is missing or damaged');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('biltyId', String(cargo.id));
      formData.append('biltyNo', biltyNo);
      formData.append('issueType', issueType);
      formData.append('description', description.trim());
      formData.append('lastKnownLocation', lastKnownLocation.trim());
      if (evidenceFile) {
        formData.append('evidenceImage', evidenceFile);
      }

      const res = await lostCargoAPI.createReport(formData);

      toast.success(
        isUrdu 
          ? `گمشدہ کارگو رپورٹ #${res.data?.id || ''} کامیابی سے درج ہو گئی۔ ٹرانسپورٹر اور ایڈمن تفتیش کر رہے ہیں۔`
          : `Missing cargo report #${res.data?.id || ''} filed successfully. Admin & Transporter have been alerted.`
      );

      if (onReportSuccess) {
        onReportSuccess(res.data);
      }
      onClose();
    } catch (err) {
      console.error('Failed to report lost cargo:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to submit report. Please try again.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white dark:bg-[#0B1325] border-2 border-red-500/50 dark:border-red-500/40 rounded-2xl sm:rounded-3xl shadow-2xl text-slate-900 dark:text-slate-100 overflow-hidden my-auto modal-enter"
        dir={isUrdu ? 'rtl' : 'ltr'}
      >
        {/* Top High-Contrast Alert Header */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 sm:p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={22} className="text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>{isUrdu ? 'گمشدہ یا نقصان زدہ کارگو کی رپورٹ' : 'Report Missing / Damaged Cargo'}</span>
              </h3>
              <p className="text-xs text-red-100 font-mono">
                {biltyNo} &bull; {cargo.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Shipment Snapshot Banner */}
        <div className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Bilty #</span>
              <span className="font-mono font-bold text-red-600 dark:text-red-400">{biltyNo}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Route</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {cargo.origin} &rarr; {cargo.destination?.split(',')[0]}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Carrier / Truck</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {cargo.assignedTruck || cargo.truckPlate || 'Pending Dispatch'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Weight</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{cargo.weight || 'Standard'}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-left">
          {formError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Issue Type Select */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {isUrdu ? 'مسئلے کی نوعیت (Issue Type) *' : 'Incident Type *'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ISSUE_TYPES.map((t) => {
                const isSelected = issueType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setIssueType(t.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-red-500 bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200 ring-2 ring-red-500/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{isUrdu ? t.labelUr : t.labelEn}</span>
                      {isSelected && <CheckCircle2 size={14} className="text-red-600 dark:text-red-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{t.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Incident Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {isUrdu ? 'واقعے کی تفصیل (Detailed Explanation) *' : 'Description of Incident / Missing Items *'}
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isUrdu
                  ? 'تفصیل لکھیں: کون سے پارسل یا سامان غائب ہیں، کنٹینر کی حالت کیا تھی یا ڈرائیور نے کیا بتایا...'
                  : 'Specify which cartons/items are missing or damaged, seal condition, driver remarks, or where the cargo was last confirmed...'
              }
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          {/* Last Known Location */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              {isUrdu ? 'آخری معلوم مقام یا ٹرمینل (Last Known Location)' : 'Last Known Location / Checkpoint'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <GpsMapPin size={15} />
              </div>
              <input
                type="text"
                value={lastKnownLocation}
                onChange={(e) => setLastKnownLocation(e.target.value)}
                placeholder="e.g. Sukkur Toll Plaza, Lahore Cargo Adda, Multan Bypass"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* Evidence Photo Upload (Cloudinary Supported) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isUrdu ? 'ثبوت کے طور پر تصویر (Optional Photo Evidence)' : 'Evidence Photo (Cloudinary Upload)'}
              </label>
              <span className="text-[10px] text-slate-500 font-mono">JPG, PNG up to 10MB</span>
            </div>

            {previewUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-red-400 dark:border-red-500/50 bg-slate-100 dark:bg-slate-900 p-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={previewUrl}
                    alt="Evidence Preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {evidenceFile?.name || 'Evidence Photo'}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      ✓ Ready for Cloudinary secure storage
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-800 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/40"
              >
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <Camera size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isUrdu ? 'نقصان زدہ کارگو یا رسید کی تصویر اپلوڈ کریں' : 'Click or drop photo evidence of damage / shortage'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Uploads directly to Cloudinary secure storage with high-resolution thumbnail
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isUrdu ? 'منسوخ کریں' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-500 text-white shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{isUrdu ? 'رپورٹ بھیجی جا رہی ہے...' : 'Filing Report & Uploading...'}</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} />
                  <span>{isUrdu ? 'رپورٹ جمع کروائیں' : 'Submit Investigation Report'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

