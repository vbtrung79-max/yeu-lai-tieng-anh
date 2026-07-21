/* ==========================================================================
   APPLICATION LOGIC: Yêu Lại Tiếng Anh v2 (Public & Offline-First Edition)
   ========================================================================== */

// 1. DATA CONFIGURATION & INITIALIZATION
const DEFAULT_PROFILE = {
    name: "Anh Trung",
    streak: 0,
    longestStreak: 0,
    lastActiveDate: "", // Format: YYYY-MM-DD
    dailyGoalMinutes: 30,
    vacationDaysLeft: 3
};

// Global variables for App State
let userProfile = { ...DEFAULT_PROFILE };
let lessonsList = [];
let vocabList = [];
let activityLogs = [];

// Audio and Speech Synthesis State
let currentAudioFile = null;
let isPlaying = false;
let audioDuration = 0;
let playbackRate = 1.0;
let shadowingMode = false;
let activeSentenceIdx = -1;
let sentencesArray = [];
let ttsUtterance = null;
let currentLesson = null;
let currentSrsCard = null;

// Initialize data from LocalStorage on DOM load
document.addEventListener("DOMContentLoaded", () => {
    initDatabase();
    setupNavigation();
    setupDashboard();
    setupActiveReader();
    setupSrsFlashcards();
    setupImporter();
    setupSettingsAndBackup();
    
    // Check if user is first-time user
    const profileRaw = localStorage.getItem("ylta_profile");
    if (!profileRaw) {
        showWelcomeModal();
    } else {
        renderDashboard();
    }
});

/**
 * Initialize all LocalStorage keys
 */
function initDatabase() {
    // 1. Profile
    const profileRaw = localStorage.getItem("ylta_profile");
    if (profileRaw) {
        try {
            userProfile = JSON.parse(profileRaw);
        } catch (e) {
            console.error("Error parsing profile, resetting...", e);
            userProfile = { ...DEFAULT_PROFILE };
        }
    }
    
    // 2. Lessons (merge DEFAULT books from books.js with custom lessons)
    const lessonsRaw = localStorage.getItem("ylta_lessons");
    let loadedLessons = [];
    if (lessonsRaw) {
        try {
            loadedLessons = JSON.parse(lessonsRaw);
        } catch (e) {
            loadedLessons = [];
        }
    }
    
    // Kiểm tra xem dữ liệu đã có các bài Mini Stories mặc định mới chưa
    const hasNewDefaults = loadedLessons.some(l => l.id === "default-1" && l.category === "ministory");
    
    if (!hasNewDefaults) {
        console.log("Cập nhật danh sách truyện mặc định v2...");
        // Giữ lại các truyện tự thêm của người dùng (có ID bắt đầu bằng custom-)
        const customLessons = loadedLessons.filter(l => l.id && l.id.startsWith("custom-"));
        lessonsList = [...BOOKS, ...customLessons];
        localStorage.setItem("ylta_lessons", JSON.stringify(lessonsList));
    } else {
        lessonsList = loadedLessons;
    }
    
    // 3. Vocab
    const vocabRaw = localStorage.getItem("ylta_vocab");
    if (vocabRaw) {
        try {
            vocabList = JSON.parse(vocabRaw);
        } catch (e) {
            console.error("Error parsing vocab, resetting...", e);
            vocabList = [];
        }
    } else {
        vocabList = [];
        localStorage.setItem("ylta_vocab", JSON.stringify(vocabList));
    }
    
    // 4. Activity Logs
    const logsRaw = localStorage.getItem("ylta_logs");
    if (logsRaw) {
        try {
            activityLogs = JSON.parse(logsRaw);
        } catch (e) {
            console.error("Error parsing logs, resetting...", e);
            activityLogs = [];
        }
    } else {
        activityLogs = [];
        localStorage.setItem("ylta_logs", JSON.stringify(activityLogs));
    }
}

function saveProfile() {
    localStorage.setItem("ylta_profile", JSON.stringify(userProfile));
}

function saveLessons() {
    localStorage.setItem("ylta_lessons", JSON.stringify(lessonsList));
}

function saveVocab() {
    localStorage.setItem("ylta_vocab", JSON.stringify(vocabList));
}

function saveLogs() {
    localStorage.setItem("ylta_logs", JSON.stringify(activityLogs));
}

function showWelcomeModal() {
    const modal = document.getElementById("modal-welcome");
    modal.classList.remove("hidden");
    
    const form = document.getElementById("welcome-form");
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("welcome-name").value.trim();
        const goalInput = parseInt(document.getElementById("welcome-goal").value, 10);
        
        userProfile.name = nameInput || "Anh Trung";
        userProfile.dailyGoalMinutes = goalInput || 30;
        userProfile.lastActiveDate = getTodayDateString();
        userProfile.streak = 1; // start first day
        userProfile.longestStreak = 1;
        saveProfile();
        
        // Log first checkin log
        logStudyMinutes(0, 0); // Log 0 mins just to start record
        
        modal.classList.add("hidden");
        renderDashboard();
    });
}

// ==========================================================================
// 2. NAVIGATION LOGIC
// ==========================================================================
function setupNavigation() {
    const menuItems = document.querySelectorAll(".menu-item");
    const screens = document.querySelectorAll(".app-screen");

    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = item.getAttribute("data-target");
            
            // Toggle active menu item
            menuItems.forEach(el => el.classList.remove("active"));
            item.classList.add("active");
            
            // Toggle screen visibility
            screens.forEach(screen => screen.classList.add("hidden"));
            const targetScreen = document.getElementById(targetId);
            targetScreen.classList.remove("hidden");
            
            // Specific screen updates
            if (targetId === "screen-dashboard") {
                renderDashboard();
            } else if (targetId === "screen-srs") {
                renderSrsFlashcards();
            } else if (targetId === "screen-settings") {
                renderSettings();
            }
            
            // Pause reader playing if navigating away
            if (targetId !== "screen-reader") {
                pausePlayback();
            }
        });
    });
}

function navigateToScreen(screenId) {
    const screens = document.querySelectorAll(".app-screen");
    const menuItems = document.querySelectorAll(".menu-item");
    
    screens.forEach(s => s.classList.add("hidden"));
    document.getElementById(screenId).classList.remove("hidden");
    
    menuItems.forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-target") === screenId) {
            item.classList.add("active");
        }
    });

    if (screenId === "screen-dashboard") {
        renderDashboard();
    } else if (screenId === "screen-srs") {
        renderSrsFlashcards();
    }
}

// ==========================================================================
// 3. DASHBOARD LOGIC
// ==========================================================================
function setupDashboard() {
    // Tab switching for curriculum list
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".curriculum-tab-content");
    
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTabId = btn.getAttribute("data-tab");
            
            tabButtons.forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            
            tabContents.forEach(content => content.classList.remove("active"));
            document.getElementById(targetTabId).classList.add("active");
        });
    });
    
    // Quick Checkin Form
    const checkinForm = document.getElementById("quick-checkin-form");
    checkinForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const activeMins = parseInt(document.getElementById("checkin-active").value, 10) || 0;
        const passiveMins = parseInt(document.getElementById("checkin-passive").value, 10) || 0;
        
        if (activeMins === 0 && passiveMins === 0) {
            alert("Vui lòng điền số phút học!");
            return;
        }
        
        logStudyMinutes(activeMins, passiveMins);
        checkinForm.reset();
        alert("Đã lưu nhật ký rèn luyện hôm nay thành công! Cố lên anh nhé.");
        renderDashboard();
    });
}

function renderDashboard() {
    // 1. Profile Texts
    document.getElementById("sidebar-user-name").innerText = userProfile.name;
    document.getElementById("banner-user-name").innerText = userProfile.name;
    
    // Recalculate streak
    updateStreak();
    
    document.getElementById("sidebar-streak-val").innerText = userProfile.streak;
    document.getElementById("dash-streak-val").innerText = userProfile.streak;
    document.getElementById("dash-longest-streak").innerText = userProfile.longestStreak;
    document.getElementById("dash-vocab-total").innerText = vocabList.length;
    
    // 2. Render Heatmap (30 days)
    renderHeatmap();
    
    // 3. Render Lessons Lists
    renderLessonsByCategory("ministory", "ministory-lessons-root");
    renderLessonsByCategory("level1", "level1-lessons-root");
    renderLessonsByCategory("power", "power-lessons-root");
    renderLessonsByCategory("bookworm", "bookworms-lessons-root");
    renderLessonsByCategory("custom", "custom-lessons-root");
    
    // 4. Update Vocab Badge in Menu
    updateVocabMenuBadge();
}

function renderHeatmap() {
    const gridRoot = document.getElementById("heatmap-grid-root");
    gridRoot.innerHTML = "";
    
    let totalMinutesAccumulated = 0;
    const today = new Date();
    
    // Generate dates for past 30 days
    const daysData = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = formatDateString(d);
        
        // Find log
        const log = activityLogs.find(l => l.date === dateStr);
        const active = log ? log.activeMinutes : 0;
        const passive = log ? log.passiveMinutes : 0;
        const total = active + passive;
        totalMinutesAccumulated += total;
        
        // Level
        let lvl = 0;
        if (total > 0 && total <= 15) lvl = 1;
        else if (total > 15 && total <= 30) lvl = 2;
        else if (total > 30) lvl = 3;
        
        // Handle vacation log
        let isVacation = false;
        if (log && log.isVacation) {
            isVacation = true;
            lvl = 2; // Color it level 2 (emerald placeholder)
        }
        
        daysData.push({
            date: dateStr,
            dayOfMonth: d.getDate(),
            totalMinutes: total,
            active,
            passive,
            level: lvl,
            isVacation
        });
    }
    
    document.getElementById("heatmap-summary-text").innerText = `Học tích lũy: ${totalMinutesAccumulated} phút`;
    
    // Render elements
    daysData.forEach(day => {
        const el = document.createElement("div");
        el.className = `heatmap-day lvl-${day.level}`;
        el.innerText = day.dayOfMonth;
        
        let tooltipText = `${day.date}: Chưa học`;
        if (day.isVacation) {
            tooltipText = `${day.date}: Nghỉ phép (Streak vẫn giữ)`;
        } else if (day.totalMinutes > 0) {
            tooltipText = `${day.date}: ${day.totalMinutes} phút (Chủ động: ${day.active}m, Thụ động: ${day.passive}m)`;
        }
        el.setAttribute("data-tooltip", tooltipText);
        gridRoot.appendChild(el);
    });
}

function renderLessonsByCategory(category, rootId) {
    const root = document.getElementById(rootId);
    root.innerHTML = "";
    
    const filtered = lessonsList.filter(l => l.category === category);
    
    if (filtered.length === 0) {
        root.innerHTML = `<div class="empty-state"><p>Chưa có câu chuyện nào trong mục này.</p></div>`;
        return;
    }
    
    filtered.forEach(lesson => {
        const card = document.createElement("div");
        card.className = "glass-card lesson-card animate-fade-in";
        
        // Determine completion state
        const isCompleted = isLessonCompleted(lesson.id);
        const statusBadge = isCompleted 
            ? `<span class="lesson-status-badge completed">Đã học xong ✓</span>` 
            : `<span class="lesson-status-badge">Đang học</span>`;
            
        card.innerHTML = `
            <div class="lesson-card-details">
                <span class="lesson-day-tag">${category === 'ministory' ? 'Mini Story' : category}</span>
                <h4>${lesson.title}</h4>
                <p>${lesson.content.substring(0, 100)}...</p>
            </div>
            <div class="lesson-card-actions">
                ${statusBadge}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-sky"><path d="m9 18 6-6-6-6"/></svg>
            </div>
        `;
        
        card.addEventListener("click", () => {
            openReader(lesson);
        });
        
        root.appendChild(card);
    });
}

/**
 * Log study minutes for today
 */
function logStudyMinutes(activeMinutes, passiveMinutes) {
    const todayStr = getTodayDateString();
    let log = activityLogs.find(l => l.date === todayStr);
    
    if (log) {
        log.activeMinutes += activeMinutes;
        log.passiveMinutes += passiveMinutes;
    } else {
        log = {
            date: todayStr,
            activeMinutes: activeMinutes,
            passiveMinutes: passiveMinutes,
            lessonsRead: [],
            isVacation: false
        };
        activityLogs.push(log);
    }
    
    saveLogs();
    
    // Update streak triggers
    updateStreak();
}

function updateStreak() {
    const todayStr = getTodayDateString();
    
    if (!userProfile.lastActiveDate) {
        userProfile.lastActiveDate = todayStr;
        userProfile.streak = 1;
        userProfile.longestStreak = 1;
        saveProfile();
        return;
    }
    
    if (userProfile.lastActiveDate === todayStr) {
        // Already active today, nothing to update
        return;
    }
    
    // Calculate difference
    const lastDate = new Date(userProfile.lastActiveDate);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        // Checked in yesterday, increment streak
        userProfile.streak += 1;
        if (userProfile.streak > userProfile.longestStreak) {
            userProfile.longestStreak = userProfile.streak;
        }
        userProfile.lastActiveDate = todayStr;
    } else if (diffDays > 1) {
        // Missed days. Let's check if there were vacation logs covering all missed days!
        let hasVacationCover = true;
        for (let i = 1; i < diffDays; i++) {
            const checkD = new Date(lastDate);
            checkD.setDate(lastDate.getDate() + i);
            const checkStr = formatDateString(checkD);
            const checkLog = activityLogs.find(l => l.date === checkStr);
            if (!checkLog || !checkLog.isVacation) {
                hasVacationCover = false;
                break;
            }
        }
        
        if (hasVacationCover) {
            // Covered by vacation days, increment streak or maintain it
            userProfile.streak += 1;
            userProfile.lastActiveDate = todayStr;
        } else {
            // Streak broken
            userProfile.streak = 1;
            userProfile.lastActiveDate = todayStr;
        }
    }
    saveProfile();
}

function isLessonCompleted(lessonId) {
    // Check if study-step 8 is completed in user logs/logs
    // We can store checklist progress in localStorage ylta_steps_completed
    const stepsRaw = localStorage.getItem("ylta_steps_" + lessonId);
    if (stepsRaw) {
        const steps = JSON.parse(stepsRaw);
        return steps.includes(8) || steps.includes("8");
    }
    return false;
}

// ==========================================================================
// 4. ACTIVE READER & PLAYER LOGIC
// ==========================================================================
function setupActiveReader() {
    const backBtn = document.getElementById("reader-btn-back");
    backBtn.addEventListener("click", () => {
        navigateToScreen("screen-dashboard");
    });
    
    // Local MP3 File Input Loader
    const audioInput = document.getElementById("audio-file-input");
    const audioElem = document.getElementById("main-audio-element");
    const mp3NameDisplay = document.getElementById("mp3-file-name");
    const sourceStatus = document.getElementById("audio-source-status");
    
    audioInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            currentAudioFile = URL.createObjectURL(file);
            audioElem.src = currentAudioFile;
            
            // Stop speech synthesis if playing
            window.speechSynthesis.cancel();
            isPlaying = false;
            updatePlayIcon();
            
            mp3NameDisplay.innerText = `Nạp thành công: ${file.name}`;
            mp3NameDisplay.classList.remove("hidden");
            sourceStatus.innerText = "File MP3 Cục Bộ 🎵";
            sourceStatus.style.color = "var(--sky)";
        }
    });
    
    // TTS option select
    const btnTts = document.getElementById("btn-use-tts");
    btnTts.addEventListener("click", () => {
        currentAudioFile = null;
        audioElem.src = "";
        mp3NameDisplay.innerText = "Sử dụng giọng AI Trình duyệt";
        mp3NameDisplay.classList.add("hidden");
        sourceStatus.innerText = "AI TTS Trình Duyệt 🔊";
        sourceStatus.style.color = "var(--emerald)";
    });
    
    // Play/Pause button
    const playBtn = document.getElementById("player-btn-play");
    playBtn.addEventListener("click", () => {
        togglePlayback();
    });
    
    // Slider seeker
    const seekSlider = document.getElementById("player-seek-slider");
    audioElem.addEventListener("timeupdate", () => {
        if (audioElem.duration) {
            const currentPercent = (audioElem.currentTime / audioElem.duration) * 100;
            seekSlider.value = currentPercent;
            document.getElementById("player-time-current").innerText = formatAudioTime(audioElem.currentTime);
        }
    });
    audioElem.addEventListener("loadedmetadata", () => {
        document.getElementById("player-time-duration").innerText = formatAudioTime(audioElem.duration);
    });
    seekSlider.addEventListener("input", (e) => {
        if (audioElem.duration) {
            const time = (e.target.value / 100) * audioElem.duration;
            audioElem.currentTime = time;
        }
    });
    
    // Speed Selector
    const speedSelect = document.getElementById("player-speed-select");
    speedSelect.addEventListener("change", (e) => {
        playbackRate = parseFloat(e.target.value);
        audioElem.playbackRate = playbackRate;
        
        // If TTS is playing, adjust rate
        if (window.speechSynthesis.speaking) {
            // Restart TTS with new rate
            const sentenceText = sentencesArray[activeSentenceIdx];
            speakSentence(sentenceText);
        }
    });
    
    // Shadowing mode toggle
    const shadowCheckbox = document.getElementById("shadow-loop-checkbox");
    shadowCheckbox.addEventListener("change", (e) => {
        shadowingMode = e.target.checked;
    });
    
    // Loop audio segment natively if shadowing mode and audio file is playing
    audioElem.addEventListener("ended", () => {
        isPlaying = false;
        updatePlayIcon();
    });

    // Tooltip close on outside click
    document.addEventListener("click", (e) => {
        const tooltip = document.getElementById("reader-tooltip");
        const isClickInsideWord = e.target.classList.contains("reader-word");
        const isClickInsideTooltip = tooltip.contains(e.target);
        
        if (!isClickInsideWord && !isClickInsideTooltip) {
            tooltip.classList.add("hidden");
            // Remove highlighting
            const activeWords = document.querySelectorAll(".active-word");
            activeWords.forEach(w => w.classList.remove("active-word"));
        }
    });
    
    // Tooltip save word button
    const btnSaveVocab = document.getElementById("tooltip-btn-save");
    btnSaveVocab.addEventListener("click", () => {
        const word = btnSaveVocab.getAttribute("data-word");
        const def = btnSaveVocab.getAttribute("data-def");
        const context = btnSaveVocab.getAttribute("data-context");
        
        saveWordToSrs(word, def, context);
        alert(`Đã lưu từ "${word}" vào Thẻ từ vựng ôn tập!`);
        document.getElementById("reader-tooltip").classList.add("hidden");
    });
    
    // Tooltip TTS pronounce button
    const pronBtn = document.getElementById("tooltip-word-pron");
    pronBtn.addEventListener("click", () => {
        const word = pronBtn.getAttribute("data-word");
        speakWordTTS(word);
    });
    
    // Study Steps Checkbox Listeners
    const stepsCheckboxes = document.querySelectorAll('input[name="study-step"]');
    stepsCheckboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            saveChecklistProgress();
        });
    });
    
    // Save Step 7 submission URL
    const btnSaveStep7 = document.getElementById("btn-save-step7");
    btnSaveStep7.addEventListener("click", () => {
        const urlInput = document.getElementById("step-7-url").value.trim();
        if (urlInput) {
            saveStep7Submission(urlInput);
            alert("Đã ghi nhận link nộp bài video của anh!");
        }
    });
}

function openReader(lesson) {
    currentLesson = lesson;
    
    // Mark lesson read in logs
    logStudyMinutes(1, 0); // Log at least 1 min for viewing the lesson
    const todayStr = getTodayDateString();
    let todayLog = activityLogs.find(l => l.date === todayStr);
    if (todayLog && !todayLog.lessonsRead.includes(lesson.id)) {
        todayLog.lessonsRead.push(lesson.id);
        saveLogs();
    }
    
    // Navigate screen
    navigateToScreen("screen-reader");
    
    // Render Title & Category
    document.getElementById("reader-lesson-title").innerText = lesson.title;
    document.getElementById("reader-lesson-category").innerText = 
        lesson.category === 'ministory' ? 'Mini Story' : 
        lesson.category === 'level1' ? 'Effortless Level 1' : 'Reading Bookworm';
        
    // Reset player state
    pausePlayback();
    document.getElementById("main-audio-element").src = lesson.audioUrl || "";
    document.getElementById("mp3-file-name").classList.add("hidden");
    document.getElementById("audio-source-status").innerText = lesson.audioUrl ? "Audio Online 🌐" : "Trình phát sẵn sàng (TTS)";
    document.getElementById("audio-source-status").style.color = lesson.audioUrl ? "var(--sky)" : "var(--emerald)";
    currentAudioFile = lesson.audioUrl || null;
    
    // Tokenize English text to reader
    renderTokenizedText(lesson.content, lesson.dictionary);
    
    // Render Q&A section if present (For Mini Stories)
    const qaCard = document.getElementById("reader-qa-card");
    const qaList = document.getElementById("reader-qa-list");
    qaList.innerHTML = "";
    
    if (lesson.questions && lesson.questions.length > 0) {
        qaCard.classList.remove("hidden");
        lesson.questions.forEach((qObj, index) => {
            const row = document.createElement("div");
            row.className = "qa-row animate-fade-in";
            row.innerHTML = `
                <div class="qa-question-line">
                    <button class="qa-play-btn" title="Phát âm câu hỏi">🔊</button>
                    <span class="qa-question-text">${qObj.q}</span>
                    <button class="qa-toggle-btn" data-target="qa-ans-${index}">Lật xem đáp án 💡</button>
                </div>
                <div class="qa-answer-box hidden" id="qa-ans-${index}">${qObj.a}</div>
            `;
            
            // Listen for play TTS question
            row.querySelector(".qa-play-btn").addEventListener("click", () => {
                speakWordTTS(qObj.q);
            });
            
            // Listen for answer show toggle
            row.querySelector(".qa-toggle-btn").addEventListener("click", (e) => {
                const ansBox = row.querySelector(".qa-answer-box");
                if (ansBox.classList.contains("hidden")) {
                    ansBox.classList.remove("hidden");
                    e.target.innerText = "Ẩn đáp án ✕";
                } else {
                    ansBox.classList.add("hidden");
                    e.target.innerText = "Lật xem đáp án 💡";
                }
            });
            
            qaList.appendChild(row);
        });
    } else {
        qaCard.classList.add("hidden");
    }
    
    // Load lesson checklist progress
    loadChecklistProgress(lesson.id);
}

function renderTokenizedText(content, dictionary) {
    const root = document.getElementById("reader-text-root");
    root.innerHTML = "";
    
    // Prepare sentences array for TTS sentence-by-sentence reading
    sentencesArray = content.match(/[^.!?]+[.!?]+/g) || [content];
    activeSentenceIdx = -1;
    
    // Tokenize text into words with spans
    const paragraphs = content.split('\n');
    paragraphs.forEach(para => {
        if (!para.trim()) return;
        
        const paraEl = document.createElement("p");
        paraEl.style.marginBottom = "15px";
        
        // Regex to split by spaces but preserve words vs punctuation
        const tokens = para.match(/([a-zA-Z0-9'-]+|[^a-zA-Z0-9'\s]+)/g);
        
        if (tokens) {
            tokens.forEach(token => {
                // If it is a word, create clickable span
                if (/^[a-zA-Z0-9'-]+$/.test(token)) {
                    const span = document.createElement("span");
                    span.className = "reader-word";
                    span.innerText = token;
                    
                    // Bind click event
                    span.addEventListener("click", (e) => {
                        e.stopPropagation();
                        // Reset all previous highlights
                        document.querySelectorAll(".active-word").forEach(w => w.classList.remove("active-word"));
                        span.classList.add("active-word");
                        
                        showWordTooltip(span, token, dictionary, content);
                    });
                    
                    paraEl.appendChild(span);
                    // Add space after word
                    paraEl.appendChild(document.createTextNode(" "));
                } else {
                    // Punctuation
                    const punct = document.createElement("span");
                    punct.className = "reader-punctuation";
                    punct.innerText = token;
                    paraEl.appendChild(punct);
                }
            });
        }
        root.appendChild(paraEl);
    });
}

function showWordTooltip(spanEl, word, dictionary, content) {
    const tooltip = document.getElementById("reader-tooltip");
    
    // Clean word for dictionary lookup
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9'-]/g, '');
    
    // Try to find definition in lesson's dictionary
    let def = dictionary[cleanWord] || dictionary[word];
    
    // If not found, try simple automatic dictionary fallback or look up in other lessons
    if (!def) {
        // Let's search all lessons dictionaries
        for (let l of lessonsList) {
            if (l.dictionary && l.dictionary[cleanWord]) {
                def = l.dictionary[cleanWord];
                break;
            }
        }
    }
    
    if (!def) {
        def = "Chưa có nghĩa mẫu. Bấm để tự tra cứu.";
    }
    
    // Try to find the sentence context containing the word
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
    let contextStr = "...";
    for (let s of sentences) {
        if (s.toLowerCase().includes(word.toLowerCase())) {
            contextStr = s.trim();
            break;
        }
    }
    
    // Set Tooltip texts
    document.getElementById("tooltip-word-title").innerText = word;
    document.getElementById("tooltip-word-def").innerText = def;
    
    // Bind attributes to the save button
    const saveBtn = document.getElementById("tooltip-btn-save");
    saveBtn.setAttribute("data-word", word);
    saveBtn.setAttribute("data-def", def);
    saveBtn.setAttribute("data-context", contextStr);
    
    // Bind pronounce button
    const pronBtn = document.getElementById("tooltip-word-pron");
    pronBtn.setAttribute("data-word", word);
    
    // Position Tooltip above word
    tooltip.classList.remove("hidden");
    const rect = spanEl.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Position absolute center top
    tooltip.style.left = (rect.left + scrollLeft + (rect.width / 2) - 90) + "px";
    tooltip.style.top = (rect.top + scrollTop - tooltip.offsetHeight - 12) + "px";
}

// Playback Logic
function togglePlayback() {
    const audioElem = document.getElementById("main-audio-element");
    
    if (isPlaying) {
        pausePlayback();
    } else {
        // Check if there is an audio file to play
        if (currentAudioFile || audioElem.src) {
            audioElem.play();
            isPlaying = true;
            updatePlayIcon();
        } else {
            // Use Web Speech API (TTS) sentence-by-sentence as fallback
            playTtsCurriculum();
        }
    }
}

function pausePlayback() {
    const audioElem = document.getElementById("main-audio-element");
    audioElem.pause();
    window.speechSynthesis.cancel();
    isPlaying = false;
    updatePlayIcon();
}

function updatePlayIcon() {
    const playIcon = document.getElementById("play-icon");
    const pauseIcon = document.getElementById("pause-icon");
    
    if (isPlaying) {
        playIcon.classList.add("hidden");
        pauseIcon.classList.remove("hidden");
    } else {
        playIcon.classList.remove("hidden");
        pauseIcon.classList.add("hidden");
    }
}

function formatAudioTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Text-to-speech engine to speak sentence-by-sentence with highlighting
 */
function playTtsCurriculum() {
    if (sentencesArray.length === 0) return;
    
    isPlaying = true;
    updatePlayIcon();
    
    if (activeSentenceIdx === -1 || activeSentenceIdx >= sentencesArray.length) {
        activeSentenceIdx = 0;
    }
    
    speakNextTtsSentence();
}

function speakNextTtsSentence() {
    if (!isPlaying || activeSentenceIdx >= sentencesArray.length) {
        isPlaying = false;
        updatePlayIcon();
        activeSentenceIdx = -1;
        return;
    }
    
    const sentenceText = sentencesArray[activeSentenceIdx];
    
    // Highlight the sentence visually in reader text (optional)
    console.log(`TTS speaking sentence [${activeSentenceIdx}]: "${sentenceText}"`);
    
    speakSentence(sentenceText, () => {
        // Finished callback
        if (shadowingMode) {
            // Loop same sentence in shadowing mode
            console.log(`Shadowing Loop: Repeating sentence.`);
            setTimeout(() => {
                speakNextTtsSentence();
            }, 1000);
        } else {
            // Next sentence
            activeSentenceIdx++;
            speakNextTtsSentence();
        }
    });
}

function speakSentence(text, onEndCallback) {
    window.speechSynthesis.cancel(); // clear previous
    
    ttsUtterance = new SpeechSynthesisUtterance(text);
    ttsUtterance.lang = 'en-US';
    ttsUtterance.rate = playbackRate;
    
    // Find a good US english voice if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.includes('en-US') && v.name.includes('Google'));
    if (enVoice) ttsUtterance.voice = enVoice;
    
    ttsUtterance.onend = () => {
        if (onEndCallback) onEndCallback();
    };
    
    ttsUtterance.onerror = (e) => {
        console.error("TTS error:", e);
        if (onEndCallback) onEndCallback();
    };
    
    window.speechSynthesis.speak(ttsUtterance);
}

function speakWordTTS(word) {
    const utt = new SpeechSynthesisUtterance(word);
    utt.lang = 'en-US';
    utt.rate = 0.8; // slightly slower for word lookup
    window.speechSynthesis.speak(utt);
}

// Checklist progress functions
function loadChecklistProgress(lessonId) {
    const key = "ylta_steps_" + lessonId;
    const completedStr = localStorage.getItem(key);
    let completedSteps = [];
    
    if (completedStr) {
        try {
            completedSteps = JSON.parse(completedStr);
        } catch (e) {
            completedSteps = [];
        }
    }
    
    // Update DOM inputs
    const checkboxes = document.querySelectorAll('input[name="study-step"]');
    checkboxes.forEach(cb => {
        const stepVal = parseInt(cb.value, 10);
        cb.checked = completedSteps.includes(stepVal);
        
        // Add styling class to row parent LI
        const li = cb.closest("li");
        if (cb.checked) {
            li.classList.add("completed-step");
        } else {
            li.classList.remove("completed-step");
        }
    });
    
    // Show/Hide Step 7 url box
    const step7Box = document.getElementById("step-7-url-box");
    const step7Checked = completedSteps.includes(7);
    if (step7Checked) {
        step7Box.classList.remove("hidden");
        // Load link nộp bài
        const logsToday = activityLogs.find(l => l.date === getTodayDateString());
        document.getElementById("step-7-url").value = (logsToday && logsToday.videoUrl) ? logsToday.videoUrl : "";
    } else {
        step7Box.classList.add("hidden");
    }
}

function saveChecklistProgress() {
    if (!currentLesson) return;
    
    const checkboxes = document.querySelectorAll('input[name="study-step"]');
    const completedSteps = [];
    
    checkboxes.forEach(cb => {
        const stepVal = parseInt(cb.value, 10);
        const li = cb.closest("li");
        
        if (cb.checked) {
            completedSteps.push(stepVal);
            li.classList.add("completed-step");
        } else {
            li.classList.remove("completed-step");
        }
    });
    
    // Save to LocalStorage
    localStorage.setItem("ylta_steps_" + currentLesson.id, JSON.stringify(completedSteps));
    
    // Show/Hide step 7 submission box
    const step7Box = document.getElementById("step-7-url-box");
    if (completedSteps.includes(7)) {
        step7Box.classList.remove("hidden");
    } else {
        step7Box.classList.add("hidden");
    }
    
    // Redraw dashboard indicators
    renderDashboard();
}

function saveStep7Submission(url) {
    const todayStr = getTodayDateString();
    let log = activityLogs.find(l => l.date === todayStr);
    
    if (!log) {
        log = {
            date: todayStr,
            activeMinutes: 0,
            passiveMinutes: 0,
            lessonsRead: [],
            isVacation: false
        };
        activityLogs.push(log);
    }
    
    log.videoUrl = url;
    saveLogs();
}

// ==========================================================================
// 5. VOCABULARY SRS LOGIC
// ==========================================================================
function setupSrsFlashcards() {
    const cardEl = document.getElementById("flashcard-card-element");
    cardEl.addEventListener("click", () => {
        const container = document.querySelector(".flashcard-container");
        container.classList.toggle("flipped");
    });
    
    // Audio trigger button in flashcard
    const audioBtn = document.getElementById("flashcard-audio-btn");
    audioBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // don't flip card on clicking play
        if (currentSrsCard) {
            speakWordTTS(currentSrsCard.word);
        }
    });
    
    // SRS Buttons: Forgot & Remember
    const btnForgot = document.getElementById("srs-btn-forgot");
    btnForgot.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSrsRecall(false);
    });
    
    const btnRemember = document.getElementById("srs-btn-remember");
    btnRemember.addEventListener("click", (e) => {
        e.stopPropagation();
        handleSrsRecall(true);
    });
}

function saveWordToSrs(word, definition, context) {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9'-]/g, '');
    
    // Check if word already exists in vocabList
    const exists = vocabList.some(v => v.word.toLowerCase() === cleanWord);
    if (exists) return;
    
    const newVocab = {
        id: "vocab-" + Date.now(),
        word: word,
        definition: definition,
        context: context || "...",
        lessonId: currentLesson ? currentLesson.id : "custom",
        box: 1,
        nextReviewDate: Date.now(), // Ready to review immediately
        created_at: Date.now()
    };
    
    vocabList.push(newVocab);
    saveVocab();
    updateVocabMenuBadge();
}

function updateVocabMenuBadge() {
    const badge = document.getElementById("vocab-review-badge");
    const count = getActiveReviewCount();
    
    if (count > 0) {
        badge.innerText = count;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function getActiveReviewCount() {
    const now = Date.now();
    return vocabList.filter(v => v.nextReviewDate <= now).length;
}

function renderSrsFlashcards() {
    // 1. Box stats
    const box1Count = vocabList.filter(v => v.box === 1).length;
    const box2Count = vocabList.filter(v => v.box === 2).length;
    const box3Count = vocabList.filter(v => v.box === 3).length;
    
    document.getElementById("srs-count-box1").innerText = box1Count;
    document.getElementById("srs-count-box2").innerText = box2Count;
    document.getElementById("srs-count-box3").innerText = box3Count;
    
    // 2. Fetch cards due for review
    const now = Date.now();
    const dueCards = vocabList.filter(v => v.nextReviewDate <= now);
    
    const container = document.querySelector(".flashcard-container");
    const cardWrapper = document.getElementById("flashcard-card-element");
    const emptyEl = document.getElementById("flashcard-empty-element");
    
    container.classList.remove("flipped"); // ensure front is facing
    
    if (dueCards.length > 0) {
        // Pick first card
        currentSrsCard = dueCards[0];
        cardWrapper.classList.remove("hidden");
        emptyEl.classList.add("hidden");
        
        // Set card texts
        document.getElementById("flashcard-word").innerText = currentSrsCard.word;
        document.getElementById("flashcard-definition").innerText = currentSrsCard.definition;
        
        // Set context (hide the word inside context sentence)
        const escapedWord = currentSrsCard.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        const blankedContext = currentSrsCard.context.replace(regex, "____");
        document.getElementById("flashcard-context").innerText = blankedContext;
        
    } else {
        currentSrsCard = null;
        cardWrapper.classList.add("hidden");
        emptyEl.classList.remove("hidden");
    }
}

function handleSrsRecall(remembered) {
    if (!currentSrsCard) return;
    
    const item = vocabList.find(v => v.id === currentSrsCard.id);
    if (!item) return;
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (remembered) {
        // Move up Leitner Box
        if (item.box === 1) {
            item.box = 2;
            item.nextReviewDate = now + 3 * oneDay; // Box 2 review in 3 days
        } else if (item.box === 2) {
            item.box = 3;
            item.nextReviewDate = now + 7 * oneDay; // Box 3 review in 7 days
        } else if (item.box === 3) {
            item.nextReviewDate = now + 14 * oneDay; // Box 3 repetition in 14 days
        }
    } else {
        // Forgot, drop back to Box 1
        item.box = 1;
        item.nextReviewDate = now + oneDay; // Review tomorrow
    }
    
    saveVocab();
    updateVocabMenuBadge();
    
    // Animate transition and load next card
    const container = document.querySelector(".flashcard-container");
    container.classList.remove("flipped");
    
    // Wait for flip animation to complete before loading next card
    setTimeout(() => {
        renderSrsFlashcards();
    }, 300);
}

// ==========================================================================
// 6. IMPORTER LOGIC
// ==========================================================================
function setupImporter() {
    const importForm = document.getElementById("import-lesson-form");
    importForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const title = document.getElementById("import-title").value.trim();
        const category = document.getElementById("import-category").value;
        const content = document.getElementById("import-content").value.trim();
        const audioUrl = document.getElementById("import-audio-url").value.trim();
        const rawDict = document.getElementById("import-dictionary").value.trim();
        
        // Parse custom dictionary format `word: definition`
        const dict = {};
        if (rawDict) {
            const lines = rawDict.split('\n');
            lines.forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase();
                    const val = parts.slice(1).join(':').trim();
                    dict[key] = val;
                }
            });
        }
        
        const newLesson = {
            id: "custom-" + Date.now(),
            day: lessonsList.filter(l => l.category === category).length + 1,
            title: title,
            category: category,
            audioUrl: audioUrl,
            content: content,
            dictionary: dict,
            questions: [] // Custom uploads don't pre-have questions
        };
        
        lessonsList.push(newLesson);
        saveLessons();
        
        importForm.reset();
        alert("Đã thêm bài học tiếng Anh mới thành công!");
        
        // Switch to Dashboard
        navigateToScreen("screen-dashboard");
    });
}

// ==========================================================================
// 7. SETTINGS, VACATION AND BACKUP LOGIC
// ==========================================================================
function setupSettingsAndBackup() {
    // Profile save
    const profileForm = document.getElementById("settings-profile-form");
    profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameVal = document.getElementById("settings-name").value.trim();
        const goalVal = parseInt(document.getElementById("settings-goal").value, 10) || 30;
        
        userProfile.name = nameVal;
        userProfile.dailyGoalMinutes = goalVal;
        saveProfile();
        
        alert("Cấu hình cá nhân đã lưu thành công!");
        renderDashboard();
    });
    
    // Use Vacation Day button
    const btnVacation = document.getElementById("btn-use-vacation");
    btnVacation.addEventListener("click", () => {
        if (userProfile.vacationDaysLeft <= 0) {
            alert("Anh đã dùng hết sạch số ngày phép nghỉ học của tháng này rồi!");
            return;
        }
        
        const confirmVacation = confirm("Anh có chắc muốn xin nghỉ học hôm nay không? Hệ thống sẽ ghi nhận lịch nghỉ phép để giữ nguyên Streak lửa của anh và không bị nộp phạt.");
        if (confirmVacation) {
            const todayStr = getTodayDateString();
            
            // Deduct days left
            userProfile.vacationDaysLeft--;
            saveProfile();
            
            // Create a vacation log for today
            let log = activityLogs.find(l => l.date === todayStr);
            if (!log) {
                log = {
                    date: todayStr,
                    activeMinutes: 0,
                    passiveMinutes: 0,
                    lessonsRead: [],
                    isVacation: true
                };
                activityLogs.push(log);
            } else {
                log.isVacation = true;
            }
            saveLogs();
            
            alert(`Đăng ký nghỉ phép thành công! Anh còn lại ${userProfile.vacationDaysLeft} ngày nghỉ phép.`);
            renderSettings();
            renderDashboard();
        }
    });
    
    // Backup export download file
    const btnExport = document.getElementById("btn-export-data");
    btnExport.addEventListener("click", () => {
        const backupData = {
            profile: userProfile,
            lessons: lessonsList,
            vocab: vocabList,
            logs: activityLogs,
            stepsKeys: {}
        };
        
        // Grab lesson checklist keys ylta_steps_
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith("ylta_steps_")) {
                backupData.stepsKeys[key] = localStorage.getItem(key);
            }
        }
        
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `yeu_lai_tieng_anh_v2_backup_${getTodayDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    // Backup import upload file
    const importInput = document.getElementById("import-data-file");
    importInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Validate parsed JSON data keys
                if (!data.profile || !data.lessons || !data.vocab || !data.logs) {
                    throw new Error("File sao lưu không hợp lệ, thiếu các khóa dữ liệu chính.");
                }
                
                const restoreConfirm = confirm("Xác nhận khôi phục dữ liệu? Hành động này sẽ thay thế toàn bộ tiến độ, streak và từ vựng hiện tại của anh trên trình duyệt này bằng dữ liệu file sao lưu.");
                if (restoreConfirm) {
                    // Save to local vars
                    userProfile = data.profile;
                    lessonsList = data.lessons;
                    vocabList = data.vocab;
                    activityLogs = data.logs;
                    
                    // Save back to LocalStorage
                    localStorage.setItem("ylta_profile", JSON.stringify(userProfile));
                    localStorage.setItem("ylta_lessons", JSON.stringify(lessonsList));
                    localStorage.setItem("ylta_vocab", JSON.stringify(vocabList));
                    localStorage.setItem("ylta_logs", JSON.stringify(activityLogs));
                    
                    // Restore checklist steps
                    if (data.stepsKeys) {
                        Object.entries(data.stepsKeys).forEach(([key, val]) => {
                            localStorage.setItem(key, val);
                        });
                    }
                    
                    alert("Khôi phục thành công! Trang web sẽ tải lại tự động.");
                    window.location.reload();
                }
            } catch (err) {
                alert("Lỗi khi đọc file sao lưu: " + err.message);
                console.error(err);
            }
        };
        reader.readAsText(file);
    });
}

function renderSettings() {
    document.getElementById("settings-name").value = userProfile.name;
    document.getElementById("settings-goal").value = userProfile.dailyGoalMinutes;
    document.getElementById("settings-vacation-days").innerText = userProfile.vacationDaysLeft;
}

// ==========================================================================
// 8. DATE AND TIME HELPER FUNCTIONS
// ==========================================================================
function getTodayDateString() {
    const d = new Date();
    return formatDateString(d);
}

function formatDateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
