import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { 
  Users, FileText, Activity, AlertTriangle, Check, X, XCircle, Shield, 
  Package, Trash2, CheckCircle, Loader2, ArrowRight, Truck, 
  Mail, Phone, Clock, Eye, AlertCircle, FileCheck, Send, MessageSquare, 
  Calendar, LayoutGrid, Radio, Handshake, TrendingUp, Coins, Repeat,
  ClipboardCheck, PackageCheck, ShieldAlert
} from 'lucide-react';
import ItemizedReceivingModal from '../../components/ItemizedReceivingModal';
import GpsMapPin from '../../components/GpsMapPin';
import { logisticsAPI, authAPI, adminAPI, socket } from '../../api';
import BiltyModal from '../../components/BiltyModal';
import { ChamakRibbon, WorkshopBadge, TruckPoetryBanner, TruckLotusArchBadge, TruckMorBadge } from '../../components/TruckArt';
import MapViewer from '../../components/MapViewer';
import { calculateFreightTariff, VEHICLE_MULTIPLIERS, getIntercityDistance, formatFreightPrice, formatWeightTons, BARGAIN_QUICK_INCREMENTS, parseWeightToKg } from '../../utils/fareCalculator';
import { sortByProximity, getProximityBadge, getProximityDistance } from '../../utils/proximity';
import LostCargoPortal from '../../components/lostCargo/LostCargoPortal';
import SearchSelect from '../../components/SearchSelect';
import UnitInput from '../../components/UnitInput';
import FormField from '../../components/FormField';
import { 
  PAKISTAN_CITIES, 
  VEHICLE_TYPES, 
  WEIGHT_UNITS, 
  RATE_TYPES,
  convertToTons 
} from '../../data/logisticsData';
import { validatePositiveNumber } from '../../utils/validation';

const safeJsonParse = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    const res = JSON.parse(val);
    return res != null ? res : fallback;
  } catch (e) {
    return fallback;
  }
};

export default function TransporterDashboard() {
  const { userData, currentUser } = useAuth();
  const { isUrdu } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('requests');
  const [loading, setLoading] = useState(true);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Live state arrays
  const [cargoRequests, setCargoRequests] = useState([]); // All cargo
  const [availableTrucks, setAvailableTrucks] = useState([]); // All available trucks
  const [bookings, setBookings] = useState([]); // Active and completed bookings
  const [trucksViewMode, setTrucksViewMode] = useState('grid'); // 'grid' | 'radar'

  // Action states
  const [verifyingCargo, setVerifyingCargo] = useState(null); // cargo object currently undergoing itemized verification
  const [rejectingCargoId, setRejectingCargoId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Assign Truck states & Route Tariff Details
  const [selectedTruckForAssign, setSelectedTruckForAssign] = useState(null);
  const [selectedCargoForAssign, setSelectedCargoForAssign] = useState(null);
  const [assignPrice, setAssignPrice] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignOrigin, setAssignOrigin] = useState('Lahore');
  const [assignDestination, setAssignDestination] = useState('Karachi');
  const [assignWeight, setAssignWeight] = useState('15');
  const [assignWeightUnit, setAssignWeightUnit] = useState('ton');
  const [assignVehicleType, setAssignVehicleType] = useState('Full Body Truck');
  const [assignFormErrors, setAssignFormErrors] = useState({});

  // Quick Tariff Estimator
  const [quickCalcOrigin, setQuickCalcOrigin] = useState('Lahore');
  const [quickCalcDest, setQuickCalcDest] = useState('Karachi');
  const [quickCalcWeight, setQuickCalcWeight] = useState('15');
  const [quickCalcWeightUnit, setQuickCalcWeightUnit] = useState('ton');

  // Active Shipments state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [chatMessageText, setChatMessageText] = useState('');

  // Bilty modal state
  const [biltyModalBooking, setBiltyModalBooking] = useState(null);
  const chatEndRef = useRef(null);

  // Fare Bargaining state
  const [bargainingCargoId, setBargainingCargoId] = useState(null);
  const [transporterCounterFare, setTransporterCounterFare] = useState('');
  const [transporterCounterNote, setTransporterCounterNote] = useState('');

  // Transporter Proximity Prioritization
  const userCity = currentUser?.city || userData?.city || 'Lahore';

  const sortedAvailableTrucks = useMemo(() => {
    return sortByProximity(availableTrucks, userCity, truck => truck.loc || 'Lahore', isUrdu);
  }, [availableTrucks, userCity, isUrdu]);

  useEffect(() => {
    const onUiBack = (e) => {
      if (biltyModalBooking) {
        setBiltyModalBooking(null);
        e.preventDefault();
        return;
      }
      if (verifyingCargo) {
        setVerifyingCargo(null);
        e.preventDefault();
        return;
      }
      if (showAssignModal) {
        setShowAssignModal(false);
        e.preventDefault();
        return;
      }
      if (rejectingCargoId) {
        setRejectingCargoId(null);
        setRejectionReason('');
        e.preventDefault();
        return;
      }
      if (selectedBooking) {
        setSelectedBooking(null);
        e.preventDefault();
        return;
      }
      if (activeTab !== 'requests') {
        setActiveTab('requests');
        e.preventDefault();
      }
    };
    window.addEventListener('ecargo:ui-back', onUiBack);
    return () => window.removeEventListener('ecargo:ui-back', onUiBack);
  }, [biltyModalBooking, verifyingCargo, showAssignModal, rejectingCargoId, selectedBooking, activeTab]);

  const fetchData = async () => {
    if (currentUser) {
      try {
        const [cargoRes, trucksRes, bookingsRes] = await Promise.all([
          logisticsAPI.getCargo({ transporterId: currentUser.id || currentUser._id }),
          logisticsAPI.getTrucks({ status: 'Available' }),
          logisticsAPI.getBookings({ transporterId: currentUser.id || currentUser._id })
        ]);
        setCargoRequests(cargoRes.data);
        setAvailableTrucks(trucksRes.data);
        setBookings(bookingsRes.data);
        setLoading(false);
      } catch (e) {
        console.error("Error fetching transporter data:", e);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();

    socket.on('booking_updated', fetchData);
    socket.on('notification', fetchData);

    return () => {
      socket.off('booking_updated');
      socket.off('notification');
    };
  }, [currentUser]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedBooking?.messages]);

  useEffect(() => {
    if (!rejectingCargoId && !showAssignModal) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setRejectingCargoId(null);
        setShowAssignModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [rejectingCargoId, showAssignModal]);

  // Sync selected booking details when bookings refresh
  useEffect(() => {
    if (selectedBooking) {
      const updated = bookings.find(b => b._id === selectedBooking._id);
      if (updated) setSelectedBooking(updated);
    }
  }, [bookings]);

  const handleCargoResponse = async (cargoId, status, extra = {}) => {
    if (status === 'Rejected') {
      setRejectingCargoId(cargoId);
      setRejectionReason('');
      return;
    }
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await logisticsAPI.respondToCargo(cargoId, { status, ...extra });
      toast.success(isUrdu ? 'کارگو قبول کر لیا گیا! اب "قبول شدہ (بغیر ٹرک)" ٹیب میں ٹرک الاٹ کریں۔' : 'Cargo request accepted! Moved to "Accepted (No Truck)" tab awaiting vehicle allocation.');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to update cargo status.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSendCounterOffer = async (cargoId) => {
    const counterAmount = parseFloat(transporterCounterFare);
    if (!counterAmount || counterAmount <= 0) {
      toast.error(isUrdu ? 'براہ کرم نیا کرایہ درج کریں' : 'Please specify a valid counter-fare amount');
      return;
    }
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await logisticsAPI.respondToCargo(cargoId, {
        status: 'Pending',
        fareStatus: 'Counter-Offered',
        counterFare: counterAmount,
        counterNote: transporterCounterNote || (isUrdu ? 'کرایہ بڑھانے کی تجویز' : 'Fare increase proposal'),
        counterBy: 'transporter'
      });
      toast.success(isUrdu ? `گاہک کو جوابی پیشکش Rs. ${counterAmount.toLocaleString()} بھیج دی گئی!` : `Counter-offer of Rs. ${counterAmount.toLocaleString()} sent to customer!`);
      setBargainingCargoId(null);
      setTransporterCounterFare('');
      setTransporterCounterNote('');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to send counter-offer.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleAcceptDriverCounter = async (booking) => {
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await logisticsAPI.updateBooking(booking._id || booking.id, {
        price: booking.counterPrice,
        counterPrice: null,
        status: 'Accepted'
      });
      toast.success(isUrdu ? `ڈرائیور کا کرایہ Rs. ${booking.counterPrice} قبول کرلیا گیا!` : `Driver's proposed fare of Rs. ${booking.counterPrice} accepted!`);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to accept driver counter-offer');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmRejection = async (e) => {
    e.preventDefault();
    if (!rejectionReason || isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      await logisticsAPI.respondToCargo(rejectingCargoId, { status: 'Rejected', rejectionReason });
      setRejectingCargoId(null);
      setRejectionReason('');
      toast.info('Cargo request rejected.');
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to reject cargo request.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmVerification = async (verificationPayload) => {
    if (!verifyingCargo || isSubmittingAction) return;
    setIsSubmittingAction(true);
    try {
      const cargoId = verifyingCargo._id || verifyingCargo.id;
      await logisticsAPI.respondToCargo(cargoId, verificationPayload);

      if (verificationPayload.hasShortage) {
        toast.warning(
          isUrdu
            ? `شارٹیج کی توثیق درج کرلی گئی۔ وصول شدہ اشیاء: ${verificationPayload.receivingVerification?.totalReceivedQty || ''} (کمی: ${verificationPayload.receivingVerification?.totalShortageQty || ''} اشیاء)`
            : `Shortage Endorsement recorded! Accepted ${verificationPayload.receivingVerification?.totalReceivedQty} units (${verificationPayload.receivingVerification?.totalShortageQty} missing).`
        );
      } else if (verificationPayload.status === 'Rejected') {
        toast.info(isUrdu ? 'کارگو شارٹیج کی وجہ سے مسترد کر دیا گیا' : 'Consignment rejected due to missing cargo.');
      } else {
        toast.success(
          isUrdu
            ? 'تمام اشیاء کی مکمل تصدیق ہوگئی! مال قبول کرلیا گیا۔'
            : 'All items verified and accepted! Ready for truck dispatch.'
        );
      }
      setVerifyingCargo(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to submit receiving verification.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const openAssignModalForTruck = (truck) => {
    setSelectedTruckForAssign(truck);
    setSelectedCargoForAssign(null);
    const orig = truck.loc ? (PAKISTAN_CITIES.find(c => (c.name || '').toLowerCase() === truck.loc.toLowerCase())?.name || truck.loc) : 'Lahore';
    const dest = 'Karachi';
    const wt = parseFloat(truck.capacity) || 15;
    const vType = truck.truckType || 'Full Body Truck';
    setAssignOrigin(orig);
    setAssignDestination(dest);
    setAssignWeight(wt);
    setAssignVehicleType(vType);
    const tariff = calculateFreightTariff({
      origin: orig,
      destination: dest,
      chargeableTons: wt,
      vehicleType: vType
    });
    setAssignPrice(tariff.totalFare || tariff.totalFreight);
    setShowAssignModal(true);
  };

  const openAssignModalForCargo = (cargo) => {
    if (!availableTrucks || availableTrucks.length === 0) {
      toast.error(isUrdu ? 'اس وقت کوئی گاڑی دستیاب نہیں ہے! برائے مہربانی پہلے بیڑے میں ٹرک شامل کریں۔' : 'No available fleet trucks found. Please register or clear a vehicle first.');
      return;
    }
    setSelectedCargoForAssign(cargo);
    const orig = cargo.origin || 'Lahore';
    const dest = cargo.destination || 'Karachi';
    const wt = cargo.chargeableWeight || cargo.weight || 15;
    const wtKg = parseWeightToKg(wt, true);

    setAssignOrigin(orig);
    setAssignDestination(dest);
    setAssignWeight(wt);
    setAssignWeightUnit('ton');

    // Find candidate truck with remaining capacity >= cargo weight, otherwise first truck
    const candidateTruck = availableTrucks.find(truck => {
      const tot = truck.total_capacity || parseWeightToKg(truck.capacity, true) || 0;
      const used = truck.used_capacity || 0;
      const rem = truck.remaining_capacity !== undefined ? truck.remaining_capacity : Math.max(0, tot - used);
      return rem >= wtKg;
    }) || availableTrucks[0];

    setSelectedTruckForAssign(candidateTruck);
    const vType = candidateTruck?.truckType || 'Full Body Truck';
    setAssignVehicleType(vType);

    const tariff = calculateFreightTariff({
      origin: orig,
      destination: dest,
      chargeableTons: wt,
      vehicleType: vType,
      handlingFlags: cargo.specialHandling || []
    });
    setAssignPrice(cargo.totalFare || cargo.baseFare || tariff.totalFare || tariff.totalFreight);
    setAssignFormErrors({});
    setShowAssignModal(true);
  };

  const handleCargoSelectInModal = (cargoId) => {
    if (!cargoId) {
      setSelectedCargoForAssign(null);
      return;
    }
    const cargo = cargoRequests.find(c => String(c._id) === String(cargoId) || String(c.id) === String(cargoId) || Number(c._id) === Number(cargoId));
    setSelectedCargoForAssign(cargo || null);
    if (cargo) {
      const orig = cargo.origin || assignOrigin;
      const dest = cargo.destination || assignDestination;
      const wt = cargo.chargeableWeight || cargo.weight || assignWeight;
      setAssignOrigin(orig);
      setAssignDestination(dest);
      setAssignWeight(wt);
      const tariff = calculateFreightTariff({
        origin: orig,
        destination: dest,
        chargeableTons: wt,
        vehicleType: assignVehicleType || selectedTruckForAssign?.truckType || 'Full Body Truck',
        handlingFlags: cargo.specialHandling || []
      });
      setAssignPrice(tariff.totalFare || tariff.totalFreight);
    }
  };

  const handleAssignConfirm = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!selectedCargoForAssign) {
      errors.cargo = isUrdu ? 'برائے مہربانی پہلے مال کا انتخاب کریں' : 'Please select an accepted cargo consignment';
    }
    const priceErr = validatePositiveNumber(assignPrice, 'Agreed Price', isUrdu);
    if (priceErr) errors.price = priceErr;

    // Validate truck remaining capacity before creating booking
    if (selectedTruckForAssign && selectedCargoForAssign) {
      const truckTot = selectedTruckForAssign.total_capacity || parseWeightToKg(selectedTruckForAssign.capacity, true) || 0;
      const truckUsed = selectedTruckForAssign.used_capacity || 0;
      const truckRem = selectedTruckForAssign.remaining_capacity !== undefined ? selectedTruckForAssign.remaining_capacity : Math.max(0, truckTot - truckUsed);
      const cargoWeight = parseWeightToKg(selectedCargoForAssign.chargeableWeight || selectedCargoForAssign.weight || assignWeight, assignWeightUnit === 'ton');
      if (cargoWeight > 0 && cargoWeight > truckRem) {
        toast.error(isUrdu ? `ٹرک میں گنجائش کم ہے! مال: ${cargoWeight.toLocaleString()} کلو، باقی گنجائش: ${truckRem.toLocaleString()} کلو` : `Cannot assign! Cargo (${cargoWeight.toLocaleString()} kg) exceeds remaining truck space (${truckRem.toLocaleString()} kg).`);
        return;
      }
    }

    if (Object.keys(errors).length > 0) {
      setAssignFormErrors(errors);
      return;
    }
    if (isSubmittingAction) return;
    setIsSubmittingAction(true);

    try {
      const truckId = selectedTruckForAssign._id || selectedTruckForAssign.id;
      const cargoId = selectedCargoForAssign._id || selectedCargoForAssign.id;
      // Create a booking request for the selected truck and cargo
      await logisticsAPI.createBooking({
        truckId: truckId,
        truckPlate: selectedTruckForAssign.plateNumber,
        truckOwnerId: selectedTruckForAssign.ownerId,
        cargoId: cargoId,
        cargoTitle: selectedCargoForAssign.title,
        price: assignPrice,
        transporterName: userData.name
      });
      // Automatically update the Cargo status to show Truck Assigned
      await logisticsAPI.updateCargo(cargoId, {
        status: 'Truck Assigned',
        assignedTruck: selectedTruckForAssign.plateNumber
      });
      setShowAssignModal(false);
      setAssignPrice('');
      setAssignFormErrors({});
      setSelectedCargoForAssign(null);
      setSelectedTruckForAssign(null);
      fetchData();
      toast.success("Booking request submitted to Truck Owner!");
    } catch (error) {
      console.error("Error creating booking:", error.response?.data || error.message);
      toast.error(`Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatMessageText.trim() || !selectedBooking) return;
    try {
      await logisticsAPI.updateBooking(selectedBooking._id || selectedBooking.id, {
        $push: { messages: { sender: userData.name, text: chatMessageText.trim() } }
      });
      setChatMessageText('');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to send message.');
    }
  };

  const handleBiltyClick = (booking) => {
    setBiltyModalBooking(booking);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status?.toUpperCase()) {
      case 'IN TRANSIT':
        return 'bg-orange-50 text-orange-700 border border-orange-200 font-bold';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold';
      case 'LOADED':
        return 'bg-amber-50 text-amber-800 border border-amber-200 font-bold';
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold';
      case 'TRUCK ASSIGNED':
        return 'bg-slate-100 text-slate-700 border border-slate-200 font-bold';
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border border-amber-200 font-bold';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 font-bold';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
        <p className="text-sm text-slate-600 font-bold tracking-wider font-mono">
          {isUrdu ? 'براہ کرم انتظار کریں...' : 'LOADING OPERATOR CENTER...'}
        </p>
      </div>
    );
  }

  const pendingRequests = cargoRequests.filter(c => c.status === 'Pending');

  // Cargo accepted by transporter but no truck has been assigned/dispatched yet
  const assignedCargoIds = useMemo(() => new Set(
    (bookings || [])
      .filter(b => b.status !== 'Rejected' && b.status !== 'Cancelled')
      .map(b => String(b.cargoId || b.cargo?._id || b.cargo?.id || ''))
      .filter(Boolean)
  ), [bookings]);

  const acceptedUnassignedCargo = useMemo(() => {
    return (cargoRequests || []).filter(c => {
      const cid = String(c._id || c.id || '');
      const isAccepted = c.status === 'Accepted';
      const hasNoTruck = !c.assignedTruck || c.assignedTruck === '-' || c.assignedTruck === 'Unassigned';
      const notInBookings = !assignedCargoIds.has(cid);
      return isAccepted && (hasNoTruck || notInBookings);
    });
  }, [cargoRequests, assignedCargoIds]);

  const totalAcceptedUnassignedTons = useMemo(() => {
    return acceptedUnassignedCargo.reduce((acc, c) => {
      const wt = convertToTons(c.chargeableWeight || c.weight || 0, 'ton');
      return acc + (Number(wt) || 0);
    }, 0);
  }, [acceptedUnassignedCargo]);

  return (
    <div className="dash-dark-theme w-full min-w-0 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 relative page-enter">
      {/* Truck Poetry Banner */}
      <div className="mb-6 relative z-10">
        <TruckPoetryBanner />
      </div>

      {/* Command Header Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 relative z-10 rounded-2xl sm:rounded-3xl bg-[#0B1325]/96 border border-white/15 p-4 sm:p-6 shadow-[0_18px_48px_-14px_rgba(0,0,0,0.75)] overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#EA580C]" />
        <div className="text-left min-w-0 w-full">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TruckMorBadge />
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300 bg-orange-500/15 px-2.5 py-0.5 rounded-full border border-orange-400/35">Fleet Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{isUrdu ? 'کارگو ٹرانسپورٹر ڈیش بورڈ' : 'Cargo Transporter Dashboard'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">{isUrdu ? 'کارپوریٹ شپنگ کی درخواستیں قبول کریں اور گاڑی ڈسپیچ کریں' : 'Accept corporate shipping requests, coordinate fleet logistics, and dispatch verified drivers.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0F1930]/92 border border-white/15 px-3.5 py-2 rounded-xl text-xs text-slate-200 font-mono shadow-sm">
            <Clock size={14} className="text-orange-400" />
            <span>Operations Live: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs navigation (Obsidian Segmented Dock) */}
      <div className="w-full max-w-full min-w-0 mb-6 sm:mb-8 relative z-10 overflow-x-auto touch-scroll no-scrollbar">
        <nav className="inline-flex min-w-full sm:min-w-0 items-center gap-1.5 p-1.5 rounded-2xl bg-[#0B1325]/96 border border-white/15 shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
          {[
            { id: 'requests', name: isUrdu ? 'نئی کارگو درخواستیں' : 'Incoming Requests', badge: pendingRequests.length },
            { id: 'unassigned', name: isUrdu ? 'قبول شدہ (بغیر ٹرک)' : 'Accepted (No Truck)', badge: acceptedUnassignedCargo.length, isAmber: true },
            { id: 'trucks', name: isUrdu ? 'دستیاب گاڑیاں' : 'Available Trucks' },
            { id: 'shipments', name: isUrdu ? 'فعال ترسیلات' : 'Active Shipments' },
            { id: 'lost_cargo', name: isUrdu ? 'گمشدہ کارگو پورٹل' : 'Lost Cargo Portal' },
            { id: 'history', name: isUrdu ? 'تاریخچہ و ریکارڈ' : 'Delivery History' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedBooking(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 relative flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white shadow-[0_6px_18px_-4px_rgba(249,115,22,0.55)]' 
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {tab.name}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  activeTab === tab.id 
                    ? 'bg-white/25 text-white border border-white/30' 
                    : (tab.isAmber ? 'bg-amber-400 text-slate-950 font-black animate-pulse shadow-sm' : 'bg-orange-600 text-white animate-pulse shadow-sm')
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6 relative z-10">

        {/* REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-6 text-left">
            {/* Shortcut banner to accepted unassigned cargo if any */}
            {acceptedUnassignedCargo.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3.5 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-amber-200 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span>
                    {isUrdu 
                      ? `آپ کے پاس ${acceptedUnassignedCargo.length} قبول شدہ کارگو موجود ہیں جن پر ٹرک مختص کرنا باقی ہے۔` 
                      : `You have ${acceptedUnassignedCargo.length} accepted shipment(s) waiting for fleet truck allocation.`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('unassigned')}
                  className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-sm"
                >
                  <span>{isUrdu ? 'قبول شدہ دیکھیں' : 'View Accepted (No Truck)'}</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
            {pendingRequests.map(req => {
              const reqProducts = Array.isArray(req.products) ? req.products : safeJsonParse(req.products, []);
              const reqPickup = (req.pickupDetails && typeof req.pickupDetails === 'object') ? req.pickupDetails : safeJsonParse(req.pickupDetails, {});
              const reqRecipients = Array.isArray(req.recipients) ? req.recipients : safeJsonParse(req.recipients, []);

              return (
              <div key={req._id || req.id} className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={16} className="text-orange-600 shrink-0" />
                      REQ-{req.id || (req._id ? String(req._id).slice(0, 8) : '')} <span className="font-normal text-sm text-slate-600">from {req.businessOwnerName}</span>
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {req.createdAt ? new Date(req.createdAt).toLocaleString() : 'Recent'}
                  </span>
                </div>

                {/* Details split column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
                  {/* Products */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Consignment</p>
                    <div className="space-y-1.5 mt-2">
                      <p className="font-bold text-slate-900 text-sm">{req.title}</p>
                      <p className="text-xs text-orange-700 font-bold font-mono">
                        {req.chargeableWeight ? `${formatWeightTons(req.chargeableWeight)} (Chargeable)` : formatWeightTons(req.weight)}
                        {req.packagingType && <span className="ml-2 text-slate-600 font-sans">&bull; {req.packagingType}</span>}
                      </p>
                      {reqProducts.map((p, idx) => {
                        const isShort = p.receivedQty !== undefined && Number(p.receivedQty) < Number(p.quantity || p.qty || 1);
                        return (
                          <p key={idx} className="text-xs text-slate-600 dark:text-slate-400 font-mono flex items-center justify-between">
                            <span>
                              &middot; {p.name || p.title} ({p.quantity || p.qty || '1'} units)
                              {p.length && p.width && p.height ? ` [${p.length}x${p.width}x${p.height}cm]` : ''}
                            </span>
                            {isShort && (
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700">
                                Recv: {p.receivedQty}
                              </span>
                            )}
                          </p>
                        );
                      })}
                      {req.hasShortage && (
                        <div className="bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-start gap-1.5 mt-2">
                          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span>Shortage Endorsed: {req.receivingVerification?.totalReceivedQty} of {req.receivingVerification?.totalDeclaredQty} units received ({req.receivingVerification?.totalShortageQty} missing).</span>
                            {req.shortageNote && <p className="text-[10px] font-normal italic mt-0.5">"{req.shortageNote}"</p>}
                          </div>
                        </div>
                      )}

                      {/* Special Handling Badges */}
                      {(() => {
                        const flags = Array.isArray(req.specialHandling) ? req.specialHandling : safeJsonParse(req.specialHandling, []);
                        if (!flags || flags.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {flags.map((flag, fi) => (
                              <span key={fi} className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                ⚠ {flag}
                              </span>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Customer Proposed Offer & Bargaining Display */}
                      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30 border-2 border-orange-300 dark:border-orange-500/50 p-3 rounded-xl text-left mt-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Handshake size={14} className="text-[#EA580C] shrink-0" />
                            <p className="text-[10px] font-black text-orange-900 dark:text-orange-200 uppercase tracking-wider">
                              {isUrdu ? 'گاہک کی پیشکش (Customer Offer)' : "Customer's Proposed Fare"}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono mt-0.5">
                            {req.counterFare && req.counterBy === 'transporter' ? (
                              <span className="text-amber-700 dark:text-amber-300 font-bold">
                                {isUrdu ? 'آپ نے جوابی پیشکش دی ہے:' : 'Your Counter-Offer:'} Rs. {Number(req.counterFare).toLocaleString()}
                              </span>
                            ) : req.counterBy === 'customer' ? (
                              <span className="text-orange-700 dark:text-orange-300 font-bold">
                                {isUrdu ? 'گاہک نے نظرثانی شدہ پیشکش دی ہے' : 'Customer submitted a revised offer'}
                              </span>
                            ) : (
                              isUrdu ? 'پیشکش قبول کریں یا کرایہ بڑھانے کی جوابی پیشکش کریں' : 'Accept offer or propose higher fare to bargain'
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base sm:text-lg font-black text-orange-600 dark:text-[#F89020] font-mono">
                            Rs. {Number(req.totalFare || req.baseFare || 50000).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pickup */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pickup Point</p>
                    <div className="space-y-1 mt-2 text-xs text-slate-700">
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <GpsMapPin size={12} className="shrink-0" />
                        <span>{req.origin}</span>
                      </p>
                      <p><span className="text-slate-500">Address:</span> {reqPickup.address || 'Not specified'}</p>
                      <p><span className="text-slate-500">Landmark:</span> {reqPickup.landmark || '—'}</p>
                      <p><span className="text-slate-500">Contact:</span> {reqPickup.contactName || reqPickup.contact || 'Shipper Contact'} {reqPickup.phone || reqPickup.contactPhone ? `(${reqPickup.phone || reqPickup.contactPhone})` : ''}</p>
                    </div>
                  </div>

                  {/* Recipients */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Recipients</p>
                    <div className="space-y-1 mt-2 text-xs text-slate-700">
                      <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <GpsMapPin size={12} className="shrink-0" />
                        <span>{req.destination}</span>
                      </p>
                      {reqRecipients.map((r, idx) => (
                        <div key={idx} className="mt-1">
                          <p><span className="text-slate-500">To:</span> {r.name || r.fullName} ({r.phone})</p>
                          <p><span className="text-slate-500">Delivery Address:</span> {r.address || r.streetAddress}</p>
                          <p className="text-emerald-700 mt-1 font-bold font-mono">Deadline: {r.expectedDate || r.deadline ? (r.expectedDate || r.deadline).split('T')[0] : '2026-06-14'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Direct Bargaining Actions */}
                {bargainingCargoId === (req._id || req.id) ? (
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border-2 border-orange-400 dark:border-orange-500/60 space-y-3 pt-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-[#EA580C]" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          {isUrdu ? 'کرایہ بڑھائیں (جوائنٹ کاؤنٹر پیشکش):' : 'Propose Higher Fare (Counter-Offer):'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBargainingCargoId(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Quick Increments */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        {isUrdu ? 'تیز اضافہ:' : 'Quick Add:'}
                      </span>
                      {[2000, 5000, 10000, 15000].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => {
                            const base = parseFloat(req.totalFare || req.baseFare || 50000);
                            setTransporterCounterFare(String(base + inc));
                          }}
                          className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border border-orange-300 dark:border-orange-600/40 hover:bg-orange-200 cursor-pointer"
                        >
                          +{inc.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-6 relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-orange-600 font-bold font-mono text-xs">
                          Rs.
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          onKeyDown={(e) => {
                            if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                          }}
                          value={transporterCounterFare}
                          onChange={(e) => setTransporterCounterFare(e.target.value.replace(/-/g, '').replace(/[eE]/g, ''))}
                          placeholder="e.g. 85000"
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm outline-none focus:border-orange-500"
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          value={transporterCounterNote}
                          onChange={(e) => setTransporterCounterNote(e.target.value)}
                          placeholder={isUrdu ? 'وجہ درج کریں (مثلاً ڈیزل ریٹ / پہاڑی راستہ)' : 'Reason (e.g. diesel hike / heavy load)'}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSubmittingAction}
                        onClick={() => handleSendCounterOffer(req._id || req.id)}
                        className="flex-1 btn-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        {isSubmittingAction ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        <span>{isUrdu ? 'گاہک کو کاؤنٹر آفر بھیجیں' : 'Send Counter-Offer to Customer'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBargainingCargoId(null)}
                        className="btn-outline text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                      >
                        {isUrdu ? 'منسوخ' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setVerifyingCargo(req)}
                      className="flex-1 btn-primary text-xs sm:text-sm font-bold py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md"
                      title="Inspect items, verify received count at dock, and record shortage"
                    >
                      <ClipboardCheck size={16} />
                      <span>{isUrdu ? 'اشیاء کی تصدیق و وصولی' : 'Verify & Receive Items'} ({reqProducts.length || 1})</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleCargoResponse(req._id || req.id, 'Accepted', { fareStatus: 'Agreed' })}
                      className="btn-outline border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                      title="Quick accept with full count"
                    >
                      <CheckCircle size={15} />
                      <span>{isUrdu ? 'مکمل قبول' : 'Quick Accept'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setBargainingCargoId(req._id || req.id);
                        const currentFare = parseFloat(req.totalFare || req.baseFare || 50000);
                        setTransporterCounterFare(String(currentFare + 5000));
                        setTransporterCounterNote('');
                      }}
                      className="btn-outline border-orange-400 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <TrendingUp size={16} className="text-orange-600" />
                      <span>{isUrdu ? 'کرایہ بڑھائیں' : 'Bargain'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleCargoResponse(req._id || req.id, 'Rejected')}
                      className="btn-outline text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={15} />
                      <span>{isUrdu ? 'مسترد کریں' : 'Reject'}</span>
                    </button>
                  </div>
                )}
              </div>
              );
            })}
            {pendingRequests.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-600 shadow-xs">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2 opacity-70" />
                <p className="font-bold text-slate-800">No incoming shipping requests found.</p>
                <p className="text-xs text-slate-500 mt-1">All incoming shipments are processed!</p>
              </div>
            )}
          </div>
        )}

        {/* ACCEPTED (NO TRUCK DISPATCHED) TAB */}
        {activeTab === 'unassigned' && (
          <div className="space-y-6 text-left">
            {/* Top Overview & Metric Banner */}
            <div className="bg-[#0B1325]/96 border border-white/15 rounded-2xl p-4 sm:p-5 shadow-sm text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {isUrdu ? 'قبول شدہ شپمنٹس (ٹرک الاٹمنٹ کا انتظار)' : 'Accepted Consignments Awaiting Truck Dispatch'}
                  </h3>
                </div>
                <p className="text-xs text-slate-300">
                  {isUrdu 
                    ? 'یہ وہ کارگو ہیں جو آپ قبول کر چکے ہیں لیکن ابھی تک کوئی ٹرک مختص نہیں کیا۔ مال لوڈ کرنے کے لیے دستیاب گاڑی چن کر ڈرائیور کو روانہ کریں۔' 
                    : 'Shipments accepted from corporate shippers but not yet assigned to any fleet carrier. Dispatch available trucks to begin transit.'}
                </p>
              </div>

              {/* Quick Stat Chips */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">{isUrdu ? 'منتظر شپمنٹس' : 'Pending Trucks'}</span>
                  <span className="text-amber-400 font-black text-sm">{acceptedUnassignedCargo.length} Orders</span>
                </div>
                <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">{isUrdu ? 'کل وزن' : 'Total Payload'}</span>
                  <span className="text-emerald-400 font-black text-sm">{totalAcceptedUnassignedTons.toFixed(1)} Tons</span>
                </div>
                <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">{isUrdu ? 'دستیاب بیڑہ' : 'Available Fleet'}</span>
                  <span className="text-orange-400 font-black text-sm">{availableTrucks.length} Trucks</span>
                </div>
              </div>
            </div>

            {/* List of Accepted Unassigned Shipments */}
            {acceptedUnassignedCargo.map(req => {
              const reqProducts = Array.isArray(req.products) ? req.products : safeJsonParse(req.products, []);
              const reqPickup = (req.pickupDetails && typeof req.pickupDetails === 'object') ? req.pickupDetails : safeJsonParse(req.pickupDetails, {});
              const reqRecipients = Array.isArray(req.recipients) ? req.recipients : safeJsonParse(req.recipients, []);
              const totalItems = reqProducts.reduce((sum, p) => sum + (Number(p.quantity || p.qty || 1)), 0);
              const totalShortage = reqProducts.reduce((sum, p) => {
                const q = Number(p.quantity || p.qty || 1);
                const r = p.receivedQty !== undefined ? Number(p.receivedQty) : q;
                return sum + Math.max(0, q - r);
              }, 0);
              const isShortageVerified = totalShortage > 0 || (req.receivingEndorsement && req.receivingEndorsement.totalShortageCount > 0);

              const reqDistance = getProximityDistance(req.origin || 'Lahore', req.destination || 'Karachi');

              return (
                <div key={req._id || req.id} className="bg-white border-2 border-amber-400/50 dark:border-amber-500/30 shadow-md rounded-2xl p-4 sm:p-6 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />

                  {/* Header Bar */}
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText size={18} className="text-orange-600 shrink-0" />
                        <span>REQ-{req.id || (req._id ? String(req._id).slice(0, 8) : '')}</span>
                      </h3>
                      <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {req.businessOwnerName || 'Corporate Shipper'}
                      </span>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                        <Clock size={12} className="text-amber-600" />
                        {isUrdu ? 'قبول شدہ • ٹرک درکار' : 'Accepted • Awaiting Truck'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent'}
                      </span>
                    </div>
                  </div>

                  {/* Split details column */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
                    {/* Column 1: Consignment Specs */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Consignment</p>
                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {reqProducts.length} Item types ({totalItems} Units)
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm mt-1">{req.title}</p>
                      <p className="text-xs text-orange-700 font-bold font-mono">
                        {req.chargeableWeight ? `${formatWeightTons(req.chargeableWeight)} (Chargeable)` : formatWeightTons(req.weight)}
                        {req.packagingType && <span className="ml-2 text-slate-600 font-sans">&bull; {req.packagingType}</span>}
                      </p>

                      {/* Products preview */}
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1 pt-1 border-t border-slate-200 mt-2">
                        {reqProducts.map((p, idx) => {
                          const isShort = p.receivedQty !== undefined && Number(p.receivedQty) < Number(p.quantity || p.qty || 1);
                          return (
                            <p key={idx} className="text-xs text-slate-600 font-mono flex items-center justify-between">
                              <span className="truncate mr-2">
                                &middot; {p.name || p.title} ({p.quantity || p.qty || '1'} units)
                              </span>
                              {isShort ? (
                                <span className="text-[10px] text-red-600 font-bold shrink-0">
                                  Rec: {p.receivedQty} (-{Number(p.quantity || p.qty || 1) - Number(p.receivedQty)})
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-bold shrink-0">Full</span>
                              )}
                            </p>
                          );
                        })}
                      </div>

                      {/* Shortage Endorsement Banner */}
                      {isShortageVerified ? (
                        <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 text-xs text-amber-900 flex items-start gap-1.5 mt-2">
                          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Shortage Verified at Receiving:</span>
                            <span className="text-[11px] text-amber-800">
                              {totalShortage} units shortage recorded &amp; confirmed before dispatch.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-900 flex items-center gap-1.5 mt-2">
                          <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-medium text-emerald-800">All items verified in full / ready for dispatch</span>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Route & Pickup */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Route &amp; Pickup Point</p>
                      
                      <div className="bg-white border border-slate-200 p-2.5 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{req.origin || 'Lahore'}</span>
                          <span className="text-orange-600 font-bold">&rarr;</span>
                          <span className="font-bold text-slate-900 text-sm">{req.destination || 'Karachi'}</span>
                        </div>
                        {reqDistance > 0 && (
                          <p className="text-[10px] font-mono text-slate-500 text-right mt-0.5">
                            🛣️ Route Distance: {reqDistance} km
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pt-1">
                        <p><strong className="text-slate-800">Pickup:</strong> {reqPickup.address || 'Corporate Hub'}</p>
                        <p><strong className="text-slate-800">Contact:</strong> {reqPickup.contactName || reqPickup.contact || '-'} ({reqPickup.phone || reqPickup.contactPhone || '-'})</p>
                        {reqRecipients.length > 0 && (
                          <p><strong className="text-slate-800">Drop-off:</strong> {reqRecipients[0].address || reqRecipients[0].city || req.destination}</p>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Agreed Price & Action Dispatch */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Agreed Consignment Fare</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-slate-900 font-mono">
                            Rs. {Number(req.totalFare || req.baseFare || 50000).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Agreed with Shipper
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {isUrdu ? 'اب بیڑے میں سے دستیاب ٹرک چنیں اور ڈرائیور کو بکنگ آفر بھیجیں۔' : 'Assign any available vehicle in your fleet with matching payload capacity.'}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={() => openAssignModalForCargo(req)}
                          className="w-full btn-primary text-xs sm:text-sm font-bold py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition-all"
                        >
                          <Truck size={17} />
                          <span>{isUrdu ? 'گاڑی مقرر کریں و روانہ کریں' : 'Assign Truck & Dispatch'}</span>
                          <ArrowRight size={15} />
                        </button>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setVerifyingCargo(req)}
                            className="flex-1 btn-outline text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100"
                            title="Re-open itemized dock verification"
                          >
                            <ClipboardCheck size={14} />
                            <span>{isUrdu ? 'سامان کی پڑتال' : 'Inspect Items'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCargoResponse(req._id || req.id, 'Rejected')}
                            className="btn-outline border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold py-2 px-3 rounded-xl cursor-pointer flex items-center justify-center gap-1"
                            title="Release/Reject order"
                          >
                            <XCircle size={14} />
                            <span>{isUrdu ? 'چھوڑیں' : 'Release'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {acceptedUnassignedCargo.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 sm:p-16 text-center text-slate-600 shadow-xs space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {isUrdu ? 'کوئی غیر تفویض شدہ کارگو نہیں ہے' : 'No Accepted Shipments Waiting for Trucks'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  {isUrdu 
                    ? 'تمام قبول شدہ کارگو پر گاڑیاں تفویض کی جا چکی ہیں، یا نئی درخواستیں موصول ہونے کا انتظار ہے۔' 
                    : 'All accepted shipping orders currently have fleet trucks dispatched to them. When you accept new corporate consignments, they will appear here until a truck is assigned.'}
                </p>
                <div className="flex flex-wrap justify-center items-center gap-3 pt-3">
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="btn-primary text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2"
                  >
                    <FileText size={14} />
                    <span>{isUrdu ? 'نئی درخواستیں دیکھیں' : 'View Incoming Requests'} ({pendingRequests.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('trucks')}
                    className="btn-outline text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2"
                  >
                    <Truck size={14} />
                    <span>{isUrdu ? 'دستیاب بیڑہ دیکھیں' : 'Inspect Available Fleet'} ({availableTrucks.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('shipments')}
                    className="btn-outline text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2"
                  >
                    <Activity size={14} />
                    <span>{isUrdu ? 'فعال ترسیلات دیکھیں' : 'Active Shipments'} ({bookings.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AVAILABLE TRUCKS TAB */}
        {activeTab === 'trucks' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-600 tracking-wider uppercase text-left">
                  {isUrdu ? 'دستیاب گاڑیوں کی ڈائریکٹری' : 'Available Trucks Directory'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isUrdu 
                    ? `آپ کے ڈپو / شہر (${userCity}) کے قریب ترین ٹرک سب سے اوپر دکھائے جا رہے ہیں` 
                    : `Fleet carriers closest to your hub (${userCity}) are prioritized at the top`}
                </p>
              </div>

              {/* View Switcher: Grid vs Live Fleet Radar */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setTrucksViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      trucksViewMode === 'grid'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid size={14} />
                    <span>{isUrdu ? 'گرڈ منظر' : 'Cards'}</span>
                  </button>
                  <button
                    onClick={() => setTrucksViewMode('radar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      trucksViewMode === 'radar'
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Radio size={14} className={trucksViewMode === 'radar' ? 'text-white' : ''} />
                    <span>{isUrdu ? 'لائیو ریڈار نقشہ' : 'Live Fleet Radar'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Inter-City Freight Tariff Estimator Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-left relative z-20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    ⚡ Live Inter-City Freight Tariff Estimator
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-700 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  Standard Rate: Rs. 45/Ton-km + 8% Fuel + 16% Tax
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <SearchSelect
                    label="From (Origin)"
                    options={PAKISTAN_CITIES}
                    value={quickCalcOrigin}
                    onChange={(val) => setQuickCalcOrigin(val)}
                    placeholder="Origin city..."
                    isUrdu={isUrdu}
                  />
                </div>
                <div>
                  <SearchSelect
                    label="To (Destination)"
                    options={PAKISTAN_CITIES}
                    value={quickCalcDest}
                    onChange={(val) => setQuickCalcDest(val)}
                    placeholder="Destination city..."
                    isUrdu={isUrdu}
                  />
                </div>
                <div>
                  <UnitInput
                    label="Payload"
                    value={quickCalcWeight}
                    onChange={(val) => setQuickCalcWeight(val)}
                    selectedUnit={quickCalcWeightUnit}
                    onUnitChange={(unit) => setQuickCalcWeightUnit(unit)}
                    units={WEIGHT_UNITS}
                    placeholder="e.g. 15"
                    isUrdu={isUrdu}
                  />
                </div>
                {(() => {
                  const wtInTons = convertToTons(quickCalcWeight, quickCalcWeightUnit);
                  const quickTariff = calculateFreightTariff({
                    origin: quickCalcOrigin,
                    destination: quickCalcDest,
                    chargeableTons: wtInTons > 0 ? wtInTons : 10,
                    vehicleType: 'Full Body Truck'
                  });
                  const quickTotal = quickTariff.totalFare || quickTariff.totalFreight || 0;
                  return (
                    <div className="bg-orange-50/70 border border-orange-300 rounded-xl p-2 px-3 flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase block font-mono">{quickTariff.distanceKm || 0} km</span>
                        <span className="text-sm font-black text-orange-700 font-mono">Rs. {quickTotal.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                        Estimated
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {trucksViewMode === 'radar' ? (
              /* Live Fleet Radar Map View */
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm overflow-hidden relative">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 px-2">
                    <div className="flex items-center gap-2">
                      <Radio size={16} className="text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                        {isUrdu ? 'ملک گیر بیڑے کا لائیو ریڈار' : 'Nationwide Fleet Radar Telemetry'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {isUrdu ? `${availableTrucks.length} گاڑیاں آن لائن` : `${availableTrucks.length} Available Vehicles Online`}
                    </span>
                  </div>

                  <MapViewer 
                    trucks={sortedAvailableTrucks}
                    onAssignTruck={(truck) => openAssignModalForTruck(truck)}
                    height="500px"
                    zoom={6}
                  />
                </div>

                {/* Fleet Quick Selection Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {sortedAvailableTrucks.map(truck => (
                    <div 
                      key={truck._id || truck.id}
                      onClick={() => openAssignModalForTruck(truck)}
                      className={`bg-white border rounded-xl p-3 text-left transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-between group ${
                        truck._proximityDistance === 0 ? 'border-emerald-300 hover:border-emerald-500' : 'border-slate-200 hover:border-orange-400'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-mono font-bold text-xs text-slate-900 group-hover:text-orange-700 transition-colors truncate">{truck.plateNumber}</p>
                          {truck._proximityDistance === 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono">Local</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                          <GpsMapPin size={10} className="shrink-0" />
                          <span>{truck.loc} &bull; {truck._proximityBadge?.shortText}</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {(() => {
                          const tot = truck.total_capacity || parseWeightToKg(truck.capacity, true) || 0;
                          const rem = truck.remaining_capacity !== undefined ? truck.remaining_capacity : tot;
                          const pct = truck.fill_percentage !== undefined ? truck.fill_percentage : (tot > 0 ? Math.round(((tot - rem) / tot) * 100) : 0);
                          const isFull = rem <= 0 || pct >= 100;
                          const isFilling = pct >= 75 && !isFull;
                          return (
                            <div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded border font-mono ${
                                isFull ? 'bg-red-50 text-red-700 border-red-300' :
                                isFilling ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}>
                                {isFull ? 'FULL' : `${rem.toLocaleString()} kg left`}
                              </span>
                              <div className="w-16 bg-slate-200 h-1 rounded-full overflow-hidden mt-1 ml-auto">
                                <div
                                  className={`h-full ${isFull ? 'bg-red-500' : isFilling ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-0.5 capitalize">{truck.truckType || 'Heavy'}</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Grid Cards View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedAvailableTrucks.map(truck => {
                  const isLocal = truck._proximityDistance === 0;
                  return (
                    <div key={truck._id} className={`bg-white border rounded-2xl p-4 sm:p-5 text-left flex flex-col justify-between min-h-[260px] h-full shadow-xs transition-all duration-300 relative overflow-hidden group ${
                      isLocal 
                        ? 'border-emerald-300 ring-1 ring-emerald-400/20 hover:border-emerald-400 hover:shadow-md' 
                        : 'border-slate-200 hover:border-orange-300 hover:shadow-md'
                    }`}>
                      <div>
                        <div className="flex justify-between items-start gap-2 flex-wrap">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs shrink-0">
                            <Truck size={20} />
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {truck._proximityBadge && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono shadow-2xs shrink-0 ${truck._proximityBadge.className}`}>
                                {truck._proximityBadge.text}
                              </span>
                            )}
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md font-mono shadow-2xs shrink-0">
                              Available
                            </span>
                          </div>
                        </div>

                        <h4 className="text-xl font-bold text-slate-900 mt-4 font-mono break-words">{truck.plateNumber}</h4>
                        <p className="text-xs text-orange-700 font-semibold mt-1">{truck.truckType} &middot; {truck.capacity}</p>

                        <div className="mt-4 space-y-1 text-xs text-slate-700">
                          <p><span className="text-slate-500">Owner:</span> <span className="text-slate-900 font-bold">{truck.ownerName || 'Verified Fleet Owner'}</span></p>
                          <p><span className="text-slate-500">Driver:</span> <span className="text-slate-900 font-bold">{truck.driverName}</span> <span className="text-slate-500 font-mono">({truck.driverMobile})</span></p>
                          <p className="flex items-center gap-1.5 mt-2 text-slate-600 font-medium">
                            <GpsMapPin size={12} className="shrink-0" />
                            <span>Depot: <strong className="text-slate-900">{truck.loc}</strong> &middot; {truck._proximityBadge?.shortText}</span>
                          </p>
                        </div>

                        {/* Real-Time Live Capacity Tracking Bar & Metrics */}
                        {(() => {
                          const tot = truck.total_capacity || parseWeightToKg(truck.capacity, true) || 0;
                          const used = truck.used_capacity || 0;
                          const rem = truck.remaining_capacity !== undefined ? truck.remaining_capacity : Math.max(0, tot - used);
                          const pct = truck.fill_percentage !== undefined ? truck.fill_percentage : (tot > 0 ? Math.min(100, Math.round((used / tot) * 100)) : 0);
                          const isFull = rem <= 0 || pct >= 100;
                          const isFilling = pct >= 75 && !isFull;
                          return (
                            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-700 flex items-center gap-1">
                                  <Package size={13} className="text-slate-500" />
                                  <span>{isUrdu ? 'گنجائش' : 'Available Capacity'}</span>
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono border ${
                                  isFull ? 'bg-red-50 text-red-700 border-red-300' :
                                  isFilling ? 'bg-amber-50 text-amber-800 border-amber-300' :
                                  'bg-emerald-50 text-emerald-800 border-emerald-300'
                                }`}>
                                  {isFull ? (isUrdu ? 'مکمل بھرا ہوا' : 'Full (100%)') :
                                   isFilling ? (isUrdu ? `${pct}% بھرا ہوا` : `Filling Up (${pct}%)`) :
                                   (isUrdu ? `${rem.toLocaleString()} کلو باقی` : `${rem.toLocaleString()} kg free`)}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    isFull ? 'bg-red-500' : isFilling ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>

                              {/* Numeric breakdown */}
                              <div className="flex flex-wrap justify-between items-center gap-1 text-[10px] text-slate-500 font-mono">
                                <span>Used: <strong className="text-slate-800">{used.toLocaleString()} kg</strong></span>
                                <span className={isFull ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                                  {rem.toLocaleString()} kg left
                                </span>
                                <span>Total: <strong className="text-slate-800">{tot.toLocaleString()} kg</strong></span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {(() => {
                        const tot = truck.total_capacity || parseWeightToKg(truck.capacity, true) || 0;
                        const rem = truck.remaining_capacity !== undefined ? truck.remaining_capacity : Math.max(0, tot - (truck.used_capacity || 0));
                        const isFull = rem <= 0 || (truck.fill_percentage !== undefined && truck.fill_percentage >= 100);
                        return (
                          <button 
                            onClick={() => openAssignModalForTruck(truck)}
                            disabled={isFull}
                            className={`w-full font-bold py-2.5 rounded-xl text-xs transition-all mt-4 shadow-xs ${
                              isFull
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                : 'btn-primary cursor-pointer'
                            }`}
                          >
                            {isFull
                              ? (isUrdu ? 'ٹرک مکمل بھرا ہوا ہے' : 'Truck Full (No Space)')
                              : (isUrdu ? 'گاڑی مقرر کریں' : 'Assign to Shipment')}
                          </button>
                        );
                      })()}
                    </div>
                  );
                })}
                {sortedAvailableTrucks.length === 0 && (
                  <div className="col-span-full bg-white border border-slate-200 rounded-2xl text-center py-16 px-4 text-slate-600 shadow-xs">
                    No available trucks found. Register or clear trips to free vehicles.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE SHIPMENTS TAB */}
        {activeTab === 'shipments' && (
          <div className="space-y-4">
            {/* Accepted unassigned alert banner if any */}
            {acceptedUnassignedCargo.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/10 border border-amber-400/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      {isUrdu ? `${acceptedUnassignedCargo.length} قبول شدہ کارگو ٹرک الاٹمنٹ کے منتظر ہیں` : `${acceptedUnassignedCargo.length} Accepted Consignments Awaiting Fleet Dispatch`}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {isUrdu ? 'ان شپمنٹس کو ٹرانسپورٹ گاڑی کے ساتھ جوڑیں تاکہ ترسیل شروع ہو سکے۔' : 'Match these accepted shipping orders with available trucks to begin delivery.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('unassigned')}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span>{isUrdu ? 'دیکھیں و ٹرک مقرر کریں' : 'View & Assign Trucks'}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

            <h3 className="text-xs font-bold text-slate-600 tracking-wider uppercase text-left">
              {bookings.filter(b => b.status !== 'Completed' && b.status !== 'Rejected').length} active transits in dispatch
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
              {/* Left pane listings */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 overflow-y-auto max-h-[500px] space-y-3 shadow-xs">
                {bookings
                  .filter(b => b.status !== 'Completed' && b.status !== 'Rejected')
                  .map(b => {
                    const isSelected = selectedBooking?._id === b._id;
                    return (
                      <div
                        key={b._id}
                        onClick={() => setSelectedBooking(b)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden ${
                          isSelected 
                            ? 'bg-orange-50/50 border-2 border-orange-600 shadow-sm' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#F89020]" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1 pr-1">
                            <h4 className="font-mono text-xs text-orange-700 font-bold">BLT-{b.cargoId || (b._id ? String(b._id).slice(0, 8) : '')}</h4>
                            <h4 className="font-bold text-slate-900 text-sm mt-0.5 truncate" title={b.cargoTitle}>{b.cargoTitle}</h4>
                            <p className="text-xs text-slate-500 mt-1 font-mono">Truck: {b.truckPlate}</p>
                          </div>
                          <span className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(b.status)}`}>
                            {b.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                {bookings.filter(b => b.status !== 'Completed' && b.status !== 'Rejected').length === 0 && (
                  <div className="text-center py-16 text-slate-500 text-sm">No active shipments in progress.</div>
                )}
              </div>

              {/* Right details review & chat panel */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Details card */}
                <div className="md:col-span-7 min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col justify-between text-left shadow-xs">
                  {selectedBooking ? (
                    <div className="space-y-6 flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex flex-wrap justify-between items-start border-b border-slate-200 pb-4 gap-2">
                          <div className="min-w-0 flex-1 pr-2">
                            <h3 className="text-lg font-bold text-slate-900 break-words">{selectedBooking.cargoTitle}</h3>
                            <p className="text-xs text-slate-500 mt-1">
                              Owner ID: USR-{selectedBooking.truckOwnerId} &middot; Plate: <span className="font-mono font-bold text-slate-900">{selectedBooking.truckPlate}</span>
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-mono font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 whitespace-nowrap">
                            BLT-{selectedBooking.cargoId || (selectedBooking._id ? String(selectedBooking._id).slice(0, 8) : '')}
                          </span>
                        </div>

                        {/* Specifications */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-5 sm:mt-6 text-xs text-slate-700">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Route</p>
                            <p className="font-bold text-slate-900 mt-0.5">
                              {selectedBooking.cargo?.origin || 'Lahore'} &rarr; {selectedBooking.cargo?.destination || 'Karachi'}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agreed Price</p>
                            <p className="font-bold text-emerald-700 mt-0.5 font-mono">{formatFreightPrice(selectedBooking.price)}</p>
                          </div>
                          {selectedBooking.cargo?.weight && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weight</p>
                              <p className="font-bold text-slate-900 mt-0.5 font-mono">{formatWeightTons(selectedBooking.cargo?.weight)}</p>
                            </div>
                          )}
                          {selectedBooking.eta && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ETA</p>
                              <p className="font-bold text-slate-800 mt-0.5 font-mono">{selectedBooking.eta}</p>
                            </div>
                          )}
                        </div>

                        {/* Pickup details */}
                        {(() => {
                          const pickup = (selectedBooking.cargo?.pickupDetails && typeof selectedBooking.cargo?.pickupDetails === 'object')
                            ? selectedBooking.cargo.pickupDetails
                            : safeJsonParse(selectedBooking.cargo?.pickupDetails, {});
                          return (
                            <div className="mt-6 border-t border-slate-200 pt-4 space-y-2">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pickup Address</p>
                              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700">
                                <p><span className="text-slate-500 font-medium">Point:</span> {pickup.address || 'Corporate depot'}</p>
                                <p className="mt-1"><span className="text-slate-500 font-medium">Contact:</span> {pickup.contactName || pickup.contact || '-'} ({pickup.phone || pickup.contactPhone || '-'})</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Driver Counter-Offer Alert & Accept Action */}
                      {selectedBooking.status === 'Counter-Offered' && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-orange-400 dark:border-orange-500/50 p-4 rounded-xl space-y-3 mt-4 text-left shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <TrendingUp size={18} className="text-orange-600 animate-pulse shrink-0" />
                              <div>
                                <h4 className="text-xs font-bold text-orange-950 dark:text-orange-200 uppercase tracking-wider">
                                  {isUrdu ? 'ڈرائیور کی جوابی پیشکش (Counter-Offer)' : 'Truck Owner Counter-Offered Higher Fare!'}
                                </h4>
                                <p className="text-[11px] text-orange-800 dark:text-orange-300">
                                  {isUrdu ? 'ڈرائیور نے یہ کرایہ طلب کیا ہے:' : 'Driver requested this revised fare:'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-400 line-through mr-1 font-mono">Rs. {selectedBooking.price}</span>
                              <span className="text-lg font-black text-orange-600 dark:text-orange-400 font-mono">Rs. {selectedBooking.counterPrice}</span>
                            </div>
                          </div>
                          {selectedBooking.counterNote && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg border border-orange-200 dark:border-orange-900/30">
                              💬 "{selectedBooking.counterNote}"
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAcceptDriverCounter(selectedBooking)}
                            className="w-full btn-primary text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <CheckCircle size={15} />
                            <span>{isUrdu ? 'ٹھیک ہے / ڈرائیور کا کرایہ قبول کریں' : "Accept Driver's Fare"} (Rs. {selectedBooking.counterPrice})</span>
                          </button>
                        </div>
                      )}

                      {/* PDF download */}
                      <button 
                        onClick={() => handleBiltyClick(selectedBooking)}
                        className="w-full btn-primary font-bold py-3 rounded-xl text-sm transition-all cursor-pointer mt-8 flex justify-center items-center gap-2 shadow-sm"
                      >
                        <FileText size={16} /> {isUrdu ? 'بلٹی دیکھیں' : 'View & Print Digital Bilty'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 py-16">
                      <Package size={36} className="text-slate-300" />
                      <p className="text-sm font-semibold font-sans">Select a shipment to view details</p>
                    </div>
                  )}
                </div>

                {/* Chat pane */}
                <div className="md:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-[400px] md:h-full shadow-xs">
                  {selectedBooking ? (
                    <div className="flex flex-col justify-between h-full text-left">
                      <div className="border-b border-slate-200 pb-2 mb-3 flex justify-between items-center">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Fleet Radio / Chat</h4>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Plate: {selectedBooking.truckPlate}</p>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>

                      {/* messages bubble log */}
                      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
                        {(selectedBooking.messages || []).map((m, idx) => {
                          const isTransporter = m.sender === userData?.name;
                          return (
                            <div key={idx} className={`flex ${isTransporter ? 'justify-end' : 'justify-start'}`}>
                              <div className={`p-2.5 rounded-2xl max-w-[85%] text-xs text-left shadow-2xs ${
                                isTransporter 
                                  ? 'bg-orange-600 text-white rounded-tr-none' 
                                  : 'bg-slate-100 text-slate-900 border border-slate-200 rounded-tl-none'
                              }`}>
                                <p className={`text-[9px] font-bold mb-0.5 ${isTransporter ? 'text-orange-100' : 'text-slate-500'}`}>{m.sender}</p>
                                <p className="leading-relaxed">{m.text}</p>
                              </div>
                            </div>
                          );
                        })}
                        {(selectedBooking.messages || []).length === 0 && (
                          <div className="flex-1 flex items-center justify-center text-[10px] text-slate-400 italic">No messages exchanged. Type below to text the driver.</div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat text input submit */}
                      <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-slate-200 pt-3 min-w-0">
                        <input 
                          type="text" 
                          value={chatMessageText}
                          onChange={e => setChatMessageText(e.target.value)}
                          placeholder="Type dispatch message..."
                          className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-orange-500"
                        />
                        <button 
                          type="submit"
                          className="btn-primary p-2.5 rounded-xl cursor-pointer flex items-center justify-center shadow-xs shrink-0"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <MessageSquare size={28} className="text-slate-300" />
                      <p className="text-xs font-semibold">Select a shipment to open chat</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* LOST CARGO TRACKER & INVESTIGATION TAB */}
        {activeTab === 'lost_cargo' && (
          <LostCargoPortal userRole="transporter" currentUserId={userData?.id || currentUser?.id} />
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 text-left shadow-xs">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-5 sm:mb-6">
                <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Delivery History</h3>
                <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 shrink-0">
                  Completed Trips: {bookings.filter(b => b.status === 'Completed').length}
                </span>
              </div>

              <div className="overflow-x-auto touch-scroll">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
                      <th className="p-3">Shipment ID</th>
                      <th className="p-3">Bilty No.</th>
                      <th className="p-3">Business Owner</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Weight</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings
                      .filter(b => b.status === 'Completed')
                      .map((b, idx) => (
                        <tr key={b._id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-mono text-slate-600">SHP-{b.cargoId || 10400 + idx}</td>
                          <td className="p-3">
                            <button 
                              onClick={() => handleBiltyClick(b)}
                              className="font-mono font-bold text-orange-700 hover:underline cursor-pointer"
                            >
                              BLT-{b.cargoId || 88000 + idx}
                            </button>
                          </td>
                          <td className="p-3 font-bold text-slate-900">{b.cargo?.businessOwnerName || 'Shipper'}</td>
                          <td className="p-3 text-slate-700">
                            {b.cargo?.origin || b.origin || '—'} &rarr; {b.cargo?.destination || b.destination || '—'}
                          </td>
                          <td className="p-3 text-slate-800 font-mono font-bold">{b.cargo?.weight ? formatWeightTons(b.cargo.weight) : '—'}</td>
                          <td className="p-3 text-slate-500 font-mono text-xs">
                            {b.completedAt ? b.completedAt.split('T')[0] : '—'}
                          </td>
                          <td className="p-3">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                              DELIVERED
                            </span>
                          </td>
                        </tr>
                      ))}
                    {bookings.filter(b => b.status === 'Completed').length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-12 text-slate-500 italic">No completed delivery history found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODALS */}

      {/* Rejection popup form */}
      {rejectingCargoId && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-xs px-2.5 sm:px-4 py-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRejectingCargoId(null);
              setRejectionReason('');
            }
          }}
        >
          <div className="bg-white dark:bg-[#0B1325]/98 text-slate-900 dark:text-slate-100 w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto relative p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/15 shadow-2xl modal-enter">
            <button type="button" aria-label="Close modal" onClick={() => { setRejectingCargoId(null); setRejectionReason(''); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 mt-1 text-left">Reject Shipment Request</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 text-left">Please provide a mandatory reason for rejecting this corporate shipment request.</p>
            <form onSubmit={handleConfirmRejection} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-1">Rejection Reason *</label>
                <textarea 
                  required 
                  value={rejectionReason} 
                  onChange={e => setRejectionReason(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/15 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white h-24 text-sm outline-none focus:bg-white dark:focus:bg-white/10 focus:border-rose-500" 
                  placeholder="e.g. Schedule conflict or route unavailable. We cannot dispatch vehicles to this route next week." 
                />
              </div>
              <button type="submit" disabled={isSubmittingAction} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-sm transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed">
                {isSubmittingAction ? 'Submitting...' : (isUrdu ? 'مسترد کریں' : 'Confirm Rejection')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Truck popup form with Dynamic Fare Calculation */}
      {showAssignModal && selectedTruckForAssign && (() => {
        const acceptedCargoList = acceptedUnassignedCargo.length > 0 
          ? acceptedUnassignedCargo 
          : cargoRequests.filter(c => c.status === 'Accepted' && (!c.assignedTruck || c.assignedTruck === '-'));
        const activeTariff = calculateFreightTariff({
          origin: assignOrigin || 'Lahore',
          destination: assignDestination || 'Karachi',
          chargeableTons: Math.max(0.5, convertToTons(assignWeight, assignWeightUnit) || 1),
          vehicleType: assignVehicleType || selectedTruckForAssign?.truckType || '18-Wheeler Trailer',
          handlingFlags: selectedCargoForAssign?.specialHandling || []
        });

        const truckTotalKg = selectedTruckForAssign.total_capacity || parseWeightToKg(selectedTruckForAssign.capacity, true) || 0;
        const truckUsedKg = selectedTruckForAssign.used_capacity || 0;
        const truckRemainingKg = selectedTruckForAssign.remaining_capacity !== undefined
          ? selectedTruckForAssign.remaining_capacity
          : Math.max(0, truckTotalKg - truckUsedKg);
        const truckCurrentPct = truckTotalKg > 0 ? Math.min(100, Math.round((truckUsedKg / truckTotalKg) * 100)) : 0;

        // Weight of cargo to be assigned
        const cargoWeightRaw = selectedCargoForAssign
          ? (selectedCargoForAssign.chargeableWeight || selectedCargoForAssign.weight || assignWeight)
          : assignWeight;
        const cargoWeightKg = parseWeightToKg(cargoWeightRaw, assignWeightUnit === 'ton');

        const isOverCapacity = cargoWeightKg > 0 && cargoWeightKg > truckRemainingKg;
        const spaceRemainingAfter = Math.max(0, truckRemainingKg - cargoWeightKg);
        const newFillPct = truckTotalKg > 0 ? Math.min(100, Math.round(((truckUsedKg + cargoWeightKg) / truckTotalKg) * 100)) : 100;

        return (
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-xs px-2.5 sm:px-4 py-4"
            onClick={(e) => e.target === e.currentTarget && setShowAssignModal(false)}
          >
            <div className="bg-white dark:bg-[#0B1325]/98 text-slate-900 dark:text-slate-100 w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto relative p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/15 shadow-2xl modal-enter">
              <button type="button" aria-label="Close modal" onClick={() => setShowAssignModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X size={20} />
              </button>
              <div className="flex items-center gap-2 mb-1 mt-1 text-left">
                <Truck size={16} className="text-orange-600 shrink-0" />
                <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">Fleet Dispatch &amp; Freight Offer</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 text-left">Assign Truck &amp; Set Freight Offer</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 text-left">
                Set your freight offer for vehicle <span className="text-orange-700 dark:text-orange-400 font-bold font-mono">{selectedTruckForAssign.plateNumber}</span>. Driver can accept or counter-offer.
              </p>

              {/* Truck summary badge with real-time capacity progress */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{selectedTruckForAssign.plateNumber}</span>
                    <span className="text-[10px] font-bold bg-orange-50 text-orange-800 px-2 py-0.5 rounded border border-orange-200 font-mono">
                      {selectedTruckForAssign.truckType}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      truckRemainingKg <= 0 ? 'bg-red-50 text-red-700 border-red-300' :
                      truckCurrentPct >= 75 ? 'bg-amber-50 text-amber-800 border-amber-300' :
                      'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}>
                      {truckRemainingKg <= 0 ? 'FULL' : `${truckRemainingKg.toLocaleString()} kg left`}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      truckRemainingKg <= 0 ? 'bg-red-500' : truckCurrentPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, truckCurrentPct)}%` }}
                  />
                </div>

                <div className="flex flex-wrap justify-between items-center gap-1.5 text-[11px] text-slate-600">
                  <p>
                    Depot: <span className="text-slate-900 font-medium">{selectedTruckForAssign.loc}</span> &bull; Driver: <span className="text-slate-900 font-medium">{selectedTruckForAssign.driverName}</span>
                    {assignOrigin && (
                      <span className="ml-1.5 font-mono text-[10px] font-bold text-orange-700">
                        ({getProximityDistance(assignOrigin, selectedTruckForAssign.loc) === 0 ? '📍 0 km' : `📍 ${getProximityDistance(assignOrigin, selectedTruckForAssign.loc)} km`})
                      </span>
                    )}
                  </p>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    Used: {truckUsedKg.toLocaleString()} kg / {truckTotalKg.toLocaleString()} kg
                  </span>
                </div>
              </div>

              <form onSubmit={handleAssignConfirm} className="space-y-4 text-left">
                {/* 1. Fleet Vehicle Selector (allows switching/picking truck) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {isUrdu ? 'گاڑی (ٹرک) منتخب کریں' : 'Select Fleet Truck'} <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">
                      {availableTrucks.length} {isUrdu ? 'گاڑیاں دستیاب' : 'Vehicles in Fleet'}
                    </span>
                  </div>
                  <select
                    value={selectedTruckForAssign ? String(selectedTruckForAssign._id || selectedTruckForAssign.id) : ''}
                    onChange={e => {
                      const tr = availableTrucks.find(t => String(t._id || t.id) === e.target.value);
                      setSelectedTruckForAssign(tr || null);
                      if (tr) {
                        setAssignVehicleType(tr.truckType || 'Full Body Truck');
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 cursor-pointer font-medium"
                  >
                    <option value="">{isUrdu ? '-- بیڑے سے گاڑی منتخب کریں --' : '-- Choose Vehicle from Fleet --'}</option>
                    {availableTrucks.map(truck => {
                      const tot = truck.total_capacity || parseWeightToKg(truck.capacity, true) || 0;
                      const used = truck.used_capacity || 0;
                      const rem = truck.remaining_capacity !== undefined ? truck.remaining_capacity : Math.max(0, tot - used);
                      const isFull = rem <= 0;
                      const cKg = selectedCargoForAssign ? parseWeightToKg(selectedCargoForAssign.chargeableWeight || selectedCargoForAssign.weight || assignWeight, true) : 0;
                      const fits = !isFull && rem >= cKg;
                      return (
                        <option key={truck._id || truck.id} value={String(truck._id || truck.id)} disabled={isFull}>
                          {truck.plateNumber} ({truck.truckType}) - {truck.loc} &bull; {isFull ? 'FULL' : `${rem.toLocaleString()} kg left`} {cKg > 0 ? (fits ? '✅ [Fits]' : '⚠️ [Over Capacity]') : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 2. Accepted Consignment Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select Accepted Consignment Request <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={selectedCargoForAssign ? String(selectedCargoForAssign._id || selectedCargoForAssign.id) : ''}
                    onChange={e => {
                      handleCargoSelectInModal(e.target.value);
                      if (assignFormErrors.cargo) {
                        setAssignFormErrors(prev => {
                          const copy = { ...prev };
                          delete copy.cargo;
                          return copy;
                        });
                      }
                    }}
                    className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-slate-900 text-xs outline-none transition-colors font-medium cursor-pointer ${
                      assignFormErrors.cargo ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:bg-white focus:border-orange-500'
                    }`}
                  >
                    <option value="">
                      {acceptedCargoList.length === 0
                        ? '-- No accepted cargo available yet --'
                        : '-- Select Consignment Request --'}
                    </option>
                    {acceptedCargoList.map(c => {
                      const cKg = parseWeightToKg(c.chargeableWeight || c.weight, true);
                      const fits = cKg <= truckRemainingKg;
                      return (
                        <option key={c._id || c.id} value={String(c._id || c.id)}>
                          REQ-{c.id || (c._id ? String(c._id).slice(0, 8) : '')}: {c.title} ({cKg.toLocaleString()} kg) &bull; {c.origin} &rarr; {c.destination} {fits ? '✅ [Fits]' : '⚠️ [Exceeds Capacity]'}
                        </option>
                      );
                    })}
                  </select>
                  {acceptedCargoList.length === 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5 font-medium">
                      Accept a shipment in the Shipment Requests tab first before assigning a truck.
                    </p>
                  )}
                  {assignFormErrors.cargo && (
                    <p className="text-[10px] text-red-600 mt-1 font-medium">{assignFormErrors.cargo}</p>
                  )}
                </div>

                {/* Route Details: From, To, Weight, Vehicle Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <SearchSelect
                      label="From (Origin City)"
                      options={PAKISTAN_CITIES}
                      value={assignOrigin}
                      onChange={(val) => setAssignOrigin(val)}
                      placeholder="Origin city..."
                      required
                      isUrdu={isUrdu}
                    />
                  </div>

                  <div>
                    <SearchSelect
                      label="To (Destination City)"
                      options={PAKISTAN_CITIES}
                      value={assignDestination}
                      onChange={(val) => setAssignDestination(val)}
                      placeholder="Destination city..."
                      required
                      isUrdu={isUrdu}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <UnitInput
                      label="Consignment Weight"
                      value={assignWeight}
                      onChange={(val) => setAssignWeight(val)}
                      selectedUnit={assignWeightUnit}
                      onUnitChange={(unit) => setAssignWeightUnit(unit)}
                      units={WEIGHT_UNITS}
                      placeholder="e.g. 15"
                      required
                      isUrdu={isUrdu}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Vehicle Type
                    </label>
                    <select
                      value={assignVehicleType}
                      onChange={e => setAssignVehicleType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 cursor-pointer font-medium"
                    >
                      {VEHICLE_TYPES.map(vt => (
                        <option key={vt.id} value={vt.id}>{vt.label} ({vt.defaultCapacity}t max)</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Real-time Capacity Space Preview / Overbooking Warning */}
                {selectedCargoForAssign && (
                  isOverCapacity ? (
                    <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-950 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-red-600 shrink-0" />
                        <span className="font-bold text-xs uppercase tracking-wider text-red-900">
                          {isUrdu ? 'گنجائش سے زیادہ ہے (Insufficient Space)' : 'Overbooking Alert: Truck Capacity Exceeded'}
                        </span>
                      </div>
                      <p className="text-xs text-red-800">
                        Consignment weight is <strong>{cargoWeightKg.toLocaleString()} kg</strong>, which exceeds this vehicle's remaining capacity of <strong>{truckRemainingKg.toLocaleString()} kg</strong>.
                      </p>
                      <p className="text-[11px] text-red-700 font-medium">
                        {isUrdu ? 'برائے مہربانی کوئی دوسرا ٹرک منتخب کریں یا ہلکا مال مقرر کریں۔' : 'Dispatch is blocked to prevent overloading. Select a larger truck or a lighter consignment.'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-emerald-950 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                          <CheckCircle size={15} className="text-emerald-700" />
                          {isUrdu ? 'گنجائش درست ہے (Capacity Approved)' : 'Capacity Verification Passed'}
                        </span>
                        <span className="font-mono font-bold text-emerald-800 text-[11px]">
                          {newFillPct}% Full After Loading
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800">
                        Loading <strong>{cargoWeightKg.toLocaleString()} kg</strong> will leave <strong>{spaceRemainingAfter.toLocaleString()} kg</strong> available space remaining on this truck.
                      </p>
                      <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${newFillPct >= 100 ? 'bg-red-500' : newFillPct >= 75 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                          style={{ width: `${Math.min(100, newFillPct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-emerald-700 pt-0.5">
                        <span>Used: {truckUsedKg.toLocaleString()} kg</span>
                        <span>Post-load: {(truckUsedKg + cargoWeightKg).toLocaleString()} kg / {truckTotalKg.toLocaleString()} kg</span>
                      </div>
                    </div>
                  )
                )}

                {/* Freight Offer & Quick Bargaining Presets */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30 border-2 border-orange-300 dark:border-orange-500/50 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-orange-200 dark:border-orange-500/30">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                      <Handshake size={15} className="text-[#EA580C]" />
                      {isUrdu ? 'ڈرائیور کو کرایہ کی پیشکش (Bargaining)' : 'Freight Offer for Driver (Direct Bargaining)'}
                    </span>
                    <span className="text-xs font-mono font-bold text-orange-700 dark:text-orange-300">
                      🛣️ {activeTariff.distanceKm} km Route
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {isUrdu ? 'ڈرائیور کو پیشکش بھیجیں۔ ڈرائیور اسے قبول کر سکتا ہے یا کرایہ بڑھانے کی جوابی پیشکش کر سکتا ہے۔' : 'Send an offer to the truck driver. Driver can accept ("Theek Hai") or propose a counter-offer.'}
                  </p>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{isUrdu ? 'تجویز کردہ:' : 'Presets:'}</span>
                    {[
                      Math.max(25000, Math.round((activeTariff.distanceKm * 45) / 5000) * 5000),
                      Math.max(35000, Math.round((activeTariff.distanceKm * 60) / 5000) * 5000),
                      Math.max(50000, Math.round((activeTariff.distanceKm * 80) / 5000) * 5000)
                    ].map((presetVal) => (
                      <button
                        key={presetVal}
                        type="button"
                        onClick={() => {
                          setAssignPrice(presetVal);
                          if (assignFormErrors.price) {
                            setAssignFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.price;
                              return copy;
                            });
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-orange-500 hover:text-orange-600 cursor-pointer shadow-2xs"
                      >
                        Rs. {presetVal.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agreed Price input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {isUrdu ? 'ٹرک ڈرائیور کو پیشکش کردہ کرایہ (Rs. PKR) *' : 'Offered Price for Driver (Rs. PKR) *'}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    step="100"
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                    }}
                    value={assignPrice}
                    onChange={e => {
                      const cleanVal = e.target.value.replace(/-/g, '').replace(/[eE]/g, '');
                      setAssignPrice(cleanVal);
                      if (assignFormErrors.price) {
                        setAssignFormErrors(prev => {
                          const copy = { ...prev };
                          delete copy.price;
                          return copy;
                        });
                      }
                    }}
                    placeholder="e.g. 75000"
                    className={`w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-bold outline-none font-mono transition-colors ${
                      assignFormErrors.price ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:bg-white focus:border-orange-500'
                    }`}
                  />
                  {assignFormErrors.price ? (
                    <p className="text-[10px] text-red-600 mt-1 font-medium">{assignFormErrors.price}</p>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Tip: Click "⚡ Apply Fare" above to auto-fill with the government/NHA tariff estimate, or adjust manually.
                    </p>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingAction || acceptedCargoList.length === 0 || isOverCapacity}
                  className="w-full btn-primary text-white font-bold py-3 rounded-xl text-sm transition-all cursor-pointer mt-4 shadow-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingAction && <Loader2 size={15} className="animate-spin" />}
                  <span>
                    {isOverCapacity
                      ? (isUrdu ? 'گنجائش سے زیادہ ہے (Cannot Dispatch)' : 'Cannot Dispatch (Exceeds Truck Capacity)')
                      : isSubmittingAction
                      ? 'Dispatching...'
                      : (isUrdu ? 'گاڑی مقرر کریں' : 'Confirm Dispatch & Assignment')}
                  </span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Itemized Receiving & Shortage Verification Modal */}
      {verifyingCargo && (
        <ItemizedReceivingModal
          isOpen={Boolean(verifyingCargo)}
          cargo={verifyingCargo}
          onClose={() => setVerifyingCargo(null)}
          onConfirmVerification={handleConfirmVerification}
          isSubmitting={isSubmittingAction}
          isUrdu={isUrdu}
        />
      )}

      {/* Bilty PDF Preview Modal */}
      <BiltyModal
        booking={biltyModalBooking}
        onClose={() => setBiltyModalBooking(null)}
      />

    </div>
  );
}
