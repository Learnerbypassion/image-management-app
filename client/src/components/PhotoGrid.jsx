import { useState } from 'react';
import { HiOutlineDownload, HiOutlineStar } from 'react-icons/hi';

const PhotoGrid = ({ photos, onDownload }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <p className="text-surface-200 text-lg">No photos to display.</p>
      </div>
    );
  }

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo._id}
            className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer card-hover"
            style={{ animationDelay: `${index * 0.05}s` }}
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={`/api/photos/${photo._id}`}
              alt={photo.fileName}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-xs truncate">{photo.fileName}</p>
                {photo.matchScore && (
                  <div className="flex items-center gap-1 mt-1">
                    <HiOutlineStar className="text-yellow-400 text-xs" />
                    <span className="text-yellow-400 text-xs font-medium">
                      {Math.round(photo.matchScore * 100)}% match
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`/api/photos/${selectedPhoto._id}`}
              alt={selectedPhoto.fileName}
              className="max-w-full max-h-[85vh] object-contain rounded-xl"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <a
                href={`/api/photos/${selectedPhoto._id}`}
                download={selectedPhoto.fileName}
                className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-primary-600 transition-colors"
              >
                <HiOutlineDownload className="text-white" />
              </a>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 text-center">
              <p className="text-white text-sm">{selectedPhoto.fileName}</p>
              {selectedPhoto.matchScore && (
                <p className="text-yellow-400 text-sm mt-1">
                  {Math.round(selectedPhoto.matchScore * 100)}% match confidence
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
