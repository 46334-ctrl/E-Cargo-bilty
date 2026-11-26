import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { lostCargoAPI, resolveAssetUrl, socket } from '../../api';
import {
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  MapPin,
  User,
  FileText,
  Camera,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Send,
  Loader2,
  RefreshCw,
  X,
  Maximize2,
  Phone,
  Mail,
  Building,
  CheckCircle,
  Info,
  Package
} from 'lucide-react';
import GpsMapPin from '../GpsMapPin';

const STATUS_OPTIONS = ['Reported', 'Under Investigation', 'Located', 'Resolved', 'Closed'];

export default function LostCargoPortal({ userRole = 'admin', currentUserId = null }) {
  const { isUrdu } = useLanguage();
  const { toast } = useToast();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');

  // Active detail view modal
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Update action form state
  const [newStatus, setNewStatus] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newResolutionNotes, setNewResolutionNotes] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [investigationImageFile, setInvestigationImageFile] = useState(null);
  const [investigationImagePreview, setInvestigationImagePreview] = useState(null);

  // Full-screen image preview modal
  const [fullImagePreview, setFullImagePreview] = useState(null);

  // Fetch reports list
  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await lostCargoAPI.getReports({
        status: statusFilter,
        issueType: issueTypeFilter
      });
      setReports(res.data || []);
    } catch (err) {
      console.error('Failed to load lost cargo reports:', err);
      toast.error(isUrdu ? 'گمشدہ کارگو رپورٹس لوڈ کرنے میں ناکامی ہوئی' : 'Failed to fetch lost cargo reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [statusFilter, issueTypeFilter]);

  // Listen to socket updates for real-time live synchronization
  useEffect(() => {
    const onCreated = (data) => {
      fetchReports();
      toast.info(`🚨 New Missing Cargo Report filed: ${data.biltyNo} (${data.issueType})`);
    };
    const onUpdated = (data) => {
      fetchReports();
      if (selectedReportId && Number(selectedReportId) === Number(data.reportId)) {
        openReportDetail(data.reportId);
      }
    };

    socket.on('lost_cargo_created', onCreated);
    socket.on('lost_cargo_updated', onUpdated);

    return () => {
      socket.off('lost_cargo_created', onCreated);
      socket.off('lost_cargo_updated', onUpdated);
    };
  }, [selectedReportId]);

  // Open single report detail
  const openReportDetail = async (id) => {
    try {
      setSelectedReportId(id);
      setLoadingDetail(true);
      const res = await lostCargoAPI.getReportById(id);
      setReportDetail(res.data);
      setNewStatus(res.data.status || 'Reported');
      setNewLocation(res.data.lastKnownLocation || '');
      setNewResolutionNotes(res.data.resolutionNotes || '');
      setActionNote('');
      setInvestigationImageFile(null);
      setInvestigationImagePreview(null);
    } catch (err) {
      console.error('Failed to load report detail:', err);
      toast.error('Failed to load detailed investigation data');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleInvestigationImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.warning(isUrdu ? 'برائے مہربانی درست تصویر کا انتخاب کریں' : 'Please select a valid image file');
        return;
      }
      setInvestigationImageFile(file);
      const url = URL.createObjectURL(file);
      setInvestigationImagePreview(url);
    }
  };

  const handleClearInvestigationImage = () => {
    setInvestigationImageFile(null);
    if (investigationImagePreview) {
      URL.revokeObjectURL(investigationImagePreview);
      setInvestigationImagePreview(null);
    }
  };

  const handleUpdateReport = async (e) => {
    e.preventDefault();
    if (!selectedReportId) return;

    if (!actionNote.trim() && newStatus === reportDetail?.status && !investigationImageFile) {
      toast.warning(isUrdu ? 'برائے مہربانی تفتیشی نوٹ درج کریں یا اسٹیٹس تبدیل کریں' : 'Please provide an investigation note or update the status');
      return;
    }

    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      formData.append('lastKnownLocation', newLocation || '');
      formData.append('resolutionNotes', newResolutionNotes || '');
      formData.append('actionNote', actionNote.trim() || (investigationImageFile ? 'Investigation photo evidence uploaded' : 'Investigation status updated'));
      if (investigationImageFile) {
        formData.append('evidenceImage', investigationImageFile);
      }

      const res = await lostCargoAPI.updateReport(selectedReportId, formData);

      toast.success(isUrdu ? 'تفتیش کا ریکارڈ اپڈیٹ ہو گیا ہے' : 'Investigation status updated successfully');
      setReportDetail(res.data);
      setActionNote('');
      handleClearInvestigationImage();
      fetchReports();
    } catch (err) {
      console.error('Failed to update report:', err);
      toast.error(err.response?.data?.message || 'Failed to update investigation report');
    } finally {
      setIsUpdating(false);
    }
  };

  // KPI calculations
  const stats = useMemo(() => {
    const total = reports.length;
    const active = reports.filter(r => r.status === 'Reported' || r.status === 'Under Investigation').length;
    const located = reports.filter(r => r.status === 'Located' || r.status === 'Resolved').length;
    const closed = reports.filter(r => r.status === 'Closed').length;
    return { total, active, located, closed };
  }, [reports]);

  // Client-side search filtering
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.trim().toLowerCase();
    return reports.filter(r => {
      const bNo = `blt-${r.biltyId}`.toLowerCase();
      const title = (r.bilty?.title || '').toLowerCase();
      const sender = (r.reportedBy?.name || r.reportedBy?.businessName || '').toLowerCase();
      const transporter = (r.transporter?.name || r.transporter?.businessName || '').toLowerCase();
      const orig = (r.bilty?.origin || '').toLowerCase();
      const dest = (r.bilty?.destination || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      return bNo.includes(q) || title.includes(q) || sender.includes(q) || transporter.includes(q) || orig.includes(q) || dest.includes(q) || desc.includes(q);
    });
  }, [reports, searchQuery]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Reported':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/60';
      case 'Under Investigation':
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700/60';
      case 'Located':
        return 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-700/60';
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700/60';
      case 'Closed':
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getIssueBadge = (type) => {
    switch (type) {
      case 'Damaged':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
      case 'Lost in Transit':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800';
      case 'Missing Items':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
      case 'Not Delivered':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-white" dir={isUrdu ? 'rtl' : 'ltr'}>
      {/* Header & Context Title */}
      <div className="bg-white dark:bg-[#0B1325] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 flex items-center justify-center shrink-0">
            <AlertTriangle size={26} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>{isUrdu ? 'گمشدہ اور نقصان زدہ کارگو پورٹل' : 'Lost & Missing Cargo Tracking Portal'}</span>
              <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                {userRole === 'admin' ? 'ADMIN DISPATCH' : userRole === 'transporter' ? 'CARRIER FLEET' : 'SHIPPER TRACK'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {isUrdu
                ? 'گمشدہ یا نقصان زدہ ترسیلات کی مکمل تفتیش، فوٹو ثبوت اور لائف سائیکل ٹریسنگ۔'
                : 'Full lifecycle investigation, Cloudinary photo evidence, and end-to-end tracing for unresolved shipments.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{isUrdu ? 'ریفریش کریں' : 'Refresh Records'}</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0B1325] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Cases</p>
          <p className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">{stats.total}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">All recorded incidents</span>
        </div>
        <div className="bg-white dark:bg-[#0B1325] border border-amber-300 dark:border-amber-800/60 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Active Inquiries</p>
          <p className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">{stats.active}</p>
          <span className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-1 block">Reported & Under Investigation</span>
        </div>
        <div className="bg-white dark:bg-[#0B1325] border border-teal-300 dark:border-teal-800/60 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Located / Recovered</p>
          <p className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400 mt-1">{stats.located}</p>
          <span className="text-[10px] text-teal-600 dark:text-teal-400/80 mt-1 block">Found & Resolved shipments</span>
        </div>
        <div className="bg-white dark:bg-[#0B1325] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Closed Files</p>
          <p className="text-2xl sm:text-3xl font-black font-mono text-slate-700 dark:text-slate-300 mt-1">{stats.closed}</p>
          <span className="text-[10px] text-slate-500 mt-1 block">Insurance / finalized claims</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0B1325] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isUrdu
                ? 'بلٹی نمبر، گاہک، ٹرانسپورٹر، یا منزل سے تلاش کریں...'
                : 'Search by Bilty #, Sender, Transporter, Route, or Notes...'
            }
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
            <Filter size={13} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
            <select
              value={issueTypeFilter}
              onChange={(e) => setIssueTypeFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="all">All Issue Types</option>
              <option value="Not Delivered">Not Delivered</option>
              <option value="Missing Items">Missing Items</option>
              <option value="Lost in Transit">Lost in Transit</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Reports Table View */}
      <div className="bg-white dark:bg-[#0B1325] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={28} className="animate-spin text-red-500" />
            <p className="text-xs font-semibold">Loading missing cargo investigations...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={24} />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Lost Cargo Cases Reported</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              All dispatches in the network are currently accounted for with no open tracer flags.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Case #</th>
                  <th className="py-3 px-4">Bilty Ref</th>
                  <th className="py-3 px-4">Sender &bull; Receiver</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Incident Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Evidence</th>
                  <th className="py-3 px-4">Reported</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredReports.map((r) => {
                  const biltyNo = `BLT-${r.biltyId}`;
                  const senderName = r.reportedBy?.businessName || r.reportedBy?.name || 'Shipper';
                  const recipients = Array.isArray(r.bilty?.recipients) ? r.bilty.recipients : [];
                  const receiverName = recipients[0]?.name || r.bilty?.destination?.split(',')[0] || 'Receiver';

                  return (
                    <tr 
                      key={r.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        #RPT-{r.id}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-600 dark:text-red-400">
                        {biltyNo}
                      </td>
                      <td className="py-3 px-4">
                        <div className="max-w-[170px] truncate">
                          <span className="font-semibold text-slate-900 dark:text-white block truncate">{senderName}</span>
                          <span className="text-[10px] text-slate-500 truncate block">&rarr; {receiverName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.bilty?.origin || 'Origin'}
                        </span>
                        <span className="text-slate-400 mx-1">&rarr;</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {r.bilty?.destination?.split(',')[0] || 'Destination'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getIssueBadge(r.issueType)}`}>
                          {r.issueType}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.evidenceImageUrl ? (
                          <button
                            type="button"
                            onClick={() => setFullImagePreview(resolveAssetUrl(r.evidenceImageUrl))}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          >
                            <Camera size={13} />
                            <span>Photo (1)</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {(r.createdAt || r.created_at) ? new Date(r.createdAt || r.created_at).toLocaleDateString() : 'Recent'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openReportDetail(r.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-red-600 dark:hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                        >
                          {userRole === 'business' ? 'View Details' : 'Investigate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Case Investigation & Traceability Detail Drawer / Modal */}
      {selectedReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div 
            className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0B1325] border-2 border-slate-300 dark:border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden modal-enter"
            dir={isUrdu ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-500 text-red-400 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>Incident Tracer: #RPT-{selectedReportId}</span>
                    <span className="font-mono text-xs text-red-400">
                      (Bilty #BLT-{reportDetail?.biltyId})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comprehensive Freight Lifecycle & Investigation Dossier
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReportId(null);
                  setReportDetail(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {loadingDetail || !reportDetail ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 size={32} className="animate-spin text-red-500" />
                <p className="text-xs font-semibold text-slate-500">Querying joined shipment traceability...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-left">
                {/* 1. Status & Issue Banner */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(reportDetail.status)}`}>
                      {reportDetail.status}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getIssueBadge(reportDetail.issueType)}`}>
                      {reportDetail.issueType}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Filed on {(reportDetail.createdAt || reportDetail.created_at) ? new Date(reportDetail.createdAt || reportDetail.created_at).toLocaleString() : 'Recent'}
                  </div>
                </div>

                {/* 2. Shipment Snapshot & Cargo Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Origin to Destination Route & Cargo specs */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Package size={15} className="text-orange-600" />
                      <span>Shipment Snapshot</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Title / Commodity:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{reportDetail.bilty?.title || 'Commercial Freight'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Declared Weight:</span>
                        <span className="font-mono font-bold">{reportDetail.bilty?.weight || 'Standard'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Route:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {reportDetail.bilty?.origin} &rarr; {reportDetail.bilty?.destination}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Declared Value:</span>
                        <span className="font-mono">{reportDetail.bilty?.declaredValue ? `Rs. ${reportDetail.bilty.declaredValue}` : 'Standard Tariff'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Packaging Type:</span>
                        <span className="font-medium">{reportDetail.bilty?.packagingType || 'Cartons / Wooden Crates'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Truck & Driver Info */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Truck size={15} className="text-orange-600" />
                      <span>Carrier &amp; Assigned Vehicle</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Assigned Truck:</span>
                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                          {reportDetail.truckDriverInfo?.plateNumber || reportDetail.bilty?.assignedTruck || 'Pending Fleet Assignment'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Driver Name:</span>
                        <span className="font-semibold">{reportDetail.truckDriverInfo?.driverName || 'Designated Fleet Operator'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Driver Mobile:</span>
                        <span className="font-mono">{reportDetail.truckDriverInfo?.driverMobile || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                        <span className="text-slate-500">Responsible Transporter:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {reportDetail.transporter?.businessName || reportDetail.transporter?.name || 'Assigned Logistics Company'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Transporter Contact:</span>
                        <span className="font-mono">{reportDetail.transporter?.phone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Parties Involved (Sender & Receiver) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Shipper (Claimant)
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {reportDetail.reportedBy?.businessName || reportDetail.reportedBy?.name || 'Customer'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      Phone: <span className="font-mono">{reportDetail.reportedBy?.phone || 'N/A'}</span> &bull; Email: <span className="font-mono">{reportDetail.reportedBy?.email}</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Consignee / Recipient Adda
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {reportDetail.bilty?.recipients?.[0]?.name || reportDetail.bilty?.destination || 'Consignee'}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      Destination: <span className="font-medium">{reportDetail.bilty?.destination}</span>
                    </p>
                  </div>
                </div>

                {/* 4. Incident Details & Photo Evidence */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Incident Description &amp; Photo Evidence
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                    {reportDetail.description}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <GpsMapPin size={14} className="text-red-500" />
                      <span>Last Confirmed Checkpoint: <strong className="text-slate-900 dark:text-white">{reportDetail.lastKnownLocation || 'Unknown'}</strong></span>
                    </div>
                  </div>

                  {/* Photo Evidence View */}
                  {reportDetail.evidenceImageUrl && (
                    <div className="pt-2">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Attached Photo Evidence (Cloudinary Stored)
                      </span>
                      <div className="relative inline-block group">
                        <img
                          src={resolveAssetUrl(reportDetail.evidenceImageUrl)}
                          alt="Incident Evidence"
                          className="w-36 h-36 object-cover rounded-xl border-2 border-red-300 dark:border-red-800 shadow-md cursor-pointer group-hover:opacity-90 transition-opacity"
                          onClick={() => setFullImagePreview(resolveAssetUrl(reportDetail.evidenceImageUrl))}
                        />
                        <button
                          type="button"
                          onClick={() => setFullImagePreview(resolveAssetUrl(reportDetail.evidenceImageUrl))}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-950/80 text-white hover:bg-black transition-colors cursor-pointer"
                          title="Open Full Image"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Investigation Timeline / Audit Logs */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Investigation Timeline &amp; Action Log</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {reportDetail.logs?.length || 0} event(s) logged
                    </span>
                  </h4>

                  <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-4">
                    {reportDetail.logs?.map((log, index) => (
                      <div key={log.id || index} className="relative text-xs">
                        {/* Dot indicator */}
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-white dark:ring-[#0B1325]" />
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] mb-0.5">
                          <span className="font-bold text-slate-900 dark:text-white capitalize">
                            {log.updater?.name || log.role} &bull; <span className="uppercase text-[10px] text-orange-600 dark:text-orange-400">{log.role}</span>
                          </span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            {(log.createdAt || log.created_at) ? new Date(log.createdAt || log.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">{log.actionNote}</p>
                        {(log.evidenceImageUrl || log.evidence_image_url) && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              <Camera size={11} className="text-orange-500" />
                              <span>{isUrdu ? 'منسلک تفتیشی تصویر' : 'Attached Photo Evidence'}</span>
                            </div>
                            <div className="relative inline-block group">
                              <img
                                src={resolveAssetUrl(log.evidenceImageUrl || log.evidence_image_url)}
                                alt="Log Evidence"
                                className="w-28 h-20 sm:w-36 sm:h-24 object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer group-hover:opacity-90 transition-opacity"
                                onClick={() => setFullImagePreview(resolveAssetUrl(log.evidenceImageUrl || log.evidence_image_url))}
                              />
                              <button
                                type="button"
                                onClick={() => setFullImagePreview(resolveAssetUrl(log.evidenceImageUrl || log.evidence_image_url))}
                                className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-black/70 text-white hover:bg-black transition-colors cursor-pointer"
                                title="Open Full Image"
                              >
                                <Maximize2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                        {log.statusChangedTo && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Status: {log.statusChangedTo}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Admin & Transporter Investigation Action Panel */}
                {(userRole === 'admin' || userRole === 'transporter') && (
                  <form onSubmit={handleUpdateReport} className="bg-gradient-to-r from-red-500/[0.04] to-orange-500/[0.04] border-2 border-red-500/30 dark:border-red-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={18} className="text-red-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        {userRole === 'admin' ? 'Admin Action & Case Resolution' : 'Transporter Investigation Update'}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                          Update Status *
                        </label>
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold outline-none focus:border-red-500"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                          Last Known Checkpoint / Location
                        </label>
                        <input
                          type="text"
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="e.g. Lahore Thokar Adda, In Transit M-5 Highway"
                          className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-red-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                        Investigation Action / Operational Remark *
                      </label>
                      <input
                        type="text"
                        required={!investigationImageFile}
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                        placeholder="e.g. Contacted driver, verified weighbridge CCTV, cargo located in Sukkur terminal warehouse..."
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-red-500 text-xs"
                      />
                    </div>

                    {/* Investigation Photo Evidence Upload */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Camera size={13} className="text-orange-500" />
                          <span>{isUrdu ? 'تفتیشی تصویر / ثبوت اپلوڈ کریں (اختیاری)' : 'Upload Investigation Photo Evidence (Optional)'}</span>
                        </label>
                        {investigationImageFile && (
                          <button
                            type="button"
                            onClick={handleClearInvestigationImage}
                            className="text-[10px] text-red-600 hover:text-red-700 font-bold cursor-pointer"
                          >
                            {isUrdu ? 'تصویر ہٹائیں' : 'Remove Image'}
                          </button>
                        )}
                      </div>

                      {!investigationImagePreview ? (
                        <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 dark:hover:border-orange-500 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-center gap-2 cursor-pointer bg-white/60 dark:bg-slate-900/60 hover:bg-orange-500/5 transition-all group text-center sm:text-left">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Camera size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {isUrdu ? 'تصویر منتخب کریں یا کیمرے سے لیں' : 'Click to upload photo evidence (or capture on mobile)'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {isUrdu ? 'سی سی ٹی وی کی تصویر، کانٹا پرچی، برآمد شدہ مال یا چیک پوائنٹ رسید' : 'Supports CCTV snapshot, weighbridge slip, terminal receipt, or recovered cargo photo (JPG, PNG)'}
                            </p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleInvestigationImageChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
                          <div className="relative group shrink-0">
                            <img
                              src={investigationImagePreview}
                              alt="Investigation Preview"
                              className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                              onClick={() => setFullImagePreview(investigationImagePreview)}
                            />
                            <span 
                              onClick={() => setFullImagePreview(investigationImagePreview)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white rounded-lg transition-opacity cursor-pointer"
                              title="Enlarge preview"
                            >
                              <Maximize2 size={13} />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 text-xs">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {investigationImageFile?.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {(investigationImageFile?.size / 1024).toFixed(1)} KB &bull; <span className="text-emerald-600 font-bold">{isUrdu ? 'اپلوڈ کے لیے تیار' : 'Ready to attach'}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearInvestigationImage}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Remove image"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                        Final Resolution Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={newResolutionNotes}
                        onChange={(e) => setNewResolutionNotes(e.target.value)}
                        placeholder="Summary of case conclusion, compensation, or recovery details..."
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-red-500 text-xs"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isUpdating}
                        className="btn-primary text-white text-xs font-bold py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
                      >
                        {isUpdating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        <span>Submit Investigation Update</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-Screen Image Preview Modal */}
      {fullImagePreview && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setFullImagePreview(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setFullImagePreview(null)}
              className="absolute -top-10 right-0 p-1 text-white/80 hover:text-white cursor-pointer"
            >
              <X size={26} />
            </button>
            <img
              src={fullImagePreview}
              alt="High Resolution Evidence"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
            <p className="text-center text-xs text-slate-400 mt-2 font-mono">
              High Resolution Incident Photo Evidence
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

