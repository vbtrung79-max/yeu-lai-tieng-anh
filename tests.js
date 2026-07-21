const { calculateStreak } = require('./utils.js');

function testStreakSameDay() {
  const today = new Date().toISOString();
  const result = calculateStreak(today, 5);
  console.assert(result === 5, "Streak should remain 5 if completed on the same day");
}

function testStreakNextDay() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = calculateStreak(yesterday, 5);
  console.assert(result === 6, "Streak should increment to 6 if completed on the next day");
}

function testStreakBroken() {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const result = calculateStreak(twoDaysAgo, 5);
  console.assert(result === 1, "Streak should reset to 1 if more than 24 hours have passed");
}

try {
  testStreakSameDay();
  testStreakNextDay();
  testStreakBroken();
  console.log("PASS: Streak logic tests completed successfully.");
} catch (err) {
  console.error("FAIL:", err);
  process.exit(1);
}
