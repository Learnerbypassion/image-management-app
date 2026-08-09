import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { HiOutlineSparkles, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <HiOutlineSparkles className="text-white text-lg" />
          </div>
          <span className="text-xl font-bold gradient-text">SnapFind</span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-surface-200 hidden sm:block">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-surface-200 hover:text-white transition-colors cursor-pointer"
              >
                <HiOutlineArrowRightOnRectangle className="text-lg" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold text-white"
            >
              Get Started
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
