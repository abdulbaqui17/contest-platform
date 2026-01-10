import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestSummary } from '../types';

const Contests: React.FC = () => {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
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
        <h1 className="page-title">Contest Management</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <Link to="/admin/contests/new" className="btn btn-success">
            Create New Contest
          </Link>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Active Contests */}
      <div className="mb-lg">
        <h2 style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--text-primary)' }}>
          Active Contests
        </h2>
        {activeContests.length === 0 ? (
          <div className="card text-center">
            <p style={{ color: 'var(--text-secondary)' }}>
              No active contests
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
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <div>Start: {new Date(contest.startAt).toLocaleString()}</div>
                      <div>End: {new Date(contest.endAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-lg)' }}>
                    <Link to={`/admin/contests/${contest.id}/monitor`} className="btn btn-primary">
                      Monitor
                    </Link>
                    <Link to={`/admin/contests/${contest.id}`} className="btn btn-secondary">
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Contests */}
      <div>
        <h2 style={{ marginBottom: 'var(--spacing-lg)', color: 'var(--text-primary)' }}>
          Past Contests
        </h2>
        {pastContests.length === 0 ? (
          <div className="card text-center">
            <p style={{ color: 'var(--text-secondary)' }}>
              No past contests
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
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <div>Start: {new Date(contest.startAt).toLocaleString()}</div>
                      <div>End: {new Date(contest.endAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'var(--spacing-lg)' }}>
                    <Link to={`/admin/contests/${contest.id}`} className="btn btn-secondary">
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Contests;