import { useState } from 'react';
import { HiOutlineArrowDownTray, HiOutlineStar, HiCheckCircle } from 'react-icons/hi2';
import SelectiveDownload from './SelectiveDownload';

const PhotoGrid = ({ photos }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());

  if (!photos || photos.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <p className="text-surface-200 text-lg">No photos to display.</p>
      </div>
    );
  }

  const toggleSelectPhoto = (photoId, e) => {
    e.stopPropagation();
    setSelectedPhotoIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(photoId)) {
        updated.delete(photoId);
      } else {
        updated.add(photoId);
      }
      return updated;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(photos.map((p) => p._id));
    setSelectedPhotoIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedPhotoIds(new Set());
  };

  const selectedPhotosList = photos.filter((p) => selectedPhotoIds.has(p._id));

  return (
    <>
      {/* Top selection toolbar if any items exist */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs text-surface-400 font-medium">
          Showing {photos.length} photo{photos.length > 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          {selectedPhotoIds.size < photos.length ? (
            <button
              onClick={handleSelectAll}
              className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors cursor-pointer"
            >
              Select All
            </button>
          ) : (
            <button
              onClick={handleClearSelection}
              className="text-xs font-semibold text-surface-300 hover:text-white transition-colors cursor-pointer"
            >
              Deselect All
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo, index) => {
          const isSelected = selectedPhotoIds.has(photo._id);

          return (
            <div
              key={photo._id}
              className={`group relative aspect-square rounded-2xl overflow-hidden cursor-pointer card-hover border-2 transition-all ${
                isSelected ? 'border-primary-500 ring-2 ring-primary-500/50 scale-[0.98]' : 'border-transparent'
              }`}
              style={{ animationDelay: `${index * 0.04}s` }}
              onClick={() => setLightboxPhoto(photo)}
            >
              <img
                src={`/api/photos/${photo._id}`}
                alt={photo.fileName || 'Event Photo'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />

              {/* Selection Checkbox Pill (Always clickable) */}
              <button
                onClick={(e) => toggleSelectPhoto(photo._id, e)}
                className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                  isSelected
                    ? 'bg-primary-500 text-white scale-110'
                    : 'bg-black/40 text-white/70 hover:bg-black/70 hover:text-white border border-white/20'
                }`}
                title={isSelected ? 'Deselect photo' : 'Select photo'}
              >
                <HiCheckCircle className={`text-xl ${isSelected ? 'text-white' : 'text-white/60'}`} />
              </button>

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white text-xs truncate font-medium">{photo.fileName}</p>
                  {photo.matchScore && (
                    <div className="flex items-center gap-1 mt-1">
                      <HiOutlineStar className="text-yellow-400 text-xs" />
                      <span className="text-yellow-400 text-xs font-semibold">
                        {Math.round(photo.matchScore * 100)}% match
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Selective Download Bar */}
      <SelectiveDownload
        selectedPhotos={selectedPhotosList}
        totalCount={photos.length}
        onClearSelection={handleClearSelection}
        onSelectAll={handleSelectAll}
      />

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/api/photos/${lightboxPhoto._id}`}
              alt={lightboxPhoto.fileName}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <a
                href={`/api/photos/${lightboxPhoto._id}`}
                download={lightboxPhoto.fileName}
                className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-primary-600 transition-colors text-white"
                title="Download photo"
              >
                <HiOutlineArrowDownTray className="text-xl" />
              </a>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 text-center">
              <p className="text-white text-sm font-medium">{lightboxPhoto.fileName}</p>
              {lightboxPhoto.matchScore && (
                <p className="text-yellow-400 text-sm mt-1 font-semibold">
                  {Math.round(lightboxPhoto.matchScore * 100)}% match confidence
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoGrid;
