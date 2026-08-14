import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StorageProvider from './StorageProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

export class LocalStorageProvider extends StorageProvider {
  async getFileStream(user, fileIdOrPath) {
    const filePath = path.isAbsolute(fileIdOrPath)
      ? fileIdOrPath
      : path.join(UPLOADS_DIR, fileIdOrPath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on local disk: ${filePath}`);
    }

    return fs.createReadStream(filePath);
  }

  async getFileBuffer(user, fileIdOrPath) {
    const filePath = path.isAbsolute(fileIdOrPath)
      ? fileIdOrPath
      : path.join(UPLOADS_DIR, fileIdOrPath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on local disk: ${filePath}`);
    }

    return fs.promises.readFile(filePath);
  }

  async getFileMetadata(user, fileIdOrPath) {
    const filePath = path.isAbsolute(fileIdOrPath)
      ? fileIdOrPath
      : path.join(UPLOADS_DIR, fileIdOrPath);

    const stats = await fs.promises.stat(filePath);
    return {
      id: fileIdOrPath,
      name: path.basename(filePath),
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
    };
  }

  async deleteFile(user, fileIdOrPath) {
    const filePath = path.isAbsolute(fileIdOrPath)
      ? fileIdOrPath
      : path.join(UPLOADS_DIR, fileIdOrPath);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
}

export default LocalStorageProvider;
