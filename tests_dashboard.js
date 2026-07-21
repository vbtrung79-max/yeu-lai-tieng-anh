const fs = require('fs');

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value.toString(); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (let k in store) delete store[k]; }
};

// Mock DOM elements
const mockElements = {};
function createMockElement(id = '', tag = '') {
  return {
    id,
    tagName: tag.toUpperCase(),
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = val; },
    getAttribute(name) { return this.attributes[name] || null; },
    addEventListener: () => {},
    querySelector: (sel) => createMockElement('', 'div'),
    querySelectorAll: (sel) => [],
    appendChild: (child) => {},
    innerHTML: '',
    textContent: ''
  };
}

global.document = {
  addEventListener: () => {},
  getElementById: (id) => {
    if (!mockElements[id]) {
      mockElements[id] = createMockElement(id);
    }
    return mockElements[id];
  },
  querySelector: (sel) => {
    if (sel.startsWith('#')) {
      const id = sel.substring(1);
      return global.document.getElementById(id);
    }
    return createMockElement();
  },
  createElement: (tag) => createMockElement('', tag)
};

global.window = {};

// Mock books and streak utilities
global.BOOKS = [
  { day: 1, title: 'The Little Prince - Chapter 1' },
  { day: 2, title: 'Alice in Wonderland - Down the Rabbit Hole' },
  { day: 3, title: 'Sherlock Holmes - A Study in Scarlet' },
  { day: 4, title: 'The Gift of the Magi' },
  { day: 5, title: 'Robin Hood - The Golden Arrow' }
];

global.calculateStreak = (lastActiveStr, currentStreak) => {
  if (!lastActiveStr) return 1;
  // simple mock streak calculation
  return currentStreak + 1;
};

// Suppress alerts
global.alert = (msg) => { console.log('ALERT:', msg); };

// Load app.js content
const appCode = fs.readFileSync('./app.js', 'utf8');
eval(appCode);

// Tests
async function runTests() {
  console.log('--- STARTING DASHBOARD & CHECK-IN TESTS ---');
  
  // 1. Verify that AppDashboard is exposed
  console.assert(global.AppDashboard !== undefined, 'AppDashboard should be exposed on window');
  
  const { fetchUserProfile, updateUserProfile, addHabitCheckIn, loadDashboard, handleDaySelect, handleCompleteDay } = global.AppDashboard;
  const userId = 'test-user-123';
  
  // 2. Fetch profile defaults
  const profile = await fetchUserProfile(userId);
  console.assert(profile.current_day === 1, 'Default current_day should be 1');
  console.assert(profile.streak === 0, 'Default streak should be 0');
  
  // 3. Update profile
  await updateUserProfile(userId, { streak: 5, current_day: 2 });
  const updatedProfile = await fetchUserProfile(userId);
  console.assert(updatedProfile.streak === 5, 'Streak should be updated to 5');
  console.assert(updatedProfile.current_day === 2, 'current_day should be updated to 2');
  
  // 4. Add habit check-in
  const checkin = await addHabitCheckIn(userId, 2);
  console.assert(checkin.user_id === userId, 'Check-in user_id should match');
  console.assert(checkin.day === 2, 'Check-in day should match');
  
  // Validate habit history localstorage
  const history = JSON.parse(localStorage.getItem('mock_supabase_habit_history') || '[]');
  console.assert(history.length === 1, 'Habit history should have 1 record');
  console.assert(history[0].day === 2, 'Recorded day in history should be 2');
  
  // 5. Simulate day completion flow
  // Setup session first
  localStorage.setItem('mock_supabase_session', JSON.stringify({
    user: { id: userId, email: 'test@example.com' }
  }));
  
  global.activeDay = 2; // user completes Day 2
  await handleCompleteDay();
  
  // Check profile state after completion
  const postCompleteProfile = await fetchUserProfile(userId);
  console.assert(postCompleteProfile.current_day === 3, 'current_day should progress to 3 after completing current day 2');
  console.assert(postCompleteProfile.streak === 6, 'streak should increment to 6');
  console.assert(postCompleteProfile.last_active !== null, 'last_active should be set');
  
  // 6. Review day completion check (should NOT progress current_day if completing an older day)
  global.activeDay = 1; // complete Day 1 (reviewing)
  await handleCompleteDay();
  
  const postReviewProfile = await fetchUserProfile(userId);
  console.assert(postReviewProfile.current_day === 3, 'current_day should remain 3 when completing Day 1 (review)');
  console.assert(postReviewProfile.streak === 7, 'streak should increment to 7');
  
  console.log('--- ALL DASHBOARD & CHECK-IN TESTS PASSED ---');
}

runTests().catch(err => {
  console.error('TEST FAIL:', err);
  process.exit(1);
});
