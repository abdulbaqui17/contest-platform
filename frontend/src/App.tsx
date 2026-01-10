import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Login from './pages/Login';
import UserContests from './pages/UserContests';
import PlayContest from './pages/PlayContest';
import Contests from './pages/Contests';
import CreateContest from './pages/CreateContest';
import ContestDetail from './pages/ContestDetail';
import Questions from './pages/Questions';
import Monitor from './pages/Monitor';
import ImportQuestion from './pages/ImportQuestion';
import CreateQuestion from './pages/CreateQuestion';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/contests" element={<UserContests />} />
        <Route path="/contest/:id/play" element={<PlayContest />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/contests" element={<ProtectedRoute><Contests /></ProtectedRoute>} />
        <Route path="/admin/contests/new" element={<ProtectedRoute><CreateContest /></ProtectedRoute>} />
        <Route path="/admin/contests/:id" element={<ProtectedRoute><ContestDetail /></ProtectedRoute>} />
        <Route path="/admin/contests/:id/questions" element={<ProtectedRoute><Questions /></ProtectedRoute>} />
        <Route path="/admin/contests/:id/monitor" element={<ProtectedRoute><Monitor /></ProtectedRoute>} />
        <Route path="/admin/questions/import" element={<ProtectedRoute><ImportQuestion /></ProtectedRoute>} />
        <Route path="/admin/questions/new" element={<ProtectedRoute><CreateQuestion /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;