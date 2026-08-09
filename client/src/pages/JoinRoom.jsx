import { useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../services/api';
import { HiOutlineQrCode } from 'react-icons/hi2';

const JoinRoom = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/rooms/join', { code });
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white mb-2">Join a Room</h1>
        <p className="text-surface-200 mb-8">
          Enter the 6-character room code shared by the event organizer.
        </p>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="e.g., FR26X9"
                required
                maxLength={6}
                className="input-field w-full px-4 py-4 rounded-xl text-white text-center text-3xl font-mono tracking-[0.3em] placeholder-surface-700 uppercase"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <>
                  <HiOutlineQrCode className="text-lg" />
                  Join Room
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;
