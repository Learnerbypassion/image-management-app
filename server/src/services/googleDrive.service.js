import { google } from 'googleapis';
import { createOAuth2Client } from '../config/google.js';
import { encryptToken, decryptToken } from '../utils/crypto.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Full Drive scope required to create/upload photos into arbitrary existing Drive folders
const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

/**
 * Generate Google OAuth2 consent URL
 * @param {string} [state] - Optional state payload (e.g. userId) passed through OAuth flow
 */
export const getAuthUrl = (state) => {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Requests refresh token
    prompt: 'consent',     // Forces refresh token emission on approval
    scope: SCOPES,
    state: state || undefined,
  });
};

/**
 * Handle OAuth callback code exchange & save tokens securely for user
 */
export const handleCallback = async (code, userId) => {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  // Encrypt refresh token before storing in MongoDB
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : user.googleTokens?.refreshToken; // Preserve existing if re-authenticating without prompt

  user.googleTokens = {
    accessToken: tokens.access_token,
    refreshToken: encryptedRefreshToken,
    expiryDate: tokens.expiry_date,
    isConnected: true,
  };

  await user.save();
  logger.success(`Google Drive connected for user ${user._id}`);

  return user;
};

/**
 * Get authenticated Drive API v3 client for a given user
 */
export const getAuthenticatedDriveClient = async (user) => {
  if (!user.googleTokens?.isConnected) {
    throw new Error('Google Drive is not connected for this user.');
  }

  const oauth2Client = createOAuth2Client();

  const decryptedRefreshToken = decryptToken(user.googleTokens.refreshToken);

  oauth2Client.setCredentials({
    access_token: user.googleTokens.accessToken,
    refresh_token: decryptedRefreshToken,
    expiry_date: user.googleTokens.expiryDate,
  });

  // Handle token refresh automatically if expired
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      user.googleTokens.accessToken = tokens.access_token;
    }
    if (tokens.expiry_date) {
      user.googleTokens.expiryDate = tokens.expiry_date;
    }
    if (tokens.refresh_token) {
      user.googleTokens.refreshToken = encryptToken(tokens.refresh_token);
    }
    await user.save();
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
};

/**
 * List folders in the user's Google Drive
 */
export const listFolders = async (user) => {
  const drive = await getAuthenticatedDriveClient(user);

  const response = await drive.files.list({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name, modifiedTime, parents)',
    pageSize: 100,
    orderBy: 'folder,name',
  });

  return response.data.files || [];
};

/**
 * List image files inside a specific Google Drive folder
 */
export const listPhotosInFolder = async (user, folderId) => {
  const drive = await getAuthenticatedDriveClient(user);

  let photos = [];
  let pageToken = null;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, imageMediaMetadata)',
      pageSize: 100,
      pageToken: pageToken,
    });

    if (response.data.files) {
      // Filter for images by mimeType OR file extension
      const imageFiles = response.data.files.filter((f) => {
        const isImageMime = f.mimeType && f.mimeType.startsWith('image/');
        const isImageExt = /\.(jpg|jpeg|png|webp|heic|bmp|tiff)$/i.test(f.name);
        return isImageMime || isImageExt;
      });
      photos = photos.concat(imageFiles);
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  logger.info(`Found ${photos.length} image files in Drive folder ${folderId}`);
  return photos;
};

/**
 * Stream an image file from Google Drive as a ReadableStream or Buffer
 */
export const getPhotoStream = async (user, fileId) => {
  const drive = await getAuthenticatedDriveClient(user);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return response.data;
};

/**
 * Fetch image content buffer directly from Google Drive API
 */
export const getPhotoBuffer = async (user, fileId) => {
  const drive = await getAuthenticatedDriveClient(user);

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data);
};
