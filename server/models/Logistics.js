const { DataTypes } = require('sequelize');
const sequelize = require('../db');
const User = require('./User');

// ─── Truck Model ───────────────────────────────────────────────────────────────
const Truck = sequelize.define('Truck', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  plateNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'plate_number'
  },
  capacity: { type: DataTypes.STRING, allowNull: false },
  totalCapacity: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    field: 'total_capacity'
  },
  usedCapacity: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    field: 'used_capacity'
  },
  loc: { type: DataTypes.STRING, allowNull: false },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'owner_id',
    references: { model: User, key: 'id' }
  },
  status: {
    type: DataTypes.ENUM('Available', 'In Transit', 'Maintenance'),
    defaultValue: 'Available'
  },
  truckType: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'truck_type'
  },
  driverName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'driver_name'
  },
  driverMobile: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'driver_mobile'
  },
  fitnessDoc: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'fitness_doc'
  },
  insuranceDoc: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'insurance_doc'
  },
  lat: { type: DataTypes.FLOAT, defaultValue: 31.5204 },
  lng: { type: DataTypes.FLOAT, defaultValue: 74.3587 }
}, {
  tableName: 'trucks',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

// ─── Cargo Model ───────────────────────────────────────────────────────────────
const Cargo = sequelize.define('Cargo', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  weight: { type: DataTypes.STRING, allowNull: false },
  origin: { type: DataTypes.STRING, allowNull: false },
  destination: { type: DataTypes.STRING, allowNull: false },
  transporterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'transporter_id',
    references: { model: User, key: 'id' }
  },
  businessOwnerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'business_owner_id',
    references: { model: User, key: 'id' }
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Pending', 'Accepted', 'Rejected', 'Truck Assigned', 'Loaded', 'In Transit', 'Delivered', 'Completed'),
    defaultValue: 'Pending'
  },
  products: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  pickupDetails: {
    type: DataTypes.JSON,
    defaultValue: {},
    field: 'pickup_details'
  },
  recipients: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  rejectionReason: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'rejection_reason'
  },
  assignedTruck: { type: DataTypes.STRING, field: 'assigned_truck' },
  packagingType: { type: DataTypes.STRING, allowNull: true, field: 'packaging_type' },
  dimensions: { type: DataTypes.JSON, defaultValue: {}, field: 'dimensions' },
  specialHandling: { type: DataTypes.JSON, defaultValue: [], field: 'special_handling' },
  declaredValue: { type: DataTypes.STRING, allowNull: true, field: 'declared_value' },
  paymentTerms: { type: DataTypes.STRING, defaultValue: 'Prepaid', field: 'payment_terms' },
  senderNTN: { type: DataTypes.STRING, allowNull: true, field: 'sender_ntn' },
  deliveryNotes: { type: DataTypes.TEXT, allowNull: true, field: 'delivery_notes' },
  chargeableWeight: { type: DataTypes.STRING, allowNull: true, field: 'chargeable_weight' },
  volumetricWeight: { type: DataTypes.STRING, allowNull: true, field: 'volumetric_weight' },
  baseFare: { type: DataTypes.FLOAT, allowNull: true, field: 'base_fare' },
  fuelSurcharge: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_surcharge' },
  taxAmount: { type: DataTypes.FLOAT, allowNull: true, field: 'tax_amount' },
  totalFare: { type: DataTypes.FLOAT, allowNull: true, field: 'total_fare' },
  counterFare: { type: DataTypes.FLOAT, allowNull: true, field: 'counter_fare' },
  counterNote: { type: DataTypes.STRING, allowNull: true, field: 'counter_note' },
  counterBy: { type: DataTypes.STRING, allowNull: true, field: 'counter_by' },
  fareStatus: { type: DataTypes.STRING, defaultValue: 'Offered', field: 'fare_status' },
  receivingVerification: { type: DataTypes.JSON, defaultValue: null, field: 'receiving_verification' },
  hasShortage: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'has_shortage' },
  shortageNote: { type: DataTypes.TEXT, allowNull: true, field: 'shortage_note' },
  pickupCode: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'pickup_code'
  }
}, {
  tableName: 'cargo',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

// ─── Booking Model ─────────────────────────────────────────────────────────────
const Booking = sequelize.define('Booking', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  truckId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'truck_id',
    references: { model: Truck, key: 'id' }
  },
  truckPlate: { type: DataTypes.STRING, allowNull: false, field: 'truck_plate' },
  truckOwnerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'truck_owner_id',
    references: { model: User, key: 'id' }
  },
  cargoId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'cargo_id',
    references: { model: Cargo, key: 'id' }
  },
  cargoTitle: { type: DataTypes.STRING, allowNull: false, field: 'cargo_title' },
  transporterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'transporter_id',
    references: { model: User, key: 'id' }
  },
  transporterName: { type: DataTypes.STRING, allowNull: false, field: 'transporter_name' },
  price: { type: DataTypes.STRING, allowNull: false },
  status: {
    type: DataTypes.ENUM('Pending', 'Accepted', 'Rejected', 'Counter-Offered', 'In Transit', 'Loaded', 'Completed', 'Cancelled'),
    defaultValue: 'Pending'
  },
  eta: { type: DataTypes.STRING },
  pod: { type: DataTypes.TEXT, allowNull: true },
  deliveryCode: { type: DataTypes.STRING, allowNull: true, field: 'delivery_code' },
  receiverSignature: { type: DataTypes.TEXT, allowNull: true, field: 'receiver_signature' },
  podPhotoUrl: { type: DataTypes.STRING, allowNull: true, field: 'pod_photo_url' },
  conditionStatus: { type: DataTypes.STRING, defaultValue: 'Good Condition', field: 'condition_status' },
  discrepancyNotes: { type: DataTypes.TEXT, allowNull: true, field: 'discrepancy_notes' },
  counterPrice: { type: DataTypes.STRING, allowNull: true, field: 'counter_price' },
  counterNote: { type: DataTypes.STRING, allowNull: true, field: 'counter_note' },
  completedAt: { type: DataTypes.DATE, field: 'completed_at' }
}, {
  tableName: 'bookings',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

// ─── Booking Messages Model (replaces embedded array) ─────────────────────────
const BookingMessage = sequelize.define('BookingMessage', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'booking_id',
    references: { model: Booking, key: 'id' }
  },
  sender: { type: DataTypes.STRING },
  text: { type: DataTypes.TEXT }
}, {
  tableName: 'booking_messages',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

// ─── Notification Model ────────────────────────────────────────────────────────
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: { model: User, key: 'id' }
  },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' }
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

// ─── Complaint Model ───────────────────────────────────────────────────────────
const Complaint = sequelize.define('Complaint', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: { model: User, key: 'id' }
  },
  userName: { type: DataTypes.STRING, allowNull: false, field: 'user_name' },
  userRole: { type: DataTypes.STRING, allowNull: false, field: 'user_role' },
  subject: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('Open', 'Resolved'),
    defaultValue: 'Open'
  }
}, {
  tableName: 'complaints',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

// ─── Lost Cargo Report Model ──────────────────────────────────────────────────
const LostCargoReport = sequelize.define('LostCargoReport', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  biltyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'bilty_id',
    references: { model: Cargo, key: 'id' }
  },
  reportedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'reported_by_user_id',
    references: { model: User, key: 'id' }
  },
  transporterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'transporter_id',
    references: { model: User, key: 'id' }
  },
  issueType: {
    type: DataTypes.ENUM('Not Delivered', 'Missing Items', 'Lost in Transit', 'Damaged'),
    allowNull: false,
    field: 'issue_type'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  evidenceImageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'evidence_image_url'
  },
  lastKnownLocation: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'last_known_location'
  },
  status: {
    type: DataTypes.ENUM('Reported', 'Under Investigation', 'Located', 'Resolved', 'Closed'),
    defaultValue: 'Reported'
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'resolution_notes'
  }
}, {
  tableName: 'lost_cargo_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// ─── Lost Cargo Log / Audit Trail Model ───────────────────────────────────────
const LostCargoLog = sequelize.define('LostCargoLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  reportId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'report_id',
    references: { model: LostCargoReport, key: 'id' }
  },
  updatedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'updated_by_user_id',
    references: { model: User, key: 'id' }
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  actionNote: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'action_note'
  },
  evidenceImageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'evidence_image_url'
  },
  statusChangedTo: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'status_changed_to'
  }
}, {
  tableName: 'lost_cargo_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// ─── Associations ──────────────────────────────────────────────────────────────
User.hasMany(Truck, { foreignKey: 'owner_id' });
Truck.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

User.hasMany(Cargo, { foreignKey: 'transporter_id' });
Cargo.belongsTo(User, { foreignKey: 'transporter_id', as: 'transporter' });

User.hasMany(Cargo, { foreignKey: 'business_owner_id' });
Cargo.belongsTo(User, { foreignKey: 'business_owner_id', as: 'businessOwner' });

Booking.hasMany(BookingMessage, { foreignKey: 'booking_id', as: 'messages' });
BookingMessage.belongsTo(Booking, { foreignKey: 'booking_id' });

Booking.belongsTo(Cargo, { foreignKey: 'cargo_id', as: 'cargo' });
Cargo.hasMany(Booking, { foreignKey: 'cargo_id' });

User.hasMany(Notification, { foreignKey: 'user_id' });
User.hasMany(Complaint, { foreignKey: 'user_id' });

// Lost Cargo Associations
LostCargoReport.belongsTo(Cargo, { foreignKey: 'bilty_id', as: 'bilty' });
Cargo.hasMany(LostCargoReport, { foreignKey: 'bilty_id', as: 'lostReports' });

LostCargoReport.belongsTo(User, { foreignKey: 'reported_by_user_id', as: 'reportedBy' });
User.hasMany(LostCargoReport, { foreignKey: 'reported_by_user_id', as: 'filedLostReports' });

LostCargoReport.belongsTo(User, { foreignKey: 'transporter_id', as: 'transporter' });
User.hasMany(LostCargoReport, { foreignKey: 'transporter_id', as: 'assignedLostReports' });

LostCargoReport.hasMany(LostCargoLog, { foreignKey: 'report_id', as: 'logs' });
LostCargoLog.belongsTo(LostCargoReport, { foreignKey: 'report_id' });

LostCargoLog.belongsTo(User, { foreignKey: 'updated_by_user_id', as: 'updater' });

module.exports = { 
  Truck, 
  Cargo, 
  Booking, 
  BookingMessage, 
  Notification, 
  Complaint,
  LostCargoReport,
  LostCargoLog
};
