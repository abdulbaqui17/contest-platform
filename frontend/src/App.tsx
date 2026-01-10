import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Contests from './pages/Contests';
import CreateContest from './pages/CreateContest';
import ContestDetail from './pages/ContestDetail';
import Questions from './pages/Questions';
import Monitor from './pages/Monitor';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/contests" element={<ProtectedRoute><Contests /></ProtectedRoute>} />
        <Route path="/admin/contests/new" element={<ProtectedRoute><CreateContest /></ProtectedRoute>} />
        <Route path="/admin/contests/:id" element={<ProtectedRoute><ContestDetail /></ProtectedRoute>} />
        <Route path="/admin/contests/:id/questions" element={<ProtectedRoute><Questions /></ProtectedRoute>} />
        <Route path="/admin/contests/:id/monitor" element={<ProtectedRoute><Monitor /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;