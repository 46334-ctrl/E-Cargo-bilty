import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import {
  Users, FileText, Activity, AlertTriangle, Check, X, Shield,
  Package, Trash2, CheckCircle, Loader2, ArrowRight, Truck,
  Mail, Phone, Clock, Eye, AlertCircle, FileCheck, Send, MessageSquare,
  Calendar, Plus, Info, Snowflake, Flame, ArrowUp, DollarSign, Calculator, Layers,
  Handshake, TrendingUp, Coins, Repeat
} from 'lucide-react';
import GpsMapPin from '../../components/GpsMapPin';
import PostCargoIcon from '../../components/PostCargoIcon';
import { useState, useEffect, useMemo, useRef } from 'react';
import { logisticsAPI, authAPI, socket } from '../../api';
import BiltyModal from '../../components/BiltyModal';
import { ChamakRibbon, WorkshopBadge, TruckPoetryBanner, SindhiTruckTexture, TruckPatternBorder, TruckLotusArchBadge, TruckMorBadge } from '../../components/TruckArt';
import MapViewer, { getCoordinatesForLocation } from '../../components/MapViewer';
import ReportMissingCargoModal from '../../components/lostCargo/ReportMissingCargoModal';
import LostCargoPortal from '../../components/lostCargo/LostCargoPortal';
import {
  calculateFreightTariff,
  calculateVolumetricWeight,
  PACKAGING_TYPES,
  SPECIAL_HANDLING_FLAGS,
  PAYMENT_TERMS_OPTIONS,
  formatFreightPrice,
  formatWeightTons,
  getIntercityDistance,
  getBargainingPresets,
  getQuickIncrements,
  BARGAIN_QUICK_INCREMENTS
} from '../../utils/fareCalculator';
import SearchSelect from '../../components/SearchSelect';
import UnitInput from '../../components/UnitInput';
import FormField from '../../components/FormField';
import {
  PAKISTAN_CITIES,
  CARGO_CATEGORIES,
  VEHICLE_TYPES,
  WEIGHT_UNITS,
  DIMENSION_UNITS,
  RATE_TYPES,
  convertToTons
} from '../../data/logisticsData';
import {
  formatPhone,
  formatNTN,
  validatePhone,
  validateNTN,
  validatePositiveNumber,
  validateRequired
} from '../../utils/validation';
import { sortByProximity, getProximityBadge, getProximityDistance } from '../../utils/proximity';

export default function BusinessDashboard() {
  const { userData, currentUser } = useAuth();
  const { isUrdu } = useLanguage();
  const { toast, confirm } = useToast();
  const errorSummaryRef = useRef(null);
  const [activeTab, setActiveTab] = useState('new-request');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Database listings state
  const [transporters, setTransporters] = useState([]);
  const [cargoList, setCargoList] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [reportingCargo, setReportingCargo] = useState(null);

  // New Request Form states
  const [selectedTransporter, setSelectedTransporter] = useState(null);

  const [products, setProducts] = useState([
    { name: '', qty: '', unitWeight: '', weightUnit: 'ton', type: 'Textiles', lengthCm: '', widthCm: '', heightCm: '', dimensionUnit: 'cm' }
  ]);

  const [packagingType, setPackagingType] = useState('Cartons / Boxes');
  const [specialHandling, setSpecialHandling] = useState([]);
  const [senderNTN, setSenderNTN] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Prepaid');
  const [vehicleTypeChoice, setVehicleTypeChoice] = useState('18-Wheeler Trailer');
  const [rateType, setRateType] = useState('ton-km');
  const [customerOfferFare, setCustomerOfferFare] = useState('');
  const [hasUserManuallyEditedOffer, setHasUserManuallyEditedOffer] = useState(false);
  const [reOfferAmount, setReOfferAmount] = useState('');
  const [showReOfferInput, setShowReOfferInput] = useState(false);
  const [isBargainingAction, setIsBargainingAction] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitted, setFormSubmitted] = useState(false);

  const [pickupDetails, setPickupDetails] = useState({
    streetAddress: '',
    city: '',
    province: '',
    landmark: '',
    contactPerson: '',
    contactPhone: ''
  });

  const [recipients, setRecipients] = useState([
    { fullName: '', phone: '', city: '', province: '', streetAddress: '', deadline: '', assignedProducts: '' }
  ]);

  // Proximity Prioritization for Business Shipper
  const userCity = currentUser?.city || userData?.city || 'Lahore';
  const step1ReferenceCity = pickupDetails?.city || userCity;

  const sortedTransportersForStep1 = useMemo(() => {
    return sortByProximity(transporters, step1ReferenceCity, t => t.city || 'Lahore', isUrdu);
  }, [transporters, step1ReferenceCity, isUrdu]);

  const sortedTransportersForDirectory = useMemo(() => {
    return sortByProximity(transporters, userCity, t => t.city || 'Lahore', isUrdu);
  }, [transporters, userCity, isUrdu]);

  // Track Shipments selection state
  const [selectedCargo, setSelectedCargo] = useState(null);
  const [biltyModalBooking, setBiltyModalBooking] = useState(null);

  useEffect(() => {
    const onUiBack = (e) => {
      if (biltyModalBooking) {
        setBiltyModalBooking(null);
        e.preventDefault();
        return;
      }
      if (selectedCargo) {
        setSelectedCargo(null);
        e.preventDefault();
        return;
      }
      if (activeTab !== 'new-request') {
        setActiveTab('new-request');
        e.preventDefault();
      }
    };
    window.addEventListener('ecargo:ui-back', onUiBack);
    return () => window.removeEventListener('ecargo:ui-back', onUiBack);
  }, [biltyModalBooking, selectedCargo, activeTab]);

  const fetchData = async () => {
    if (currentUser) {
      try {
        const [transRes, cargoRes, bookingsRes, trucksRes] = await Promise.all([
          logisticsAPI.getTransporters(),
          logisticsAPI.getCargo({ businessOwnerId: currentUser.id || currentUser._id }),
          logisticsAPI.getBookings(),
          logisticsAPI.getTrucks()
        ]);

        // Eager load transporter completed shipments counts from the backend user statistics
        setTransporters(transRes.data);
        setCargoList(cargoRes.data);
        setBookings(bookingsRes.data);
        setTrucks(trucksRes.data);
        setLoading(false);
      } catch (e) {
        console.error("Error fetching business dashboard data:", e);
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

  // Sync selected cargo details when cargoList refreshes
  useEffect(() => {
    if (selectedCargo) {
      const updated = cargoList.find(c => c._id === selectedCargo._id);
      if (updated) setSelectedCargo(updated);
    }
  }, [cargoList]);

  // Auto pre-fill saved business names, shipper contact info, and addresses from user profile
  useEffect(() => {
    if (userData || currentUser) {
      setPickupDetails(prev => ({
        ...prev,
        contactPerson: prev.contactPerson || userData?.name || currentUser?.name || '',
        contactPhone: prev.contactPhone || userData?.phone || currentUser?.phone || '',
        streetAddress: prev.streetAddress || (userData?.businessName ? `${userData.businessName} Logistics Yard` : '')
      }));
      if (!senderNTN && userData?.businessRegNumber) {
        setSenderNTN(userData.businessRegNumber);
      }
    }
  }, [userData, currentUser]);

  // Products utilities
  const addProductRow = () => {
    setProducts([...products, {
      name: '',
      qty: '',
      unitWeight: '',
      weightUnit: 'ton',
      type: 'Textiles',
      lengthCm: '',
      widthCm: '',
      heightCm: '',
      dimensionUnit: 'cm'
    }]);
  };

  const removeProductRow = (idx) => {
    setProducts(products.filter((_, i) => i !== idx));
  };

  const handleProductChange = (idx, field, value) => {
    const updated = [...products];
    // Sanitize numeric and dimensional fields to strictly prevent negative numbers and exponents
    if (['qty', 'unitWeight', 'lengthCm', 'widthCm', 'heightCm'].includes(field)) {
      if (typeof value === 'string') {
        value = value.replace(/-/g, '').replace(/[eE]/g, '').trim();
      }
    }
    updated[idx][field] = value;
    setProducts(updated);
  };

  // Recipients utilities
  const addRecipientRow = () => {
    setRecipients([...recipients, { fullName: '', phone: '', city: '', province: '', streetAddress: '', deadline: '', assignedProducts: '' }]);
  };

  const removeRecipientRow = (idx) => {
    setRecipients(recipients.filter((_, i) => i !== idx));
  };

  const handleRecipientChange = (idx, field, value) => {
    const updated = [...recipients];
    updated[idx][field] = value;
    setRecipients(updated);
  };

  // Auto-calculated gross weight converting any unit (Kg, Ton, Maund, Quintal) into Metric Tons
  const calculateGrossWeight = () => {
    return products.reduce((sum, p) => {
      const qty = Math.max(0, parseFloat(p.qty) || 0);
      const wtInTons = Math.max(0, convertToTons(p.unitWeight, p.weightUnit || 'ton'));
      return sum + (qty * wtInTons);
    }, 0);
  };

  // Auto-calculated volumetric weight with dimensional unit support
  const calculateTotalVolumetricWeight = () => {
    return products.reduce((sum, p) => {
      let l = Math.max(0, parseFloat(p.lengthCm) || 0);
      let w = Math.max(0, parseFloat(p.widthCm) || 0);
      let h = Math.max(0, parseFloat(p.heightCm) || 0);
      if (p.dimensionUnit === 'meter') {
        l *= 100;
        w *= 100;
        h *= 100;
      } else if (p.dimensionUnit === 'feet') {
        l *= 30.48;
        w *= 30.48;
        h *= 30.48;
      }
      const q = Math.max(1, parseInt(p.qty) || 1);
      const vol = calculateVolumetricWeight(l, w, h, q);
      return sum + Math.max(0, vol.tons || 0);
    }, 0);
  };

  const grossWeight = calculateGrossWeight();
  const volumetricWeight = calculateTotalVolumetricWeight();
  const chargeableWeight = Math.max(grossWeight, volumetricWeight);

  // Dynamic route distance & delivery-specific tariff estimation
  const pickupCity = pickupDetails.city?.trim() || '';
  const deliveryCity = recipients[0]?.city?.trim() || '';
  const hasRouteSpecified = Boolean(pickupCity && deliveryCity);

  const originCity = pickupCity || userCity || 'Lahore';
  const destinationCity = deliveryCity || (originCity.toLowerCase() === 'karachi' ? 'Lahore' : 'Karachi');

  const estDistance = useMemo(() => {
    if (hasRouteSpecified) {
      return getIntercityDistance(pickupCity, deliveryCity);
    }
    return getIntercityDistance(originCity, destinationCity);
  }, [hasRouteSpecified, pickupCity, deliveryCity, originCity, destinationCity]);

  const tariffQuote = useMemo(() => {
    return calculateFreightTariff({
      origin: originCity,
      destination: destinationCity,
      chargeableTons: Math.max(0.5, chargeableWeight),
      vehicleType: vehicleTypeChoice,
      handlingFlags: specialHandling
    });
  }, [originCity, destinationCity, chargeableWeight, vehicleTypeChoice, specialHandling]);

  const recommendedFare = useMemo(() => {
    return tariffQuote.totalFare || tariffQuote.totalFreight || 45000;
  }, [tariffQuote]);

  const bargainingPresets = useMemo(() => {
    return getBargainingPresets(recommendedFare);
  }, [recommendedFare]);

  const quickIncrements = useMemo(() => {
    return getQuickIncrements(recommendedFare);
  }, [recommendedFare]);

  // Dynamically sync offer to the delivery's recommended fare until user manually edits
  useEffect(() => {
    if (!hasUserManuallyEditedOffer && recommendedFare) {
      setCustomerOfferFare(String(recommendedFare));
    }
  }, [recommendedFare, hasUserManuallyEditedOffer]);

  const toggleSpecialHandling = (flagId) => {
    if (specialHandling.includes(flagId)) {
      setSpecialHandling(specialHandling.filter(f => f !== flagId));
    } else {
      setSpecialHandling([...specialHandling, flagId]);
    }
  };

  // Strict Form Validation
  const validateForm = () => {
    const errors = {};

    if (!selectedTransporter) {
      errors.transporter = isUrdu ? 'برائے مہربانی پہلے ٹرانسپورٹر کا انتخاب کریں' : 'Please select a transporter for this shipment';
    }

    // Validate products
    products.forEach((p, idx) => {
      if (!p.name?.trim()) {
        errors[`prod_${idx}_name`] = isUrdu ? 'پروڈکٹ کا نام درج کریں' : 'Product name is required';
      }
      const qtyErr = validatePositiveNumber(p.qty, 'Quantity', isUrdu);
      if (qtyErr) errors[`prod_${idx}_qty`] = qtyErr;
      const wtErr = validatePositiveNumber(p.unitWeight, 'Unit Weight', isUrdu);
      if (wtErr) errors[`prod_${idx}_wt`] = wtErr;
    });

    // Validate pickup details
    if (!pickupDetails.streetAddress?.trim()) {
      errors.pickupAddress = isUrdu ? 'روانگی کا پتہ درج کریں' : 'Pickup street address is required';
    }
    if (!pickupDetails.city?.trim()) {
      errors.pickupCity = isUrdu ? 'روانگی کا شہر منتخب کریں' : 'Pickup city is required';
    }
    if (!pickupDetails.contactPerson?.trim()) {
      errors.pickupContact = isUrdu ? 'رابطہ کار کا نام درج کریں' : 'Contact person name is required';
    }
    const phoneErr = validatePhone(pickupDetails.contactPhone, isUrdu);
    if (phoneErr) errors.pickupPhone = phoneErr;

    // Validate recipients
    recipients.forEach((r, idx) => {
      if (!r.fullName?.trim()) {
        errors[`recip_${idx}_name`] = isUrdu ? 'وصول کنندہ کا نام درج کریں' : 'Consignee full name is required';
      }
      const rPhoneErr = validatePhone(r.phone, isUrdu);
      if (rPhoneErr) errors[`recip_${idx}_phone`] = rPhoneErr;
      if (!r.city?.trim()) {
        errors[`recip_${idx}_city`] = isUrdu ? 'منزل کا شہر منتخب کریں' : 'Destination city is required';
      }
      if (!r.streetAddress?.trim()) {
        errors[`recip_${idx}_address`] = isUrdu ? 'منزل کا پتہ درج کریں' : 'Destination delivery address is required';
      }
      if (!r.deadline) {
        errors[`recip_${idx}_deadline`] = isUrdu ? 'آخری تاریخ منتخب کریں' : 'Delivery deadline date is required';
      }
    });

    // Validate sender NTN if provided
    if (senderNTN) {
      const ntnErr = validateNTN(senderNTN, isUrdu, false);
      if (ntnErr) errors.senderNTN = ntnErr;
    }

    // Validate customer proposed freight offer
    if (!customerOfferFare || parseFloat(customerOfferFare) <= 0) {
      errors.offer = isUrdu ? 'براہ کرم اپنی کرایہ کی پیشکش درج کریں' : 'Please specify your proposed fare offer';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCustomerAcceptCounter = async (cargo) => {
    if (isBargainingAction) return;
    setIsBargainingAction(true);
    try {
      const agreedFare = cargo.counterFare;
      await logisticsAPI.updateCargo(cargo._id || cargo.id, {
        totalFare: agreedFare,
        baseFare: agreedFare,
        status: 'Accepted',
        fareStatus: 'Agreed',
        counterFare: null,
        counterBy: null
      });
      toast.success(isUrdu ? `پیشکش قبول کرلی گئی! کرایہ Rs. ${Number(agreedFare).toLocaleString()} طے پا گیا۔` : `Counter-offer accepted! Fare locked at Rs. ${Number(agreedFare).toLocaleString()}`);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept counter-offer');
    } finally {
      setIsBargainingAction(false);
    }
  };

  const handleCustomerReOffer = async (cargo) => {
    const newOffer = parseFloat(reOfferAmount);
    if (!newOffer || newOffer <= 0 || isBargainingAction) {
      toast.error(isUrdu ? 'برائے مہربانی درست پیشکش درج کریں' : 'Please enter a valid counter amount');
      return;
    }
    setIsBargainingAction(true);
    try {
      await logisticsAPI.updateCargo(cargo._id || cargo.id, {
        totalFare: newOffer,
        baseFare: newOffer,
        fareStatus: 'Counter-Offered',
        counterFare: null,
        counterBy: 'customer',
        counterNote: 'Customer re-offered new price'
      });
      toast.success(isUrdu ? `نئی جوابی پیشکش بھیج دی گئی: Rs. ${newOffer.toLocaleString()}` : `Counter-offer sent: Rs. ${newOffer.toLocaleString()}`);
      setShowReOfferInput(false);
      setReOfferAmount('');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit re-offer');
    } finally {
      setIsBargainingAction(false);
    }
  };

  useEffect(() => {
    if (formSubmitted) {
      validateForm();
    }
  }, [formSubmitted, selectedTransporter, products, pickupDetails, recipients, senderNTN]);

  const handleRequestSubmit = async (e, status = 'Pending') => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormSubmitted(true);

    if (!validateForm()) {
      toast.error(isUrdu ? 'برائے مہربانی فارم میں نشان زدہ غلطیوں کو درست کریں' : 'Please fix the highlighted form errors before proceeding.');
      setTimeout(() => {
        errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      return;
    }

    setIsSubmitting(true);
    const cargoTitle = products.map(p => `${p.name || 'Goods'} (x${p.qty || 1} ${p.weightUnit || 'ton'})`).join(', ');

    const payload = {
      title: cargoTitle,
      weight: (chargeableWeight > 0 ? chargeableWeight : 1).toFixed(2),
      chargeableWeight: (chargeableWeight > 0 ? chargeableWeight : 1).toFixed(2),
      volumetricWeight: volumetricWeight.toFixed(2),
      packagingType,
      specialHandling,
      senderNTN: senderNTN || null,
      deliveryNotes: deliveryNotes || null,
      paymentTerms,
      vehicleTypeChoice,
      rateType,
      baseFare: parseFloat(customerOfferFare) || recommendedFare,
      fuelSurcharge: 0,
      taxAmount: 0,
      totalFare: parseFloat(customerOfferFare) || recommendedFare,
      fareStatus: 'Offered',
      origin: pickupDetails.city || 'Depot',
      destination: recipients.map(r => r.city).join(', ') || 'Receivers',
      transporterId: selectedTransporter._id,
      status: status,
      products: products.map(p => ({
        name: p.name,
        category: p.type,
        qty: parseInt(p.qty) || 1,
        unitWeight: parseFloat(p.unitWeight) || 0,
        weightUnit: p.weightUnit || 'ton',
        dimensions: {
          lengthCm: p.lengthCm || 0,
          widthCm: p.widthCm || 0,
          heightCm: p.heightCm || 0,
          unit: p.dimensionUnit || 'cm'
        }
      })),
      pickupDetails: {
        address: `${pickupDetails.streetAddress}, ${pickupDetails.city}, ${pickupDetails.province}`,
        landmark: pickupDetails.landmark,
        contactName: pickupDetails.contactPerson,
        phone: pickupDetails.contactPhone
      },
      recipients: recipients.map(r => ({
        name: r.fullName,
        phone: r.phone,
        address: `${r.streetAddress}, ${r.city}, ${r.province}`,
        expectedDate: r.deadline,
        assignedProducts: r.assignedProducts
      }))
    };

    try {
      await logisticsAPI.postCargo(payload);
      toast.success(status === 'Draft' ? 'Shipment saved as draft!' : 'Request submitted successfully with verified tariff and unit specs!');

      // Reset forms while preserving shipper profile contact details
      setSelectedTransporter(null);
      setProducts([{ name: '', qty: '', unitWeight: '', weightUnit: 'ton', type: 'Textiles', lengthCm: '', widthCm: '', heightCm: '', dimensionUnit: 'cm' }]);
      setPackagingType('Cartons / Boxes');
      setSpecialHandling([]);
      setSenderNTN(userData?.businessRegNumber || '');
      setDeliveryNotes('');
      setFormErrors({});
      setFormSubmitted(false);
      setPickupDetails({
        streetAddress: userData?.businessName ? `${userData.businessName} Logistics Yard` : '',
        city: '',
        province: '',
        landmark: '',
        contactPerson: userData?.name || currentUser?.name || '',
        contactPhone: userData?.phone || currentUser?.phone || ''
      });
      setRecipients([{ fullName: '', phone: '', city: '', province: '', streetAddress: '', deadline: '', assignedProducts: '' }]);

      fetchData();
      setActiveTab('track');
    } catch (err) {
      console.error("Error posting cargo:", err);
      toast.error("Failed to submit freight request: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDraft = async (cargoId) => {
    const confirmed = await confirm({
      title: 'Delete Draft Shipment',
      message: 'Are you sure you want to delete this saved draft shipment? This action cannot be undone.',
      confirmLabel: 'Delete Draft',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await logisticsAPI.deleteCargo(cargoId);
      toast.info('Draft shipment deleted.');
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete draft shipment.');
    }
  };

  const findAssociatedBooking = (cargoItem, preferCompleted = false) => {
    const cid = Number(cargoItem?.id || cargoItem?._id);
    if (!cid) return null;
    if (preferCompleted) {
      const done = bookings.find(
        (b) => Number(b.cargoId) === cid && (b.status === 'Completed' || b.status === 'Delivered')
      );
      if (done) return done;
    }
    return bookings.find((b) => Number(b.cargoId) === cid) || null;
  };

  const handleBiltyClick = (cargo) => {
    // Locate the booking associated with this cargo to retrieve verified pricing & signature
    const associatedBooking = findAssociatedBooking(cargo, true);
    const biltyData = {
      id: cargo.id || cargo._id,
      _id: cargo._id || cargo.id,
      cargoId: cargo.id || cargo._id,
      cargoTitle: cargo.title,
      transporterName: cargo.transporterName || associatedBooking?.transporterName || 'Unassigned',
      truckPlate: associatedBooking?.truckPlate || cargo.assignedTruck || 'Unassigned',
      price: associatedBooking ? associatedBooking.price : (cargo.totalFare ? cargo.totalFare.toLocaleString() : null),
      completedAt: associatedBooking?.completedAt || cargo.createdAt,
      origin: cargo.origin,
      destination: cargo.destination,
      weight: cargo.weight,
      chargeableWeight: cargo.chargeableWeight || cargo.weight,
      packagingType: cargo.packagingType || 'Cartons / Boxes',
      paymentTerms: cargo.paymentTerms || 'Prepaid',
      specialHandling: cargo.specialHandling || [],
      senderNTN: cargo.senderNTN,
      deliveryNotes: cargo.deliveryNotes,
      receiverSignature: associatedBooking?.receiverSignature,
      businessOwnerName: userData?.businessName || userData?.name
    };
    setBiltyModalBooking(biltyData);
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
      case 'DRAFT':
        return 'bg-slate-100 text-slate-700 border border-slate-200 font-bold';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 font-bold';
    }
  };

  const getTransporterRating = (count) => {
    if (count > 40) return '★ 4.8';
    if (count > 25) return '★ 4.6';
    if (count > 15) return '★ 4.5';
    return '★ 4.2';
  };

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
            {isUrdu && <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-400/35 font-urdu">شاہراہِ پاکستان</span>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{isUrdu ? 'تاجر و کسٹمر پورٹل' : 'Business Shipping Panel'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">{isUrdu ? 'ٹرانسپورٹرز بک کریں، کارگو ٹریک کریں اور بلٹی حاصل کریں' : 'Book transporters, request shipments, and track cargo bilties in real-time.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0F1930]/92 border border-white/15 px-3.5 py-2 rounded-xl text-xs text-slate-200 font-mono shadow-sm">
            <Clock size={14} className="text-orange-400" />
            <span>Operational Session: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation (Obsidian Segmented Dock) */}
      <div className="w-full max-w-full min-w-0 mb-6 sm:mb-8 relative z-10 overflow-x-auto touch-scroll no-scrollbar">
        <nav className="inline-flex min-w-full sm:min-w-0 items-center gap-1.5 p-1.5 rounded-2xl bg-[#0B1325]/96 border border-white/15 shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
          {[
            { id: 'new-request', name: isUrdu ? 'کارگو پوسٹ کریں' : 'Post Cargo' },
            { id: 'track', name: isUrdu ? 'کارگو ٹریکنگ' : 'Track Shipments' },
            { id: 'transporters', name: isUrdu ? 'ٹرانسپورٹرز ڈائریکٹری' : 'Transporters Directory' },
            { id: 'lost_cargo', name: isUrdu ? 'گمشدہ کارگو دعوے' : 'Missing Cargo Claims' },
            { id: 'history', name: isUrdu ? 'تاریخچہ' : 'History' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedCargo(null);
              }}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 relative flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white shadow-[0_6px_18px_-4px_rgba(249,115,22,0.55)]'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
                }`}
            >
              {tab.id === 'new-request' && <PostCargoIcon size={16} className="shrink-0" />}
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Panels */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 shadow-xs">
          <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">Loading shipper workspace...</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* NEW REQUEST TAB */}
          {activeTab === 'new-request' && (
            <form onSubmit={(e) => handleRequestSubmit(e, 'Pending')} className="space-y-8 text-left">

              {/* Step 1: SELECT TRANSPORTER */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-4 overflow-hidden">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">1</span>
                      <span>{isUrdu ? 'ٹرانسپورٹر کا انتخاب' : 'Select Transporter'}</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      {isUrdu 
                        ? `قریب ترین ٹرانسپورٹرز اوپر دکھائے جا رہے ہیں (${step1ReferenceCity})` 
                        : `Sorted by proximity to ${step1ReferenceCity}: Closest local carriers shown first`}
                    </p>
                  </div>
                  {selectedTransporter && (
                    <span className="text-xs font-mono text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 font-bold shadow-2xs max-w-full truncate">
                      Selected: {selectedTransporter.name}
                    </span>
                  )}
                </div>

                {formErrors.transporter && (
                  <div className="bg-red-50 border-2 border-red-400 text-red-700 text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 animate-shake">
                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                    <span>{formErrors.transporter}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sortedTransportersForStep1.map(t => {
                    const isSelected = selectedTransporter?._id === t._id;
                    const isLocal = t._proximityDistance === 0;
                    return (
                      <div
                        key={t._id}
                        onClick={() => {
                          setSelectedTransporter(t);
                          if (formErrors.transporter) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy.transporter;
                              return copy;
                            });
                          }
                        }}
                        className={`p-4 sm:p-5 rounded-2xl border text-left cursor-pointer transition-all duration-300 relative overflow-hidden ${
                          isSelected
                            ? 'bg-orange-50/50 border-2 border-orange-600 shadow-sm -translate-y-0.5'
                            : isLocal
                              ? 'bg-emerald-50/20 border-emerald-300 hover:border-emerald-400 hover:shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#F89020]" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-base truncate">{t.name}</h4>
                              {t._proximityBadge && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono shadow-2xs shrink-0 ${t._proximityBadge.className}`}>
                                  {t._proximityBadge.text}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 font-mono">
                              {t.phone || 'Contact via portal'} &middot; {t.shipmentsCount || 0} shipments &middot; <span className="font-bold text-slate-800">Hub: {t.city || 'Lahore'}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-2.5 font-medium">
                              {t.businessName ? `${t.businessName} · Verified Network` : 'Verified National Carrier'}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 font-mono shadow-2xs shrink-0">
                            {getTransporterRating(t.shipmentsCount || 0)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {sortedTransportersForStep1.length === 0 && (
                    <div className="col-span-full text-center py-8 px-4 text-slate-500 italic bg-slate-50 rounded-2xl border border-slate-200">
                      No transporters available. Please verify registered transporters in Admin panel.
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: PRODUCTS, PACKAGING & VOLUMETRIC SPECS */}
              <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-4 sm:p-6 space-y-4 overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">2</span>
                    <span className="leading-snug">{isUrdu ? 'مال کی تفصیلات اور پیمائش' : 'Cargo Products, Packaging & Unit Dimensions'}</span>
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-2.5 w-full lg:w-auto">
                    <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
                      <label className="text-[10px] font-bold text-slate-600 uppercase font-mono shrink-0">Packaging:</label>
                      <select
                        value={packagingType}
                        onChange={e => setPackagingType(e.target.value)}
                        className="w-full sm:w-auto min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-900 text-xs font-semibold outline-none focus:border-orange-500"
                      >
                        {PACKAGING_TYPES.map(pkg => (
                          <option key={pkg} value={pkg}>{pkg}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addProductRow}
                      className="btn-outline text-xs !py-1.5 !px-3 shrink-0 whitespace-nowrap"
                    >
                      <Plus size={14} className="shrink-0" /> Add Product
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {products.map((prod, idx) => {
                    let l = parseFloat(prod.lengthCm) || 0;
                    let w = parseFloat(prod.widthCm) || 0;
                    let h = parseFloat(prod.heightCm) || 0;
                    if (prod.dimensionUnit === 'meter') {
                      l *= 100; w *= 100; h *= 100;
                    } else if (prod.dimensionUnit === 'feet') {
                      l *= 30.48; w *= 30.48; h *= 30.48;
                    }
                    const vol = calculateVolumetricWeight(l, w, h, prod.qty);
                    const grossItemTons = (parseFloat(prod.qty) || 0) * convertToTons(prod.unitWeight, prod.weightUnit || 'ton');

                    return (
                      <div key={idx} className={`bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-xl relative space-y-3 ${products.length > 1 ? 'pr-8' : ''}`}>
                        {products.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProductRow(idx)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-red-600 cursor-pointer p-1"
                          >
                            <X size={16} />
                          </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          <div className="md:col-span-3 min-w-0">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Product Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={prod.name}
                              onChange={e => handleProductChange(idx, 'name', e.target.value)}
                              className={`w-full bg-white border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none transition-colors ${formErrors[`prod_${idx}_name`] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300 focus:border-orange-500'
                                }`}
                              placeholder="e.g. Cotton Textiles / Machinery"
                            />
                            {formErrors[`prod_${idx}_name`] && (
                              <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors[`prod_${idx}_name`]}</p>
                            )}
                          </div>

                          <div className="md:col-span-2 min-w-0">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '.') e.preventDefault();
                              }}
                              value={prod.qty}
                              onChange={e => handleProductChange(idx, 'qty', e.target.value)}
                              className={`w-full bg-white border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none font-mono transition-colors ${formErrors[`prod_${idx}_qty`] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300 focus:border-orange-500'
                                }`}
                              placeholder="e.g. 50"
                            />
                            {formErrors[`prod_${idx}_qty`] && (
                              <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors[`prod_${idx}_qty`]}</p>
                            )}
                          </div>

                          <div className="md:col-span-3 min-w-0">
                            <UnitInput
                              label="Unit Weight"
                              value={prod.unitWeight}
                              onChange={(val) => handleProductChange(idx, 'unitWeight', val)}
                              selectedUnit={prod.weightUnit || 'ton'}
                              onUnitChange={(unit) => handleProductChange(idx, 'weightUnit', unit)}
                              units={WEIGHT_UNITS}
                              placeholder="Weight"
                              required
                              error={formErrors[`prod_${idx}_wt`]}
                              isUrdu={isUrdu}
                            />
                          </div>

                          <div className="md:col-span-2 min-w-0">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gross Item Wt</label>
                            <input
                              disabled
                              type="text"
                              value={`${grossItemTons.toFixed(2)} Tons`}
                              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-mono font-bold"
                            />
                          </div>

                          <div className="md:col-span-2 min-w-0">
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Category</label>
                            <select
                              value={prod.type}
                              onChange={e => handleProductChange(idx, 'type', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:border-orange-500"
                            >
                              {CARGO_CATEGORIES.map(cat => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.label || cat.name || cat.id} {isUrdu && cat.urdu ? `(${cat.urdu})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Volumetric Dimensions Row with Unit Selector */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3 pt-2 border-t border-slate-200 items-end">
                          <div className="min-w-0">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Length ({prod.dimensionUnit || 'cm'})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                              }}
                              value={prod.lengthCm || ''}
                              onChange={e => handleProductChange(idx, 'lengthCm', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono outline-none focus:border-orange-500"
                              placeholder="e.g. 120"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Width ({prod.dimensionUnit || 'cm'})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                              }}
                              value={prod.widthCm || ''}
                              onChange={e => handleProductChange(idx, 'widthCm', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono outline-none focus:border-orange-500"
                              placeholder="e.g. 80"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Height ({prod.dimensionUnit || 'cm'})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                              }}
                              value={prod.heightCm || ''}
                              onChange={e => handleProductChange(idx, 'heightCm', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-mono outline-none focus:border-orange-500"
                              placeholder="e.g. 160"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dimension Unit</label>
                            <select
                              value={prod.dimensionUnit || 'cm'}
                              onChange={e => handleProductChange(idx, 'dimensionUnit', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-900 text-xs font-semibold outline-none focus:border-orange-500"
                            >
                              {DIMENSION_UNITS.map(u => (
                                <option key={u.id} value={u.id}>{u.label || u.name || u.id}</option>
                              ))}
                            </select>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Volumetric Wt</label>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5 text-orange-800 text-xs font-mono font-bold">
                              {vol.tons > 0 ? `${vol.tons.toFixed(2)} tons` : '0.00 tons'}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Chargeable</label>
                            <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1.5 text-emerald-800 text-xs font-mono font-black">
                              {Math.max(grossItemTons, vol.tons).toFixed(2)} tons
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weight Totals Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Gross Weight (Converted)</span>
                    <span className="text-slate-900 font-bold text-sm">{grossWeight.toFixed(2)} Metric Tons</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold uppercase text-[10px] block">Volumetric Weight (IATA Standard)</span>
                    <span className="text-orange-700 font-bold text-sm">{volumetricWeight.toFixed(2)} Metric Tons</span>
                  </div>
                  <div className="w-full sm:w-auto bg-white border border-emerald-500 rounded-xl px-3.5 sm:px-4 py-2 shadow-2xs">
                    <span className="text-emerald-700 font-bold uppercase text-[10px] block">Chargeable Freight Weight</span>
                    <span className="text-emerald-800 font-bold text-sm sm:text-base">{chargeableWeight.toFixed(2)} Tons (max of Gross & Volumetric)</span>
                  </div>
                </div>
              </div>

              {/* Step 3: PICKUP DETAILS */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-4 overflow-hidden">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">3</span>
                  {isUrdu ? 'روانگی کا مقام' : 'Pickup Details & Logistics Hub'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Street Address / Factory Yard <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pickupDetails.streetAddress}
                      onChange={e => setPickupDetails({ ...pickupDetails, streetAddress: e.target.value })}
                      className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none transition-colors ${formErrors.pickupAddress ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                        }`}
                      placeholder="Street / Industrial Estate / Warehouse No"
                    />
                    {formErrors.pickupAddress && (
                      <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors.pickupAddress}</p>
                    )}
                  </div>

                  <div>
                    <SearchSelect
                      label="Pickup City / Hub"
                      options={PAKISTAN_CITIES}
                      value={pickupDetails.city}
                      onChange={(val, opt) => {
                        setPickupDetails(prev => ({
                          ...prev,
                          city: val,
                          province: opt?.province || prev.province
                        }));
                        if (formErrors.pickupCity) {
                          setFormErrors(prev => {
                            const copy = { ...prev };
                            delete copy.pickupCity;
                            return copy;
                          });
                        }
                      }}
                      placeholder="Search pickup city..."
                      error={formErrors.pickupCity}
                      required
                      isUrdu={isUrdu}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Province</label>
                    <input
                      type="text"
                      value={pickupDetails.province}
                      onChange={e => setPickupDetails({ ...pickupDetails, province: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      placeholder="e.g. Punjab / Sindh"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Landmark</label>
                    <input
                      type="text"
                      value={pickupDetails.landmark}
                      onChange={e => setPickupDetails({ ...pickupDetails, landmark: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      placeholder="e.g. Near Dry Port Toll Plaza"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Contact Person <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pickupDetails.contactPerson}
                      onChange={e => setPickupDetails({ ...pickupDetails, contactPerson: e.target.value })}
                      className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none transition-colors ${formErrors.pickupContact ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                        }`}
                      placeholder="Full name of dispatch manager"
                    />
                    {formErrors.pickupContact && (
                      <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors.pickupContact}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Contact Mobile (03XX-XXXXXXX) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pickupDetails.contactPhone}
                      onChange={e => setPickupDetails({ ...pickupDetails, contactPhone: formatPhone(e.target.value) })}
                      className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none font-mono transition-colors ${formErrors.pickupPhone ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                        }`}
                      placeholder="0300-1234567"
                    />
                    {formErrors.pickupPhone && (
                      <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors.pickupPhone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 4: RECIPIENTS / CONSIGNEES */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-4 overflow-hidden">
                <div className="flex flex-wrap justify-between items-center gap-2.5">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">4</span>
                    <span className="leading-snug">{isUrdu ? 'وصول کنندگان اور منزل' : 'Recipients / Consignee Destinations'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={addRecipientRow}
                    className="btn-outline text-xs !py-1.5 !px-3 shrink-0 whitespace-nowrap"
                  >
                    <Plus size={14} className="shrink-0" /> Add Recipient
                  </button>
                </div>

                <div className="space-y-6">
                  {recipients.map((recip, idx) => (
                    <div key={idx} className={`bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-xl relative space-y-4 ${recipients.length > 1 ? 'pr-8' : ''}`}>
                      {recipients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRecipientRow(idx)}
                          className="absolute top-2 right-2 text-slate-400 hover:text-red-600 cursor-pointer p-1"
                        >
                          <X size={16} />
                        </button>
                      )}
                      <h5 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 select-none flex items-center gap-2">
                        <GpsMapPin size={14} className="shrink-0" />
                        <span>Consignee Destination {idx + 1}</span>
                      </h5>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Consignee Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={recip.fullName}
                            onChange={e => handleRecipientChange(idx, 'fullName', e.target.value)}
                            className={`w-full bg-white border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none transition-colors ${formErrors[`recip_${idx}_name`] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                              }`}
                            placeholder="Recipient or Company name"
                          />
                          {formErrors[`recip_${idx}_name`] && (
                            <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors[`recip_${idx}_name`]}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Mobile Phone (03XX-XXXXXXX) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={recip.phone}
                            onChange={e => handleRecipientChange(idx, 'phone', formatPhone(e.target.value))}
                            className={`w-full bg-white border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none font-mono transition-colors ${formErrors[`recip_${idx}_phone`] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                              }`}
                            placeholder="0300-0000000"
                          />
                          {formErrors[`recip_${idx}_phone`] && (
                            <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors[`recip_${idx}_phone`]}</p>
                          )}
                        </div>

                        <div>
                          <SearchSelect
                            label="Destination City"
                            options={PAKISTAN_CITIES}
                            value={recip.city}
                            onChange={(val, opt) => {
                              const updated = [...recipients];
                              updated[idx].city = val;
                              if (opt?.province) updated[idx].province = opt.province;
                              setRecipients(updated);
                              if (formErrors[`recip_${idx}_city`]) {
                                setFormErrors(prev => {
                                  const copy = { ...prev };
                                  delete copy[`recip_${idx}_city`];
                                  return copy;
                                });
                              }
                            }}
                            placeholder="Select destination..."
                            error={formErrors[`recip_${idx}_city`]}
                            required
                            isUrdu={isUrdu}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Deadline Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={recip.deadline}
                            onChange={e => handleRecipientChange(idx, 'deadline', e.target.value)}
                            className={`w-full bg-white border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none font-mono transition-colors ${formErrors[`recip_${idx}_deadline`] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                              }`}
                          />
                          {formErrors[`recip_${idx}_deadline`] && (
                            <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors[`recip_${idx}_deadline`]}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Delivery Street Address / Warehouse <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={recip.streetAddress}
                            onChange={e => handleRecipientChange(idx, 'streetAddress', e.target.value)}
                            className={`w-full bg-white border rounded-xl px-3 py-2 text-slate-900 text-xs outline-none transition-colors ${formErrors[`recip_${idx}_address`] ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                              }`}
                            placeholder="Shop / Plot / Warehouse Number and Area"
                          />
                          {formErrors[`recip_${idx}_address`] && (
                            <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors[`recip_${idx}_address`]}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            Assigned Products & Packages
                          </label>
                          <input
                            type="text"
                            value={recip.assignedProducts}
                            onChange={e => handleRecipientChange(idx, 'assignedProducts', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                            placeholder="e.g. All Items / 20 Cartons"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 5: SPECIAL HANDLING, TAX ID, RATE TYPE & CUSTOM FREIGHT OFFER */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-hidden">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">5</span>
                  {isUrdu ? 'خصوصی ہدایات، ٹیکس اور کرایہ کی پیشکش' : 'Special Handling, NTN & Custom Freight Offer'}
                </h3>

                {/* Special Handling Badges Checkboxes */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Special Cargo Handling Flags
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {SPECIAL_HANDLING_FLAGS.map(flag => {
                      const isChecked = specialHandling.includes(flag.id);
                      return (
                        <div
                          key={flag.id}
                          onClick={() => toggleSpecialHandling(flag.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${isChecked
                              ? 'bg-orange-50/80 border-orange-600 text-orange-900 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${isChecked ? 'bg-orange-600 border-orange-600 text-white' : 'border-slate-300 bg-white'
                            }`}>
                            {isChecked && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-900 leading-tight">{flag.label.split('(')[0]}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{flag.label.includes('(') ? `(${flag.label.split('(')[1]}` : ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* NTN, Delivery Notes, Payment Terms, Vehicle Type Choice & Rate Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Sender NTN / Tax ID (7-8 digits)
                    </label>
                    <input
                      type="text"
                      value={senderNTN}
                      onChange={e => setSenderNTN(formatNTN(e.target.value))}
                      placeholder="1234567-8"
                      className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-slate-900 text-xs font-mono outline-none transition-colors ${formErrors.senderNTN ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
                        }`}
                    />
                    {formErrors.senderNTN && (
                      <p className="text-[10px] text-red-600 mt-1 font-medium">{formErrors.senderNTN}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Payment Terms
                    </label>
                    <select
                      value={paymentTerms}
                      onChange={e => setPaymentTerms(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 font-semibold"
                    >
                      {PAYMENT_TERMS_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Vehicle Type Preference
                    </label>
                    <select
                      value={vehicleTypeChoice}
                      onChange={e => setVehicleTypeChoice(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    >
                      {VEHICLE_TYPES.map(vt => (
                        <option key={vt.id} value={vt.id}>
                          {vt.label} ({vt.defaultCapacity}t max)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Rate / Tariff Pricing Model
                    </label>
                    <select
                      value={rateType}
                      onChange={e => setRateType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100 font-semibold"
                    >
                      {RATE_TYPES.map(rt => (
                        <option key={rt.id} value={rt.id}>{rt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Gate / Bay Instructions
                    </label>
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={e => setDeliveryNotes(e.target.value)}
                      placeholder="e.g. Gate 4, Bay 2"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>

                {/* Direct Customer Fare Offer & Price Negotiation */}
                <div className="bg-gradient-to-br from-orange-500/[0.04] via-slate-50 to-amber-500/[0.05] dark:from-[#0B1325] dark:to-[#12203B] border-2 border-orange-500/30 dark:border-orange-500/40 rounded-2xl p-4 sm:p-5 text-slate-900 dark:text-white shadow-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-500/40 text-[#EA580C] flex items-center justify-center shrink-0 shadow-2xs">
                        <Handshake size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                          {isUrdu ? 'کرایہ کی پیشکش اور گفت و شنید' : 'Direct Freight Offer & Price Negotiation'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {isUrdu ? 'تجویز کردہ مارکیٹ کرایہ دیکھ کر اپنی پیشکش درج کریں۔ ٹرانسپورٹر اسے قبول کر سکتا ہے یا جوابی پیشکش دے سکتا ہے۔' : 'Enter your proposed freight fare based on the recommended rate. Transporter can accept or counter-offer.'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/80 px-2.5 py-1 rounded-lg border border-orange-300 dark:border-orange-500/40 shrink-0">
                      {hasRouteSpecified ? (
                        `📍 ${pickupCity} → ${deliveryCity} (${estDistance} km Route)`
                      ) : pickupCity ? (
                        `📍 From ${pickupCity} (${estDistance} km Est.)`
                      ) : deliveryCity ? (
                        `📍 To ${deliveryCity} (${estDistance} km Est.)`
                      ) : (
                        `📍 ${originCity} → ${destinationCity} (${estDistance} km Est.)`
                      )}
                    </span>
                  </div>

                  {/* Recommended Market Benchmark Tariff Banner */}
                  <div className="bg-gradient-to-r from-orange-500/[0.08] via-amber-500/[0.06] to-transparent dark:from-orange-950/50 dark:to-slate-900/40 border border-orange-300/80 dark:border-orange-500/40 rounded-xl p-3.5 sm:p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-900 dark:text-orange-300 font-mono">
                          {isUrdu ? 'تجویز کردہ مارکیٹ کرایہ (Standard Benchmark):' : 'Recommended Standard Market Tariff:'}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200 border border-orange-300 dark:border-orange-600/40 font-mono">
                          {vehicleTypeChoice} &bull; {formatWeightTons(chargeableWeight)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {hasRouteSpecified ? (
                          isUrdu ? `${pickupCity} سے ${deliveryCity} کا سرکاری ہائی وے کرایہ برائے ${estDistance} کلومیٹر` : `NHA rate calculation for ${pickupCity} to ${deliveryCity} (${estDistance} km highway haul)`
                        ) : (
                          isUrdu ? 'راستہ، وزن اور گاڑی کے مطابق متوقع کرایہ' : `Estimated tariff based on ${estDistance} km road distance & cargo specs`
                        )}
                      </p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-1 shrink-0">
                      <span className="text-xl sm:text-2xl font-black text-orange-600 dark:text-[#F89020] font-mono tabular-nums">
                        Rs. {recommendedFare.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerOfferFare(String(recommendedFare));
                          setHasUserManuallyEditedOffer(true);
                        }}
                        className="text-[11px] font-bold text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-white underline cursor-pointer"
                      >
                        {isUrdu ? 'یہ کرایہ لاگو کریں' : 'Apply Standard Tariff'}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900/90 p-4 sm:p-5 rounded-xl border border-orange-200/80 dark:border-slate-700/80 shadow-2xs space-y-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex-1 w-full">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            {isUrdu ? 'آپ کا تجویز کردہ کرایہ (Your Proposed Offer) *' : 'Your Proposed Fare Offer (PKR) *'}
                          </label>
                          {Number(customerOfferFare) > 0 && Number(customerOfferFare) !== recommendedFare && (
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                              {Number(customerOfferFare) > recommendedFare 
                                ? `(+Rs. ${(Number(customerOfferFare) - recommendedFare).toLocaleString()} above standard)`
                                : `(-Rs. ${(recommendedFare - Number(customerOfferFare)).toLocaleString()} below standard)`}
                            </span>
                          )}
                        </div>
                        <div className="relative rounded-xl shadow-2xs">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-orange-600 font-bold font-mono text-base">
                            Rs.
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            onKeyDown={(e) => {
                              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                            }}
                            value={customerOfferFare}
                            onChange={(e) => {
                              const cleanVal = e.target.value.replace(/-/g, '').replace(/[eE]/g, '');
                              setCustomerOfferFare(cleanVal);
                              setHasUserManuallyEditedOffer(true);
                            }}
                            placeholder={String(recommendedFare)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-orange-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-900/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-lg outline-none transition-all"
                          />
                        </div>
                        {formErrors.offer && (
                          <p className="text-[11px] text-red-600 mt-1 font-semibold">{formErrors.offer}</p>
                        )}
                      </div>

                      {/* Dynamic offer presets relative to this delivery */}
                      <div className="w-full md:w-auto">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          {isUrdu ? 'تیز ترین پیشکشیں (Presets):' : 'Quick Offer Presets:'}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {bargainingPresets.map((preset) => {
                            const isRec = preset === recommendedFare;
                            const isSelected = String(customerOfferFare) === String(preset);
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  setCustomerOfferFare(String(preset));
                                  setHasUserManuallyEditedOffer(true);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-orange-600 text-white border-orange-600 shadow-xs scale-105'
                                    : isRec
                                      ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-500/50 hover:bg-orange-100'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-orange-400'
                                }`}
                              >
                                Rs. {preset.toLocaleString()} {isRec ? ' ★' : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Quick Increment Buttons tailored to delivery fare */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isUrdu ? 'کرایہ بڑھائیں:' : 'Quick Increase:'}
                      </span>
                      {quickIncrements.map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => {
                            const current = parseFloat(customerOfferFare) || recommendedFare;
                            setCustomerOfferFare(String(current + inc));
                            setHasUserManuallyEditedOffer(true);
                          }}
                          className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30 hover:bg-orange-100 transition-colors cursor-pointer"
                        >
                          +{inc.toLocaleString()}
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-auto font-medium">
                        {isUrdu ? '💡 ٹرانسپورٹر روانگی سے قبل آپ کی پیشکش کا جائزہ لے گا' : '💡 Transporter will review your proposed fare before confirming dispatch.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Error Summary if form submitted with errors */}
              {formSubmitted && Object.keys(formErrors).length > 0 && (
                <div ref={errorSummaryRef} className="bg-red-50 border-2 border-red-500 text-red-800 p-4 rounded-2xl flex items-start gap-3 shadow-lg">
                  <AlertCircle className="text-red-600 mt-0.5 shrink-0" size={20} />
                  <div className="text-xs">
                    <h5 className="font-bold text-sm text-red-900 mb-1">
                      {isUrdu ? 'براہ کرم درج ذیل غلطیوں کو درست کریں:' : 'Please correct the highlighted errors before submitting:'}
                    </h5>
                    <ul className="list-disc list-inside space-y-0.5 font-medium text-red-700">
                      {Object.values(formErrors).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Form actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 btn-primary text-white font-extrabold py-3.5 rounded-xl text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <PostCargoIcon size={18} className="shrink-0" />}
                  <span>{isSubmitting ? 'Submitting...' : (isUrdu ? 'کارگو پوسٹ کریں' : 'Post Cargo Request')}</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={(e) => handleRequestSubmit(e, 'Draft')}
                  className="flex-1 btn-outline text-slate-700 font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FileText size={16} /> Save as Draft
                </button>
              </div>

            </form>
          )}

          {/* TRACK SHIPMENTS TAB */}
          {activeTab === 'track' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase text-left font-sans">
                  {cargoList.filter(c => c.status !== 'Completed').length} active shipments in network
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
                {/* Left active cargo list */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 overflow-y-auto max-h-[500px] space-y-3 shadow-sm">
                  {cargoList
                    .filter(c => c.status !== 'Completed')
                    .map(c => {
                      const isDraft = c.status === 'Draft';
                      const isSelected = selectedCargo?._id === c._id;
                      return (
                        <div
                          key={c._id}
                          onClick={() => setSelectedCargo(c)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden ${isSelected
                              ? 'bg-orange-50/50 border-2 border-orange-600 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                            }`}
                        >
                          {isSelected && (
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#F89020]" />
                          )}
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1 pr-1">
                              <h4 className="font-mono text-xs text-orange-700 font-bold">
                                {c.assignedTruck && c.status !== 'Pending' ? `BLT-${c.id}` : `SHP-${c.id}`}
                              </h4>
                              <h4 className="font-bold text-slate-900 text-sm mt-0.5 truncate" title={c.title}>{c.title}</h4>
                              <p className="text-xs text-slate-600 mt-1 font-mono truncate">{c.transporterName} &middot; {formatWeightTons(c.weight)}</p>
                              {c.specialHandling && Array.isArray(c.specialHandling) && c.specialHandling.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {c.specialHandling.map((sh, idx) => (
                                    <span key={idx} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                      {sh.replace('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeStyle(c.status)}`}>
                              {c.status}
                            </span>
                          </div>
                          {isDraft && (
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200">
                              <span className="text-[10px] text-slate-500 font-bold uppercase select-none font-mono">Draft Mode</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDraft(c._id);
                                }}
                                className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                              >
                                Delete Draft
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {cargoList.filter(c => c.status !== 'Completed').length === 0 && (
                    <div className="text-center py-16 text-slate-500 text-sm">
                      <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-60" />
                      No active shipments in transit.
                    </div>
                  )}
                </div>

                {/* Right shipment progress pane */}
                <div className="lg:col-span-7 min-w-0 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col justify-between text-left shadow-xs relative overflow-hidden">
                  <SindhiTruckTexture />
                  {selectedCargo ? (
                    <div className="space-y-6 flex-1 flex flex-col justify-between relative z-10 min-w-0">
                      <div>
                        <div className="flex flex-wrap justify-between items-start border-b border-slate-200 pb-4 gap-2">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                                <GpsMapPin size={11} className="shrink-0" />
                                <span>{isUrdu ? 'لائیو ٹیلی میٹری ٹریکنگ' : 'Live Telemetry Track'}</span>
                              </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 break-words">{selectedCargo.title}</h3>
                            <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                              <GpsMapPin size={12} className="shrink-0" />
                              <span>{isUrdu ? 'منزل:' : 'Destination Hub:'} <strong className="text-slate-900 font-bold">{selectedCargo.destination}</strong></span>
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200 whitespace-nowrap">
                              {selectedCargo.assignedTruck && selectedCargo.status !== 'Pending' ? `BLT-${selectedCargo.id}` : `SHP-${selectedCargo.id}`}
                            </span>
                            {selectedCargo.assignedTruck && selectedCargo.status !== 'Pending' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = findAssociatedBooking(selectedCargo, false) || {
                                    cargoId: selectedCargo.id,
                                    cargoTitle: selectedCargo.title,
                                    truckPlate: selectedCargo.assignedTruck,
                                    transporterName: selectedCargo.transporterName,
                                    price: selectedCargo.totalFare ? selectedCargo.totalFare.toLocaleString() : 'Agreed Rate',
                                    cargo: selectedCargo
                                  };
                                  setBiltyModalBooking(matched);
                                }}
                                className="btn-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all whitespace-nowrap"
                              >
                                <FileText size={13} />
                                <span>{isUrdu ? 'بلٹی دیکھیں' : 'View e-Bilty'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setReportingCargo(selectedCargo)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 border border-red-300 dark:border-red-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                              title="Report Missing, Undelivered or Damaged Cargo"
                            >
                              <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />
                              <span>{isUrdu ? 'گمشدگی / نقصان رپورٹ کریں' : 'Report Missing Cargo'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Interactive MapViewer Displaying Assigned Truck Live Location, Route Polyline & Driver Telemetry */}
                        {(() => {
                          const assignedTruckObj = trucks.find(t =>
                            selectedCargo.assignedTruck && (t.plateNumber === selectedCargo.assignedTruck || String(t.id) === String(selectedCargo.assignedTruck))
                          );
                          const associatedBkg = bookings.find(b => Number(b.cargoId) === Number(selectedCargo.id || selectedCargo._id) && b.status !== 'Completed');

                          const routeData = {
                            origin: selectedCargo.origin,
                            destination: selectedCargo.destination.split(',')[0],
                            truckCoords: assignedTruckObj ? [assignedTruckObj.lat, assignedTruckObj.lng] : null,
                            truckPlate: selectedCargo.assignedTruck,
                            driverName: assignedTruckObj?.driverName,
                            driverMobile: assignedTruckObj?.driverMobile,
                            eta: associatedBkg?.eta
                          };

                          return (
                            <div className="mt-4 mb-2">
                              <MapViewer
                                route={routeData}
                                title={selectedCargo.assignedTruck ? `TRUCK ${selectedCargo.assignedTruck} LIVE GPS` : 'CARGO ROUTE TELEMETRY'}
                                color={selectedCargo.status === 'In Transit' ? 'neon-blue' : 'rose'}
                                height="280px"
                              />
                            </div>
                          );
                        })()}

                        {/* Details specifications */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-5 sm:mt-6 text-xs text-slate-700">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Transporter</p>
                            <p className="font-semibold text-slate-900 mt-0.5">{selectedCargo.transporterName}</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weight</p>
                            <p className="font-semibold text-slate-900 mt-0.5 font-mono">{formatWeightTons(selectedCargo.weight)}</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Route</p>
                            <p className="font-semibold text-slate-900 mt-0.5">
                              {selectedCargo.origin} &rarr; {selectedCargo.destination.split(',')[0]}
                            </p>
                          </div>
                          {selectedCargo.assignedTruck && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assigned Truck</p>
                              <p className="font-semibold text-orange-700 font-mono mt-0.5">{selectedCargo.assignedTruck}</p>
                            </div>
                          )}
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Packaging</p>
                            <p className="font-semibold text-slate-900 mt-0.5">{selectedCargo.packagingType || 'Cartons / Boxes'}</p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billing Terms</p>
                            <p className="font-semibold text-emerald-800 mt-0.5">{selectedCargo.paymentTerms || 'Prepaid'}</p>
                          </div>

                          {/* Fare Bargaining & Counter-Offer Status Card */}
                          <div className="col-span-full">
                            {selectedCargo.counterFare && selectedCargo.counterBy === 'transporter' ? (
                              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-2 border-orange-400 dark:border-orange-500/50 p-4 sm:p-5 rounded-2xl shadow-md space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp size={20} className="text-orange-600 animate-pulse shrink-0" />
                                    <div>
                                      <h4 className="text-sm font-extrabold text-orange-900 dark:text-orange-200">
                                        {isUrdu ? 'ٹرانسپورٹر کی کرایہ بڑھانے کی پیشکش (Counter-Offer)' : 'Transporter Counter-Offered Higher Fare!'}
                                      </h4>
                                      <p className="text-xs text-orange-700 dark:text-orange-300">
                                        {isUrdu ? 'ٹرانسپورٹر نے نیا کرایہ تجویز کیا ہے:' : 'Transporter proposed a revised fare:'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xs text-slate-500 line-through mr-2">
                                      Rs. {Number(selectedCargo.totalFare || selectedCargo.baseFare).toLocaleString()}
                                    </span>
                                    <span className="text-xl font-black font-mono text-orange-600 dark:text-orange-400">
                                      Rs. {Number(selectedCargo.counterFare).toLocaleString()}
                                    </span>
                                  </div>
                                </div>

                                {selectedCargo.counterNote && (
                                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-orange-200 dark:border-orange-900/40 italic">
                                    💬 "{selectedCargo.counterNote}"
                                  </p>
                                )}

                                {!showReOfferInput ? (
                                  <div className="flex flex-wrap gap-2.5 pt-1">
                                    <button
                                      type="button"
                                      disabled={isBargainingAction}
                                      onClick={() => handleCustomerAcceptCounter(selectedCargo)}
                                      className="flex-1 btn-primary text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                                    >
                                      {isBargainingAction ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={16} />}
                                      <span>{isUrdu ? 'ٹھیک ہے / پیشکش قبول کریں' : 'Accept Counter-Offer'} (Rs. {Number(selectedCargo.counterFare).toLocaleString()})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReOfferAmount(String(Math.round(((selectedCargo.totalFare || 0) + selectedCargo.counterFare) / 2)));
                                        setShowReOfferInput(true);
                                      }}
                                      className="btn-outline text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-slate-800 dark:text-slate-200"
                                    >
                                      <Repeat size={15} />
                                      <span>{isUrdu ? 'مزید بارگیننگ کریں' : 'Counter Back / Re-Offer'}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-orange-300 dark:border-orange-500/50 space-y-2.5">
                                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                                      {isUrdu ? 'اپنی جوابی پیشکش درج کریں (Re-Offer Fare):' : 'Enter Your Counter-Offer (PKR):'}
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        min="0"
                                        step="500"
                                        onKeyDown={(e) => {
                                          if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
                                        }}
                                        value={reOfferAmount}
                                        onChange={(e) => {
                                          const cleanVal = e.target.value.replace(/-/g, '').replace(/[eE]/g, '');
                                          setReOfferAmount(cleanVal);
                                        }}
                                        className="flex-1 px-3 py-2 border rounded-xl font-mono font-bold text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-orange-500"
                                      />
                                      <button
                                        type="button"
                                        disabled={isBargainingAction}
                                        onClick={() => handleCustomerReOffer(selectedCargo)}
                                        className="btn-primary text-xs font-bold px-4 py-2 rounded-xl whitespace-nowrap cursor-pointer"
                                      >
                                        {isBargainingAction ? <Loader2 size={14} className="animate-spin" /> : (isUrdu ? 'بھیجیں' : 'Send Offer')}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowReOfferInput(false)}
                                        className="btn-outline text-xs px-3 py-2 rounded-xl cursor-pointer"
                                      >
                                        {isUrdu ? 'منسوخ' : 'Cancel'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : selectedCargo.fareStatus === 'Counter-Offered' && selectedCargo.counterBy === 'customer' ? (
                              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                                  <Clock size={16} className="text-amber-600 shrink-0" />
                                  <span>{isUrdu ? 'آپ کی جوابی پیشکش بھیج دی گئی ہے — ٹرانسپورٹر کے جواب کا انتظار ہے۔' : 'Your counter-offer has been sent. Awaiting Transporter response.'}</span>
                                </div>
                                <span className="font-mono font-bold text-amber-700 dark:text-amber-300 text-sm shrink-0">
                                  Rs. {Number(selectedCargo.totalFare).toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
                                    {selectedCargo.status === 'Accepted' || selectedCargo.fareStatus === 'Agreed' ? '🤝 Agreed Fare' : '💬 Proposed Fare Offer'}
                                  </span>
                                  <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                                    Rs. {Number(selectedCargo.totalFare || selectedCargo.baseFare || 0).toLocaleString()}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                                  selectedCargo.status === 'Accepted' || selectedCargo.fareStatus === 'Agreed'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-orange-50 text-orange-800 border border-orange-200'
                                }`}>
                                  {selectedCargo.status === 'Accepted' || selectedCargo.fareStatus === 'Agreed' ? 'Fare Locked' : 'Offer Pending'}
                                </span>
                              </div>
                            )}
                          </div>
                          {(() => {
                            const associatedBkg = bookings.find(b => Number(b.cargoId) === Number(selectedCargo.id || selectedCargo._id) && b.status !== 'Completed');
                            return associatedBkg ? (
                              <>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agreed Price</p>
                                  <p className="font-semibold text-emerald-700 mt-0.5 font-mono">{formatFreightPrice(associatedBkg.price)}</p>
                                </div>
                                {associatedBkg.eta && (
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ETA</p>
                                    <p className="font-semibold text-slate-800 mt-0.5 font-mono">{associatedBkg.eta}</p>
                                  </div>
                                )}
                              </>
                            ) : null;
                          })()}
                          {selectedCargo.specialHandling && Array.isArray(selectedCargo.specialHandling) && selectedCargo.specialHandling.length > 0 && (
                            <div className="col-span-full bg-amber-50 p-3 rounded-xl border border-amber-200">
                              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5">Special Handling Directives</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selectedCargo.specialHandling.map((h, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200">
                                    ⚠ {h.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Transit Progression Line */}
                        {selectedCargo.status !== 'Draft' && (
                          <div className="mt-6 sm:mt-8 bg-slate-50 border border-slate-200 p-3.5 sm:p-5 rounded-xl shadow-2xs">
                            <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-4 sm:mb-5">Transit Progression</h4>
                            <div className="flex justify-between items-center relative px-1 sm:px-4 gap-1">
                              {/* Connector line */}
                              <div className="absolute left-5 right-5 sm:left-8 sm:right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-200 -z-1"></div>

                              {[
                                { label: 'Pending', step: 'Pending' },
                                { label: 'Assigned', step: 'Truck Assigned' },
                                { label: 'Transit', step: 'In Transit' },
                                { label: 'Delivered', step: 'Delivered' }
                              ].map((s, index) => {
                                const steps = ['Pending', 'Accepted', 'Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'];
                                const currentIdx = steps.indexOf(selectedCargo.status);
                                const stepIdx = steps.indexOf(s.step);
                                const isCompleted = currentIdx >= stepIdx;

                                return (
                                  <div key={index} className="flex flex-col items-center gap-2 z-10">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isCompleted
                                        ? 'bg-orange-600 text-white shadow-2xs'
                                        : 'bg-white border-2 border-slate-300 text-slate-400'
                                      }`}>
                                      {isCompleted ? <Check size={13} strokeWidth={3} /> : index + 1}
                                    </div>
                                    <span className={`text-[10px] font-bold ${isCompleted ? 'text-orange-700' : 'text-slate-500'}`}>{s.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Pickup & Consignees details */}
                        <div className="mt-6 border-t border-slate-200 pt-4 space-y-4">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Pickup Address</h4>
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700">
                            <p><span className="text-slate-500 font-medium">Point:</span> {selectedCargo.pickupDetails?.address || selectedCargo.pickupDetails?.streetAddress || 'Corporate depot'}</p>
                            <p className="mt-1"><span className="text-slate-500 font-medium">Contact:</span> {selectedCargo.pickupDetails?.contactName || selectedCargo.pickupDetails?.contact || '-'} ({selectedCargo.pickupDetails?.phone || selectedCargo.pickupDetails?.contactPhone || '-'})</p>
                          </div>
                        </div>
                      </div>

                      {/* Rejection Notification if rejected */}
                      {selectedCargo.status === 'Rejected' && selectedCargo.rejectionReason && (
                        <div className="mt-6 border-t border-slate-200 pt-4">
                          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex gap-3 text-xs leading-relaxed">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Shipment Request Rejected</p>
                              <p className="text-slate-700 mt-1">Reason: "{selectedCargo.rejectionReason}"</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 py-16 relative z-10">
                      <Package size={36} className="text-slate-400" />
                      <p className="text-sm font-medium font-sans">Select a shipment to track progress</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TRANSPORTERS DIRECTORY TAB */}
          {activeTab === 'transporters' && (
            <div className="space-y-6 text-left">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    {transporters.length} verified transporters available
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isUrdu 
                      ? `آپ کے شہر (${userCity}) کے قریب ترین ٹرانسپورٹرز اوپر دکھائے جا رہے ہیں` 
                      : `Transporters nearest to your city (${userCity}) are prioritized at the top`}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {sortedTransportersForDirectory.map(t => {
                  const isLocal = t._proximityDistance === 0;
                  return (
                    <div key={t._id} className={`bg-white border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden ${
                      isLocal ? 'border-emerald-300 ring-1 ring-emerald-400/20' : 'border-slate-200'
                    }`}>
                      <div className="flex items-start gap-3 sm:gap-4 relative z-10 min-w-0 flex-1">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex items-center justify-center shrink-0 shadow-2xs">
                          <Users size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-wide break-words">{t.name}</h4>
                            {t._proximityBadge && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-mono shadow-2xs shrink-0 ${t._proximityBadge.className}`}>
                                {t._proximityBadge.text}
                              </span>
                            )}
                            <span className="text-xs text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono shadow-2xs shrink-0">
                              {getTransporterRating(t.shipmentsCount || 0)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5 font-mono break-all">
                            {t.phone || '0300-1112223'} &middot; <span className="text-orange-700 font-sans font-semibold">{t.email}</span>
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            <span className="bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-0.5 rounded-md font-mono">
                              Base Hub: {t.city || 'Lahore'}
                            </span>
                            {t.businessName && (
                              <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                {t.businessName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 sm:gap-4 w-full md:w-auto shrink-0 relative z-10 pt-2 md:pt-0 border-t border-slate-200/70 md:border-t-0">
                        <span className="text-xs sm:text-sm text-slate-600 font-bold font-mono">
                          {t.shipmentsCount || 0} shipments
                        </span>
                        <button
                          onClick={() => {
                            setSelectedTransporter(t);
                            setActiveTab('new-request');
                          }}
                          className="btn-primary px-4 py-2 text-xs shadow-sm transition-all shrink-0 whitespace-nowrap cursor-pointer"
                        >
                          Send Request
                        </button>
                      </div>
                    </div>
                  );
                })}
                {sortedTransportersForDirectory.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 shadow-sm">
                    No verified transporters listed.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 text-left shadow-xs relative overflow-hidden">
                <SindhiTruckTexture />
                <div className="flex flex-wrap justify-between items-center gap-2 mb-5 sm:mb-6 relative z-10">
                  <h3 className="text-xs font-bold text-slate-700 tracking-wider uppercase">Delivery History</h3>
                  <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 shrink-0">
                    Total Completed: {cargoList.filter(c => c.status === 'Completed').length}
                  </span>
                </div>

                <div className="overflow-x-auto touch-scroll relative z-10">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
                        <th className="py-3 px-3">Shipment ID</th>
                        <th className="py-3 px-3">Bilty No.</th>
                        <th className="py-3 px-3">Transporter</th>
                        <th className="py-3 px-3">Route</th>
                        <th className="py-3 px-3">Weight</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cargoList
                        .filter(c => c.status === 'Completed')
                        .map((c, idx) => (
                          <tr key={c._id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-3 font-mono text-slate-600">SHP-{c.id || 10400 + idx}</td>
                            <td className="py-4 px-3">
                              <button
                                onClick={() => handleBiltyClick(c)}
                                className="font-mono font-bold text-orange-700 hover:underline cursor-pointer"
                              >
                                BLT-{c.id || 88000 + idx}
                              </button>
                            </td>
                            <td className="py-4 px-3 font-bold text-slate-900">{c.transporterName || 'Unassigned'}</td>
                            <td className="py-4 px-3 text-slate-700">
                              {c.origin} &rarr; {c.destination.split(',')[0]}
                            </td>
                            <td className="py-4 px-3 text-slate-700 font-mono">{formatWeightTons(c.weight)}</td>
                            <td className="py-4 px-3 text-slate-600 font-mono text-xs">
                              {c.createdAt ? c.createdAt.split('T')[0] : '—'}
                            </td>
                            <td className="py-4 px-3">
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
                                DELIVERED
                              </span>
                            </td>
                            <td className="py-4 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setReportingCargo(c)}
                                className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
                              >
                                Report Issue
                              </button>
                            </td>
                          </tr>
                        ))}
                      {cargoList.filter(c => c.status === 'Completed').length === 0 && (
                        <tr>
                          <td colSpan="8" className="text-center py-12 text-slate-500 italic">No completed delivery history found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LOST & MISSING CARGO CLAIMS TAB */}
          {activeTab === 'lost_cargo' && (
            <LostCargoPortal userRole="business" currentUserId={userData?.id || currentUser?.id} />
          )}

        </div>
      )}

      {/* Report Missing Cargo Modal */}
      <ReportMissingCargoModal
        isOpen={Boolean(reportingCargo)}
        onClose={() => setReportingCargo(null)}
        cargo={reportingCargo}
        onReportSuccess={() => {
          fetchData();
          setActiveTab('lost_cargo');
        }}
      />

      {/* Official Bilty Preview & Print Modal */}
      <BiltyModal
        booking={biltyModalBooking}
        onClose={() => setBiltyModalBooking(null)}
      />

    </div>
  );
}
