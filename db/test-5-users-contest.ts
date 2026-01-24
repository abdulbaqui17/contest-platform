import "./prismaClient";
import { prisma } from "./prismaClient";
import bcrypt from "bcrypt";

async function main() {
  console.log("🌱 Starting 5-user contest test...\n");

  // 1. Create 5 new users
  console.log("👤 Creating 5 test users...");
  const hashedPassword = await bcrypt.hash("test123", 10);
  
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        name: `Test User ${i}`,
        email: `testuser${i}@contest.com`,
        password: hashedPassword,
        role: "USER",
      },
    });
    users.push(user);
    console.log(`✅ User ${i} created: ${user.email} (ID: ${user.id})`);
  }

  // 2. Create 3 MCQ questions with options
  console.log("\n❓ Creating MCQ questions...");
  
  const questions = [];
  const questionData = [
    { 
      title: "What is 2 + 2?", 
      description: "Simple math question",
      correct: "4", 
      wrong: ["3", "5", "6"] 
    },
    { 
      title: "What is the capital of France?", 
      description: "Geography question",
      correct: "Paris", 
      wrong: ["London", "Berlin", "Madrid"] 
    },
    { 
      title: "What color is the sky?", 
      description: "General knowledge question",
      correct: "Blue", 
      wrong: ["Green", "Red", "Yellow"] 
    },
  ];

  for (const qd of questionData) {
    const question = await prisma.question.create({
      data: {
        type: "MCQ",
        title: qd.title,
        description: qd.description,
      },
    });

    // Create correct option
    const correctOption = await prisma.mcqOption.create({
      data: {
        questionId: question.id,
        text: qd.correct,
        isCorrect: true,
      },
    });

    // Create wrong options
    const wrongOptions = [];
    for (const wrongText of qd.wrong) {
      const opt = await prisma.mcqOption.create({
        data: {
          questionId: question.id,
          text: wrongText,
          isCorrect: false,
        },
      });
      wrongOptions.push(opt);
    }

    questions.push({ question, correctOption, wrongOptions });
    console.log(`✅ Question created: ${question.title}`);
  }

  // 3. Create contest (starts now, ends in 10 minutes)
  console.log("\n🏆 Creating contest...");
  const now = new Date();
  const startTime = new Date(now.getTime() + 5000); // Start in 5 seconds
  const endTime = new Date(startTime.getTime() + 10 * 60 * 1000); // 10 minutes duration

  const contest = await prisma.contest.create({
    data: {
      title: "5-User Test Contest",
      description: "Testing with 5 users and 3 questions",
      startAt: startTime,
      endAt: endTime,
      status: "UPCOMING",
    },
  });
  console.log(`✅ Contest created: ${contest.id}`);
  console.log(`   Title: ${contest.title}`);
  console.log(`   Starts: ${startTime.toISOString()}`);
  console.log(`   Ends: ${endTime.toISOString()}`);

  // 4. Link questions to contest
  console.log("\n🔗 Linking questions to contest...");
  for (let i = 0; i < questions.length; i++) {
    await prisma.contestQuestion.create({
      data: {
        contestId: contest.id,
        questionId: questions[i].question.id,
        orderIndex: i,
        points: 10,
        timeLimit: 30,
      },
    });
    console.log(`✅ Question ${i + 1} linked (10 points, 30s limit)`);
  }

  // 5. Join all 5 users to contest
  console.log("\n👥 Joining users to contest...");
  for (let i = 0; i < users.length; i++) {
    await prisma.contestParticipant.create({
      data: {
        contestId: contest.id,
        userId: users[i].id,
      },
    });
    console.log(`✅ User ${i + 1} (${users[i].email}) joined contest`);
  }

  // 6. Simulate submissions with varying performance
  console.log("\n📝 Simulating submissions...");
  
  // User 1: All correct, fast
  console.log("\n👤 User 1 (Perfect score, fast):");
  for (let i = 0; i < questions.length; i++) {
    const submission = await prisma.submission.create({
      data: {
        userId: users[0].id,
        contestId: contest.id,
        questionId: questions[i].question.id,
        selectedOptionId: questions[i].correctOption.id,
        isCorrect: true,
        submittedAt: new Date(now.getTime() + (i * 35000) + 5000), // 5s + 35s per question
      },
    });
    console.log(`   ✅ Q${i + 1}: Correct (10 points)`);
  }

  // User 2: All correct, slower
  console.log("\n👤 User 2 (Perfect score, slower):");
  for (let i = 0; i < questions.length; i++) {
    const submission = await prisma.submission.create({
      data: {
        userId: users[1].id,
        contestId: contest.id,
        questionId: questions[i].question.id,
        selectedOptionId: questions[i].correctOption.id,
        isCorrect: true,
        submittedAt: new Date(now.getTime() + (i * 35000) + 15000), // 15s + 35s per question
      },
    });
    console.log(`   ✅ Q${i + 1}: Correct (10 points)`);
  }

  // User 3: 2 correct, 1 wrong
  console.log("\n👤 User 3 (2 correct, 1 wrong):");
  for (let i = 0; i < questions.length; i++) {
    const isCorrect = i !== 2; // Wrong on question 3
    const submission = await prisma.submission.create({
      data: {
        userId: users[2].id,
        contestId: contest.id,
        questionId: questions[i].question.id,
        selectedOptionId: isCorrect ? questions[i].correctOption.id : questions[i].wrongOptions[0].id,
        isCorrect,
        submittedAt: new Date(now.getTime() + (i * 35000) + 10000),
      },
    });
    console.log(`   ${isCorrect ? '✅' : '❌'} Q${i + 1}: ${isCorrect ? 'Correct' : 'Wrong'} (${isCorrect ? 10 : 0} points)`);
  }

  // User 4: 1 correct, 2 wrong
  console.log("\n👤 User 4 (1 correct, 2 wrong):");
  for (let i = 0; i < questions.length; i++) {
    const isCorrect = i === 0; // Only first correct
    const submission = await prisma.submission.create({
      data: {
        userId: users[3].id,
        contestId: contest.id,
        questionId: questions[i].question.id,
        selectedOptionId: isCorrect ? questions[i].correctOption.id : questions[i].wrongOptions[1].id,
        isCorrect,
        submittedAt: new Date(now.getTime() + (i * 35000) + 20000),
      },
    });
    console.log(`   ${isCorrect ? '✅' : '❌'} Q${i + 1}: ${isCorrect ? 'Correct' : 'Wrong'} (${isCorrect ? 10 : 0} points)`);
  }

  // User 5: All wrong
  console.log("\n👤 User 5 (All wrong):");
  for (let i = 0; i < questions.length; i++) {
    const submission = await prisma.submission.create({
      data: {
        userId: users[4].id,
        contestId: contest.id,
        questionId: questions[i].question.id,
        selectedOptionId: questions[i].wrongOptions[2].id,
        isCorrect: false,
        submittedAt: new Date(now.getTime() + (i * 35000) + 25000),
      },
    });
    console.log(`   ❌ Q${i + 1}: Wrong (0 points)`);
  }

  // 7. Calculate and display results
  console.log("\n" + "=".repeat(80));
  console.log("📊 CONTEST RESULTS");
  console.log("=".repeat(80));

  const participants = await prisma.contestParticipant.findMany({
    where: { contestId: contest.id },
    include: {
      user: true,
    }
  });

  const results = await Promise.all(participants.map(async (p) => {
    const submissions = await prisma.submission.findMany({
      where: { 
        contestId: contest.id,
        userId: p.userId 
      },
      include: {
        question: {
          include: {
            contests: {
              where: { contestId: contest.id }
            }
          }
        }
      }
    });

    const correctAnswers = submissions.filter(s => s.isCorrect).length;
    const totalPoints = submissions.reduce((sum, s) => {
      if (s.isCorrect) {
        const contestQuestion = s.question.contests[0];
        return sum + (contestQuestion?.points || 10);
      }
      return sum;
    }, 0);

    return {
      name: p.user.name,
      email: p.user.email,
      userId: p.userId,
      correctAnswers,
      totalQuestions: questions.length,
      points: totalPoints,
      submissionCount: submissions.length
    };
  }));
  
  results.sort((a, b) => b.points - a.points);

  console.log("\n🏆 LEADERBOARD (Sorted by Points):\n");
  results.forEach((r, index) => {
    console.log(`${index + 1}. ${r.name} (${r.email})`);
    console.log(`   📧 User ID: ${r.userId}`);
    console.log(`   ✅ Correct: ${r.correctAnswers}/${r.totalQuestions}`);
    console.log(`   🏅 Points: ${r.points}`);
    console.log(`   📝 Submissions: ${r.submissionCount}`);
    console.log();
  });

  // 8. Display database statistics
  console.log("=".repeat(80));
  console.log("📈 DATABASE STATISTICS");
  console.log("=".repeat(80));

  const totalParticipants = await prisma.contestParticipant.count({
    where: { contestId: contest.id }
  });

  const totalSubmissions = await prisma.submission.count({
    where: { contestId: contest.id }
  });

  const correctSubmissions = await prisma.submission.count({
    where: { contestId: contest.id, isCorrect: true }
  });

  const totalQuestions = await prisma.contestQuestion.count({
    where: { contestId: contest.id }
  });

  console.log(`\n📊 Contest: ${contest.title}`);
  console.log(`   🆔 Contest ID: ${contest.id}`);
  console.log(`   👥 Total Participants: ${totalParticipants}`);
  console.log(`   ❓ Total Questions: ${totalQuestions}`);
  console.log(`   📝 Total Submissions: ${totalSubmissions}`);
  console.log(`   ✅ Correct Submissions: ${correctSubmissions}`);
  console.log(`   ❌ Wrong Submissions: ${totalSubmissions - correctSubmissions}`);
  console.log(`   ⏰ Start Time: ${contest.startAt.toISOString()}`);
  console.log(`   ⏱️  End Time: ${contest.endAt.toISOString()}`);
  console.log(`   📊 Status: ${contest.status}`);

  console.log("\n" + "=".repeat(80));
  console.log("✅ TEST COMPLETE!");
  console.log("=".repeat(80));
  console.log("\n📋 Login Credentials (all users):");
  console.log("   Password: test123");
  for (let i = 0; i < users.length; i++) {
    console.log(`   User ${i + 1}: ${users[i].email}`);
  }
  console.log(`\n🔗 Contest ID: ${contest.id}`);
  console.log("\n💡 Contest will auto-start in 5 seconds. Restart backend to join live!");
}

main()
  .catch((e) => {
    console.error("❌ Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
