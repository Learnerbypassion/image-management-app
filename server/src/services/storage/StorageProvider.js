/**
 * Abstract Base StorageProvider Interface
 * All storage implementations (GoogleDrive, LocalStorage, S3, etc.) must implement this interface.
 */
export class StorageProvider {
  /**
   * List files within a folder
   * @param {Object} user - User document containing auth tokens if required
   * @param {string} folderId - Folder identifier
   * @returns {Promise<Array<{id: string, name: string, mimeType: string, size: number, modifiedTime: string}>>}
   */
  async listFolderFiles(user, folderId) {
    throw new Error('StorageProvider.listFolderFiles() must be implemented.');
  }

  /**
   * Get metadata for a specific file
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<Object>}
   */
  async getFileMetadata(user, fileId) {
    throw new Error('StorageProvider.getFileMetadata() must be implemented.');
  }

  /**
   * Get a ReadableStream for a file
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<import('stream').Readable>}
   */
  async getFileStream(user, fileId) {
    throw new Error('StorageProvider.getFileStream() must be implemented.');
  }

  /**
   * Get file binary content as a Buffer
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<Buffer>}
   */
  async getFileBuffer(user, fileId) {
    throw new Error('StorageProvider.getFileBuffer() must be implemented.');
  }

  /**
   * Upload a file
   * @param {Object} user
   * @param {Object} file - File payload
   * @returns {Promise<Object>}
   */
  async uploadFile(user, file) {
    throw new Error('StorageProvider.uploadFile() must be implemented.');
  }

  /**
   * Create a subfolder
   * @param {Object} user
   * @param {string} name
   * @param {string} [parentId]
   * @returns {Promise<Object>}
   */
  async createFolder(user, name, parentId) {
    throw new Error('StorageProvider.createFolder() must be implemented.');
  }

  /**
   * Delete a file or move to trash
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<boolean>}
   */
  async deleteFile(user, fileId) {
    throw new Error('StorageProvider.deleteFile() must be implemented.');
  }

  /**
   * Rename a file
   * @param {Object} user
   * @param {string} fileId
   * @param {string} newName
   * @returns {Promise<Object>}
   */
  async renameFile(user, fileId, newName) {
    throw new Error('StorageProvider.renameFile() must be implemented.');
  }
}

export default StorageProvider;
