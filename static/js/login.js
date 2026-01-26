// login.js

// ============================================
// CLOCK UPDATE
// ============================================
function updateClock() {
    const now = new Date();
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const dateText = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
    const h = now.getHours(), m = now.getMinutes();
    const timeText = `${h}:${m<10?'0':''}${m}`;
    document.getElementById("dateDisplay").textContent = dateText;
    document.getElementById("timeDisplay").textContent = timeText;
    document.getElementById("dateDisplay2").textContent = dateText;
    document.getElementById("timeDisplay2").textContent = timeText;
}
setInterval(updateClock, 1000);
updateClock();

// ============================================
// STORAGE KEYS & SESSION MANAGEMENT
// ============================================
const TIMERKEY = "loginTimerEnd";
const CODEKEY = "sessionCode";
const FLASHKEY = "hasFlashed";
const FAILED_FLAG = "cameFromFailed";

window.addEventListener('pageshow', function(event) {
    if (event.persisted || sessionStorage.getItem(FAILED_FLAG) === "true") {
        localStorage.removeItem(TIMERKEY);
        localStorage.removeItem(CODEKEY);
        localStorage.removeItem(FLASHKEY);
        sessionStorage.removeItem(FAILED_FLAG);
        location.reload();
    }
});

let timerInterval;
let hasFlashed = localStorage.getItem(FLASHKEY) === "true";

// ============================================
// FETCH CHALLENGE CODE FROM BACKEND
// ============================================
async function fetchChallengeCode() {
    let code = localStorage.getItem(CODEKEY);

    if (!code) {
        try {
            const response = await fetch("/api/get-challenge");
            const data = await response.json();
            code = data.code;
            localStorage.setItem(CODEKEY, code);
        } catch (error) {
            console.error("Failed to fetch code:", error);
            code = "SAMIPRY";
        }
    }

    return code;
}

// ============================================
// TIMER MANAGEMENT (60 SECONDS)
// ============================================
function startTimer() {
    let endTime = localStorage.getItem(TIMERKEY);

    if (!endTime) {
        endTime = Date.now() + 60000;
        localStorage.setItem(TIMERKEY, endTime);
    } else {
        endTime = parseInt(endTime);
    }

    function updateTimer() {
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        document.getElementById("timerAdmin").textContent = `${remaining}s`;
        document.getElementById("timerGuest").textContent = `${remaining}s remaining`;

        if (remaining <= 0) {
            clearInterval(timerInterval);
            localStorage.removeItem(TIMERKEY);
            localStorage.removeItem(CODEKEY);
            localStorage.removeItem(FLASHKEY);
            sessionStorage.setItem(FAILED_FLAG, "true");
            window.location.href = "/failed-login";
        }
    }

    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

startTimer();

// ============================================
// PASSWORD BOXES CREATION
// ============================================
function createInputBoxes() {
    const container = document.getElementById("passwordBoxes");
    container.innerHTML = "";

    for (let i = 0; i < 8; i++) {
        const box = document.createElement("input");
        box.className = "pass-box";
        box.type = "text";
        box.maxLength = "1";
        box.readOnly = true;
        container.appendChild(box);
    }
}

createInputBoxes();

// ============================================
// SCREEN NAVIGATION
// ============================================
function showAdmin() {
    document.getElementById("screen-landing").classList.add("hidden");
    document.getElementById("screen-admin").classList.add("active");
    document.getElementById("adminPass").focus();
}

async function showGuest() {
    document.getElementById("centerContainer").classList.add("hidden");
    document.getElementById("guestContainer").classList.add("active");

    if (!hasFlashed) {
        await initializeFlashPhase();
    } else {
        enablePhysicalKeyboard();
    }
}

function goBack() {
    document.getElementById("screen-admin").classList.remove("active");
    document.getElementById("guestContainer").classList.remove("active");
    document.getElementById("screen-landing").classList.remove("hidden");
    document.getElementById("centerContainer").classList.remove("hidden");

    userInput = [];
    createInputBoxes();
    disablePhysicalKeyboard();
}

// ============================================
// GUEST PASSWORD INPUT LOGIC
// ============================================
let userInput = [];
let secretCode = "";
let maskTimeouts = [];

// FLASH: Show ABCDE_FG (normal order, 6th empty)
async function initializeFlashPhase() {
    secretCode = await fetchChallengeCode(); // e.g., "ABCDEFG"
    const boxes = document.querySelectorAll(".pass-box");
    const keyboard = document.getElementById("hologram-keyboard");
    const timerDisplay = document.getElementById("timerGuest");

    keyboard.classList.add("locked");
    disablePhysicalKeyboard();
    document.body.style.cursor = "wait";

    // Flash: A B C D E _ F G (boxes 0-4, skip 5, then 6-7)
    let codeIndex = 0;
    for (let i = 0; i < 8; i++) {
        if (i !== 5) {
            boxes[i].value = secretCode[codeIndex];
            codeIndex++;
        }
    }
    boxes[5].value = "";

    let flashCountdown = 3;
    timerDisplay.textContent = `Flash: ${flashCountdown}s`;

    const flashInterval = setInterval(() => {
        flashCountdown--;
        if (flashCountdown > 0) {
            timerDisplay.textContent = `Flash: ${flashCountdown}s`;
        } else {
            clearInterval(flashInterval);

            createInputBoxes();
            keyboard.classList.remove("locked");
            enablePhysicalKeyboard();
            document.body.style.cursor = "default";

            hasFlashed = true;
            localStorage.setItem(FLASHKEY, "true");

            const endTime = parseInt(localStorage.getItem(TIMERKEY));
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            timerDisplay.textContent = `${remaining}s remaining`;

            console.log("✅ Type REVERSED! Format: GFEDC.BA");
        }
    }, 1000);
}

// TYPING: User must type GFEDC.BA (REVERSED with dot at position 6)
function typeKey(char) {
    const boxes = document.querySelectorAll(".pass-box");
    const currentPos = userInput.length;

    if (currentPos >= 8) return;

    // REVERSE VALIDATION LOGIC
    if (currentPos === 5) {
        // 6th position MUST be dot
        if (char !== ".") {
            sessionStorage.setItem(FAILED_FLAG, "true");
            window.location.href = "/failed-login";
            return;
        }
    } else {
        // Reverse index mapping
        let secretIndex;
        if (currentPos < 5) {
            secretIndex = 6 - currentPos;
        } else {
            secretIndex = 7 - currentPos;
        }

        if (char !== secretCode[secretIndex]) {
            sessionStorage.setItem(FAILED_FLAG, "true");
            window.location.href = "/failed-login";
            return;
        }
    }

    // Character is correct
    userInput.push(char);
    boxes[currentPos].value = char;

    if (maskTimeouts[currentPos]) {
        clearTimeout(maskTimeouts[currentPos]);
    }

    maskTimeouts[currentPos] = setTimeout(() => {
        boxes[currentPos].value = "●";
    }, 1000);

    if (userInput.length === 8) {
        localStorage.removeItem(TIMERKEY);
        localStorage.removeItem(CODEKEY);
        localStorage.removeItem(FLASHKEY);
        window.location.href = "/processing";
    }
}

function backspace() {
    if (userInput.length === 0) return;

    const boxes = document.querySelectorAll(".pass-box");
    const currentPos = userInput.length - 1;

    if (maskTimeouts[currentPos]) {
        clearTimeout(maskTimeouts[currentPos]);
        maskTimeouts[currentPos] = null;
    }

    userInput.pop();
    boxes[currentPos].value = "";
}

// ============================================
// PHYSICAL KEYBOARD SUPPORT
// ============================================
function handlePhysicalKey(e) {
    const key = e.key.toLowerCase();
    const virtualKey = document.querySelector(`#hologram-keyboard .holo-key[data-key="${key}"]`);

    if (virtualKey) {
        virtualKey.classList.add("pulse");
        setTimeout(() => virtualKey.classList.remove("pulse"), 200);
    }

    if (key === "backspace") {
        e.preventDefault();
        backspace();
    } else if (key === "enter") {
        e.preventDefault();
        submitGuest();
    } else if (key === ".") {
        e.preventDefault();
        typeKey(".");
    } else if (key === "-" || key === " ") {
        e.preventDefault();
        typeKey(key);
    } else if (/[0-9]/.test(key)) {
        e.preventDefault();
        typeKey(key);
    } else if (/[a-z]/i.test(key)) {
        e.preventDefault();
        typeKey(key.toUpperCase());
    }
}

let physicalKeyboardEnabled = false;

function enablePhysicalKeyboard() {
    if (!physicalKeyboardEnabled) {
        window.addEventListener("keydown", handlePhysicalKey);
        physicalKeyboardEnabled = true;
    }
}

function disablePhysicalKeyboard() {
    window.removeEventListener("keydown", handlePhysicalKey);
    physicalKeyboardEnabled = false;
}

function submitGuest() {
    console.log("Auto-validates per character");
}

// ============================================
// ADMIN LOGIN
// ============================================
async function loginAdmin(e) {
    e.preventDefault();
    const pass = document.getElementById("adminPass").value;

    const form = new FormData();
    form.append("password", pass);

    try {
        const r = await fetch("/login-admin", {
            method: "POST",
            body: form
        });

        if (r.redirected) {
            localStorage.removeItem(TIMERKEY);
            localStorage.removeItem(CODEKEY);
            localStorage.removeItem(FLASHKEY);
            window.location.href = r.url;
        }
    } catch (error) {
        console.log("Login error:", error);
    }
}
