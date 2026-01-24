import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Button } from './ui/button';
import { LogOut, ChevronDown, Mail, Calendar, Shield } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const UserProfileDropdown: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userData = await authAPI.getMe();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="h-10 w-10 rounded-full bg-zinc-800 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Button variant="secondary" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Logout
      </Button>
    );
  }

  // Get initials from name
  const initials = user.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700"
      >
        <div className="h-8 w-8 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
          {initials}
        </div>
        <span className="text-zinc-100 font-medium hidden sm:block">{user.name}</span>
        <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="p-4 bg-linear-to-br from-purple-600/20 to-indigo-600/20 border-b border-zinc-700">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg font-semibold">
                {initials}
              </div>
              <div>
                <h3 className="text-zinc-100 font-semibold">{user.name}</h3>
                <p className="text-zinc-400 text-sm">{user.role}</p>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 text-zinc-400">
              <Mail className="h-4 w-4" />
              <span className="text-sm truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <Shield className="h-4 w-4" />
              <span className="text-sm">Role: {user.role}</span>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Joined: {formatDate(user.createdAt)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2 border-t border-zinc-700">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;
