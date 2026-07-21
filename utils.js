function calculateStreak(lastActiveStr, currentStreak) {
  if (!lastActiveStr) return 1;
  const lastActive = new Date(lastActiveStr);
  const today = new Date();
  
  // Đưa về cùng mốc giờ 00:00:00 để so sánh ngày
  const d1 = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
  const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = d2 - d1;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return currentStreak;
  } else if (diffDays === 1) {
    return currentStreak + 1;
  } else {
    return 1;
  }
}

if (typeof module !== 'undefined') { module.exports = { calculateStreak }; }
