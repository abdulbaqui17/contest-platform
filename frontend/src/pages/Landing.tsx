import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Trophy, Users, Zap } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/contests');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
            <Trophy className="h-10 w-10 text-white" />
          </div>
        </div>

        <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
          Contest Platform
        </h1>
        
        <p className="text-xl text-white/90 mb-12 leading-relaxed">
          Compete in real-time coding contests.<br />
          Challenge yourself. Climb the leaderboard.
        </p>

        {/* Features */}
        <div className="flex justify-center gap-8 mb-12">
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Zap className="h-6 w-6 text-yellow-300" />
            </div>
            <span className="text-white/80 text-sm">Real-time</span>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Users className="h-6 w-6 text-green-300" />
            </div>
            <span className="text-white/80 text-sm">Compete</span>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Trophy className="h-6 w-6 text-orange-300" />
            </div>
            <span className="text-white/80 text-sm">Leaderboard</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/signin">
            <Button 
              size="lg" 
              className="bg-white text-purple-700 hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-xl shadow-lg"
            >
              Sign In
            </Button>
          </Link>

          <Link to="/signup">
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 font-semibold px-8 py-6 text-lg rounded-xl"
            >
              Sign Up
            </Button>
          </Link>
        </div>

        {/* Admin Link */}
        <div className="mt-16">
          <Link 
            to="/admin/login" 
            className="text-white/70 hover:text-white/90 text-sm underline underline-offset-4 transition-colors"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
