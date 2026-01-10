import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '1rem',
          lineHeight: 1.2
        }}>
          Contest Platform
        </h1>
        
        <p style={{
          fontSize: '1.25rem',
          color: 'rgba(255, 255, 255, 0.9)',
          marginBottom: '3rem',
          lineHeight: 1.6
        }}>
          Compete in real-time coding contests.<br />
          Challenge yourself. Climb the leaderboard.
        </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link to="/signin" className="btn btn-lg" style={{
            backgroundColor: 'white',
            color: '#667eea',
            padding: '1rem 2.5rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            borderRadius: '0.75rem',
            textDecoration: 'none',
            display: 'inline-block',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s'
          }}>
            Sign In
          </Link>

          <Link to="/signup" className="btn btn-lg" style={{
            backgroundColor: 'transparent',
            color: 'white',
            border: '2px solid white',
            padding: '1rem 2.5rem',
            fontSize: '1.125rem',
            fontWeight: 600,
            borderRadius: '0.75rem',
            textDecoration: 'none',
            display: 'inline-block',
            transition: 'all 0.2s'
          }}>
            Sign Up
          </Link>
        </div>

        <div style={{
          marginTop: '4rem',
          fontSize: '0.875rem',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <Link to="/admin/login" style={{
            color: 'rgba(255, 255, 255, 0.9)',
            textDecoration: 'underline',
            fontSize: '0.875rem'
          }}>
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
