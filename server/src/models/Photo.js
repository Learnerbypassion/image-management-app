import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true,
  },
  // For Phase 2: local upload path; Phase 4: driveFileId
  driveFileId: {
    type: String,
    default: null,
  },
  localPath: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    default: 'image/jpeg',
  },
  size: {
    type: Number,
    default: 0,
  },
  width: {
    type: Number,
    default: null,
  },
  height: {
    type: Number,
    default: null,
  },
  indexed: {
    type: Boolean,
    default: false,
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
});

photoSchema.index({ roomId: 1, indexed: 1 });

const Photo = mongoose.model('Photo', photoSchema);

export default Photo;
