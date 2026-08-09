import crypto from 'crypto';
import env from '../config/env.js';

/**
 * Generate a unique 6-character alphanumeric room code
 * Example: "FR26X9"
 */
export const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
};

// AES-256-GCM Encryption Key (32 bytes derived from JWT_SECRET or ENCRYPTION_SECRET)
const getMasterKey = () => {
  const secret = process.env.ENCRYPTION_SECRET || env.JWT_SECRET || 'fallback-secret-key-change-this';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypt a text string (e.g. OAuth refresh token) using AES-256-GCM
 */
export const encryptToken = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Return IV:AuthTag:EncryptedPayload
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt an AES-256-GCM encrypted token string
 */
export const decryptToken = (encryptedData) => {
  if (!encryptedData) return null;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getMasterKey();
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt token:', err.message);
    return null;
  }
};
