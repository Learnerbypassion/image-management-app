import StorageProvider from './StorageProvider.js';
import * as driveService from '../googleDrive.service.js';
import logger from '../../utils/logger.js';

export class GoogleDriveProvider extends StorageProvider {
  async listFolderFiles(user, folderId) {
    return driveService.listPhotosInFolder(user, folderId);
  }

  async listFolders(user) {
    return driveService.listFolders(user);
  }

  async getFileStream(user, fileId) {
    return driveService.getPhotoStream(user, fileId);
  }

  async getFileBuffer(user, fileId) {
    return driveService.getPhotoBuffer(user, fileId);
  }

  async getFileMetadata(user, fileId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, imageMediaMetadata',
    });
    return response.data;
  }

  async deleteFile(user, fileId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    // Soft delete: move to trash
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
    });
    logger.info(`Drive file ${fileId} moved to trash.`);
    return true;
  }

  async renameFile(user, fileId, newName) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    const response = await drive.files.update({
      fileId,
      requestBody: { name: newName },
    });
    return response.data;
  }

  async createFolder(user, name, parentId) {
    const drive = await driveService.getAuthenticatedDriveClient(user);
    const fileMetadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };
    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name',
    });
    return response.data;
  }
}

export default GoogleDriveProvider;
