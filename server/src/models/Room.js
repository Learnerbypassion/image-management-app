import mongoose from 'mongoose';

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
  // Google Drive fields (Phase 4)
  driveFolderId: {
    type: String,
    default: null,
  },
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
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, {
  timestamps: true,
});

// Index for fast owner lookups
roomSchema.index({ ownerId: 1 });

const Room = mongoose.model('Room', roomSchema);

export default Room;
