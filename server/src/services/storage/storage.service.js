import GoogleDriveProvider from './google-drive.provider.js';
import LocalProvider from './local.provider.js';

const providers = {
  'google-drive': new GoogleDriveProvider(),
  'local': new LocalProvider(),
};

/**
 * Get storage provider instance by name
 * @param {'google-drive' | 'local' | 's3'} [providerName='google-drive']
 * @returns {import('./storage.interface.js').StorageProvider}
 */
export const getStorageProvider = (providerName = 'google-drive') => {
  const normalized = (providerName || 'google-drive').toLowerCase();
  const provider = providers[normalized];

  if (!provider) {
    throw new Error(
      `Unsupported storage provider: "${providerName}". Supported: ${Object.keys(providers).join(', ')}`
    );
  }

  return provider;
};

/**
 * Register a custom storage provider (e.g., s3.provider.js) dynamically
 */
export const registerStorageProvider = (name, providerInstance) => {
  providers[name.toLowerCase()] = providerInstance;
};

export default {
  getStorageProvider,
  registerStorageProvider,
};
