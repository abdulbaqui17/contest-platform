import { Link } from 'react-router-dom';

const Landing: React.FC = () => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Contest Platform</h1>
      <p style={{ fontSize: '20px', marginBottom: '40px' }}>Real-time coding contests and competitions</p>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        <Link 
          to="/signin" 
          style={{ 
            padding: '15px 40px', 
            fontSize: '18px',
            backgroundColor: 'white', 
            color: '#667eea', 
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold'
          }}
        >
          Sign In
        </Link>
        
        <Link 
          to="/signup" 
          style={{ 
            padding: '15px 40px', 
            fontSize: '18px',
            backgroundColor: 'transparent', 
            color: 'white',
            border: '2px solid white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 'bold'
          }}
        >
          Sign Up
        </Link>
      </div>
      
      <div style={{ marginTop: '60px', fontSize: '14px', opacity: 0.8 }}>
        <Link to="/admin/login" style={{ color: 'white' }}>Admin Login</Link>
      </div>
    </div>
  );
};

export default Landing;
