import logger from './logger.js';

/**
 * Drive Error Codes — actionable classifications for UX and retry logic
 */
export const DRIVE_ERROR_CODES = {
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  DRIVE_ACCESS_REVOKED: 'DRIVE_ACCESS_REVOKED',
  FOLDER_NOT_FOUND: 'FOLDER_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Classify a Google API error into an actionable Drive error code.
 * @param {Error} err - The error thrown by googleapis
 * @returns {{ code: string, message: string, retryable: boolean, requiresReconnect: boolean }}
 */
export const classifyDriveError = (err) => {
  const status = err?.response?.status || err?.code;
  const message = err?.response?.data?.error?.message || err?.message || 'Unknown error';
  const errorReason = err?.response?.data?.error?.errors?.[0]?.reason || '';

  // 401 — token expired or revoked
  if (status === 401 || message.includes('invalid_grant') || message.includes('Token has been expired')) {
    return {
      code: DRIVE_ERROR_CODES.TOKEN_EXPIRED,
      message: 'Google Drive access token has expired. Please reconnect your Google Drive.',
      retryable: false,
      requiresReconnect: true,
    };
  }

  // 403 — permission or quota issues
  if (status === 403) {
    if (errorReason === 'insufficientPermissions' || message.includes('insufficient')) {
      return {
        code: DRIVE_ERROR_CODES.INSUFFICIENT_SCOPE,
        message: 'SnapFind does not have sufficient permissions. Please reconnect Google Drive.',
        retryable: false,
        requiresReconnect: true,
      };
    }
    if (errorReason === 'userRateLimitExceeded' || errorReason === 'rateLimitExceeded' || message.includes('rate limit')) {
      return {
        code: DRIVE_ERROR_CODES.QUOTA_EXCEEDED,
        message: 'Google Drive API rate limit reached. Sync will retry automatically.',
        retryable: true,
        requiresReconnect: false,
      };
    }
    // Generic 403 — likely revoked
    return {
      code: DRIVE_ERROR_CODES.DRIVE_ACCESS_REVOKED,
      message: 'Google Drive access has been revoked. Please reconnect.',
      retryable: false,
      requiresReconnect: true,
    };
  }

  // 404 — file or folder not found
  if (status === 404) {
    if (message.includes('folder') || message.includes('Folder')) {
      return {
        code: DRIVE_ERROR_CODES.FOLDER_NOT_FOUND,
        message: 'The linked Google Drive folder was not found. It may have been deleted or moved.',
        retryable: false,
        requiresReconnect: false,
      };
    }
    return {
      code: DRIVE_ERROR_CODES.FILE_NOT_FOUND,
      message: 'A file was not found in Google Drive. It may have been deleted.',
      retryable: false,
      requiresReconnect: false,
    };
  }

  // Network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return {
      code: DRIVE_ERROR_CODES.NETWORK_ERROR,
      message: 'Network error connecting to Google Drive. Will retry.',
      retryable: true,
      requiresReconnect: false,
    };
  }

  // Fallback
  return {
    code: DRIVE_ERROR_CODES.UNKNOWN,
    message: message,
    retryable: false,
    requiresReconnect: false,
  };
};

/**
 * Handle a Drive auth error: disconnect user tokens and mark room sync as error.
 */
export const handleDriveAuthError = async (user, room, errorCode) => {
  const User = (await import('../models/User.js')).default;
  const Room = (await import('../models/Room.js')).default;
  const { emitToRoom } = await import('../config/socket.js');

  // Mark user's Drive as disconnected
  if (user) {
    await User.findByIdAndUpdate(user._id, {
      'googleTokens.isConnected': false,
    });
    logger.warn(`Drive disconnected for user ${user._id} due to ${errorCode}`);
  }

  // Mark room sync as error
  if (room) {
    await Room.findByIdAndUpdate(room._id, {
      'sync.status': 'error',
      'sync.error': errorCode,
    });

    // Notify connected clients
    emitToRoom(room._id, 'drive:auth-error', {
      roomId: room._id.toString(),
      errorCode,
      message: 'Google Drive access needs attention.',
    });
  }
};

export default {
  DRIVE_ERROR_CODES,
  classifyDriveError,
  handleDriveAuthError,
};
