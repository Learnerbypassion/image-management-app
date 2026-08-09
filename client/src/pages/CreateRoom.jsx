import { useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../services/api';
import { HiOutlinePlus } from 'react-icons/hi';

const CreateRoom = () => {
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/rooms', { name, organization, description });
      navigate(`/room/${data.room._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white mb-2">Create a Room</h1>
        <p className="text-surface-200 mb-8">
          Set up an event room where you can upload photos and share a code with attendees.
        </p>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Event Name <span className="text-accent-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Freshers 2026"
                required
                className="input-field w-full px-4 py-3 rounded-xl text-white placeholder-surface-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Organization
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g., GNIT"
                className="input-field w-full px-4 py-3 rounded-xl text-white placeholder-surface-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-200 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Freshers Party photos"
                rows={3}
                className="input-field w-full px-4 py-3 rounded-xl text-white placeholder-surface-700 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <>
                  <HiOutlinePlus className="text-lg" />
                  Create Room
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;
