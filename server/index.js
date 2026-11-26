const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const { Op } = require('sequelize');
const sequelize = require('./db');
const User = require('./models/User');
const { Truck, Cargo, Booking, BookingMessage, Notification, Complaint, LostCargoReport, LostCargoLog } = require('./models/Logistics');
const { uploadToCloudinary } = require('./services/cloudinary');
const { autoSeedDatabase } = require('./autoSeed');
const { parseWeightToKg, formatWeightDisplay, computeCapacityMetrics } = require('./utils/capacity');
const {
  initWhatsApp,
  restartWhatsApp,
  sendWhatsAppMessage,
  notifyCargoCreated,
  notifyBookingOffer,
  notifyBookingStatusUpdate,
  notifyDeliveryCompleted,
  getWhatsAppStatus
} = require('./services/whatsapp');


const app = express();

// Allow Chromium Private Network Access (http://localhost WebView -> LAN IP) alongside CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.path === '/api/health' || req.path.startsWith('/api/auth/')) {
    console.log(`[API] ${req.method} ${req.originalUrl} from ${req.ip}`);
  }
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));
app.use(express.json());

// Lightweight health check endpoint for mobile IP verification
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Public sanitized fleet & network overview (no PII) for interactive landing explorer
app.get('/api/public/overview', async (req, res) => {
  try {
    const [
      totalTrucks,
      availableTrucks,
      inTransitTrucks,
      totalBilties,
      completedDeliveries,
      trucks,
      cargos
    ] = await Promise.all([
      Truck.count(),
      Truck.count({ where: { status: 'Available' } }),
      Truck.count({ where: { status: 'In Transit' } }),
      Cargo.count({ where: { status: { [Op.in]: ['Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'] } } }),
      Cargo.count({ where: { status: { [Op.in]: ['Delivered', 'Completed'] } } }),
      Truck.findAll({
        attributes: ['id', 'plateNumber', 'capacity', 'loc', 'status', 'truckType', 'fitnessDoc', 'insuranceDoc'],
        order: [['status', 'ASC'], ['id', 'DESC']],
        limit: 24
      }),
      Cargo.findAll({
        where: { status: { [Op.in]: ['Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'] } },
        attributes: ['id', 'title', 'origin', 'destination', 'weight', 'status', 'assignedTruck', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 8
      })
    ]);

    const cities = new Set();
    const fleetVehicles = trucks.map((t) => {
      if (t.loc) cities.add(t.loc);
      return {
        id: t.id,
        plateNumber: t.plateNumber,
        truckType: t.truckType || 'Commercial Carrier',
        capacity: t.capacity,
        loc: t.loc,
        status: t.status,
        verified: Boolean(t.fitnessDoc && t.insuranceDoc),
      };
    });

    const recentDispatches = cargos.map((c) => {
      if (c.origin) cities.add(c.origin);
      if (c.destination) cities.add(c.destination);
      return {
        id: c.id,
        biltyNo: `BLT-${c.id}`,
        title: c.title,
        origin: c.origin,
        destination: c.destination,
        weight: c.weight,
        status: c.status,
        assignedTruck: c.assignedTruck || null,
      };
    });

    res.json({
      stats: {
        totalTrucks,
        availableTrucks,
        inTransitTrucks,
        totalBilties,
        completedDeliveries,
        activeHubs: cities.size,
      },
      fleetVehicles,
      recentDispatches,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── File Upload Setup ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Serve uploaded files as static assets
app.use('/uploads', express.static(uploadsDir));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

// ─── Auth Routes ───────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, cnic, phone, businessName, businessRegNumber, city } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    let safeRole = (role || 'business').toLowerCase().trim();
    if (safeRole === 'fleet-owner' || safeRole === 'fleet_owner' || safeRole === 'driver') safeRole = 'truck_owner';
    if (safeRole === 'shipper') safeRole = 'business';

    const status = safeRole === 'admin' ? 'active' : 'pending';
    const user = await User.create({ name, email, password, role: safeRole, status, cnic, phone, businessName, businessRegNumber, city: city || 'Lahore' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name, email, role: user.role, status, cnic, phone, businessName, businessRegNumber, city: user.city } });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, city: user.city || 'Lahore', phone: user.phone, businessName: user.businessName } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── JWT Middleware ────────────────────────────────────────────────────────────

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    await User.update(req.body, { where: { id: req.user.id } });
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── File Upload Route ─────────────────────────────────────────────────────────

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename, originalname: req.file.originalname });
});

// ─── Socket.io Setup ───────────────────────────────────────────────────────────

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`User ${userId} joined room`);
    }
  });
  socket.on('disconnect', () => console.log('User disconnected'));
});

// ─── Initialize WhatsApp Web Client ──────────────────────────────────────────
initWhatsApp(io);

// ─── WhatsApp Status & Test Endpoints ────────────────────────────────────────
app.get('/api/whatsapp/status', authMiddleware, (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post('/api/whatsapp/restart', authMiddleware, async (req, res) => {
  const { clearSession } = req.body || {};
  const result = await restartWhatsApp(Boolean(clearSession));
  res.json(result);
});

app.post('/api/whatsapp/test', authMiddleware, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone number is required' });
  const result = await sendWhatsAppMessage(phone, message || 'Hello from E-Cargo-Bilty WhatsApp Service!');
  res.json(result);
});


// ─── Notification Helper ───────────────────────────────────────────────────────

const sendNotification = async (userId, message) => {
  try {
    const notification = await Notification.create({ userId, message });
    io.to(userId.toString()).emit('notification', notification);
  } catch (e) {
    console.error(e);
  }
};

// ─── Truck Capacity Tracking Helpers ──────────────────────────────────────────

/**
 * Calculates current active used capacity in kg for a truck based on all ongoing bookings and active cargo
 */
async function getTruckActiveUsedCapacity(truckId, plateNumber) {
  const activeBookings = await Booking.findAll({
    where: {
      [Op.or]: [
        { truckId: truckId },
        plateNumber ? { truckPlate: plateNumber } : null
      ].filter(Boolean),
      status: { [Op.notIn]: ['Completed', 'Cancelled', 'Rejected'] }
    },
    include: [{ model: Cargo, as: 'cargo' }]
  });

  const seenCargoIds = new Set();
  let usedKg = 0;

  for (const b of activeBookings) {
    if (b.cargo) {
      seenCargoIds.add(b.cargo.id);
      usedKg += parseWeightToKg(b.cargo.chargeableWeight || b.cargo.weight);
    }
  }

  if (plateNumber) {
    const activeCargos = await Cargo.findAll({
      where: {
        assignedTruck: plateNumber,
        status: { [Op.in]: ['Truck Assigned', 'Loaded', 'In Transit'] }
      }
    });

    for (const c of activeCargos) {
      if (!seenCargoIds.has(c.id)) {
        seenCargoIds.add(c.id);
        usedKg += parseWeightToKg(c.chargeableWeight || c.weight);
      }
    }
  }

  return usedKg;
}

/**
 * Enriches an array of trucks with real-time capacity metrics (total, used, remaining, fill percentage)
 */
async function enrichTrucksWithCapacity(trucks) {
  const [activeBookings, activeCargos] = await Promise.all([
    Booking.findAll({
      where: {
        status: { [Op.notIn]: ['Completed', 'Cancelled', 'Rejected'] }
      },
      include: [{ model: Cargo, as: 'cargo' }]
    }),
    Cargo.findAll({
      where: {
        status: { [Op.in]: ['Truck Assigned', 'Loaded', 'In Transit'] },
        assignedTruck: { [Op.ne]: null }
      }
    })
  ]);

  const usedKgByTruckId = {};
  const usedKgByPlate = {};
  const seenCargoIds = new Set();

  for (const b of activeBookings) {
    if (b.cargo) {
      seenCargoIds.add(b.cargo.id);
      const wt = parseWeightToKg(b.cargo.chargeableWeight || b.cargo.weight);
      usedKgByTruckId[b.truckId] = (usedKgByTruckId[b.truckId] || 0) + wt;
      if (b.truckPlate) {
        usedKgByPlate[b.truckPlate] = (usedKgByPlate[b.truckPlate] || 0) + wt;
      }
    }
  }

  for (const c of activeCargos) {
    if (!seenCargoIds.has(c.id) && c.assignedTruck) {
      seenCargoIds.add(c.id);
      const wt = parseWeightToKg(c.chargeableWeight || c.weight);
      usedKgByPlate[c.assignedTruck] = (usedKgByPlate[c.assignedTruck] || 0) + wt;
    }
  }

  return trucks.map(t => {
    const plain = typeof t.toJSON === 'function' ? t.toJSON() : { ...t };
    const usedKg = usedKgByTruckId[t.id] || usedKgByPlate[t.plateNumber] || 0;
    const metrics = computeCapacityMetrics(plain, usedKg);

    return {
      ...plain,
      id: t.id,
      _id: t.id,
      coordinates: [t.lat, t.lng],
      ownerName: plain.owner ? (plain.owner.businessName || plain.owner.name) : 'Unknown',
      ...metrics
    };
  });
}

// ─── Truck Routes ──────────────────────────────────────────────────────────────

app.get('/api/trucks', authMiddleware, async (req, res) => {
  try {
    const where = {};
    if (req.query.ownerId) where.ownerId = req.query.ownerId;
    if (req.query.status) where.status = req.query.status;

    const trucks = await Truck.findAll({
      where,
      include: [{ model: User, as: 'owner', attributes: ['name', 'phone', 'businessName'] }]
    });

    const enrichedResult = await enrichTrucksWithCapacity(trucks);
    res.json(enrichedResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/trucks', authMiddleware, async (req, res) => {
  try {
    const { id: plateNumber, capacity, loc, status, coordinates, truckType, driverName, driverMobile, fitnessDoc, insuranceDoc, totalCapacity, total_capacity } = req.body;
    const [lat, lng] = coordinates || [31.5204, 74.3587];

    const numericTotalCapacity = totalCapacity || total_capacity 
      ? parseWeightToKg(totalCapacity || total_capacity, false)
      : parseWeightToKg(capacity, true);

    const safeCapacityString = capacity && String(capacity).trim() !== ''
      ? String(capacity).trim()
      : `${(numericTotalCapacity / 1000).toFixed(1)} Tons`;

    const truck = await Truck.create({
      plateNumber,
      capacity: safeCapacityString,
      totalCapacity: numericTotalCapacity,
      usedCapacity: 0,
      loc,
      ownerId: req.user.id,
      status: status || 'Available',
      lat,
      lng,
      truckType,
      driverName,
      driverMobile,
      fitnessDoc,
      insuranceDoc
    });

    const metrics = computeCapacityMetrics(truck.toJSON(), 0);
    res.status(201).json({ ...truck.toJSON(), _id: truck.id, coordinates: [truck.lat, truck.lng], ...metrics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/trucks/:id', authMiddleware, async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.id;
    delete updateData._id;
    if (req.body.coordinates) {
      updateData.lat = req.body.coordinates[0];
      updateData.lng = req.body.coordinates[1];
      delete updateData.coordinates;
    }
    if (req.body.plateNumber !== undefined) {
      updateData.plateNumber = req.body.plateNumber;
    } else if (
      typeof req.body.id === 'string' &&
      req.body.id.trim() !== '' &&
      req.body.id !== String(req.params.id) &&
      !/^\d+$/.test(req.body.id.trim())
    ) {
      updateData.plateNumber = req.body.id;
    }

    if (req.body.totalCapacity || req.body.total_capacity) {
      updateData.totalCapacity = parseWeightToKg(req.body.totalCapacity || req.body.total_capacity, false);
    } else if (req.body.capacity) {
      updateData.totalCapacity = parseWeightToKg(req.body.capacity, true);
    }

    await Truck.update(updateData, { where: { id: req.params.id } });
    const truck = await Truck.findByPk(req.params.id, {
      include: [{ model: User, as: 'owner', attributes: ['name', 'phone', 'businessName'] }]
    });
    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    const usedKg = await getTruckActiveUsedCapacity(truck.id, truck.plateNumber);
    const metrics = computeCapacityMetrics(truck.toJSON(), usedKg);

    res.json({ ...truck.toJSON(), _id: truck.id, coordinates: [truck.lat, truck.lng], ...metrics });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/trucks/:id', authMiddleware, async (req, res) => {
  try {
    await Truck.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Truck deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Cargo Routes ──────────────────────────────────────────────────────────────

const safeParseJson = (val, fallback) => {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    const parsed = JSON.parse(val);
    return parsed != null ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

const formatCargo = (c) => {
  if (!c) return null;
  const plain = typeof c.toJSON === 'function' ? c.toJSON() : c;
  return {
    ...plain,
    products: safeParseJson(plain.products, []),
    receivingVerification: safeParseJson(plain.receivingVerification, null),
    hasShortage: Boolean(plain.hasShortage),
    shortageNote: plain.shortageNote || null,
    pickupDetails: safeParseJson(plain.pickupDetails, {}),
    recipients: safeParseJson(plain.recipients, []),
    dimensions: safeParseJson(plain.dimensions, {}),
    specialHandling: safeParseJson(plain.specialHandling, []),
    packagingType: plain.packagingType || 'Cartons / Boxes',
    paymentTerms: plain.paymentTerms || 'Prepaid',
    _id: plain.id,
    transporterName: plain.transporter ? plain.transporter.name : (plain.transporterName || 'Unassigned'),
    businessOwnerName: plain.businessOwner ? (plain.businessOwner.businessName || plain.businessOwner.name) : (plain.businessOwnerName || 'Unknown')
  };
};

app.get('/api/cargo', authMiddleware, async (req, res) => {
  try {
    const where = {};
    if (req.query.transporterId) {
      where.transporterId = req.query.transporterId;
      where.status = { [Op.ne]: 'Draft' };
    }
    if (req.query.businessOwnerId) {
      where.businessOwnerId = req.query.businessOwnerId;
    }
    const cargo = await Cargo.findAll({
      where,
      include: [
        { model: User, as: 'transporter', attributes: ['name', 'phone'] },
        { model: User, as: 'businessOwner', attributes: ['name', 'phone', 'businessName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(cargo.map(c => formatCargo(c)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/cargo', authMiddleware, async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.user.role === 'business') {
      data.businessOwnerId = req.user.id;
    } else if (req.user.role === 'transporter') {
      data.transporterId = req.user.id;
    }

    // Defensively sanitize numeric values to prevent negative weights, dimensions, or fares
    if (data.weight !== undefined) data.weight = Math.max(0, parseFloat(data.weight) || 0);
    if (data.chargeableWeight !== undefined) data.chargeableWeight = Math.max(0, parseFloat(data.chargeableWeight) || 0);
    if (data.baseFare !== undefined) data.baseFare = Math.max(0, parseFloat(data.baseFare) || 0);
    if (data.totalFare !== undefined) data.totalFare = Math.max(0, parseFloat(data.totalFare) || 0);
    if (data.counterFare !== undefined) data.counterFare = Math.max(0, parseFloat(data.counterFare) || 0);

    if (data.products) {
      let prods = Array.isArray(data.products) ? data.products : safeParseJson(data.products, []);
      if (Array.isArray(prods)) {
        prods = prods.map(p => ({
          ...p,
          qty: Math.max(1, parseInt(p.qty) || 1),
          unitWeight: Math.max(0, parseFloat(p.unitWeight) || 0),
          lengthCm: Math.max(0, parseFloat(p.lengthCm) || 0),
          widthCm: Math.max(0, parseFloat(p.widthCm) || 0),
          heightCm: Math.max(0, parseFloat(p.heightCm) || 0)
        }));
        data.products = prods;
      }
    }

    // InDrive bargaining defaults
    if (!data.fareStatus) {
      data.fareStatus = 'Offered';
    }

    // Auto-generate 4-digit pickup OTP for physical gate-pass verification
    if (!data.pickupCode) {
      data.pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    }
    const cargo = await Cargo.create(data);

    // Notify transporter about new cargo offer
    if (cargo.transporterId) {
      const offeredPrice = cargo.totalFare ? Number(cargo.totalFare).toLocaleString() : 'Negotiable';
      sendNotification(cargo.transporterId, `📦 New Cargo Offer: Customer offered Rs. ${offeredPrice} for "${cargo.title}". You can accept or bargain!`).catch(() => {});
    }
    io.emit('booking_updated');

    // Trigger WhatsApp notification for new shipment
    User.findByPk(cargo.businessOwnerId).then(shipper => {
      const recipients = safeParseJson(cargo.recipients, []);
      notifyCargoCreated(cargo, shipper, recipients);
    }).catch(e => console.error('WhatsApp notifyCargoCreated error:', e.message));

    res.status(201).json({ ...cargo.toJSON(), _id: cargo.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/cargo/:id', authMiddleware, async (req, res) => {
  try {
    if (req.body.weight !== undefined) req.body.weight = Math.max(0, parseFloat(req.body.weight) || 0);
    if (req.body.chargeableWeight !== undefined) req.body.chargeableWeight = Math.max(0, parseFloat(req.body.chargeableWeight) || 0);
    if (req.body.baseFare !== undefined) req.body.baseFare = Math.max(0, parseFloat(req.body.baseFare) || 0);
    if (req.body.totalFare !== undefined) req.body.totalFare = Math.max(0, parseFloat(req.body.totalFare) || 0);
    if (req.body.counterFare !== undefined) req.body.counterFare = Math.max(0, parseFloat(req.body.counterFare) || 0);

    if (req.body.assignedTruck) {
      const existingCargo = await Cargo.findByPk(req.params.id);
      const truck = await Truck.findOne({ where: { plateNumber: req.body.assignedTruck } });
      if (truck && existingCargo) {
        const cargoWeightKg = parseWeightToKg(req.body.chargeableWeight || req.body.weight || existingCargo.chargeableWeight || existingCargo.weight);
        const currentUsedKg = await getTruckActiveUsedCapacity(truck.id, truck.plateNumber);
        const capacityMetrics = computeCapacityMetrics(truck, currentUsedKg);
        if (cargoWeightKg > 0 && cargoWeightKg > capacityMetrics.remaining_capacity) {
          return res.status(400).json({
            message: `Insufficient truck capacity. Remaining: ${capacityMetrics.remaining_capacity_display}, required: ${cargoWeightKg.toLocaleString()} kg (${(cargoWeightKg / 1000).toFixed(1)} Tons).`,
            remainingCapacity: capacityMetrics.remaining_capacity,
            requiredWeight: cargoWeightKg,
            fillPercentage: capacityMetrics.fill_percentage
          });
        }
      }
    }

    await Cargo.update(req.body, { where: { id: req.params.id } });
    const cargo = await Cargo.findByPk(req.params.id);

    // Bargaining notifications between customer and transporter
    if (req.body.fareStatus === 'Agreed' && cargo.transporterId) {
      const agreedFare = cargo.totalFare ? Number(cargo.totalFare).toLocaleString() : '';
      sendNotification(cargo.transporterId, `✅ Customer accepted the counter-offer of Rs. ${agreedFare} for "${cargo.title}"! Deal confirmed.`).catch(() => {});
    } else if (req.body.fareStatus === 'Counter-Offered' && req.body.counterBy === 'customer' && cargo.transporterId) {
      const reOffer = cargo.totalFare ? Number(cargo.totalFare).toLocaleString() : '';
      sendNotification(cargo.transporterId, `💬 Customer re-offered Rs. ${reOffer} for "${cargo.title}".`).catch(() => {});
    }

    // If status updated on cargo, trigger WhatsApp notification if booking exists
    if (['In Transit', 'Loaded', 'Completed'].includes(req.body.status)) {
      Booking.findOne({ where: { cargoId: cargo.id } }).then(async (booking) => {
        if (booking) {
          const truck = await Truck.findByPk(booking.truckId);
          const shipper = cargo.businessOwnerId ? await User.findByPk(cargo.businessOwnerId) : null;
          const transporter = booking.transporterId ? await User.findByPk(booking.transporterId) : null;
          let recipients = [];
          if (typeof cargo.recipients === 'string') {
            recipients = safeParseJson(cargo.recipients, []);
          } else if (Array.isArray(cargo.recipients)) {
            recipients = cargo.recipients;
          }
          notifyBookingStatusUpdate({
            booking,
            status: req.body.status,
            cargo,
            truck,
            shipper,
            transporter,
            recipients
          });
        }
      }).catch(e => console.error('WhatsApp cargo patch notification error:', e.message));
    }

    io.emit('booking_updated');
    res.json({ ...cargo.toJSON(), _id: cargo.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/cargo/:id/respond', authMiddleware, async (req, res) => {
  try {
    const {
      status,
      rejectionReason,
      counterFare,
      counterNote,
      counterBy,
      totalFare,
      fareStatus,
      receivingVerification,
      hasShortage,
      shortageNote,
      products,
      chargeableWeight,
      weight
    } = req.body;
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;
    if (counterFare !== undefined) updateData.counterFare = counterFare;
    if (counterNote !== undefined) updateData.counterNote = counterNote;
    if (counterBy !== undefined) updateData.counterBy = counterBy;
    if (totalFare !== undefined) updateData.totalFare = totalFare;
    if (fareStatus !== undefined) updateData.fareStatus = fareStatus;
    if (receivingVerification !== undefined) updateData.receivingVerification = receivingVerification;
    if (hasShortage !== undefined) updateData.hasShortage = Boolean(hasShortage);
    if (shortageNote !== undefined) updateData.shortageNote = shortageNote;
    if (products !== undefined) updateData.products = products;
    if (chargeableWeight !== undefined) updateData.chargeableWeight = chargeableWeight;
    if (weight !== undefined) updateData.weight = weight;

    await Cargo.update(updateData, { where: { id: req.params.id } });
    const cargo = await Cargo.findByPk(req.params.id);

    if (cargo.businessOwnerId) {
      if (hasShortage) {
        const missingCount = receivingVerification?.totalShortageQty || 'some';
        const receivedCount = receivingVerification?.totalReceivedQty || 'partial';
        await sendNotification(
          cargo.businessOwnerId,
          `⚠️ Shortage Endorsement: Transporter received ${receivedCount} items for "${cargo.title}" (${missingCount} missing at dock). Note: "${shortageNote || 'Short delivery recorded by carrier'}"`
        );
      } else if (fareStatus === 'Counter-Offered' && counterFare) {
        const orig = cargo.totalFare ? Number(cargo.totalFare).toLocaleString() : '';
        await sendNotification(
          cargo.businessOwnerId,
          `💬 Transporter proposed counter-fare of Rs. ${Number(counterFare).toLocaleString()} for "${cargo.title}" (Your offer: Rs. ${orig}).`
        );
      } else if (fareStatus === 'Agreed' || status === 'Accepted') {
        const agreed = (totalFare || cargo.totalFare) ? Number(totalFare || cargo.totalFare).toLocaleString() : '';
        await sendNotification(
          cargo.businessOwnerId,
          `🤝 Transporter verified and accepted your shipment "${cargo.title}" (Rs. ${agreed})! Ready for vehicle dispatch.`
        );
      } else if (status === 'Rejected') {
        await sendNotification(
          cargo.businessOwnerId,
          `Your shipment request for "${cargo.title}" has been rejected${rejectionReason ? ` (Reason: ${rejectionReason})` : ''}`
        );
      }
    }

    io.emit('booking_updated');
    res.json({ ...cargo.toJSON(), _id: cargo.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/cargo/:id/verify-pickup', authMiddleware, async (req, res) => {
  try {
    const {
      pickupOtp,
      receivingVerification,
      shortageNote,
      hasShortage,
      products,
      chargeableWeight,
      weight
    } = req.body;

    const cargo = await Cargo.findByPk(req.params.id);
    if (!cargo) {
      return res.status(404).json({ message: 'Cargo consignment not found.' });
    }

    const expectedOtp = String(cargo.pickupCode || '').trim();
    const providedOtp = String(pickupOtp || '').trim();

    if (!expectedOtp || expectedOtp !== providedOtp) {
      return res.status(400).json({
        message: 'Invalid Pickup OTP! Please collect the verified 4-digit code from the business shipper at the loading dock.'
      });
    }

    const updateData = {
      status: 'Loaded',
      receivingVerification: receivingVerification || null,
      hasShortage: Boolean(hasShortage),
      shortageNote: shortageNote || null
    };

    if (products !== undefined) updateData.products = products;
    if (chargeableWeight !== undefined) updateData.chargeableWeight = chargeableWeight;
    if (weight !== undefined) updateData.weight = weight;

    await Cargo.update(updateData, { where: { id: req.params.id } });
    const updatedCargo = await Cargo.findByPk(req.params.id);

    if (updatedCargo.businessOwnerId) {
      if (hasShortage) {
        const missingCount = receivingVerification?.totalShortageQty || 'some';
        const receivedCount = receivingVerification?.totalReceivedQty || 'partial';
        await sendNotification(
          updatedCargo.businessOwnerId,
          `📦 Cargo Handover Verified (Shortage Endorsed): Transporter verified and loaded '${updatedCargo.title}' via Pickup OTP. Received: ${receivedCount} (${missingCount} missing at dock). Note: "${shortageNote || 'Short delivery recorded by carrier'}"`
        );
      } else {
        await sendNotification(
          updatedCargo.businessOwnerId,
          `📦 Cargo Handover Verified: Transporter has verified and loaded '${updatedCargo.title}' via Pickup OTP.`
        );
      }
    }

    io.emit('booking_updated');
    res.json({
      message: 'Warehouse pickup and cargo custody verified successfully!',
      cargo: formatCargo(updatedCargo),
      ...updatedCargo.toJSON(),
      _id: updatedCargo.id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/cargo/:id', authMiddleware, async (req, res) => {
  try {
    await Cargo.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Cargo deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Booking Routes ────────────────────────────────────────────────────────────

const bookingIncludes = [
  { model: BookingMessage, as: 'messages' },
  {
    model: Cargo,
    as: 'cargo',
    include: [
      { model: User, as: 'transporter', attributes: ['name', 'phone'] },
      { model: User, as: 'businessOwner', attributes: ['name', 'phone', 'businessName'] }
    ]
  }
];

app.get('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const where = {};
    if (req.query.truckOwnerId) where.truckOwnerId = req.query.truckOwnerId;
    if (req.query.transporterId) where.transporterId = req.query.transporterId;
    if (req.query.status) where.status = { [Op.in]: req.query.status.split(',') };

    const bookings = await Booking.findAll({
      where,
      include: bookingIncludes,
      order: [['createdAt', 'DESC']]
    });
    res.json(bookings.map(b => {
      const plain = b.toJSON();
      return {
        ...plain,
        _id: b.id,
        cargo: plain.cargo ? formatCargo(plain.cargo) : null
      };
    }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/bookings', authMiddleware, async (req, res) => {
  try {
    const { truckId, cargoId } = req.body;
    
    // Validate Truck exists
    const truck = await Truck.findByPk(truckId);
    if (!truck) {
      return res.status(404).json({ message: 'Selected truck not found' });
    }

    // Overbooking Validation: check if incoming cargo weight exceeds truck's remaining capacity
    let cargoWeightKg = 0;
    let cargoTitle = req.body.cargoTitle || '';
    if (cargoId) {
      const cargo = await Cargo.findByPk(cargoId);
      if (cargo) {
        cargoWeightKg = parseWeightToKg(cargo.chargeableWeight || cargo.weight);
        if (!cargoTitle) cargoTitle = cargo.title;
      }
    } else if (req.body.weight) {
      cargoWeightKg = parseWeightToKg(req.body.weight);
    }

    const currentUsedKg = await getTruckActiveUsedCapacity(truck.id, truck.plateNumber);
    const capacityMetrics = computeCapacityMetrics(truck, currentUsedKg);

    if (cargoWeightKg > 0 && cargoWeightKg > capacityMetrics.remaining_capacity) {
      return res.status(400).json({
        message: `Insufficient truck capacity. Remaining: ${capacityMetrics.remaining_capacity_display}, required: ${cargoWeightKg.toLocaleString()} kg (${(cargoWeightKg / 1000).toFixed(1)} Tons).`,
        remainingCapacity: capacityMetrics.remaining_capacity,
        requiredWeight: cargoWeightKg,
        fillPercentage: capacityMetrics.fill_percentage
      });
    }

    const deliveryCode = req.body.deliveryCode || Math.floor(1000 + Math.random() * 9000).toString();
    const booking = await Booking.create({ ...req.body, cargoTitle, deliveryCode, transporterId: req.user.id });
    await sendNotification(booking.truckOwnerId, `New booking request for ${booking.cargoTitle}`);
    io.emit('booking_updated');


    // Trigger WhatsApp notification to Truck Owner/Driver
    Promise.all([
      Truck.findByPk(booking.truckId, { include: [{ model: User, as: 'owner' }] }),
      Cargo.findByPk(booking.cargoId),
      User.findByPk(req.user.id)
    ]).then(([truck, cargo, transporter]) => {
      if (truck) {
        notifyBookingOffer(booking, truck, cargo, transporter);
      }
    }).catch(e => console.error('WhatsApp notifyBookingOffer error:', e.message));

    res.status(201).json({ ...booking.toJSON(), _id: booking.id, messages: [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/bookings/:id', authMiddleware, async (req, res) => {
  try {
    // Handle message push separately
    if (req.body.$push && req.body.$push.messages) {
      const msg = req.body.$push.messages;
      await BookingMessage.create({ bookingId: req.params.id, sender: msg.sender, text: msg.text });
      const booking = await Booking.findByPk(req.params.id, {
        include: bookingIncludes
      });
      const plainMsg = booking.toJSON();
      io.emit('booking_updated');
      return res.json({
        ...plainMsg,
        _id: booking.id,
        cargo: plainMsg.cargo ? formatCargo(plainMsg.cargo) : null
      });
    }

    await Booking.update(req.body, { where: { id: req.params.id } });
    const booking = await Booking.findByPk(req.params.id, {
      include: bookingIncludes
    });

    // When transit starts: update cargo status and notify business owner
    if (req.body.status === 'In Transit' && booking.cargoId) {
      const cargo = await Cargo.findByPk(booking.cargoId);
      if (cargo) {
        await Cargo.update({ status: 'In Transit' }, { where: { id: booking.cargoId } });
        if (cargo.businessOwnerId) {
          await sendNotification(
            cargo.businessOwnerId,
            `🚛 Your shipment "${booking.cargoTitle}" is now In Transit on truck ${booking.truckPlate}.`
          );
        }
      }
    }

    // When booking is Counter-Offered by Truck Owner / Driver
    if (req.body.status === 'Counter-Offered') {
      const counterPriceStr = req.body.counterPrice || booking.counterPrice;
      await sendNotification(
        booking.transporterId,
        `💬 Driver/Truck Owner proposed a counter-fare of Rs. ${counterPriceStr} for "${booking.cargoTitle}" (Your offer: Rs. ${booking.price}).`
      );
    }

    // When booking is Accepted: notify transporter or driver
    if (req.body.status === 'Accepted') {
      const target = req.user.id.toString() === booking.transporterId.toString() ? booking.truckOwnerId : booking.transporterId;
      await sendNotification(
        target,
        `✅ Booking & Fare of Rs. ${booking.price} confirmed for "${booking.cargoTitle}" (Truck: ${booking.truckPlate}).`
      );
    }

    // When booking is Rejected: notify transporter
    if (req.body.status === 'Rejected') {
      await sendNotification(
        booking.transporterId,
        `❌ Truck owner rejected your booking request for "${booking.cargoTitle}".`
      );
    }

    // General notification to the other party for other status changes
    const targetId = req.user.id.toString() === booking.truckOwnerId.toString()
      ? booking.transporterId
      : booking.truckOwnerId;
    if (!['Accepted', 'Rejected', 'In Transit', 'Counter-Offered'].includes(req.body.status)) {
      await sendNotification(targetId, `Booking status updated to ${booking.status} for ${booking.cargoTitle}`);
    }

    io.emit('booking_updated');

    // Trigger WhatsApp notification for booking transit state changes (Shipper, Transporter, AND all Recipients)
    Promise.all([
      Truck.findByPk(booking.truckId),
      Cargo.findByPk(booking.cargoId),
      User.findByPk(booking.transporterId)
    ]).then(async ([truck, cargo, transporter]) => {
      const shipper = cargo && cargo.businessOwnerId ? await User.findByPk(cargo.businessOwnerId) : null;
      let recipients = [];
      if (cargo && cargo.recipients) {
        if (typeof cargo.recipients === 'string') {
          recipients = safeParseJson(cargo.recipients, []);
        } else if (Array.isArray(cargo.recipients)) {
          recipients = cargo.recipients;
        }
      }

      // Ensure deliveryCode exists on the booking if status is In Transit
      if (req.body.status === 'In Transit' && !booking.deliveryCode) {
        const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
        await Booking.update({ deliveryCode: generatedCode }, { where: { id: booking.id } });
        booking.deliveryCode = generatedCode;
      }

      notifyBookingStatusUpdate({
        booking,
        status: req.body.status,
        cargo,
        truck,
        shipper,
        transporter,
        recipients
      });
    }).catch(e => console.error('WhatsApp notifyBookingStatusUpdate error:', e.message));

    const plainBooking = booking.toJSON();
    res.json({
      ...plainBooking,
      _id: booking.id,
      cargo: plainBooking.cargo ? formatCargo(plainBooking.cargo) : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});



// ─── Booking Complete Route ────────────────────────────────────────────────────

app.post('/api/bookings/:id/complete', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findByPk(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    const { pod, deliveryCode, receiverSignature, podPhotoUrl, conditionStatus, discrepancyNotes } = req.body;

    await Booking.update({ 
      status: 'Completed', 
      completedAt: new Date(), 
      pod: pod || podPhotoUrl,
      deliveryCode: deliveryCode || null,
      receiverSignature: receiverSignature || null,
      podPhotoUrl: podPhotoUrl || null,
      conditionStatus: conditionStatus || 'Good Condition',
      discrepancyNotes: discrepancyNotes || null
    }, { where: { id: req.params.id } });
    await Truck.update({ status: 'Available' }, { where: { id: booking.truckId } });
    if (booking.cargoId) {
      await Cargo.update(
        { status: 'Completed', assignedTruck: booking.truckPlate },
        { where: { id: booking.cargoId } }
      );
    }
    await sendNotification(booking.transporterId, `Delivery completed for ${booking.cargoTitle}.`);

    io.emit('booking_updated');

    // Trigger WhatsApp notification on delivery completion to Shipper AND Recipients
    Cargo.findByPk(booking.cargoId).then(async (cargo) => {
      if (cargo) {
        const shipper = cargo.businessOwnerId ? await User.findByPk(cargo.businessOwnerId) : null;
        let recipients = [];
        if (typeof cargo.recipients === 'string') {
          recipients = safeParseJson(cargo.recipients, []);
        } else if (Array.isArray(cargo.recipients)) {
          recipients = cargo.recipients;
        }
        notifyDeliveryCompleted(booking, cargo, shipper, recipients);
      }
    }).catch(e => console.error('WhatsApp notifyDeliveryCompleted error:', e.message));

    const updated = await Booking.findByPk(req.params.id);
    res.json({ message: 'Booking marked as completed', booking: { ...updated.toJSON(), _id: updated.id } });
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
});

// ─── Notification Routes ───────────────────────────────────────────────────────

app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications.map(n => ({ ...n.toJSON(), _id: n.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/notifications/:id', authMiddleware, async (req, res) => {
  try {
    await Notification.destroy({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Complaint Routes ──────────────────────────────────────────────────────────

app.post('/api/complaints', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const complaint = await Complaint.create({
      ...req.body,
      userId: req.user.id,
      userName: user.name,
      userRole: user.role
    });
    res.status(201).json({ ...complaint.toJSON(), _id: complaint.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/complaints', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    const complaints = await Complaint.findAll({ order: [['createdAt', 'DESC']] });
    res.json(complaints.map(c => ({ ...c.toJSON(), _id: c.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/complaints/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    await Complaint.update(req.body, { where: { id: req.params.id } });
    const complaint = await Complaint.findByPk(req.params.id);
    res.json({ ...complaint.toJSON(), _id: complaint.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Lost & Missing Cargo Tracking Portal APIs ────────────────────────────────

// 1. File a new Lost / Missing / Damaged Cargo Report (with optional Cloudinary photo evidence)
app.post('/api/lost-cargo', authMiddleware, upload.single('evidenceImage'), async (req, res) => {
  try {
    const {
      biltyId,
      biltyNo,
      issueType,
      description,
      lastKnownLocation
    } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Description of the lost/damaged cargo incident is required' });
    }

    // Resolve bilty/cargo ID
    let rawBiltyId = biltyId || biltyNo;
    if (!rawBiltyId) {
      return res.status(400).json({ message: 'Bilty ID or Number is required' });
    }
    if (typeof rawBiltyId === 'string' && rawBiltyId.toUpperCase().startsWith('BLT-')) {
      rawBiltyId = rawBiltyId.replace(/BLT-/i, '');
    }
    const resolvedBiltyId = parseInt(rawBiltyId, 10);
    if (isNaN(resolvedBiltyId) || resolvedBiltyId <= 0) {
      return res.status(400).json({ message: 'Invalid Bilty reference number' });
    }

    const cargo = await Cargo.findByPk(resolvedBiltyId, {
      include: [
        { model: User, as: 'businessOwner', attributes: ['id', 'name', 'phone', 'email'] },
        { model: User, as: 'transporter', attributes: ['id', 'name', 'phone', 'email'] }
      ]
    });

    if (!cargo) {
      return res.status(404).json({ message: `Bilty #BLT-${resolvedBiltyId} could not be found in cargo records` });
    }

    // Business shippers can only report incidents for their own bilties
    if (req.user.role === 'business' && cargo.businessOwnerId && cargo.businessOwnerId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You can only file reports for your own shipments' });
    }

    let evidenceImageUrl = null;
    if (req.file) {
      // 1. Try Cloudinary upload
      const cloudUrl = await uploadToCloudinary(req.file.path, 'e_cargo_lost_evidence');
      if (cloudUrl) {
        evidenceImageUrl = cloudUrl;
      } else {
        // Fallback to local server static URL
        evidenceImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      }
    } else if (req.body.evidenceImageUrl) {
      evidenceImageUrl = req.body.evidenceImageUrl;
    }

    const validIssueTypes = ['Not Delivered', 'Missing Items', 'Lost in Transit', 'Damaged'];
    const finalIssueType = validIssueTypes.includes(issueType) ? issueType : 'Lost in Transit';

    const report = await LostCargoReport.create({
      biltyId: cargo.id,
      reportedByUserId: req.user.id,
      transporterId: cargo.transporterId || null,
      issueType: finalIssueType,
      description: description.trim(),
      evidenceImageUrl,
      lastKnownLocation: lastKnownLocation && lastKnownLocation.trim() ? lastKnownLocation.trim() : (cargo.destination || 'In Transit'),
      status: 'Reported'
    });

    // Create initial timeline entry in lost_cargo_logs
    await LostCargoLog.create({
      reportId: report.id,
      updatedByUserId: req.user.id,
      role: req.user.role,
      actionNote: `Incident reported by ${req.user.role} (${req.user.name || req.user.email}): "${finalIssueType}" - ${description.trim().slice(0, 150)}`,
      statusChangedTo: 'Reported'
    });

    // Real-time socket broadcast
    io.emit('lost_cargo_created', {
      reportId: report.id,
      biltyNo: `BLT-${cargo.id}`,
      issueType: finalIssueType,
      reportedBy: req.user.id,
      transporterId: cargo.transporterId
    });

    // In-app alert for assigned transporter
    if (cargo.transporterId) {
      await Notification.create({
        userId: cargo.transporterId,
        message: `🚨 Lost/Missing Cargo Incident: Report #${report.id} filed for Bilty #BLT-${cargo.id} (${finalIssueType}). Please investigate.`
      });
    }

    // Fetch and return complete record
    const createdData = await LostCargoReport.findByPk(report.id, {
      include: [
        { model: Cargo, as: 'bilty' },
        { model: User, as: 'reportedBy', attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] },
        { model: User, as: 'transporter', attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] },
        {
          model: LostCargoLog,
          as: 'logs',
          include: [{ model: User, as: 'updater', attributes: ['id', 'name', 'role'] }]
        }
      ]
    });

    res.status(201).json(createdData);
  } catch (error) {
    console.error('Error in POST /api/lost-cargo:', error);
    res.status(500).json({ message: error.message });
  }
});

// 2. List all Lost Cargo Reports (role-filtered for Admin, Transporter, and Business Owner)
app.get('/api/lost-cargo', authMiddleware, async (req, res) => {
  try {
    const { status, issueType, transporterId, search } = req.query;
    const where = {};

    if (req.user.role === 'business') {
      where.reportedByUserId = req.user.id;
    } else if (req.user.role === 'transporter') {
      where.transporterId = req.user.id;
    }

    if (transporterId && req.user.role === 'admin') {
      where.transporterId = transporterId;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (issueType && issueType !== 'all') {
      where.issueType = issueType;
    }

    const reports = await LostCargoReport.findAll({
      where,
      include: [
        { 
          model: Cargo, 
          as: 'bilty',
          attributes: ['id', 'title', 'origin', 'destination', 'weight', 'assignedTruck', 'status', 'totalFare', 'recipients', 'pickupDetails']
        },
        { 
          model: User, 
          as: 'reportedBy', 
          attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] 
        },
        { 
          model: User, 
          as: 'transporter', 
          attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] 
        },
        {
          model: LostCargoLog,
          as: 'logs',
          include: [{ model: User, as: 'updater', attributes: ['id', 'name', 'role'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    let result = reports.map(r => {
      const j = r.toJSON();
      return {
        ...j,
        createdAt: j.created_at || j.createdAt,
        updatedAt: j.updated_at || j.updatedAt
      };
    });

    // Apply search filter if specified
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(item => {
        const bNo = `blt-${item.biltyId}`.toLowerCase();
        const bTitle = (item.bilty?.title || '').toLowerCase();
        const repName = (item.reportedBy?.name || item.reportedBy?.businessName || '').toLowerCase();
        const transName = (item.transporter?.name || item.transporter?.businessName || '').toLowerCase();
        const dest = (item.bilty?.destination || '').toLowerCase();
        const orig = (item.bilty?.origin || '').toLowerCase();
        const loc = (item.lastKnownLocation || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return bNo.includes(q) || bTitle.includes(q) || repName.includes(q) ||
               transName.includes(q) || dest.includes(q) || orig.includes(q) || loc.includes(q) || desc.includes(q);
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error in GET /api/lost-cargo:', error);
    res.status(500).json({ message: error.message });
  }
});

// 3. Get single Lost Cargo Report with joined traceability and timeline
app.get('/api/lost-cargo/:id', authMiddleware, async (req, res) => {
  try {
    const report = await LostCargoReport.findByPk(req.params.id, {
      include: [
        { model: Cargo, as: 'bilty' },
        { model: User, as: 'reportedBy', attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city', 'cnic'] },
        { model: User, as: 'transporter', attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] },
        {
          model: LostCargoLog,
          as: 'logs',
          include: [{ model: User, as: 'updater', attributes: ['id', 'name', 'role'] }]
        }
      ],
      order: [
        [{ model: LostCargoLog, as: 'logs' }, 'created_at', 'ASC']
      ]
    });

    if (!report) {
      return res.status(404).json({ message: 'Lost cargo report not found' });
    }

    // Role verification
    if (req.user.role === 'business' && report.reportedByUserId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You cannot view this report' });
    }
    if (req.user.role === 'transporter' && report.transporterId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: This report is not assigned to your fleet' });
    }

    const data = report.toJSON();

    // Query assigned truck & driver info from Booking and Truck tables
    let truckDriverInfo = null;
    if (report.biltyId) {
      const booking = await Booking.findOne({
        where: { cargoId: report.biltyId }
      });
      if (booking) {
        const truck = await Truck.findByPk(booking.truckId, {
          include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'phone'] }]
        });
        truckDriverInfo = {
          plateNumber: booking.truckPlate || truck?.plateNumber || report.bilty?.assignedTruck || 'Assigned',
          truckType: truck?.truckType || 'Heavy Freight Carrier',
          driverName: truck?.driverName || 'Designated Fleet Driver',
          driverMobile: truck?.driverMobile || truck?.owner?.phone || 'N/A',
          truckOwnerName: truck?.owner?.name || 'Fleet Operator',
          eta: booking.eta || 'N/A',
          bookingStatus: booking.status
        };
      } else if (report.bilty?.assignedTruck) {
        const truck = await Truck.findOne({ where: { plateNumber: report.bilty.assignedTruck } });
        if (truck) {
          truckDriverInfo = {
            plateNumber: truck.plateNumber,
            truckType: truck.truckType,
            driverName: truck.driverName || 'Designated Fleet Driver',
            driverMobile: truck.driverMobile || 'N/A',
            loc: truck.loc
          };
        }
      }
    }

    res.json({
      ...data,
      createdAt: data.created_at || data.createdAt,
      updatedAt: data.updated_at || data.updatedAt,
      logs: (data.logs || []).map(l => ({
        ...l,
        createdAt: l.created_at || l.createdAt
      })),
      truckDriverInfo
    });
  } catch (error) {
    console.error('Error in GET /api/lost-cargo/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

// 4. Update status, location, resolution notes, and append investigation timeline log (with optional image evidence)
app.patch('/api/lost-cargo/:id', authMiddleware, upload.single('evidenceImage'), async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'transporter') {
    return res.status(403).json({ message: 'Only Admin and the assigned Transporter can update investigation status' });
  }

  try {
    const report = await LostCargoReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Lost cargo report not found' });
    }

    if (req.user.role === 'transporter' && report.transporterId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You can only update reports assigned to your logistics fleet' });
    }

    const { status, lastKnownLocation, resolutionNotes, actionNote } = req.body;
    const updates = {};
    let statusChanged = false;

    if (status && status !== report.status) {
      updates.status = status;
      statusChanged = true;
    }
    if (lastKnownLocation !== undefined && lastKnownLocation !== null) {
      updates.lastKnownLocation = lastKnownLocation.trim();
    }
    if (resolutionNotes !== undefined && resolutionNotes !== null) {
      updates.resolutionNotes = resolutionNotes.trim();
    }

    // Process uploaded evidence/investigation photo if provided
    let evidenceImageUrl = null;
    if (req.file) {
      const cloudUrl = await uploadToCloudinary(req.file.path, 'e_cargo_lost_evidence');
      if (cloudUrl) {
        evidenceImageUrl = cloudUrl;
      } else {
        evidenceImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      }
    } else if (req.body.evidenceImageUrl) {
      evidenceImageUrl = req.body.evidenceImageUrl;
    }

    if (evidenceImageUrl && !report.evidenceImageUrl) {
      updates.evidenceImageUrl = evidenceImageUrl;
    }

    await report.update(updates);

    // Append log entry to lost_cargo_logs
    const logNote = actionNote && actionNote.trim() 
      ? actionNote.trim() 
      : (statusChanged ? `Status updated from "${report.status}" to "${status}"` : 'Investigation updated');

    await LostCargoLog.create({
      reportId: report.id,
      updatedByUserId: req.user.id,
      role: req.user.role,
      actionNote: logNote,
      statusChangedTo: status || report.status,
      evidenceImageUrl: evidenceImageUrl || null
    });

    // Notify the customer who reported the missing cargo
    if (report.reportedByUserId) {
      await Notification.create({
        userId: report.reportedByUserId,
        message: `📢 Missing Cargo Update (#BLT-${report.biltyId}): Status is now "${status || report.status}". ${logNote.slice(0, 80)}`
      });
    }

    // Real-time broadcast
    io.emit('lost_cargo_updated', {
      reportId: report.id,
      status: status || report.status,
      lastKnownLocation: report.lastKnownLocation,
      updatedByRole: req.user.role
    });

    // Return updated record
    const updatedRecord = await LostCargoReport.findByPk(report.id, {
      include: [
        { model: Cargo, as: 'bilty' },
        { model: User, as: 'reportedBy', attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] },
        { model: User, as: 'transporter', attributes: ['id', 'name', 'email', 'phone', 'businessName', 'city'] },
        {
          model: LostCargoLog,
          as: 'logs',
          include: [{ model: User, as: 'updater', attributes: ['id', 'name', 'role'] }]
        }
      ],
      order: [
        [{ model: LostCargoLog, as: 'logs' }, 'created_at', 'ASC']
      ]
    });

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error in PATCH /api/lost-cargo/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

// ─── Admin User Management ────────────────────────────────────────────────────

app.get('/api/users', authMiddleware, async (req, res) => {
  const isTransporterQuery = req.query.role === 'transporter';
  if (req.user.role !== 'admin' && !isTransporterQuery) return res.status(403).json({ message: 'Access denied' });
  try {
    const where = {};
    if (isTransporterQuery) {
      where.role = 'transporter';
      where.status = 'active';
    } else if (req.query.role) {
      where.role = req.query.role;
    }
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] }
    });

    const usersWithCounts = await Promise.all(users.map(async (u) => {
      let shipmentsCount = 0;
      if (u.role === 'business') {
        shipmentsCount = await Cargo.count({ where: { businessOwnerId: u.id } });
      } else if (u.role === 'transporter') {
        shipmentsCount = await Cargo.count({ where: { transporterId: u.id } });
      } else if (u.role === 'truck_owner') {
        shipmentsCount = await Booking.count({ where: { truckOwnerId: u.id } });
      }
      return {
        ...u.toJSON(),
        _id: u.id,
        shipmentsCount,
        joinedDate: u.createdAt ? u.createdAt.toISOString().split('T')[0] : ''
      };
    }));

    res.json(usersWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/users/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    const { status, reason } = req.body;
    await User.update(req.body, { where: { id: req.params.id } });
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    let msg = `Your account status has been updated to: ${user.status}`;
    if (status === 'rejected' && reason) {
      msg += `. Reason: ${reason}`;
    }
    await sendNotification(user.id, msg);
    res.json({ ...user.toJSON(), _id: user.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    const [
      usersCount,
      pendingUsersCount,
      trucksCount,
      activeTrucksCount,
      bookingsCount,
      complaintsCount,
      businessOwnersCount,
      transportersCount,
      truckOwnersCount
    ] = await Promise.all([
      User.count(),
      User.count({ where: { status: { [Op.in]: ['pending', 'pending_verification'] } } }),
      Truck.count(),
      Truck.count({ where: { status: 'In Transit' } }),
      Booking.count(),
      Complaint.count({ where: { status: 'Open' } }),
      User.count({ where: { role: 'business' } }),
      User.count({ where: { role: 'transporter' } }),
      User.count({ where: { role: 'truck_owner' } })
    ]);

    // Active shipments: cargo currently in active transportation states
    const activeShipmentsCount = await Cargo.count({
      where: { status: { [Op.in]: ['Accepted', 'Truck Assigned', 'Loaded', 'In Transit'] } }
    });

    // Total Bilties: cargo that progressed beyond pending
    const totalBiltiesCount = await Cargo.count({
      where: { status: { [Op.in]: ['Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'] } }
    });

    // Truck utilization calculations
    const utilizationRate = trucksCount > 0 ? Math.round((activeTrucksCount / trucksCount) * 100) : 0;

    // Monthly stats for Shipments & Bilties (rolling last 6 months ending in current month)
    const now = new Date();
    const monthlyStats = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let offset = 5; offset >= 0; offset--) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);

      const realShipments = await Cargo.count({
        where: {
          createdAt: {
            [Op.between]: [start, end]
          }
        }
      });

      const realBilties = await Cargo.count({
        where: {
          status: { [Op.in]: ['Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'] },
          createdAt: {
            [Op.between]: [start, end]
          }
        }
      });

      monthlyStats.push({
        month: monthNames[start.getMonth()],
        shipments: realShipments,
        bilties: realBilties
      });
    }

    res.json({
      users: usersCount,
      pendingUsers: pendingUsersCount,
      trucks: trucksCount,
      activeTrucks: activeTrucksCount,
      utilizationRate: utilizationRate,
      activeShipments: activeShipmentsCount,
      totalBilties: totalBiltiesCount,
      complaints: complaintsCount,
      roleBreakdown: {
        business: businessOwnersCount,
        transporter: transportersCount,
        truck_owner: truckOwnersCount
      },
      monthlyStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Detailed Shipments for Admin ──────────────────────────────────────────────
app.get('/api/admin/shipments', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    const [cargo, allBookings] = await Promise.all([
      Cargo.findAll({
        include: [
          { model: User, as: 'transporter', attributes: ['name', 'phone'] },
          { model: User, as: 'businessOwner', attributes: ['name', 'phone', 'businessName'] }
        ],
        order: [['createdAt', 'DESC']]
      }),
      Booking.findAll({ order: [['createdAt', 'DESC']] })
    ]);

    const bookingByCargoId = new Map();
    allBookings.forEach(b => {
      if (b.cargoId && !bookingByCargoId.has(b.cargoId)) {
        bookingByCargoId.set(b.cargoId, b.toJSON());
      }
    });

    const result = cargo.map(c => {
      const formatted = formatCargo(c);
      const booking = bookingByCargoId.get(c.id);
      const hasBilty = Boolean(
        booking ||
        formatted.assignedTruck ||
        ['Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'].includes(formatted.status)
      );
      return {
        ...formatted,
        truckPlate: booking?.truckPlate || formatted.assignedTruck || null,
        biltyNo: hasBilty ? `BLT-${c.id}` : '-',
        price: booking?.price || (formatted.totalFare ? String(Math.round(formatted.totalFare)) : null),
        completedAt: booking?.completedAt || null,
        receiverSignature: booking?.receiverSignature || null
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Activity Log for Admin ───────────────────────────────────────────────────
app.get('/api/admin/activity', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Access denied' });
  try {
    const [recentUsers, recentCargo, recentBookings] = await Promise.all([
      User.findAll({ limit: 5, order: [['createdAt', 'DESC']] }),
      Cargo.findAll({ limit: 5, order: [['createdAt', 'DESC']], include: [{ model: User, as: 'businessOwner', attributes: ['name'] }] }),
      Booking.findAll({ limit: 5, order: [['createdAt', 'DESC']] })
    ]);

    const logs = [];
    recentUsers.forEach(u => {
      logs.push({
        type: 'user',
        title: 'New User Registered',
        description: `${u.name} registered as a ${u.role.replace('_', ' ')}.`,
        date: u.createdAt
      });
    });
    recentCargo.forEach(c => {
      logs.push({
        type: 'cargo',
        title: 'Shipment Created',
        description: `Shipment for "${c.title}" (${c.weight} tons) created by ${c.businessOwner ? c.businessOwner.name : 'Business Owner'}.`,
        date: c.createdAt
      });
    });
    recentBookings.forEach(b => {
      logs.push({
        type: 'booking',
        title: `Booking ${b.status}`,
        description: `Booking for cargo "${b.cargoTitle}" was marked ${b.status.toLowerCase()}.`,
        date: b.createdAt
      });
    });

    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(logs.slice(0, 10));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Production Frontend Static Serving (Railway / Single Service) ────────────
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`📦 Serving frontend static build from: ${distPath}`);
  app.use(express.static(distPath));

  app.use((req, res, next) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/uploads') &&
      !req.path.startsWith('/socket.io')
    ) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// ─── Start Server ──────────────────────────────────────────────────────────────

const isSqlite = sequelize.getDialect() === 'sqlite';

const ensureSqliteColumns = async () => {
  if (!isSqlite) return;
  const queries = [
    `ALTER TABLE cargo ADD COLUMN packaging_type TEXT;`,
    `ALTER TABLE cargo ADD COLUMN dimensions TEXT;`,
    `ALTER TABLE cargo ADD COLUMN special_handling TEXT;`,
    `ALTER TABLE cargo ADD COLUMN declared_value TEXT;`,
    `ALTER TABLE cargo ADD COLUMN payment_terms TEXT DEFAULT 'Prepaid';`,
    `ALTER TABLE cargo ADD COLUMN sender_ntn TEXT;`,
    `ALTER TABLE cargo ADD COLUMN delivery_notes TEXT;`,
    `ALTER TABLE cargo ADD COLUMN chargeable_weight TEXT;`,
    `ALTER TABLE cargo ADD COLUMN volumetric_weight TEXT;`,
    `ALTER TABLE cargo ADD COLUMN base_fare REAL;`,
    `ALTER TABLE cargo ADD COLUMN fuel_surcharge REAL;`,
    `ALTER TABLE cargo ADD COLUMN tax_amount REAL;`,
    `ALTER TABLE cargo ADD COLUMN total_fare REAL;`,
    `ALTER TABLE cargo ADD COLUMN counter_fare REAL;`,
    `ALTER TABLE cargo ADD COLUMN counter_note TEXT;`,
    `ALTER TABLE cargo ADD COLUMN counter_by TEXT;`,
    `ALTER TABLE cargo ADD COLUMN fare_status TEXT DEFAULT 'Offered';`,
    `ALTER TABLE cargo ADD COLUMN receiving_verification TEXT;`,
    `ALTER TABLE cargo ADD COLUMN has_shortage INTEGER DEFAULT 0;`,
    `ALTER TABLE cargo ADD COLUMN shortage_note TEXT;`,
    `ALTER TABLE cargo ADD COLUMN pickup_code TEXT;`,
    `ALTER TABLE lost_cargo_logs ADD COLUMN evidence_image_url TEXT;`,
    `ALTER TABLE bookings ADD COLUMN delivery_code TEXT;`,
    `ALTER TABLE bookings ADD COLUMN receiver_signature TEXT;`,
    `ALTER TABLE bookings ADD COLUMN pod_photo_url TEXT;`,
    `ALTER TABLE bookings ADD COLUMN condition_status TEXT DEFAULT 'Good Condition';`,
    `ALTER TABLE bookings ADD COLUMN discrepancy_notes TEXT;`,
    `ALTER TABLE bookings ADD COLUMN counter_price TEXT;`,
    `ALTER TABLE bookings ADD COLUMN counter_note TEXT;`,
    `ALTER TABLE users ADD COLUMN city TEXT DEFAULT 'Lahore';`,
    `ALTER TABLE trucks ADD COLUMN total_capacity REAL DEFAULT 0;`,
    `ALTER TABLE trucks ADD COLUMN used_capacity REAL DEFAULT 0;`
  ];
  for (const q of queries) {
    try {
      await sequelize.query(q);
    } catch (e) {
      // Column already exists or table handles it
    }
  }
  try {
    await LostCargoReport.sync();
    await LostCargoLog.sync();
  } catch (e) {
    console.warn('Lost cargo sync info:', e.message);
  }
};

sequelize.sync(isSqlite ? {} : { alter: true })
  .then(async () => {
    await ensureSqliteColumns();
    await autoSeedDatabase(sequelize);

    // Auto-backfill 4-digit pickupCode for existing cargo if missing
    try {
      const cargosWithoutCode = await Cargo.findAll({ where: { pickupCode: null } });
      for (const c of cargosWithoutCode) {
        await c.update({ pickupCode: Math.floor(1000 + Math.random() * 9000).toString() });
      }
    } catch (e) {
      // Column might be syncing
    }

    // Auto-backfill totalCapacity from capacity string for existing trucks
    try {
      const trucksToBackfill = await Truck.findAll();
      for (const t of trucksToBackfill) {
        if (!t.totalCapacity || Number(t.totalCapacity) <= 0) {
          const parsed = parseWeightToKg(t.capacity, true);
          if (parsed > 0) {
            await t.update({ totalCapacity: parsed });
          }
        }
      }
    } catch (backfillErr) {
      console.warn('Truck totalCapacity backfill notice:', backfillErr.message);
    }

    console.log(`✅ ${isSqlite ? 'SQLite' : 'MySQL'} Database synced with Real-Time Truck Capacity Tracking`);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT} (0.0.0.0)`);
    });
  })
  .catch(err => {
    console.error('❌ Database sync failed:', err.message);
    process.exit(1);
  });
