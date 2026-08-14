import mongoose from 'mongoose';
import crypto from 'crypto';

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
    maxlength: [200, 'Room name cannot exceed 200 characters'],
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6,
  },
  // Public join token for QR codes and instant guest access (/join/:publicToken)
  publicToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organization: {
    type: String,
    trim: true,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },

  // Storage provider mapping
  storageProvider: {
    type: String,
    enum: ['google-drive', 'local', 's3', 'cloudinary'],
    default: 'google-drive',
  },

  // Google Drive fields
  driveFolderId: {
    type: String,
    default: null,
  },
  driveFolderName: {
    type: String,
    default: null,
  },

  // Sync state tracking
  sync: {
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['idle', 'syncing', 'error'],
      default: 'idle',
    },
    lastSyncedAt: { type: Date, default: null },
    lastSyncStartedAt: { type: Date, default: null },
    lastSyncCompletedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },

  // Extended processing stats
  processing: {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    processing: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },

  // Legacy status
  status: {
    type: String,
    enum: ['created', 'indexing', 'ready', 'error'],
    default: 'created',
  },
  totalPhotos: {
    type: Number,
    default: 0,
  },
  processedPhotos: {
    type: Number,
    default: 0,
  },
  facesDetected: {
    type: Number,
    default: 0,
  },
  // Structured membership with roles and upload permissions
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['OWNER', 'PHOTOGRAPHER', 'PARTICIPANT'],
      default: 'PARTICIPANT',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REMOVED', 'LEFT'],
      default: 'ACTIVE',
    },
    // Upload permission — only relevant for PHOTOGRAPHER role
    // OWNER always has upload rights; PARTICIPANT never does
    uploadPermission: {
      type: String,
      enum: ['APPROVED', 'PENDING', 'DENIED'],
      default: 'DENIED',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    _id: false,
  }],
}, {
  timestamps: true,
});

// Auto-generate publicToken before save if not present
roomSchema.pre('save', function (next) {
  if (!this.publicToken) {
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const cleanName = this.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
    this.publicToken = `${cleanName || 'ROOM'}-${randomSuffix}`;
  }
  next();
});

roomSchema.index({ ownerId: 1 });
roomSchema.index({ 'members.userId': 1 });

const Room = mongoose.model('Room', roomSchema);

export default Room;
