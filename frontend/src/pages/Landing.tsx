import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Trophy, Users, Zap, Code, CircleHelp } from 'lucide-react';

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
    <div className="min-h-screen bg-linear-to-br from-zinc-950 via-slate-900 to-zinc-900 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-3xl">
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
          Compete in real-time contests. Practice coding problems.<br />
          Challenge yourself. Climb the leaderboard.
        </p>

        {/* Features */}
        <div className="flex justify-center gap-6 mb-12 flex-wrap">
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Trophy className="h-6 w-6 text-yellow-300" />
            </div>
            <span className="text-white/80 text-sm">Contests</span>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Code className="h-6 w-6 text-green-300" />
            </div>
            <span className="text-white/80 text-sm">Coding</span>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
            <CircleHelp className="h-6 w-6 text-orange-300" />
            </div>
            <span className="text-white/80 text-sm">MCQ</span>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Zap className="h-6 w-6 text-orange-300" />
            </div>
            <span className="text-white/80 text-sm">Real-time</span>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center mx-auto mb-2">
              <Users className="h-6 w-6 text-blue-300" />
            </div>
            <span className="text-white/80 text-sm">Compete</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-4 justify-center flex-wrap mb-8">
          <Link to="/signin">
            <Button 
              size="lg" 
              className="bg-[var(--color-brand-500)] text-black hover:bg-[var(--color-brand-600)] font-semibold px-8 py-6 text-lg rounded-xl shadow-lg"
            >
              Sign In
            </Button>
          </Link>

          <Link to="/signup">
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-zinc-200 text-zinc-100 hover:bg-white/10 font-semibold px-8 py-6 text-lg rounded-xl"
            >
              Sign Up
            </Button>
          </Link>
        </div>

        {/* Quick Access - Practice without signing in */}
        <div className="mb-12">
          <p className="text-white/60 text-sm mb-4">Or explore practice problems:</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/practice/coding">
              <Button 
                size="sm" 
                className="bg-emerald-600/80 hover:bg-emerald-500 text-white font-medium px-6 rounded-lg"
              >
                <Code className="h-4 w-4 mr-2" />
                Practice Coding
              </Button>
            </Link>
            <Link to="/practice/mcq">
              <Button 
                size="sm" 
                className="bg-orange-500/80 hover:bg-orange-400 text-black font-medium px-6 rounded-lg"
              >
                <CircleHelp className="h-4 w-4 mr-2" />
                Practice MCQ
              </Button>
            </Link>
          </div>
        </div>

        {/* Admin Link */}
        <div>
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
