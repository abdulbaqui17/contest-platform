// Test script to verify MCQ options are broadcast correctly for all questions
const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001';
const TEST_USER = {
  email: 'qa@test.com',
  password: 'test123'
};

let authToken = null;
let ws = null;

// Step 1: Login to get auth token
async function login() {
  const response = await fetch('http://localhost:3001/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER)
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const data = await response.json();
  authToken = data.token;
  console.log('✅ Logged in successfully');
  return authToken;
}

// Step 2: Connect to WebSocket
function connectWebSocket(token, contestId) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL, {
      headers: { Authorization: `Bearer ${token}` }
    });

    ws.on('open', () => {
      console.log('🔌 WebSocket connected');
      // Join contest
      ws.send(JSON.stringify({
        event: 'join_contest',
        data: { contestId }
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      handleMessage(message);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
    });

    resolve();
  });
}

let currentQuestionId = null;
let questionCount = 0;

// Handle incoming messages
function handleMessage(message) {
  switch (message.event) {
    case 'question_broadcast':
      questionCount++;
      currentQuestionId = message.data.questionId;
      
      console.log(`\n📝 Question ${message.data.questionNumber}/${message.data.totalQuestions} received:`);
      console.log(`   Title: ${message.data.title}`);
      console.log(`   Type: ${message.data.type}`);
      console.log(`   MCQ Options: ${message.data.mcqOptions ? message.data.mcqOptions.length : 0}`);
      
      if (message.data.mcqOptions && message.data.mcqOptions.length > 0) {
        console.log(`   ✅ OPTIONS PRESENT:`);
        message.data.mcqOptions.forEach((opt, idx) => {
          console.log(`      ${String.fromCharCode(65 + idx)}. ${opt.text}`);
        });
        
        // Auto-submit after 1 second
        setTimeout(() => {
          const firstOption = message.data.mcqOptions[0];
          console.log(`   ⬆️  Submitting option: ${firstOption.text}`);
          ws.send(JSON.stringify({
            event: 'submit_answer',
            data: {
              contestId: process.argv[2],
              questionId: currentQuestionId,
              mcqOptionId: firstOption.id
            }
          }));
        }, 1000);
      } else {
        console.log(`   ❌ ERROR: NO OPTIONS RECEIVED!`);
      }
      break;
      
    case 'submission_result':
      console.log(`   ✅ Submission result: ${message.data.isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      console.log(`   Points: ${message.data.pointsEarned}, Score: ${message.data.currentScore}, Rank: #${message.data.currentRank}`);
      break;
      
    case 'question_change':
      console.log(`⏭️  ${message.data.message}`);
      break;
      
    case 'contest_end':
      console.log(`\n🏁 Contest ended!`);
      console.log(`   Total questions received: ${questionCount}`);
      if (message.data.userFinalRank) {
        console.log(`   Final rank: #${message.data.userFinalRank.rank}`);
        console.log(`   Final score: ${message.data.userFinalRank.score}`);
      }
      setTimeout(() => process.exit(0), 1000);
      break;
      
    case 'error':
      console.error(`❌ Server error:`, message.data);
      break;
      
    case 'timer_update':
      // Silent - too noisy
      break;
      
    default:
      console.log(`📨 ${message.event}:`, message.data);
  }
}

// Main execution
async function main() {
  const contestId = process.argv[2];
  
  if (!contestId) {
    console.error('Usage: node test-question-options.js <contestId>');
    process.exit(1);
  }
  
  console.log(`🧪 Testing MCQ options for contest: ${contestId}\n`);
  
  try {
    await login();
    await connectWebSocket(authToken, contestId);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();
