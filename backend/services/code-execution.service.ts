/**
 * Code Execution Service
 *
 * Executes code inside ephemeral Docker containers. Each test case runs in its
 * own container for isolation.
 */

import { prisma } from "../../db/prismaClient";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export type SubmissionStatus =
  | "PENDING"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILATION_ERROR";

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  executionTime: number; // ms
  memoryUsed: number; // MB
  error?: string;
  isHidden: boolean;
}

export interface ExecutionResult {
  status: SubmissionStatus;
  testCaseResults: TestCaseResult[];
  totalTestCases: number;
  testCasesPassed: number;
  totalExecutionTime: number;
  maxMemoryUsed: number;
  compilationError?: string;
  runtimeError?: string;
}

type ExecutionMode = "function" | "raw";

type RunnerConfig = {
  image: string;
  sourceFile: string;
  compile?: string;
  run: string;
  env?: Record<string, string>;
  setup?: (workDir: string) => Promise<void>;
};

type DockerRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
};

const SANDBOX_LIBS_DIR = path.resolve(__dirname, "../sandbox-libs");
const GSON_JAR = path.join(SANDBOX_LIBS_DIR, "java", "gson-2.10.1.jar");
const NLOHMANN_HEADER = path.join(SANDBOX_LIBS_DIR, "nlohmann", "json.hpp");

const RUNNER_IMAGES = {
  javascript: process.env.CODE_RUNNER_IMAGE_JS || "oven/bun:1.1.10",
  typescript: process.env.CODE_RUNNER_IMAGE_TS || "oven/bun:1.1.10",
  python: process.env.CODE_RUNNER_IMAGE_PY || "python:3.11-slim",
  java: process.env.CODE_RUNNER_IMAGE_JAVA || "eclipse-temurin:17-jdk",
  cpp: process.env.CODE_RUNNER_IMAGE_CPP || "gcc:12",
  c: process.env.CODE_RUNNER_IMAGE_C || "gcc:12",
};

const SUPPORTED_LANGUAGES = ["javascript", "typescript", "python", "java", "cpp", "c"];
const DOCKER_OVERHEAD_MS = Number(process.env.CODE_RUNNER_OVERHEAD_MS || 5000);

const RUNNERS: Record<string, RunnerConfig> = {
  javascript: {
    image: RUNNER_IMAGES.javascript,
    sourceFile: "main.ts",
    run: "bun /work/main.ts",
  },
  typescript: {
    image: RUNNER_IMAGES.typescript,
    sourceFile: "main.ts",
    run: "bun /work/main.ts",
  },
  python: {
    image: RUNNER_IMAGES.python,
    sourceFile: "main.py",
    run: "python /work/main.py",
    env: { PYTHONDONTWRITEBYTECODE: "1" },
  },
  python3: {
    image: RUNNER_IMAGES.python,
    sourceFile: "main.py",
    run: "python /work/main.py",
    env: { PYTHONDONTWRITEBYTECODE: "1" },
  },
  java: {
    image: RUNNER_IMAGES.java,
    sourceFile: "Main.java",
    compile: "javac -cp /work/gson.jar -d /work /work/Main.java",
    run: "java -cp /work:/work/gson.jar Main",
    setup: async (workDir: string) => {
      await fs.copyFile(GSON_JAR, path.join(workDir, "gson.jar"));
    },
  },
  cpp: {
    image: RUNNER_IMAGES.cpp,
    sourceFile: "main.cpp",
    compile: "g++ -std=c++17 -O2 -I/work /work/main.cpp -o /work/a.out",
    run: "/work/a.out",
    setup: async (workDir: string) => {
      const targetDir = path.join(workDir, "nlohmann");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.copyFile(NLOHMANN_HEADER, path.join(targetDir, "json.hpp"));
    },
  },
  "c++": {
    image: RUNNER_IMAGES.cpp,
    sourceFile: "main.cpp",
    compile: "g++ -std=c++17 -O2 -I/work /work/main.cpp -o /work/a.out",
    run: "/work/a.out",
    setup: async (workDir: string) => {
      const targetDir = path.join(workDir, "nlohmann");
      await fs.mkdir(targetDir, { recursive: true });
      await fs.copyFile(NLOHMANN_HEADER, path.join(targetDir, "json.hpp"));
    },
  },
  c: {
    image: RUNNER_IMAGES.c,
    sourceFile: "main.c",
    compile: "gcc -O2 /work/main.c -o /work/a.out",
    run: "/work/a.out",
  },
};

const CODE_WRAPPERS: Record<string, (code: string, functionName: string) => string> = {
  javascript: (code, fn) => `
${code}

const input = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
const args = input ? JSON.parse(input) : null;
let result;
if (Array.isArray(args)) {
  result = ${fn}(...args);
} else if (args && typeof args === 'object') {
  result = ${fn}(...Object.values(args));
} else {
  result = ${fn}(args);
}
console.log(JSON.stringify(result));
`,
  typescript: (code, fn) => `
${code}

const input = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
const args = input ? JSON.parse(input) : null;
let result;
if (Array.isArray(args)) {
  result = ${fn}(...args);
} else if (args && typeof args === 'object') {
  result = ${fn}(...Object.values(args));
} else {
  result = ${fn}(args);
}
console.log(JSON.stringify(result));
`,
  python: (code, fn) => `
import sys
import json

${code}

input_data = sys.stdin.read().strip()
args = json.loads(input_data) if input_data else None
if isinstance(args, dict):
    args = list(args.values())
elif not isinstance(args, list):
    args = [args]
result = ${fn}(*args)
print(json.dumps(result))
`,
  python3: (code, fn) => `
import sys
import json

${code}

input_data = sys.stdin.read().strip()
args = json.loads(input_data) if input_data else None
if isinstance(args, dict):
    args = list(args.values())
elif not isinstance(args, list):
    args = [args]
result = ${fn}(*args)
print(json.dumps(result))
`,
  java: (code, fn) => `
import java.io.*;
import com.google.gson.Gson;

${code}

class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line);
        }

        Gson gson = new Gson();
        Object[] params = gson.fromJson(sb.toString(), Object[].class);
        Solution solution = new Solution();
        Object result = solution.${fn}(params);
        System.out.println(gson.toJson(result));
    }
}
`,
  cpp: (code, fn) => `
#include <bits/stdc++.h>
#include <nlohmann/json.hpp>
using namespace std;
using json = nlohmann::json;

${code}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string input;
    getline(cin, input);
    json args = input.empty() ? json(nullptr) : json::parse(input);

    auto result = ${fn}(args);
    cout << json(result).dump() << endl;

    return 0;
}
`,
  c: (code, _fn) => `
#include <stdio.h>

${code}

int main() {
    // C wrapper is intentionally minimal; parse input manually in solution for now.
    return 0;
}
`,
};

export class CodeExecutionService {
  isLanguageSupported(language: string): boolean {
    const normalized = this.normalizeLanguage(language);
    return normalized in RUNNERS;
  }

  getSupportedLanguages(): string[] {
    return SUPPORTED_LANGUAGES;
  }

  async runCode(code: string, language: string, questionId: string): Promise<ExecutionResult> {
    const testCases = await prisma.testCase.findMany({
      where: { questionId, isHidden: false },
      orderBy: { order: "asc" },
    });

    if (testCases.length === 0) {
      return {
        status: "RUNTIME_ERROR",
        testCaseResults: [],
        totalTestCases: 0,
        testCasesPassed: 0,
        totalExecutionTime: 0,
        maxMemoryUsed: 0,
        compilationError: "No sample test cases found for this question",
      };
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { functionName: true, timeLimit: true, memoryLimit: true, type: true },
    });

    const functionName = question?.functionName || "solve";
    const timeLimit = (question?.timeLimit || 2000) / 1000;
    const memoryLimit = (question?.memoryLimit || 256) * 1024;
    const executionMode: ExecutionMode = question?.type === "SANDBOX" ? "raw" : "function";

    return this.executeAgainstTestCases(
      code,
      language,
      testCases,
      functionName,
      timeLimit,
      memoryLimit,
      executionMode
    );
  }

  async submitCode(
    code: string,
    language: string,
    questionId: string,
    timeLimit: number = 2,
    memoryLimit: number = 262144
  ): Promise<ExecutionResult> {
    const testCases = await prisma.testCase.findMany({
      where: { questionId },
      orderBy: { order: "asc" },
    });

    if (testCases.length === 0) {
      return {
        status: "RUNTIME_ERROR",
        testCaseResults: [],
        totalTestCases: 0,
        testCasesPassed: 0,
        totalExecutionTime: 0,
        maxMemoryUsed: 0,
        compilationError: "No test cases found for this question",
      };
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { functionName: true, timeLimit: true, memoryLimit: true, type: true },
    });

    const functionName = question?.functionName || "solve";
    const actualTimeLimit = (question?.timeLimit || 2000) / 1000;
    const actualMemoryLimit = (question?.memoryLimit || 256) * 1024;
    const executionMode: ExecutionMode = question?.type === "SANDBOX" ? "raw" : "function";

    return this.executeAgainstTestCases(
      code,
      language,
      testCases,
      functionName,
      actualTimeLimit,
      actualMemoryLimit,
      executionMode
    );
  }

  private async executeAgainstTestCases(
    code: string,
    language: string,
    testCases: Array<{
      id: string;
      input: string;
      expectedOutput: string;
      isHidden: boolean;
    }>,
    functionName: string,
    timeLimit: number,
    memoryLimit: number,
    executionMode: ExecutionMode
  ): Promise<ExecutionResult> {
    const normalizedLanguage = this.normalizeLanguage(language);
    const runner = RUNNERS[normalizedLanguage];
    if (!runner) {
      return {
        status: "RUNTIME_ERROR",
        testCaseResults: [],
        totalTestCases: testCases.length,
        testCasesPassed: 0,
        totalExecutionTime: 0,
        maxMemoryUsed: 0,
        compilationError: `Unsupported language: ${language}`,
      };
    }

    const resolvedFunctionName =
      executionMode === "function"
        ? this.resolveFunctionName(code, normalizedLanguage, functionName)
        : "";

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-run-"));
    try {
      const wrappedCode =
        executionMode === "raw"
          ? code
          : this.wrapCode(code, normalizedLanguage, resolvedFunctionName);

      await fs.writeFile(path.join(workDir, runner.sourceFile), wrappedCode, "utf8");

      if (runner.setup) {
        await runner.setup(workDir);
      }

      let compilationError: string | undefined;
      let runtimeError: string | undefined;
      let maxMemoryUsed = 0;
      let totalExecutionTime = 0;

      if (runner.compile) {
        const compileResult = await this.runDockerCommand({
          image: runner.image,
          workDir,
          command: runner.compile,
          env: runner.env,
          timeoutMs: Math.max(5000, timeLimit * 1000 + DOCKER_OVERHEAD_MS * 2),
          memoryLimitKb: memoryLimit,
        });

        if (compileResult.timedOut) {
          compilationError = "Compilation timed out";
        } else if (compileResult.exitCode !== 0) {
          compilationError = (compileResult.stderr || compileResult.stdout || "Compilation failed").trim();
        }

        if (compilationError) {
          return {
            status: "COMPILATION_ERROR",
            testCaseResults: testCases.map((tc) => ({
              testCaseId: tc.id,
              passed: false,
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              actualOutput: "",
              executionTime: 0,
              memoryUsed: 0,
              error: compilationError,
              isHidden: tc.isHidden,
            })),
            totalTestCases: testCases.length,
            testCasesPassed: 0,
            totalExecutionTime: 0,
            maxMemoryUsed: 0,
            compilationError,
          };
        }
      }

      const testCaseResults: TestCaseResult[] = [];
      let timedOut = false;
      let runtimeFailure = false;

      for (const testCase of testCases) {
        const startTime = Date.now();
        const runResult = await this.runDockerCommand({
          image: runner.image,
          workDir,
          command: runner.run,
          env: runner.env,
          stdin: testCase.input,
          timeoutMs: Math.max(1000, timeLimit * 1000 + DOCKER_OVERHEAD_MS),
          memoryLimitKb: memoryLimit,
        });
        const executionTime = Date.now() - startTime;
        totalExecutionTime += executionTime;

        if (runResult.timedOut) {
          timedOut = true;
          runtimeError = "Time limit exceeded";
        }

        const actualOutput = runResult.stdout.trim();
        const expectedOutput = testCase.expectedOutput.trim();
        const passed =
          !runResult.timedOut &&
          runResult.exitCode === 0 &&
          this.normalizeOutput(actualOutput) === this.normalizeOutput(expectedOutput);

        if (!passed && !timedOut && runResult.exitCode !== 0) {
          runtimeFailure = true;
          runtimeError = runResult.stderr || runResult.stdout || "Runtime error";
        }

        testCaseResults.push({
          testCaseId: testCase.id,
          passed,
          input: testCase.input,
          expectedOutput,
          actualOutput,
          executionTime,
          memoryUsed: 0,
          error: runResult.stderr || undefined,
          isHidden: testCase.isHidden,
        });
      }

      const testCasesPassed = testCaseResults.filter((r) => r.passed).length;
      let status: SubmissionStatus;

      if (timedOut) {
        status = "TIME_LIMIT_EXCEEDED";
      } else if (runtimeFailure) {
        status = "RUNTIME_ERROR";
      } else if (testCasesPassed === testCases.length) {
        status = "ACCEPTED";
      } else {
        status = "WRONG_ANSWER";
      }

      return {
        status,
        testCaseResults,
        totalTestCases: testCases.length,
        testCasesPassed,
        totalExecutionTime,
        maxMemoryUsed,
        compilationError,
        runtimeError,
      };
    } catch (error: any) {
      const message = error?.message || String(error);
      return {
        status: "RUNTIME_ERROR",
        testCaseResults: testCases.map((tc) => ({
          testCaseId: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: "",
          executionTime: 0,
          memoryUsed: 0,
          error: message,
          isHidden: tc.isHidden,
        })),
        totalTestCases: testCases.length,
        testCasesPassed: 0,
        totalExecutionTime: 0,
        maxMemoryUsed: 0,
        runtimeError: message,
      };
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  }

  private wrapCode(code: string, language: string, functionName: string): string {
    const wrapper = CODE_WRAPPERS[language.toLowerCase()];
    if (!wrapper) {
      return code;
    }
    return wrapper(code, functionName);
  }

  private extractFunctionName(code: string, language: string, defaultName: string): string {
    const lang = language.toLowerCase();

    if (lang === "python" || lang === "python3") {
      const match = code.match(/def\s+(\w+)\s*\(/);
      return match?.[1] || defaultName;
    }

    if (lang === "java") {
      const match = code.match(/(?:public|private|protected)?\s+\w+\s+(\w+)\s*\(/);
      return match?.[1] || defaultName;
    }

    if (lang === "cpp" || lang === "c++" || lang === "c") {
      const match = code.match(/\b(\w+)\s*\([^)]*\)\s*\{/);
      return match?.[1] || defaultName;
    }

    const functionMatch = code.match(/function\s+(\w+)\s*\(/);
    if (functionMatch) {
      return functionMatch[1];
    }

    const constMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:\(|function)/);
    if (constMatch) {
      return constMatch[1];
    }

    return defaultName;
  }

  private resolveFunctionName(code: string, language: string, requestedName?: string | null): string {
    const fallback = requestedName && requestedName.trim() ? requestedName : "solve";
    return this.extractFunctionName(code, language, fallback);
  }

  private normalizeLanguage(language: string): string {
    return language.toLowerCase();
  }

  private async runDockerCommand(options: {
    image: string;
    workDir: string;
    command: string;
    env?: Record<string, string>;
    stdin?: string;
    timeoutMs: number;
    memoryLimitKb: number;
  }): Promise<DockerRunResult> {
    const memoryMb = Math.max(64, Math.ceil(options.memoryLimitKb / 1024));
    const args = [
      "run",
      "--rm",
      "-i",
      "--network",
      "none",
      "--cpus",
      "1",
      "--memory",
      `${memoryMb}m`,
      "--pids-limit",
      "64",
      "--security-opt",
      "no-new-privileges",
      "-v",
      `${options.workDir}:/work`,
      "-w",
      "/work",
    ];

    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    args.push(options.image, "sh", "-lc", options.command);

    return new Promise((resolve) => {
      const child = spawn("docker", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, options.timeoutMs);

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      if (child.stdin && options.stdin !== undefined) {
        child.stdin.write(options.stdin);
        child.stdin.end();
      }

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode: code, timedOut });
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr: err.message, exitCode: 1, timedOut });
      });
    });
  }

  private normalizeOutput(output: string): string {
    return output
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
  }

  async healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn("docker", ["info"], { stdio: "ignore" });
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(false);
      }, 3000);

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve(code === 0);
      });

      child.on("error", () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }
}

export const codeExecutionService = new CodeExecutionService();
