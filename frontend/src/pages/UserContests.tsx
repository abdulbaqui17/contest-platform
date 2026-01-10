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
      setError(err.response?.data?.error || 'Failed to join contest');
      setJoining(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const activeContests = contests.filter(c => c.status === 'ACTIVE');
  const pastContests = contests.filter(c => c.status !== 'ACTIVE');

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Contests</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Active Contests Section */}
      <div className="mb-lg">
        <h2 style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--text-primary)' }}>
          Active Contests
        </h2>
        {activeContests.length === 0 ? (
          <div className="card text-center">
            <p style={{ color: 'var(--text-secondary)' }}>
              No active contests at the moment. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid">
            {activeContests.map((contest) => (
              <div key={contest.id} className="card">
                <div className="flex-between">
                  <div style={{ flex: 1 }}>
                    <div className="flex gap-md mb-sm" style={{ alignItems: 'center' }}>
                      <h3 className="card-title" style={{ marginBottom: 0 }}>
                        {contest.title}
                      </h3>
                      <span className="badge badge-active">Active</span>
                    </div>
                    <p className="card-description" style={{ marginBottom: 'var(--spacing-md)' }}>
                      {contest.description}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Started: {new Date(contest.startAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoin(contest.id)}
                    disabled={joining === contest.id}
                    className="btn btn-success btn-lg"
                    style={{ marginLeft: 'var(--spacing-lg)' }}
                  >
                    {joining === contest.id ? 'Joining...' : 'Attempt'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Contests Section */}
      <div>
        <h2 style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--text-primary)' }}>
          Past Contests
        </h2>
        {pastContests.length === 0 ? (
          <div className="card text-center">
            <p style={{ color: 'var(--text-secondary)' }}>
              No past contests available
            </p>
          </div>
        ) : (
          <div className="grid">
            {pastContests.map((contest) => (
              <div key={contest.id} className="card">
                <div className="flex-between">
                  <div style={{ flex: 1 }}>
                    <div className="flex gap-md mb-sm" style={{ alignItems: 'center' }}>
                      <h3 className="card-title" style={{ marginBottom: 0 }}>
                        {contest.title}
                      </h3>
                      <span className="badge badge-past">{contest.status}</span>
                    </div>
                    <p className="card-description" style={{ marginBottom: 'var(--spacing-md)' }}>
                      {contest.description}
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      Ended: {new Date(contest.endAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ marginLeft: 'var(--spacing-lg)' }}
                    disabled
                  >
                    View Leaderboard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserContests;
