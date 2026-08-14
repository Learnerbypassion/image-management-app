import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import api from '../services/api';
import { HiOutlineArrowDownTray, HiOutlineCheckCircle, HiOutlineXMark, HiOutlineArchiveBox } from 'react-icons/hi2';

const SelectiveDownload = ({ selectedPhotos, totalCount, onClearSelection, onSelectAll }) => {
  const [downloading, setDownloading] = useState(false);
  const [progressText, setProgressText] = useState('');

  if (!selectedPhotos || selectedPhotos.length === 0) return null;

  const handleDownloadZip = async () => {
    setDownloading(true);
    const count = selectedPhotos.length;

    try {
      if (count <= 10) {
        // Mode A: Client-side JSZip for small selections
        setProgressText(`Packaging ${count} photo(s) in browser...`);
        const zip = new JSZip();

        for (let i = 0; i < selectedPhotos.length; i++) {
          const photo = selectedPhotos[i];
          setProgressText(`Fetching photo ${i + 1}/${count}...`);

          try {
            const response = await api.get(`/photos/${photo._id}`, {
              responseType: 'blob',
            });

            const safeName = `${i + 1}_${photo.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            zip.file(safeName, response.data);
          } catch (err) {
            console.error(`Failed to fetch photo ${photo._id} for client zip:`, err);
          }
        }

        setProgressText('Compressing ZIP file...');
        const zipContent = await zip.generateAsync({ type: 'blob' });
        saveAs(zipContent, `SnapFind_MyPhotos_${count}.zip`);
      } else {
        // Mode B: Server-side archiver stream for large selections (> 10 photos)
        setProgressText(`Requesting server ZIP stream for ${count} photos...`);

        const photoIds = selectedPhotos.map((p) => p._id);
        const response = await api.post(
          '/photos/download-zip',
          { photoIds },
          { responseType: 'blob' }
        );

        saveAs(response.data, `SnapFind_MyPhotos_${count}.zip`);
      }
    } catch (err) {
      alert('Failed to download ZIP file: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
      setProgressText('');
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up w-11/12 max-w-xl">
      <div className="glass rounded-2xl p-4 border border-primary-500/40 shadow-2xl bg-surface-900/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600/30 text-primary-400 flex items-center justify-center font-bold">
            {selectedPhotos.length}
          </div>
          <div>
            <p className="text-white text-sm font-semibold">
              {selectedPhotos.length} photo{selectedPhotos.length > 1 ? 's' : ''} selected
            </p>
            <p className="text-surface-200 text-xs">
              {selectedPhotos.length <= 10 ? 'Client-side ZIP' : 'Server-side ZIP Stream'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {totalCount > selectedPhotos.length && (
            <button
              onClick={onSelectAll}
              className="px-3 py-2 rounded-xl text-xs font-semibold glass text-surface-200 hover:text-white transition-colors cursor-pointer"
            >
              Select All ({totalCount})
            </button>
          )}

          <button
            onClick={onClearSelection}
            className="p-2 rounded-xl text-surface-400 hover:text-white glass transition-colors cursor-pointer"
            title="Deselect all"
          >
            <HiOutlineXMark className="text-lg" />
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={downloading}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary-900/40"
          >
            {downloading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18 }} />
                <span className="text-xs">{progressText || 'Preparing...'}</span>
              </>
            ) : (
              <>
                <HiOutlineArchiveBox className="text-lg" />
                <span>Download .ZIP</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectiveDownload;
