import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestSummary } from '../types';

const Contests: React.FC = () => {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <div>Loading contests...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Contest Management</h2>
      <Link to="/admin/contests/new" style={{ marginBottom: '20px', display: 'inline-block', padding: '10px 20px', backgroundColor: '#28a745', color: 'white', textDecoration: 'none' }}>
        Create New Contest
      </Link>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Title</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Status</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Start Time</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>End Time</th>
            <th style={{ border: '1px solid #ddd', padding: '8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contests.map((contest) => (
            <tr key={contest.id}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{contest.title}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{contest.status}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(contest.startAt).toLocaleString()}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(contest.endAt).toLocaleString()}</td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                <Link to={`/admin/contests/${contest.id}`} style={{ marginRight: '10px' }}>View</Link>
                {contest.status === 'ACTIVE' && (
                  <Link to={`/admin/contests/${contest.id}/monitor`}>Monitor</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Contests;