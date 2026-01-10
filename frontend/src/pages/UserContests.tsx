import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestSummary } from '../types';

const UserContests: React.FC = () => {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const data = await contestsAPI.getAll();
        setContests(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load contests');
      } finally {
        setLoading(false);
      }
    };

    fetchContests();
  }, []);

  const handleJoin = async (contestId: string) => {
    setJoining(contestId);
    try {
      await contestsAPI.join(contestId);
      navigate(`/contest/${contestId}/play`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join contest');
      setJoining(null);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading contests...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>Available Contests</h2>
      <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
        {contests.map((contest) => (
          <div key={contest.id} style={{ 
            border: '1px solid #ddd', 
            padding: '20px', 
            borderRadius: '8px',
            backgroundColor: contest.status === 'ACTIVE' ? '#f0fff4' : '#fff'
          }}>
            <h3>{contest.title}</h3>
            <p>{contest.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
              <div>
                <span style={{ 
                  padding: '4px 12px', 
                  borderRadius: '4px',
                  backgroundColor: contest.status === 'ACTIVE' ? '#48bb78' : '#cbd5e0',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  {contest.status}
                </span>
                <div style={{ fontSize: '14px', marginTop: '8px', color: '#666' }}>
                  {new Date(contest.startAt).toLocaleString()}
                </div>
              </div>
              {contest.status === 'ACTIVE' && (
                <button
                  onClick={() => handleJoin(contest.id)}
                  disabled={joining === contest.id}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: joining === contest.id ? 'not-allowed' : 'pointer',
                    opacity: joining === contest.id ? 0.6 : 1
                  }}
                >
                  {joining === contest.id ? 'Joining...' : 'Join Contest'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserContests;
