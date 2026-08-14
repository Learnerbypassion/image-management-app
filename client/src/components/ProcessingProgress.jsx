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
      <div className="glass rounded-2xl p-6 border border-emerald-500/20 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
            <h3 className="text-lg font-semibold text-white">Indexing Complete</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
            INDEXED
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-surface-800/50 rounded-xl p-4 text-center border border-white/5">
            <p className="text-2xl font-bold gradient-text">{total}</p>
            <p className="text-xs text-surface-400 mt-1">Total Photos</p>
          </div>
          <div className="bg-surface-800/50 rounded-xl p-4 text-center border border-white/5">
            <p className="text-2xl font-bold gradient-text">{processed}</p>
            <p className="text-xs text-surface-400 mt-1">Indexed</p>
          </div>
          <div className="bg-surface-800/50 rounded-xl p-4 text-center border border-white/5">
            <p className="text-2xl font-bold gradient-text">{facesDetected}</p>
            <p className="text-xs text-surface-400 mt-1">Faces Found</p>
          </div>
        </div>
      </div>
    );
  }

  // Indexing in progress
  return (
    <div className="glass rounded-2xl p-6 border border-primary-500/30 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-indigo-500 pulse-glow" />
          <h3 className="text-lg font-semibold text-white">Indexing Job Running...</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-primary-500/20 text-primary-300 border border-primary-500/30">
            PROCESSING
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-surface-900 rounded-full h-3 mb-3 overflow-hidden border border-white/5 p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 via-purple-500 to-accent-500 transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-sm">
        <span className="text-surface-200 font-medium">
          {processed} / {total} photos indexed
        </span>
        <span className="font-bold gradient-text">{percentage}%</span>
      </div>

      <div className="mt-4 bg-surface-800/50 rounded-xl px-4 py-3 border border-white/5 flex items-center justify-between text-xs">
        <p className="text-surface-300">
          <span className="text-white font-bold text-sm">{facesDetected}</span> faces detected so far
        </p>
        <span className="text-surface-400 font-mono text-[10px]">Lifecycle: UPLOADED → QUEUED → PROCESSING → INDEXED</span>
      </div>
    </div>
  );
};

export default ProcessingProgress;
