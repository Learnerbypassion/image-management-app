import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StorageProvider from './storage.interface.js';
import logger from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');

export class LocalProvider extends StorageProvider {
  _getFilePath(fileIdOrPath) {
    return path.isAbsolute(fileIdOrPath)
      ? fileIdOrPath
      : path.join(UPLOADS_DIR, fileIdOrPath);
  }

  async listFiles(user, folderId) {
    const targetDir = folderId ? this._getFilePath(folderId) : UPLOADS_DIR;
    if (!fs.existsSync(targetDir)) return [];

    const files = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const results = [];

    for (const dirent of files) {
      if (dirent.isFile()) {
        const fullPath = path.join(targetDir, dirent.name);
        const stats = await fs.promises.stat(fullPath);
        results.push({
          id: dirent.name,
          name: dirent.name,
          mimeType: 'image/jpeg', // default fallback
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
        });
      }
    }
    return results;
  }

  async listFolderFiles(user, folderId) {
    return this.listFiles(user, folderId);
  }

  async getFile(user, fileIdOrPath) {
    const filePath = this._getFilePath(fileIdOrPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on local disk: ${filePath}`);
    }
    return fs.promises.readFile(filePath);
  }

  async getFileBuffer(user, fileIdOrPath) {
    return this.getFile(user, fileIdOrPath);
  }

  async getFileStream(user, fileIdOrPath) {
    const filePath = this._getFilePath(fileIdOrPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on local disk: ${filePath}`);
    }
    return fs.createReadStream(filePath);
  }

  async getMetadata(user, fileIdOrPath) {
    const filePath = this._getFilePath(fileIdOrPath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on local disk: ${filePath}`);
    }
    const stats = await fs.promises.stat(filePath);
    return {
      id: fileIdOrPath,
      name: path.basename(filePath),
      mimeType: 'image/jpeg',
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
    };
  }

  async getFileMetadata(user, fileIdOrPath) {
    return this.getMetadata(user, fileIdOrPath);
  }

  async uploadFile(user, file, parentId) {
    const targetDir = parentId ? this._getFilePath(parentId) : UPLOADS_DIR;
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const fileName = file.originalname || file.name || `photo_${Date.now()}.jpg`;
    const targetPath = path.join(targetDir, fileName);

    if (file.buffer) {
      await fs.promises.writeFile(targetPath, file.buffer);
    } else if (file.path && file.path !== targetPath) {
      await fs.promises.copyFile(file.path, targetPath);
    } else if (file.stream) {
      const writeStream = fs.createWriteStream(targetPath);
      await new Promise((resolve, reject) => {
        file.stream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    const stats = await fs.promises.stat(targetPath);
    return {
      id: fileName,
      name: fileName,
      path: targetPath,
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
    };
  }

  async createFolder(user, name, parentId) {
    const targetDir = parentId
      ? path.join(this._getFilePath(parentId), name)
      : path.join(UPLOADS_DIR, name);

    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    return { id: name, name, path: targetDir };
  }

  async moveFile(user, fileId, newParentId) {
    const sourcePath = this._getFilePath(fileId);
    const destDir = this._getFilePath(newParentId);
    const destPath = path.join(destDir, path.basename(sourcePath));

    await fs.promises.rename(sourcePath, destPath);
    return { id: path.basename(destPath), name: path.basename(destPath), path: destPath };
  }

  async renameFile(user, fileId, newName) {
    const sourcePath = this._getFilePath(fileId);
    const destPath = path.join(path.dirname(sourcePath), newName);

    await fs.promises.rename(sourcePath, destPath);
    return { id: newName, name: newName, path: destPath };
  }

  async deleteFile(user, fileIdOrPath) {
    const filePath = this._getFilePath(fileIdOrPath);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }
}

export default LocalProvider;
