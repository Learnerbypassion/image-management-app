import mongoose from 'mongoose';

const uploadRequestSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'],
    default: 'PENDING',
  },
  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters'],
    default: '',
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

// Compound index: one pending request per user per room
uploadRequestSchema.index({ roomId: 1, requesterId: 1 });
uploadRequestSchema.index({ roomId: 1, status: 1 });

const UploadRequest = mongoose.model('UploadRequest', uploadRequestSchema);

export default UploadRequest;
