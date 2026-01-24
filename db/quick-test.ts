import "./prismaClient";
import { prisma } from "./prismaClient";
import bcrypt from "bcrypt";

async function main() {
  console.log("🧪 Creating quick test contest...\n");

  const hashedPassword = await bcrypt.hash("test123", 10);
  
  // Create 2 users if they don't exist
  const user1 = await prisma.user.upsert({
    where: { email: "player1@test.com" },
    update: {},
    create: {
      name: "Player 1",
      email: "player1@test.com",
      password: hashedPassword,
      role: "USER",
    },
  });
  
  const user2 = await prisma.user.upsert({
    where: { email: "player2@test.com" },
    update: {},
    create: {
      name: "Player 2",
      email: "player2@test.com",
      password: hashedPassword,
      role: "USER",
    },
  });

  console.log(`✅ Users: ${user1.email}, ${user2.email}`);

  // Create 3 questions with options
  const q1 = await prisma.question.create({
    data: {
      type: "MCQ",
      title: "Question 1: What is 1+1?",
      description: "Simple math",
    },
  });
  
  await prisma.mcqOption.createMany({
    data: [
      { questionId: q1.id, text: "1", isCorrect: false },
      { questionId: q1.id, text: "2", isCorrect: true },
      { questionId: q1.id, text: "3", isCorrect: false },
      { questionId: q1.id, text: "4", isCorrect: false },
    ]
  });

  const q2 = await prisma.question.create({
    data: {
      type: "MCQ",
      title: "Question 2: What is 2+2?",
      description: "Another math question",
    },
  });
  
  await prisma.mcqOption.createMany({
    data: [
      { questionId: q2.id, text: "2", isCorrect: false },
      { questionId: q2.id, text: "3", isCorrect: false },
      { questionId: q2.id, text: "4", isCorrect: true },
      { questionId: q2.id, text: "5", isCorrect: false },
    ]
  });

  const q3 = await prisma.question.create({
    data: {
      type: "MCQ",
      title: "Question 3: What is 3+3?",
      description: "Last math question",
    },
  });
  
  await prisma.mcqOption.createMany({
    data: [
      { questionId: q3.id, text: "5", isCorrect: false },
      { questionId: q3.id, text: "6", isCorrect: true },
      { questionId: q3.id, text: "7", isCorrect: false },
      { questionId: q3.id, text: "8", isCorrect: false },
    ]
  });

  console.log("✅ Created 3 questions");

  // Create contest starting NOW
  const now = new Date();
  const contest = await prisma.contest.create({
    data: {
      title: "Quick Test Contest",
      description: "Testing user-specific progression",
      startAt: now,
      endAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes
      status: "ACTIVE",
    },
  });

  // Link questions
  await prisma.contestQuestion.createMany({
    data: [
      { contestId: contest.id, questionId: q1.id, orderIndex: 0, points: 10, timeLimit: 60 },
      { contestId: contest.id, questionId: q2.id, orderIndex: 1, points: 10, timeLimit: 60 },
      { contestId: contest.id, questionId: q3.id, orderIndex: 2, points: 10, timeLimit: 60 },
    ]
  });

  // Join users
  await prisma.contestParticipant.createMany({
    data: [
      { contestId: contest.id, userId: user1.id },
      { contestId: contest.id, userId: user2.id },
    ]
  });

  console.log(`\n🎮 CONTEST READY!`);
  console.log(`   ID: ${contest.id}`);
  console.log(`   Title: ${contest.title}`);
  console.log(`   Questions: 3`);
  console.log(`   Participants: 2`);
  console.log(`\n📋 Login:`);
  console.log(`   Player 1: player1@test.com / test123`);
  console.log(`   Player 2: player2@test.com / test123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
