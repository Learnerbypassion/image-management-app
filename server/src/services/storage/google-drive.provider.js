import fs from 'fs';
import { Readable } from 'stream';
import StorageProvider from './storage.interface.js';
import * as driveService from '../googleDrive.service.js';
import logger from '../../utils/logger.js';

export class GoogleDriveProvider extends StorageProvider {
  /**
   * List photos/files in a Google Drive folder
   */
  async listFiles(user, folderId, options = {}) {
    return driveService.listPhotosInFolder(user, folderId);
  }

  // Alias for backward compatibility
  async listFolderFiles(user, folderId, options = {}) {
    return this.listFiles(user, folderId, options);
  }

  /**
   * List folders in user's Drive
   */
  async listFolders(user) {
    return driveService.listFolders(user);
  }

  /**
   * Get photo binary content as Buffer
   */
  async getFile(user, fileId) {
    return driveService.getPhotoBuffer(user, fileId);
  }

  // Alias for backward compatibility
  async getFileBuffer(user, fileId) {
    return this.getFile(user, fileId);
  }

  /**
   * Get photo as ReadableStream
   */
  async getFileStream(user, fileId) {
    return driveService.getPhotoStream(user, fileId);
  }

  /**
   * Get metadata for a file
   */
  async getMetadata(user, fileId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, parents, imageMediaMetadata',
    });
    return response.data;
  }

  // Alias for backward compatibility
  async getFileMetadata(user, fileId) {
    return this.getMetadata(user, fileId);
  }

  /**
   * Upload a file to Google Drive
   */
  async uploadFile(user, file, parentId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);

    const fileMetadata = {
      name: file.originalname || file.name || 'uploaded_photo.jpg',
      parents: parentId ? [parentId] : undefined,
    };

    let mediaBody;
    if (file.buffer) {
      mediaBody = Readable.from(file.buffer);
    } else if (file.stream) {
      mediaBody = file.stream;
    } else if (file.path) {
      mediaBody = fs.createReadStream(file.path);
    }

    const media = {
      mimeType: file.mimetype || 'image/jpeg',
      body: mediaBody,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, mimeType, size, webViewLink, webContentLink',
    });

    logger.info(`Uploaded file "${response.data.name}" (${response.data.id}) to Google Drive.`);
    return response.data;
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(user, name, parentId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    const fileMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType',
    });
    logger.info(`Created Google Drive folder "${name}" (${response.data.id}).`);
    return response.data;
  }

  /**
   * Move a file to a new parent folder
   */
  async moveFile(user, fileId, newParentId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    // Get existing parents to remove
    const file = await drive.files.get({ fileId, fields: 'parents' });
    const previousParents = (file.data.parents || []).join(',');

    const response = await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields: 'id, name, parents',
    });
    logger.info(`Moved file ${fileId} to parent ${newParentId}.`);
    return response.data;
  }

  /**
   * Rename a file in Google Drive
   */
  async renameFile(user, fileId, newName) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    const response = await drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: 'id, name',
    });
    return response.data;
  }

  /**
   * Soft delete a file (move to trash)
   */
  async deleteFile(user, fileId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
    });
    logger.info(`Drive file ${fileId} moved to trash.`);
    return true;
  }
}

export default GoogleDriveProvider;
