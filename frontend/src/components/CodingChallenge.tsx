import { useState, useEffect } from "react";
import { CodeEditor, LANGUAGE_TEMPLATES } from "./CodeEditor";
import { submissionsAPI, questionsAPI } from "../services/api";

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

interface SubmissionResult {
  submissionId: string;
  status: string;
  isCorrect: boolean;
  points: number;
  testCasesPassed: number;
  totalTestCases: number;
  executionTime: number;
  memoryUsed: number;
  compilationError?: string;
  testCaseResults: TestResult[];
}

interface CodingChallengeProps {
  question: {
    id: string;
    title: string;
    description: string;
    timeLimit?: number;
    memoryLimit?: number;
  };
  contestId: string;
  onSubmissionComplete?: (result: SubmissionResult) => void;
}

export function CodingChallenge({
  question,
  contestId,
  onSubmissionComplete,
}: CodingChallengeProps) {
  const [code, setCode] = useState(LANGUAGE_TEMPLATES.javascript);
  const [language, setLanguage] = useState("javascript");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [activeTab, setActiveTab] = useState<"description" | "testcases" | "submissions">("description");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<TestResult[] | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmissionResult | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch test cases on mount
  useEffect(() => {
    const fetchTestCases = async () => {
      try {
        const response = await questionsAPI.getTestCases(question.id);
        setTestCases(response.testCases || []);
      } catch (err) {
        console.error("Failed to fetch test cases:", err);
      }
    };
    fetchTestCases();
  }, [question.id]);

  // Fetch user's previous submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const response = await submissionsAPI.getSubmissions(question.id, contestId);
        setSubmissions(response || []);
      } catch (err) {
        console.error("Failed to fetch submissions:", err);
      }
    };
    fetchSubmissions();
  }, [question.id, contestId]);

  // Handle language change - update template
  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (code === LANGUAGE_TEMPLATES[language]) {
      setCode(LANGUAGE_TEMPLATES[newLanguage] || "");
    }
  };

  // Run code against sample test cases
  const handleRun = async () => {
    setIsRunning(true);
    setError(null);
    setRunResults(null);

    try {
      const response = await submissionsAPI.runCode(question.id, code, language);
      setRunResults(response.results || []);
      setActiveTab("testcases");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to run code");
    } finally {
      setIsRunning(false);
    }
  };

  // Submit code for full evaluation
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    setSubmitResult(null);

    try {
      const response = await submissionsAPI.submitCode(
        question.id,
        contestId,
        code,
        language
      );
      setSubmitResult(response);
      onSubmissionComplete?.(response);

      // Refresh submissions list
      const subsResponse = await submissionsAPI.getSubmissions(question.id, contestId);
      setSubmissions(subsResponse || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "text-green-500";
      case "WRONG_ANSWER":
        return "text-red-500";
      case "TIME_LIMIT_EXCEEDED":
        return "text-yellow-500";
      case "MEMORY_LIMIT_EXCEEDED":
        return "text-orange-500";
      case "RUNTIME_ERROR":
      case "COMPILATION_ERROR":
        return "text-red-400";
      case "PENDING":
      case "RUNNING":
        return "text-blue-400";
      default:
        return "text-slate-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "✅";
      case "WRONG_ANSWER":
        return "❌";
      case "TIME_LIMIT_EXCEEDED":
        return "⏱️";
      case "MEMORY_LIMIT_EXCEEDED":
        return "💾";
      case "RUNTIME_ERROR":
        return "💥";
      case "COMPILATION_ERROR":
        return "🔴";
      case "PENDING":
        return "⏳";
      case "RUNNING":
        return "🔄";
      default:
        return "❓";
    }
  };

  return (
    <div className="flex h-full bg-slate-900">
      {/* Left Panel - Problem Description */}
      <div className="w-1/2 border-r border-slate-700 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab("description")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "description"
                ? "text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab("testcases")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "testcases"
                ? "text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Test Cases
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "submissions"
                ? "text-white border-b-2 border-blue-500"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Submissions ({submissions.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === "description" && (
            <div className="prose prose-invert max-w-none">
              <h2 className="text-xl font-bold text-white mb-4">{question.title}</h2>
              <div className="flex gap-4 mb-4 text-sm">
                {question.timeLimit && (
                  <span className="text-slate-400">
                    ⏱️ Time Limit: {question.timeLimit}s
                  </span>
                )}
                {question.memoryLimit && (
                  <span className="text-slate-400">
                    💾 Memory: {question.memoryLimit}MB
                  </span>
                )}
              </div>
              <div
                className="text-slate-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: question.description.replace(/\n/g, "<br/>") }}
              />
            </div>
          )}

          {activeTab === "testcases" && (
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
                            ? "bg-green-900/20 border-green-700"
                            : "bg-red-900/20 border-red-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-white">
                            {result.passed ? "✅" : "❌"} Test Case {index + 1}
                          </span>
                          <span className="text-sm text-slate-400">
                            {result.executionTime.toFixed(2)}ms | {result.memoryUsed.toFixed(2)}MB
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div>
                            <span className="text-slate-400">Input:</span>
                            <pre className="mt-1 p-2 bg-slate-800 rounded text-slate-200 overflow-x-auto">
                              {result.input}
                            </pre>
                          </div>
                          <div>
                            <span className="text-slate-400">Expected:</span>
                            <pre className="mt-1 p-2 bg-slate-800 rounded text-slate-200 overflow-x-auto">
                              {result.expectedOutput}
                            </pre>
                          </div>
                          <div>
                            <span className="text-slate-400">Your Output:</span>
                            <pre
                              className={`mt-1 p-2 rounded overflow-x-auto ${
                                result.passed ? "bg-green-900/30" : "bg-red-900/30"
                              } text-slate-200`}
                            >
                              {result.actualOutput}
                            </pre>
                          </div>
                          {result.error && (
                            <div className="text-red-400 text-sm">{result.error}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Test Cases */}
              <h3 className="text-lg font-semibold text-white mb-3">Sample Test Cases</h3>
              {testCases.length === 0 ? (
                <p className="text-slate-400">No test cases available</p>
              ) : (
                <div className="space-y-3">
                  {testCases.filter(tc => !tc.isHidden).map((tc, index) => (
                    <div
                      key={tc.id}
                      className="p-4 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="font-medium text-white mb-2">
                        Example {index + 1}
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div>
                          <span className="text-slate-400">Input:</span>
                          <pre className="mt-1 p-2 bg-slate-900 rounded text-slate-200 overflow-x-auto">
                            {tc.input}
                          </pre>
                        </div>
                        <div>
                          <span className="text-slate-400">Expected Output:</span>
                          <pre className="mt-1 p-2 bg-slate-900 rounded text-slate-200 overflow-x-auto">
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

          {activeTab === "submissions" && (
            <div className="space-y-4">
              {/* Latest Submit Result */}
              {submitResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    submitResult.isCorrect
                      ? "bg-green-900/20 border-green-600"
                      : "bg-red-900/20 border-red-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-bold text-lg ${getStatusColor(submitResult.status)}`}>
                      {getStatusIcon(submitResult.status)} {submitResult.status.replace(/_/g, " ")}
                    </span>
                    {submitResult.isCorrect && (
                      <span className="text-green-400 font-medium">
                        +{submitResult.points} points
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                    <div>
                      Test Cases: {submitResult.testCasesPassed}/{submitResult.totalTestCases}
                    </div>
                    <div>Runtime: {submitResult.executionTime.toFixed(2)}ms</div>
                    <div>Memory: {submitResult.memoryUsed.toFixed(2)}MB</div>
                  </div>
                  {submitResult.compilationError && (
                    <div className="mt-3 p-2 bg-red-900/30 rounded text-red-300 text-sm">
                      {submitResult.compilationError}
                    </div>
                  )}
                </div>
              )}

              {/* Submissions History */}
              <h3 className="text-lg font-semibold text-white mb-3">Submission History</h3>
              {submissions.length === 0 ? (
                <p className="text-slate-400">No submissions yet</p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className={getStatusColor(sub.status)}>
                          {getStatusIcon(sub.status)}
                        </span>
                        <div>
                          <div className={`font-medium ${getStatusColor(sub.status)}`}>
                            {sub.status.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-slate-400">
                            {sub.language} • {new Date(sub.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-slate-300">
                          {sub.testCasesPassed}/{sub.totalTestCases} passed
                        </div>
                        <div className="text-xs text-slate-400">
                          {sub.executionTime?.toFixed(2)}ms
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Code Editor */}
      <div className="w-1/2 flex flex-col">
        {/* Editor */}
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
        <div className="border-t border-slate-700 bg-slate-800 p-4">
          {error && (
            <div className="mb-3 p-3 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleRun}
                disabled={isRunning || isSubmitting}
                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRunning ? (
                  <>
                    <span className="animate-spin">⏳</span> Running...
                  </>
                ) : (
                  <>▶ Run</>
                )}
              </button>
            </div>
            <button
              onClick={handleSubmit}
              disabled={isRunning || isSubmitting}
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
  );
}
