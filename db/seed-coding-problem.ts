import { prisma } from "./prismaClient";
import { QuestionType, ContestStatus } from "./generated/prisma";

async function main() {
  console.log("🌱 Seeding coding challenge data...\n");

  // Create a new Contest for coding challenges
  const contest = await prisma.contest.create({
    data: {
      title: "Weekly Coding Challenge 1",
      description:
        "Test your algorithmic skills with classic coding problems. Solve problems efficiently to earn maximum points!",
      startAt: new Date(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: ContestStatus.ACTIVE,
    },
  });

  console.log(`✅ Created contest: "${contest.title}" (ID: ${contest.id})`);

  // ==========================================
  // Question 1: Two Sum
  // ==========================================
  const twoSumQuestion = await prisma.question.create({
    data: {
      title: "Two Sum",
      type: QuestionType.CODING,
      description: `## Problem Description

Given an array of integers \`nums\` and an integer \`target\`, return **indices of the two numbers** such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

---

## Examples

### Example 1:
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

### Example 2:
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

### Example 3:
\`\`\`
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\`

---

## Constraints:
- \`2 <= nums.length <= 10^4\`
- \`-10^9 <= nums[i] <= 10^9\`
- \`-10^9 <= target <= 10^9\`
- **Only one valid answer exists.**

---

## Function Signature

**JavaScript/TypeScript:**
\`\`\`javascript
function twoSum(nums: number[], target: number): number[]
\`\`\`

**Python:**
\`\`\`python
def twoSum(nums: List[int], target: int) -> List[int]:
\`\`\`

**Java:**
\`\`\`java
public int[] twoSum(int[] nums, int target)
\`\`\`
`,
      memoryLimit: 256000, // 256 MB in KB
      timeLimit: 2000,     // 2 seconds in milliseconds
    },
  });

  console.log(`✅ Created question: "${twoSumQuestion.title}" (ID: ${twoSumQuestion.id})`);

  // Link question to contest
  await prisma.contestQuestion.create({
    data: {
      contestId: contest.id,
      questionId: twoSumQuestion.id,
      orderIndex: 1,
      points: 100,
      timeLimit: 1800, // 30 minutes
    },
  });

  // Visible Test Cases (shown to users as examples)
  await prisma.testCase.createMany({
    data: [
      {
        questionId: twoSumQuestion.id,
        input: JSON.stringify({ nums: [2, 7, 11, 15], target: 9 }),
        expectedOutput: JSON.stringify([0, 1]),
        isHidden: false,
        order: 1,
      },
      {
        questionId: twoSumQuestion.id,
        input: JSON.stringify({ nums: [3, 2, 4], target: 6 }),
        expectedOutput: JSON.stringify([1, 2]),
        isHidden: false,
        order: 2,
      },
    ],
  });

  console.log(`   📝 Created 2 visible test cases for Two Sum`);

  // Hidden Test Cases (for grading, not shown to users)
  await prisma.testCase.createMany({
    data: [
      {
        questionId: twoSumQuestion.id,
        input: JSON.stringify({ nums: [3, 3], target: 6 }),
        expectedOutput: JSON.stringify([0, 1]),
        isHidden: true,
        order: 3,
      },
      {
        questionId: twoSumQuestion.id,
        input: JSON.stringify({ nums: [-1, -2, -3, -4, -5], target: -8 }),
        expectedOutput: JSON.stringify([2, 4]),
        isHidden: true,
        order: 4,
      },
      {
        questionId: twoSumQuestion.id,
        input: JSON.stringify({ nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], target: 19 }),
        expectedOutput: JSON.stringify([8, 9]),
        isHidden: true,
        order: 5,
      },
      {
        questionId: twoSumQuestion.id,
        input: JSON.stringify({ nums: [0, 4, 3, 0], target: 0 }),
        expectedOutput: JSON.stringify([0, 3]),
        isHidden: true,
        order: 6,
      },
    ],
  });

  console.log(`   🔒 Created 4 hidden test cases for Two Sum`);

  // ==========================================
  // Question 2: Reverse String
  // ==========================================
  const reverseStringQuestion = await prisma.question.create({
    data: {
      title: "Reverse String",
      type: QuestionType.CODING,
      description: `## Problem Description

Write a function that reverses a string. The input string is given as an array of characters \`s\`.

You must do this by modifying the input array **in-place** with \`O(1)\` extra memory.

---

## Examples

### Example 1:
\`\`\`
Input: s = ["h","e","l","l","o"]
Output: ["o","l","l","e","h"]
\`\`\`

### Example 2:
\`\`\`
Input: s = ["H","a","n","n","a","h"]
Output: ["h","a","n","n","a","H"]
\`\`\`

---

## Constraints:
- \`1 <= s.length <= 10^5\`
- \`s[i]\` is a printable ASCII character.

---

## Function Signature

**JavaScript/TypeScript:**
\`\`\`javascript
function reverseString(s: string[]): void
\`\`\`

**Python:**
\`\`\`python
def reverseString(s: List[str]) -> None:
\`\`\`

**Java:**
\`\`\`java
public void reverseString(char[] s)
\`\`\`

> **Note:** Do not return anything, modify \`s\` in-place instead.
`,
      memoryLimit: 128000, // 128 MB in KB
      timeLimit: 1000,     // 1 second in milliseconds
    },
  });

  console.log(`✅ Created question: "${reverseStringQuestion.title}" (ID: ${reverseStringQuestion.id})`);

  // Link question to contest
  await prisma.contestQuestion.create({
    data: {
      contestId: contest.id,
      questionId: reverseStringQuestion.id,
      orderIndex: 2,
      points: 50,
      timeLimit: 900, // 15 minutes
    },
  });

  // Visible Test Cases
  await prisma.testCase.createMany({
    data: [
      {
        questionId: reverseStringQuestion.id,
        input: JSON.stringify({ s: ["h", "e", "l", "l", "o"] }),
        expectedOutput: JSON.stringify(["o", "l", "l", "e", "h"]),
        isHidden: false,
        order: 1,
      },
      {
        questionId: reverseStringQuestion.id,
        input: JSON.stringify({ s: ["H", "a", "n", "n", "a", "h"] }),
        expectedOutput: JSON.stringify(["h", "a", "n", "n", "a", "H"]),
        isHidden: false,
        order: 2,
      },
    ],
  });

  console.log(`   📝 Created 2 visible test cases for Reverse String`);

  // Hidden Test Cases
  await prisma.testCase.createMany({
    data: [
      {
        questionId: reverseStringQuestion.id,
        input: JSON.stringify({ s: ["a"] }),
        expectedOutput: JSON.stringify(["a"]),
        isHidden: true,
        order: 3,
      },
      {
        questionId: reverseStringQuestion.id,
        input: JSON.stringify({ s: ["A", "B"] }),
        expectedOutput: JSON.stringify(["B", "A"]),
        isHidden: true,
        order: 4,
      },
      {
        questionId: reverseStringQuestion.id,
        input: JSON.stringify({ s: ["1", "2", "3", "4", "5"] }),
        expectedOutput: JSON.stringify(["5", "4", "3", "2", "1"]),
        isHidden: true,
        order: 5,
      },
      {
        questionId: reverseStringQuestion.id,
        input: JSON.stringify({ s: [" ", "!", "@", "#"] }),
        expectedOutput: JSON.stringify(["#", "@", "!", " "]),
        isHidden: true,
        order: 6,
      },
    ],
  });

  console.log(`   🔒 Created 4 hidden test cases for Reverse String`);

  // ==========================================
  // Question 3: Valid Palindrome
  // ==========================================
  const palindromeQuestion = await prisma.question.create({
    data: {
      title: "Valid Palindrome",
      type: QuestionType.CODING,
      description: `## Problem Description

A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return \`true\` if it is a **palindrome**, or \`false\` otherwise.

---

## Examples

### Example 1:
\`\`\`
Input: s = "A man, a plan, a canal: Panama"
Output: true
Explanation: "amanaplanacanalpanama" is a palindrome.
\`\`\`

### Example 2:
\`\`\`
Input: s = "race a car"
Output: false
Explanation: "raceacar" is not a palindrome.
\`\`\`

### Example 3:
\`\`\`
Input: s = " "
Output: true
Explanation: s is an empty string "" after removing non-alphanumeric characters.
Since an empty string reads the same forward and backward, it is a palindrome.
\`\`\`

---

## Constraints:
- \`1 <= s.length <= 2 * 10^5\`
- \`s\` consists only of printable ASCII characters.

---

## Function Signature

**JavaScript/TypeScript:**
\`\`\`javascript
function isPalindrome(s: string): boolean
\`\`\`

**Python:**
\`\`\`python
def isPalindrome(s: str) -> bool:
\`\`\`
`,
      memoryLimit: 128000,
      timeLimit: 1000,
    },
  });

  console.log(`✅ Created question: "${palindromeQuestion.title}" (ID: ${palindromeQuestion.id})`);

  // Link question to contest
  await prisma.contestQuestion.create({
    data: {
      contestId: contest.id,
      questionId: palindromeQuestion.id,
      orderIndex: 3,
      points: 75,
      timeLimit: 1200, // 20 minutes
    },
  });

  // Visible Test Cases
  await prisma.testCase.createMany({
    data: [
      {
        questionId: palindromeQuestion.id,
        input: JSON.stringify({ s: "A man, a plan, a canal: Panama" }),
        expectedOutput: JSON.stringify(true),
        isHidden: false,
        order: 1,
      },
      {
        questionId: palindromeQuestion.id,
        input: JSON.stringify({ s: "race a car" }),
        expectedOutput: JSON.stringify(false),
        isHidden: false,
        order: 2,
      },
    ],
  });

  console.log(`   📝 Created 2 visible test cases for Valid Palindrome`);

  // Hidden Test Cases
  await prisma.testCase.createMany({
    data: [
      {
        questionId: palindromeQuestion.id,
        input: JSON.stringify({ s: " " }),
        expectedOutput: JSON.stringify(true),
        isHidden: true,
        order: 3,
      },
      {
        questionId: palindromeQuestion.id,
        input: JSON.stringify({ s: "0P" }),
        expectedOutput: JSON.stringify(false),
        isHidden: true,
        order: 4,
      },
      {
        questionId: palindromeQuestion.id,
        input: JSON.stringify({ s: "aa" }),
        expectedOutput: JSON.stringify(true),
        isHidden: true,
        order: 5,
      },
      {
        questionId: palindromeQuestion.id,
        input: JSON.stringify({ s: ".,," }),
        expectedOutput: JSON.stringify(true),
        isHidden: true,
        order: 6,
      },
    ],
  });

  console.log(`   🔒 Created 4 hidden test cases for Valid Palindrome`);

  // ==========================================
  // Summary
  // ==========================================
  console.log("\n" + "=".repeat(50));
  console.log("📊 SEEDING SUMMARY");
  console.log("=".repeat(50));
  console.log(`✅ Contest: "${contest.title}"`);
  console.log(`   - Status: ${contest.status}`);
  console.log(`   - Starts: ${contest.startAt.toISOString()}`);
  console.log(`   - Ends: ${contest.endAt.toISOString()}`);
  console.log("");
  console.log("📚 Questions Created:");
  console.log("   1. Two Sum (100 pts) - 2 visible, 4 hidden test cases");
  console.log("   2. Reverse String (50 pts) - 2 visible, 4 hidden test cases");
  console.log("   3. Valid Palindrome (75 pts) - 2 visible, 4 hidden test cases");
  console.log("");
  console.log("🎉 Coding challenge seed data created successfully!");
  console.log("=".repeat(50));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error seeding data:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
