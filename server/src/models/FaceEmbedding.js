import mongoose from 'mongoose';

const faceEmbeddingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  photoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Photo',
    required: true,
  },
  embedding: {
    type: [Number],
    required: true,
    // 512-dimensional vector from ArcFace/InsightFace
  },
  boundingBox: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  faceIndex: {
    type: Number,
    default: 0,
  },
  qualityScore: {
    type: Number,
    default: 0,
  },
  confidence: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Compound unique index for idempotent face insertion
faceEmbeddingSchema.index({ roomId: 1, photoId: 1, faceIndex: 1 }, { unique: true });

const FaceEmbedding = mongoose.model('FaceEmbedding', faceEmbeddingSchema);

export default FaceEmbedding;
