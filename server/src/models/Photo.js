import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  },

  // Storage provider configuration
  storageProvider: {
    type: String,
    enum: ['google-drive', 'local', 's3', 'cloudinary'],
    default: 'google-drive',
    required: true,
  },

  // Abstract storage payload
  storage: {
    fileId: { type: String, default: null, index: true },
    folderId: { type: String, default: null },
    fileName: { type: String, required: true },
    mimeType: { type: String, default: 'image/jpeg' },
    size: { type: Number, default: 0 },
    localPath: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },

  // Granular processing lifecycle state
  processing: {
    status: {
      type: String,
      enum: ['pending', 'downloading', 'face_detection', 'embedding', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    processedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },

  // Legacy & status flags
  indexed: {
    type: Boolean,
    default: false,
    index: true,
  },
  facesFound: {
    type: Number,
    default: 0,
  },
  perceptualHash: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Backward compatibility virtual properties
photoSchema.virtual('driveFileId').get(function () {
  return this.storage?.fileId || null;
});

photoSchema.virtual('localPath').get(function () {
  return this.storage?.localPath || null;
});

photoSchema.virtual('fileName').get(function () {
  return this.storage?.fileName || '';
});

photoSchema.virtual('mimeType').get(function () {
  return this.storage?.mimeType || 'image/jpeg';
});

photoSchema.virtual('size').get(function () {
  return this.storage?.size || 0;
});

photoSchema.index({ roomId: 1, indexed: 1 });
photoSchema.index({ roomId: 1, 'processing.status': 1 });

const Photo = mongoose.model('Photo', photoSchema);

export default Photo;
