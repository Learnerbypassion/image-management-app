/**
 * StorageProvider Interface / Abstract Base Class
 * Defines standard contract for all storage backends (Google Drive, Local, S3, etc.)
 */
export class StorageProvider {
  /**
   * List files within a folder
   * @param {Object} user
   * @param {string} folderId
   * @param {Object} [options]
   * @returns {Promise<Array<{id: string, name: string, mimeType: string, size: number, modifiedTime: string}>>}
   */
  async listFiles(user, folderId, options) {
    throw new Error('StorageProvider.listFiles() must be implemented.');
  }

  /**
   * Get file content as a Buffer
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<Buffer>}
   */
  async getFile(user, fileId) {
    throw new Error('StorageProvider.getFile() must be implemented.');
  }

  /**
   * Get ReadableStream for a file
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<import('stream').Readable>}
   */
  async getFileStream(user, fileId) {
    throw new Error('StorageProvider.getFileStream() must be implemented.');
  }

  /**
   * Get metadata for a file
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<{id: string, name: string, mimeType: string, size: number, modifiedTime: string}>}
   */
  async getMetadata(user, fileId) {
    throw new Error('StorageProvider.getMetadata() must be implemented.');
  }

  /**
   * Upload a file
   * @param {Object} user
   * @param {Object} file - { originalname/name, buffer/stream/path, mimetype }
   * @param {string} [parentId]
   * @returns {Promise<Object>}
   */
  async uploadFile(user, file, parentId) {
    throw new Error('StorageProvider.uploadFile() must be implemented.');
  }

  /**
   * Create a folder
   * @param {Object} user
   * @param {string} name
   * @param {string} [parentId]
   * @returns {Promise<{id: string, name: string}>}
   */
  async createFolder(user, name, parentId) {
    throw new Error('StorageProvider.createFolder() must be implemented.');
  }

  /**
   * Move a file to a new folder
   * @param {Object} user
   * @param {string} fileId
   * @param {string} newParentId
   * @returns {Promise<Object>}
   */
  async moveFile(user, fileId, newParentId) {
    throw new Error('StorageProvider.moveFile() must be implemented.');
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

  /**
   * Delete a file or move to trash
   * @param {Object} user
   * @param {string} fileId
   * @returns {Promise<boolean>}
   */
  async deleteFile(user, fileId) {
    throw new Error('StorageProvider.deleteFile() must be implemented.');
  }
}

export default StorageProvider;
