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

// Compound index for room-scoped queries
faceEmbeddingSchema.index({ roomId: 1, photoId: 1 });

const FaceEmbedding = mongoose.model('FaceEmbedding', faceEmbeddingSchema);

export default FaceEmbedding;
