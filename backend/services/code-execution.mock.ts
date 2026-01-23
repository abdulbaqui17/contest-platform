import { prisma } from "../../db/prismaClient";

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
}

// Language configurations for code execution
const LANGUAGE_CONFIG: Record<
  string,
  { extension: string; compile?: string; run: string }
> = {
  javascript: {
    extension: "js",
    run: "node solution.js",
  },
  typescript: {
    extension: "ts",
    run: "bun run solution.ts",
  },
  python: {
    extension: "py",
    run: "python3 solution.py",
  },
  java: {
    extension: "java",
    compile: "javac Solution.java",
    run: "java Solution",
  },
  cpp: {
    extension: "cpp",
    compile: "g++ -o solution solution.cpp",
    run: "./solution",
  },
  c: {
    extension: "c",
    compile: "gcc -o solution solution.c",
    run: "./solution",
  },
};

/**
 * Simulated code execution service
 * In production, this would use Docker containers or a sandboxed execution environment
 * For now, we simulate execution results based on code analysis
 */
export class CodeExecutionService {
  /**
   * Execute code against test cases
   * This is a SIMULATED execution for development purposes
   * Production would use isolated Docker containers
   */
  async executeCode(
    code: string,
    language: string,
    questionId: string,
    timeLimit: number = 5,
    memoryLimit: number = 256
  ): Promise<ExecutionResult> {
    // Get test cases for the question
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

    // Check for basic syntax errors (simplified check)
    const syntaxError = this.checkBasicSyntax(code, language);
    if (syntaxError) {
      return {
        status: "COMPILATION_ERROR",
        testCaseResults: [],
        totalTestCases: testCases.length,
        testCasesPassed: 0,
        totalExecutionTime: 0,
        maxMemoryUsed: 0,
        compilationError: syntaxError,
      };
    }

    // Execute against each test case (simulated)
    const testCaseResults: TestCaseResult[] = [];
    let totalExecutionTime = 0;
    let maxMemoryUsed = 0;
    let allPassed = true;

    for (const testCase of testCases) {
      const result = await this.executeTestCase(
        code,
        language,
        testCase,
        timeLimit,
        memoryLimit
      );
      testCaseResults.push(result);
      totalExecutionTime += result.executionTime;
      maxMemoryUsed = Math.max(maxMemoryUsed, result.memoryUsed);

      if (!result.passed) {
        allPassed = false;
      }
    }

    const testCasesPassed = testCaseResults.filter((r) => r.passed).length;

    // Determine final status
    let status: SubmissionStatus = "ACCEPTED";
    if (!allPassed) {
      const failedResult = testCaseResults.find((r) => !r.passed);
      if (failedResult?.error?.includes("Time limit")) {
        status = "TIME_LIMIT_EXCEEDED";
      } else if (failedResult?.error?.includes("Memory limit")) {
        status = "MEMORY_LIMIT_EXCEEDED";
      } else if (failedResult?.error?.includes("Runtime")) {
        status = "RUNTIME_ERROR";
      } else {
        status = "WRONG_ANSWER";
      }
    }

    return {
      status,
      testCaseResults,
      totalTestCases: testCases.length,
      testCasesPassed,
      totalExecutionTime,
      maxMemoryUsed,
    };
  }

  /**
   * Execute code against a single test case (simulated)
   */
  private async executeTestCase(
    code: string,
    language: string,
    testCase: {
      id: string;
      input: string;
      expectedOutput: string;
      isHidden: boolean;
    },
    timeLimit: number,
    memoryLimit: number
  ): Promise<TestCaseResult> {
    // Simulate execution delay
    const executionTime = Math.random() * 100 + 10; // 10-110ms
    const memoryUsed = Math.random() * 50 + 10; // 10-60MB

    // For simulation, we use a simple heuristic:
    // Check if the code contains key patterns that suggest correct implementation
    const actualOutput = this.simulateExecution(
      code,
      language,
      testCase.input,
      testCase.expectedOutput
    );

    const passed =
      this.normalizeOutput(actualOutput) ===
      this.normalizeOutput(testCase.expectedOutput);

    return {
      testCaseId: testCase.id,
      passed,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput,
      executionTime: Math.round(executionTime * 100) / 100,
      memoryUsed: Math.round(memoryUsed * 100) / 100,
      isHidden: testCase.isHidden,
      error: passed ? undefined : "Output does not match expected",
    };
  }

  /**
   * Simulate code execution (development only)
   * In production, this would actually run the code in a sandbox
   */
  private simulateExecution(
    code: string,
    language: string,
    input: string,
    expectedOutput: string
  ): string {
    // For development simulation, we check if the code looks reasonable
    // and return the expected output with some probability

    // Check for common patterns that suggest correct implementation
    const hasLoops = /for|while|forEach|map|reduce/.test(code);
    const hasConditionals = /if|else|switch|case|\?.*:/.test(code);
    const hasReturn = /return/.test(code);
    const hasFunction = /function|def|public|=>/.test(code);

    // Simple heuristic: if code has basic structure, simulate success
    const codeQuality =
      (hasLoops ? 0.25 : 0) +
      (hasConditionals ? 0.25 : 0) +
      (hasReturn ? 0.25 : 0) +
      (hasFunction ? 0.25 : 0);

    // 70% + codeQuality chance of correct output for simulation
    const isCorrect = Math.random() < 0.7 + codeQuality * 0.3;

    if (isCorrect) {
      return expectedOutput;
    }

    // Return a wrong answer for simulation
    return this.generateWrongOutput(expectedOutput);
  }

  /**
   * Generate a plausible but wrong output for simulation
   */
  private generateWrongOutput(expectedOutput: string): string {
    // Try to return something similar but wrong
    if (expectedOutput.includes("[")) {
      // Array output - return different order or values
      return expectedOutput.replace(/\d+/g, (n) =>
        String(parseInt(n) + 1)
      );
    }
    if (/^\d+$/.test(expectedOutput)) {
      // Numeric output
      return String(parseInt(expectedOutput) + 1);
    }
    if (expectedOutput === "true" || expectedOutput === "false") {
      return expectedOutput === "true" ? "false" : "true";
    }
    // String output
    return expectedOutput + "_wrong";
  }

  /**
   * Normalize output for comparison (trim whitespace, normalize newlines)
   */
  private normalizeOutput(output: string): string {
    return output
      .trim()
      .replace(/\r\n/g, "\n")
      .replace(/\s+$/gm, "");
  }

  /**
   * Basic syntax checking (simplified)
   */
  private checkBasicSyntax(code: string, language: string): string | null {
    if (!code || code.trim().length === 0) {
      return "Empty code submission";
    }

    // Check for obviously broken syntax
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/]/g) || []).length;

    if (openBraces !== closeBraces) {
      return `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`;
    }
    if (openParens !== closeParens) {
      return `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`;
    }
    if (openBrackets !== closeBrackets) {
      return `Mismatched brackets: ${openBrackets} opening, ${closeBrackets} closing`;
    }

    return null;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_CONFIG);
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): boolean {
    return language in LANGUAGE_CONFIG;
  }
}

// Export singleton instance
export const codeExecutionService = new CodeExecutionService();
