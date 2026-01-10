import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestDetail } from '../types';

const ContestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchContest = async () => {
      if (!id) return;
      try {
        const data = await contestsAPI.getById(id);
        setContest(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load contest');
      } finally {
        setLoading(false);
      }
    };

    fetchContest();
  }, [id]);

  if (loading) return <div>Loading contest...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!contest) return <div>Contest not found</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>{contest.title}</h2>
      <p>{contest.description}</p>
      <p>Status: {contest.status}</p>
      <p>Start: {new Date(contest.startAt).toLocaleString()}</p>
      <p>End: {new Date(contest.endAt).toLocaleString()}</p>

      <h3>Questions</h3>
      <Link to={`/admin/contests/${id}/questions`} style={{ marginBottom: '20px', display: 'inline-block', padding: '10px 20px', backgroundColor: '#28a745', color: 'white', textDecoration: 'none' }}>
        Manage Questions
      </Link>
      <ul>
        {contest.questions.map((question) => (
          <li key={question.id}>
            {question.title} - {question.points} points, {question.timeLimit}s
          </li>
        ))}
      </ul>

      {contest.status === 'ACTIVE' && (
        <Link to={`/admin/contests/${id}/monitor`} style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: '#007bff', color: 'white', textDecoration: 'none' }}>
          Monitor Contest
        </Link>
      )}
    </div>
  );
};

export default ContestDetailPage;