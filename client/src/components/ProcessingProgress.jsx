const ProcessingProgress = ({ status, total, processed, facesDetected }) => {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  if (status === 'created') {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-surface-200">No photos indexed yet. Upload photos to get started.</p>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <h3 className="text-lg font-semibold text-white">Indexing Complete</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-surface-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold gradient-text">{total}</p>
            <p className="text-xs text-surface-200 mt-1">Total Photos</p>
          </div>
          <div className="bg-surface-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold gradient-text">{processed}</p>
            <p className="text-xs text-surface-200 mt-1">Processed</p>
          </div>
          <div className="bg-surface-800/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold gradient-text">{facesDetected}</p>
            <p className="text-xs text-surface-200 mt-1">Faces Found</p>
          </div>
        </div>
      </div>
    );
  }

  // Indexing in progress
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-3 h-3 rounded-full bg-blue-500 pulse-glow" />
        <h3 className="text-lg font-semibold text-white">Indexing your photos...</h3>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-800 rounded-full h-3 mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-surface-200">
          {processed} / {total} photos
        </span>
        <span className="font-semibold gradient-text">{percentage}%</span>
      </div>

      <div className="mt-4 bg-surface-800/50 rounded-xl px-4 py-3">
        <p className="text-sm text-surface-200">
          <span className="text-white font-semibold">{facesDetected}</span> faces detected so far
        </p>
      </div>
    </div>
  );
};

export default ProcessingProgress;
