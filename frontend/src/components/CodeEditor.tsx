import Editor from "@monaco-editor/react";
import { useState } from "react";

interface CodeEditorProps {
  code: string;
  language: string;
  onChange: (value: string) => void;
  onLanguageChange: (language: string) => void;
  readOnly?: boolean;
  height?: string;
}

const SUPPORTED_LANGUAGES = [
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "python", name: "Python" },
  { id: "java", name: "Java" },
  { id: "cpp", name: "C++" },
  { id: "c", name: "C" },
];

const LANGUAGE_TEMPLATES: Record<string, string> = {
  javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function solution(nums, target) {
  // Write your code here
  
}`,
  typescript: `function solution(nums: number[], target: number): number[] {
  // Write your code here
  
}`,
  python: `def solution(nums: list[int], target: int) -> list[int]:
    # Write your code here
    pass`,
  java: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Write your code here
        return new int[]{};
    }
}`,
  cpp: `#include <vector>
using namespace std;

class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Write your code here
        return {};
    }
};`,
  c: `#include <stdlib.h>

int* solution(int* nums, int numsSize, int target, int* returnSize) {
    // Write your code here
    *returnSize = 0;
    return NULL;
}`,
};

export function CodeEditor({
  code,
  language,
  onChange,
  onLanguageChange,
  readOnly = false,
  height = "400px",
}: CodeEditorProps) {
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || "");
  };

  const handleLanguageChange = (newLanguage: string) => {
    onLanguageChange(newLanguage);
    // Optionally set template code when language changes
    if (!code || code.trim() === "" || code === LANGUAGE_TEMPLATES[language]) {
      onChange(LANGUAGE_TEMPLATES[newLanguage] || "");
    }
  };

  // Map language IDs to Monaco language IDs
  const getMonacoLanguage = (lang: string): string => {
    const mapping: Record<string, string> = {
      javascript: "javascript",
      typescript: "typescript",
      python: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
    };
    return mapping[lang] || "plaintext";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-400">Language:</label>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={readOnly}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "vs-dark" ? "light" : "vs-dark")}
            className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1"
          >
            {theme === "vs-dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button
            onClick={() => onChange(LANGUAGE_TEMPLATES[language] || "")}
            className="text-sm text-slate-400 hover:text-white transition-colors px-2 py-1"
            disabled={readOnly}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height={height}
          language={getMonacoLanguage(language)}
          theme={theme}
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            readOnly,
            padding: { top: 16 },
          }}
          loading={
            <div className="flex items-center justify-center h-full bg-slate-900 text-slate-400">
              Loading editor...
            </div>
          }
        />
      </div>
    </div>
  );
}

export { SUPPORTED_LANGUAGES, LANGUAGE_TEMPLATES };
