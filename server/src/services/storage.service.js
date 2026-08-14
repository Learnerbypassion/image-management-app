import GoogleDriveProvider from './storage/GoogleDriveProvider.js';
import LocalStorageProvider from './storage/LocalStorageProvider.js';

const providers = {
  'google-drive': new GoogleDriveProvider(),
  'local': new LocalStorageProvider(),
};

/**
 * Get storage provider implementation by name
 * @param {'google-drive' | 'local' | 's3'} [providerName='google-drive']
 * @returns {import('./storage/StorageProvider.js').StorageProvider}
 */
export const getStorageProvider = (providerName = 'google-drive') => {
  const provider = providers[providerName.toLowerCase()];
  if (!provider) {
    throw new Error(`Unsupported storage provider: "${providerName}". Supported: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
};

export default {
  getStorageProvider,
};
