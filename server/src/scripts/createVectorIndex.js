/**
 * Script to create MongoDB Atlas Vector Search index on the face_embeddings collection.
 *
 * Run: node src/scripts/createVectorIndex.js
 *
 * NOTE: This requires MongoDB Atlas (M0 free tier supports vector search).
 *       This script only needs to be run ONCE per database.
 */

import mongoose from 'mongoose';
import env from '../config/env.js';

const MONGODB_URI = env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set in .env');
  process.exit(1);
}

async function createVectorIndex() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.getClient().db();
    const collection = db.collection('faceembeddings');

    // Create the vector search index
    const indexDefinition = {
      createSearchIndexes: 'faceembeddings',
      indexes: [
        {
          name: 'face_vector_index',
          type: 'vectorSearch',
          definition: {
            fields: [
              {
                path: 'embedding',
                type: 'vector',
                numDimensions: 512,     // ArcFace/InsightFace embedding dimension
                similarity: 'cosine',
              },
              {
                path: 'roomId',
                type: 'filter',         // Pre-filter by room for scoped searches
              },
            ],
          },
        },
      ],
    };

    const result = await db.command(indexDefinition);
    console.log('✅ Vector search index created:', result);
  } catch (error) {
    if (error.codeName === 'IndexAlreadyExists' || error.message?.includes('already exists')) {
      console.log('ℹ️ Vector search index already exists.');
    } else {
      console.error('❌ Error creating vector index:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createVectorIndex();
