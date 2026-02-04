import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CodeEditor, LANGUAGE_TEMPLATES } from '../components/CodeEditor';
import { submissionsAPI, questionsAPI } from '../services/api';
import UserProfileDropdown from '../components/UserProfileDropdown';

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  order: number;
}

interface TestResult {
  testCaseId?: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number;
  memoryUsed: number;
  error?: string;
  isHidden?: boolean;
}

interface Question {
  id: string;
  title: string;
  description: string;
  type: string;
  timeLimit: number | null;
  memoryLimit: number | null;
}

const SolveCoding: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAuthenticated = Boolean(localStorage.getItem('token'));
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [code, setCode] = useState(LANGUAGE_TEMPLATES.javascript);
  const [language, setLanguage] = useState('javascript');
  const [activeTab, setActiveTab] = useState<'description' | 'testcases' | 'submissions'>('description');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<TestResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch question and test cases
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const q = await questionsAPI.getById(id);
        if (q) setQuestion(q);
        
        // Fetch test cases
        const tcResponse = await questionsAPI.getTestCases(id);
        setTestCases(tcResponse.testCases || []);
      } catch (err) {
        console.error('Failed to fetch question:', err);
        setError('Failed to load question');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Handle language change
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (code === LANGUAGE_TEMPLATES[language]) {
      setCode(LANGUAGE_TEMPLATES[newLanguage] || '');
    }
  };

  // Run code against sample test cases (practice mode - no contest)
  const handleRun = async () => {
    if (!id) return;
    setIsRunning(true);
    setError(null);
    setRunResults(null);

    try {
      const response = await submissionsAPI.runCode(id, code, language);
      setRunResults(response.results || []);
      setActiveTab('testcases');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to run code');
    } finally {
      setIsRunning(false);
    }
  };

  // Submit for practice (not tied to contest)
  const handleSubmit = async () => {
    if (!id) return;
    if (!isAuthenticated) {
      setError('Please sign in to submit your solution.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSubmitResult(null);

    try {
      const response = await submissionsAPI.submitPractice(code, language, id);
      setSubmitResult({
        status: response.status,
        isCorrect: response.isAccepted,
        testCasesPassed: response.testCasesPassed,
        totalTestCases: response.totalTestCases,
        results: response.results,
        runtime: response.runtime,
        memory: response.memory,
        compilationError: response.compilationError,
        runtimeError: response.runtimeError,
      });
      setActiveTab('submissions');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Please sign in to submit your solution.');
      } else {
        setError(err.response?.data?.error || 'Failed to submit code');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'text-green-500';
      case 'WRONG_ANSWER': return 'text-red-500';
      default: return 'text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl text-zinc-300 mb-4">Question not found</h2>
          <Button onClick={() => navigate('/practice/coding')}>Back to Problems</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => navigate('/practice/coding')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold text-zinc-100">{question.title}</h1>
        </div>
        <UserProfileDropdown />
      </header>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Problem Description */}
        <div className="w-1/2 border-r border-zinc-700 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-zinc-700">
            <button
              onClick={() => setActiveTab('description')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'description'
                  ? 'text-white border-b-2 border-green-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab('testcases')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'testcases'
                  ? 'text-white border-b-2 border-green-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Test Cases
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'submissions'
                  ? 'text-white border-b-2 border-green-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Results
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'description' && (
              <div className="prose prose-invert max-w-none">
                <h2 className="text-xl font-bold text-white mb-4">{question.title}</h2>
                <div className="flex gap-4 mb-4 text-sm">
                  {question.timeLimit && (
                    <span className="text-zinc-400">⏱️ Time Limit: {question.timeLimit}ms</span>
                  )}
                  {question.memoryLimit && (
                    <span className="text-zinc-400">💾 Memory: {question.memoryLimit}MB</span>
                  )}
                </div>
                <div
                  className="text-zinc-300 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: question.description.replace(/\n/g, '<br/>') }}
                />
              </div>
            )}

            {activeTab === 'testcases' && (
              <div className="space-y-4">
                {/* Run Results */}
                {runResults && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Run Results</h3>
                    <div className="space-y-3">
                      {runResults.map((result, index) => (
                        <div
                          key={result.testCaseId || index}
                          className={`p-4 rounded-lg border ${
                            result.passed
                              ? 'bg-green-900/20 border-green-700'
                              : 'bg-red-900/20 border-red-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white">
                              {result.passed ? '✅' : '❌'} Test Case {index + 1}
                            </span>
                            <span className="text-sm text-zinc-400">
                              {result.executionTime?.toFixed(2)}ms | {result.memoryUsed?.toFixed(2)}MB
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div>
                              <span className="text-zinc-400">Input:</span>
                              <pre className="mt-1 p-2 bg-zinc-800 rounded text-zinc-200 overflow-x-auto">
                                {result.input}
                              </pre>
                            </div>
                            <div>
                              <span className="text-zinc-400">Expected:</span>
                              <pre className="mt-1 p-2 bg-zinc-800 rounded text-zinc-200 overflow-x-auto">
                                {result.expectedOutput}
                              </pre>
                            </div>
                            <div>
                              <span className="text-zinc-400">Your Output:</span>
                              <pre
                                className={`mt-1 p-2 rounded overflow-x-auto ${
                                  result.passed ? 'bg-green-900/30' : 'bg-red-900/30'
                                } text-zinc-200`}
                              >
                                {result.actualOutput}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Test Cases */}
                <h3 className="text-lg font-semibold text-white mb-3">Sample Test Cases</h3>
                {testCases.filter(tc => !tc.isHidden).length === 0 ? (
                  <p className="text-zinc-400">No sample test cases available</p>
                ) : (
                  <div className="space-y-3">
                    {testCases.filter(tc => !tc.isHidden).map((tc, index) => (
                      <div key={tc.id} className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                        <div className="font-medium text-white mb-2">Example {index + 1}</div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div>
                            <span className="text-zinc-400">Input:</span>
                            <pre className="mt-1 p-2 bg-zinc-900 rounded text-zinc-200 overflow-x-auto">
                              {tc.input}
                            </pre>
                          </div>
                          <div>
                            <span className="text-zinc-400">Expected Output:</span>
                            <pre className="mt-1 p-2 bg-zinc-900 rounded text-zinc-200 overflow-x-auto">
                              {tc.expectedOutput}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'submissions' && (
              <div className="space-y-4">
                {submitResult ? (
                  <div
                    className={`p-4 rounded-lg border ${
                      submitResult.isCorrect
                        ? 'bg-green-900/20 border-green-600'
                        : 'bg-red-900/20 border-red-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-bold text-lg ${getStatusColor(submitResult.status)}`}>
                        {submitResult.isCorrect ? '✅' : '❌'} {submitResult.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-300">
                      Test Cases Passed: {submitResult.testCasesPassed}/{submitResult.totalTestCases}
                    </div>
                    <div className="text-sm text-zinc-400 mt-1">
                      Runtime: {submitResult.runtime ?? submitResult.executionTime ?? 0}ms · Memory: {submitResult.memory ?? submitResult.memoryUsed ?? 0}MB
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-400">No submissions yet. Run or submit your code to see results.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Code Editor */}
        <div className="w-1/2 flex flex-col">
          <div className="flex-1 min-h-0">
            <CodeEditor
              code={code}
              language={language}
              onChange={setCode}
              onLanguageChange={handleLanguageChange}
              height="100%"
            />
          </div>

          {/* Action Bar */}
          <div className="border-t border-zinc-700 bg-zinc-800 p-4">
            {!isAuthenticated && (
              <div className="mb-3 p-3 bg-orange-500/10 border border-orange-500/40 rounded-lg text-orange-300 text-sm flex items-center justify-between gap-3">
                <span>Sign in to submit. You can still run sample tests without an account.</span>
                <Button variant="secondary" size="sm" onClick={() => navigate('/signin')}>
                  Sign In
                </Button>
              </div>
            )}
            {error && (
              <div className="mb-3 p-3 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={handleRun}
                disabled={isRunning || isSubmitting}
                className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <span className="animate-spin">⏳</span> Running...
                  </>
                ) : (
                  <>▶ Run</>
                )}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isAuthenticated || isRunning || isSubmitting}
                className="px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⏳</span> Submitting...
                  </>
                ) : (
                  <>🚀 Submit</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SolveCoding;
