import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import RoomCard from '../components/RoomCard';
import api from '../services/api';
import { HiOutlinePlus, HiOutlineQrCode, HiOutlineSparkles } from 'react-icons/hi2';

const Home = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/rooms');
      setRooms(data.rooms || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
      setError('Could not load your rooms. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-12 animate-fade-in-up">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Find your photos</span>
          <br />
          <span className="text-white">with a single selfie</span>
        </h1>
        <p className="text-surface-200 text-lg max-w-xl mx-auto">
          Upload event photos, take one selfie, and instantly discover every photo you appear in.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid sm:grid-cols-2 gap-4 mb-12 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <Link
          to="/create-room"
          className="glass rounded-2xl p-6 card-hover group flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <HiOutlinePlus className="text-white text-2xl" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Create Room</h3>
            <p className="text-sm text-surface-200 mt-0.5">
              Upload event photos & share a code
            </p>
          </div>
        </Link>

        <Link
          to="/join"
          className="glass rounded-2xl p-6 card-hover group flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
            <HiOutlineQrCode className="text-white text-2xl" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Join Room</h3>
            <p className="text-sm text-surface-200 mt-0.5">
              Enter a code & find your photos
            </p>
          </div>
        </Link>
      </div>

      {/* My Rooms */}
      <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-2xl font-bold text-white mb-6">Your Rooms</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-8 text-center border border-red-500/20">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={fetchRooms}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : rooms.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <HiOutlineSparkles className="text-5xl text-primary-400 mx-auto mb-4" />
            <p className="text-surface-200 text-lg">No rooms yet.</p>
            <p className="text-surface-200 text-sm mt-1">
              Create a room to start uploading photos, or join one with a code.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {rooms.map((room) => (
              <RoomCard key={room._id} room={room} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
