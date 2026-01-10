#!/usr/bin/env node

const WebSocket = require('ws');

const JWT = process.argv[2];
const CONTEST_ID = process.argv[3] || 'e40b7fdd-ed7d-44c3-9dcd-0e08befaa29b';
const CORRECT_OPTION_ID = process.argv[4] || 'a4f677f7-90ae-4c4d-8c04-9adcf39cc866';

if (!JWT) {
  console.error('Usage: node websocket-test.js <JWT_TOKEN> [CONTEST_ID] [OPTION_ID]');
  process.exit(1);
}

const ws = new WebSocket(`ws://localhost:3000/ws/contest?token=${JWT}`);

let questionReceived = false;
let submittedAnswer = false;

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully\n');
  console.log('📤 Sending join_contest event...');
  
  ws.send(JSON.stringify({
    event: 'join_contest',
    data: {
      contestId: CONTEST_ID
    }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  const timestamp = new Date().toISOString();
  
  console.log(`\n[${timestamp}] 📨 Received: ${message.event}`);
  console.log(JSON.stringify(message, null, 2));
  
  // Auto-submit answer when question is broadcast
  if (message.event === 'question_broadcast' && !submittedAnswer) {
    questionReceived = true;
    console.log('\n⏱️  Waiting 2 seconds before submitting answer...');
    
    setTimeout(() => {
      console.log(`\n📤 Submitting answer (optionId: ${CORRECT_OPTION_ID})...`);
      ws.send(JSON.stringify({
        event: 'submit_answer',
        data: {
          questionId: message.payload.question.id,
          selectedOptionId: CORRECT_OPTION_ID,
          submittedAt: new Date().toISOString()
        }
      }));
      submittedAnswer = true;
    }, 2000);
  }
  
  // Close after contest_end
  if (message.event === 'contest_end') {
    console.log('\n🏁 Contest ended. Closing connection in 2 seconds...');
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 2000);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket closed with code ${code}: ${reason || 'No reason provided'}`);
  if (code !== 1000) {
    console.error('❌ Unexpected close code');
    process.exit(1);
  }
});

// Timeout after 2 minutes
setTimeout(() => {
  console.error('\n⏰ Test timeout after 2 minutes');
  ws.close();
  process.exit(1);
}, 120000);

console.log('🔄 Connecting to ws://localhost:3000/ws/contest...');
