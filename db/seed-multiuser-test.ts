import "./prismaClient";
import { prisma } from "./prismaClient";
import bcrypt from "bcrypt";

async function main() {
  console.log("🌱 Starting multi-user test seed...\n");

  // Clean up existing test data
  console.log("🧹 Cleaning up existing test data...");
  await prisma.leaderboardSnapshot.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.contestParticipant.deleteMany();
  await prisma.contestQuestion.deleteMany();
  await prisma.mcqOption.deleteMany();
  await prisma.contest.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany({ 
    where: { 
      email: { 
        in: ["user1@test.com", "user2@test.com", "admin@test.com"] 
      } 
    } 
  });

  // 1. Create test users
  console.log("\n👤 Creating test users...");
  const hashedPassword = await bcrypt.hash("test123", 10);
  
  const user1 = await prisma.user.create({
    data: {
      name: "Test User 1",
      email: "user1@test.com",
      password: hashedPassword,
      role: "USER",
    },
  });
  console.log(`✅ User 1 created: ${user1.id} (${user1.email})`);

  const user2 = await prisma.user.create({
    data: {
      name: "Test User 2",
      email: "user2@test.com",
      password: hashedPassword,
      role: "USER",
    },
  });
  console.log(`✅ User 2 created: ${user2.id} (${user2.email})`);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@test.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin created: ${admin.id} (${admin.email})`);

  // 2. Create 3 MCQ questions
  console.log("\n❓ Creating MCQ questions...");
  
  const questions = [];
  const questionData = [
    { title: "What is 2 + 2?", correct: "4", wrong: ["3", "5", "6"] },
    { title: "What is the capital of France?", correct: "Paris", wrong: ["London", "Berlin", "Madrid"] },
    { title: "What color is the sky?", correct: "Blue", wrong: ["Green", "Red", "Yellow"] },
  ];

  for (const qd of questionData) {
    const question = await prisma.question.create({
      data: {
        type: "MCQ",
        title: qd.title,
        description: `Answer the question: ${qd.title}`,
      },
    });

    // Create correct option
    await prisma.mcqOption.create({
      data: {
        questionId: question.id,
        text: qd.correct,
        isCorrect: true,
      },
    });

    // Create wrong options
    for (const wrongText of qd.wrong) {
      await prisma.mcqOption.create({
        data: {
          questionId: question.id,
          text: wrongText,
          isCorrect: false,
        },
      });
    }

    questions.push(question);
    console.log(`✅ Question created: ${question.title}`);
  }

  // 3. Create ACTIVE contest (starts now, ends in 10 minutes)
  console.log("\n🏆 Creating contest...");
  const now = new Date();
  const endTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes from now

  const contest = await prisma.contest.create({
    data: {
      title: "Multi-User Test Contest",
      description: "Test with multiple users and questions",
      startAt: now,
      endAt: endTime,
      status: "ACTIVE",
    },
  });
  console.log(`✅ Contest created: ${contest.id}`);
  console.log(`   Status: ACTIVE`);
  console.log(`   Starts: ${now.toISOString()}`);
  console.log(`   Ends: ${endTime.toISOString()}`);

  // 4. Link all questions to contest
  console.log("\n🔗 Linking questions to contest...");
  for (let i = 0; i < questions.length; i++) {
    await prisma.contestQuestion.create({
      data: {
        contestId: contest.id,
        questionId: questions[i].id,
        orderIndex: i,
        points: 100,
        timeLimit: 30, // 30 seconds per question for faster testing
      },
    });
    console.log(`✅ Question ${i + 1} linked (30s time limit)`);
  }

  // 5. Join both users to contest
  console.log("\n👥 Joining users to contest...");
  await prisma.contestParticipant.create({
    data: {
      contestId: contest.id,
      userId: user1.id,
    },
  });
  console.log(`✅ User 1 joined contest`);

  await prisma.contestParticipant.create({
    data: {
      contestId: contest.id,
      userId: user2.id,
    },
  });
  console.log(`✅ User 2 joined contest`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Multi-user test setup complete!");
  console.log("=".repeat(60));
  console.log("\n📋 Test Credentials:");
  console.log("   User 1: user1@test.com / test123");
  console.log("   User 2: user2@test.com / test123");
  console.log("   Admin:  admin@test.com / test123");
  console.log(`\n📍 Contest ID: ${contest.id}`);
  console.log(`   Questions: ${questions.length}`);
  console.log(`   Time per question: 30 seconds`);
  console.log("\n✅ Ready for testing!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
