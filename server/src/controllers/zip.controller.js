import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
import Photo from '../models/Photo.js';
import { getStorageProvider } from '../services/storage.service.js';
import logger from '../utils/logger.js';

// POST /api/photos/download-zip
export const downloadPhotosZip = async (req, res, next) => {
  try {
    const { photoIds } = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of photoIds to download.' });
    }

    const photos = await Photo.find({ _id: { $in: photoIds } });
    if (photos.length === 0) {
      return res.status(404).json({ error: 'No matching photos found.' });
    }

    const zipFilename = `SnapFind_Photos_${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => {
      logger.error('ZIP archive streaming error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate ZIP archive.' });
      }
    });

    archive.pipe(res);

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      try {
        const providerName = photo.storageProvider || (photo.driveFileId ? 'google-drive' : 'local');
        const fileId = photo.storage?.fileId || photo.driveFileId || photo.storage?.localPath || photo.localPath;

        if (!fileId) continue;

        const provider = getStorageProvider(providerName);
        const stream = await provider.getFileStream(req.user, fileId);

        // Sanitize filename to avoid collisions inside ZIP
        const safeName = `${i + 1}_${photo.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        archive.append(stream, { name: safeName });
      } catch (err) {
        logger.error(`Error adding photo ${photo._id} to ZIP:`, err.message);
      }
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};
