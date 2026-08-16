import { useState, useRef, useCallback } from 'react';
import api from '../services/api';

const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk
const MAX_RETRIES = 3;

/**
 * React hook for chunked file uploads with progress tracking and resume.
 *
 * Usage:
 *   const { uploadFiles, progress, isUploading, error, cancelUpload } = useChunkedUpload(roomId);
 *   uploadFiles(fileList);
 */
const useChunkedUpload = (roomId) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({
    currentFile: 0,
    totalFiles: 0,
    currentFileName: '',
    fileProgress: 0,    // 0-100 for current file
    overallProgress: 0, // 0-100 for all files
  });
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const cancelledRef = useRef(false);

  /**
   * Upload a single chunk with retry logic.
   */
  const uploadChunkWithRetry = async (roomId, sessionId, chunkIndex, chunkBlob, retries = 0) => {
    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('chunk', chunkBlob, `chunk_${chunkIndex}`);

      const { data } = await api.post(`/rooms/${roomId}/upload/chunk`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      return data;
    } catch (err) {
      if (retries < MAX_RETRIES) {
        // Wait with exponential backoff before retry
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
        return uploadChunkWithRetry(roomId, sessionId, chunkIndex, chunkBlob, retries + 1);
      }
      throw err;
    }
  };

  /**
   * Upload a single file in chunks.
   */
  const uploadSingleFile = async (file, fileIndex, totalFiles) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Initialize upload session
    const { data: initData } = await api.post(`/rooms/${roomId}/upload/init`, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'image/jpeg',
      totalChunks,
    });

    const sessionId = initData.sessionId;

    // 2. Upload chunks sequentially
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (cancelledRef.current) {
        throw new Error('Upload cancelled by user.');
      }

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBlob = file.slice(start, end);

      await uploadChunkWithRetry(roomId, sessionId, chunkIndex, chunkBlob);

      // Update progress
      const fileProgress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      const overallProgress = Math.round(
        ((fileIndex * 100 + fileProgress) / (totalFiles * 100)) * 100
      );

      setProgress({
        currentFile: fileIndex + 1,
        totalFiles,
        currentFileName: file.name,
        fileProgress,
        overallProgress,
      });
    }

    // 3. Complete the upload
    const { data: completeData } = await api.post(`/rooms/${roomId}/upload/complete`, {
      sessionId,
    });

    return completeData;
  };

  /**
   * Upload multiple files using chunked upload.
   * @param {FileList|File[]} files
   */
  const uploadFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setResults([]);
    cancelledRef.current = false;

    const fileArray = Array.from(files);
    const uploadResults = [];

    setProgress({
      currentFile: 0,
      totalFiles: fileArray.length,
      currentFileName: '',
      fileProgress: 0,
      overallProgress: 0,
    });

    try {
      for (let i = 0; i < fileArray.length; i++) {
        if (cancelledRef.current) break;

        const file = fileArray[i];
        try {
          const result = await uploadSingleFile(file, i, fileArray.length);
          uploadResults.push({ fileName: file.name, success: true, ...result });
        } catch (fileErr) {
          if (cancelledRef.current) break;
          uploadResults.push({ fileName: file.name, success: false, error: fileErr.message });
        }
      }

      setResults(uploadResults);
      const successCount = uploadResults.filter((r) => r.success).length;
      const failCount = uploadResults.filter((r) => !r.success).length;

      if (failCount > 0 && successCount === 0) {
        setError(`All ${failCount} file(s) failed to upload.`);
      } else if (failCount > 0) {
        setError(`${successCount} uploaded, ${failCount} failed.`);
      }
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }, [roomId]);

  /**
   * Cancel the current upload process.
   */
  const cancelUpload = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  return {
    uploadFiles,
    isUploading,
    progress,
    error,
    results,
    cancelUpload,
  };
};

export default useChunkedUpload;
