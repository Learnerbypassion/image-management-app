import { Link } from 'react-router';
import { HiOutlineCamera, HiOutlineUsers, HiOutlinePhotograph } from 'react-icons/hi';

const statusColors = {
  created: 'bg-yellow-500/20 text-yellow-400',
  indexing: 'bg-blue-500/20 text-blue-400',
  ready: 'bg-green-500/20 text-green-400',
  error: 'bg-red-500/20 text-red-400',
};

const statusLabels = {
  created: 'Created',
  indexing: 'Indexing...',
  ready: 'Ready',
  error: 'Error',
};

const RoomCard = ({ room }) => {
  return (
    <Link to={`/room/${room._id}`} className="block">
      <div className="glass rounded-2xl p-6 card-hover">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">{room.name}</h3>
            {room.organization && (
              <p className="text-sm text-surface-200 mt-0.5">{room.organization}</p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[room.status] || statusColors.created}`}>
            {statusLabels[room.status] || room.status}
          </span>
        </div>

        {/* Room Code */}
        <div className="bg-surface-800/50 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-surface-200 mb-1">Room Code</p>
          <p className="text-2xl font-mono font-bold tracking-widest gradient-text">
            {room.code}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <HiOutlinePhotograph className="text-primary-400" />
            <div>
              <p className="text-sm font-semibold">{room.totalPhotos || 0}</p>
              <p className="text-xs text-surface-200">Photos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HiOutlineCamera className="text-accent-400" />
            <div>
              <p className="text-sm font-semibold">{room.processedPhotos || 0}</p>
              <p className="text-xs text-surface-200">Indexed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HiOutlineUsers className="text-green-400" />
            <div>
              <p className="text-sm font-semibold">{room.facesDetected || 0}</p>
              <p className="text-xs text-surface-200">Faces</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default RoomCard;
