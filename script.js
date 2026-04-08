// ===== XP Startup Sound =====
const startupAudio = new Audio('assets/startup-sound.mp3');
startupAudio.volume = 0.7;

function playStartupSound() {
  startupAudio.currentTime = 0;
  startupAudio.play().catch(() => {});
}

// ===== Boot Sequence =====
// Real XP: Boot screen (logo + loading blocks) → Welcome screen (sound plays) → Desktop
let booted = false;

function startBoot() {
  if (booted) return;
  booted = true;

  const bootScreen = document.getElementById('boot-screen');
  const loader = document.getElementById('boot-loader');
  const tapText = document.getElementById('boot-tap');

  bootScreen.classList.add('booting');
  tapText.classList.add('hide');
  loader.classList.add('active');

  // Phase 1: Boot screen with loading blocks for ~3s, then transition to Welcome
  setTimeout(() => showWelcomeScreen(), 3000);
}

function showWelcomeScreen() {
  const bootScreen = document.getElementById('boot-screen');
  const welcomeScreen = document.getElementById('welcome-screen');

  // Hide boot screen, show welcome
  bootScreen.style.display = 'none';
  welcomeScreen.classList.remove('hidden');

  // Play the actual XP startup sound on the Welcome screen
  playStartupSound();

  // Welcome screen stays for the duration of the startup sound (~4s), then desktop
  setTimeout(() => finishBoot(), 4200);
}

function finishBoot() {
  const welcomeScreen = document.getElementById('welcome-screen');
  const desktopLayer = document.getElementById('desktop-layer');

  welcomeScreen.classList.add('fade-out');
  setTimeout(() => {
    welcomeScreen.style.display = 'none';
    desktopLayer.classList.remove('hidden');
    initWindows();
    openWindow('main-window');
  }, 600);
}

// ===== Desktop Icon Selection & Opening =====
// On mobile: single tap selects, second tap opens (since dblclick doesn't work)
// On desktop: single click selects, double-click opens
let lastTappedIcon = null;
let lastTapTime = 0;

document.addEventListener('click', (e) => {
  const icon = e.target.closest('.desktop-icon');

  // Clicked outside icons — deselect all
  if (!icon) {
    if (e.target.closest('.desktop-layer') && !e.target.closest('.win-window') && !e.target.closest('.taskbar')) {
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
      lastTappedIcon = null;
    }
    return;
  }

  const winId = icon.dataset.window;
  const now = Date.now();
  const isMobile = window.innerWidth < 600 || 'ontouchstart' in window;

  if (isMobile) {
    // Mobile: first tap selects, second tap on same icon opens
    if (lastTappedIcon === icon && (now - lastTapTime) < 1000) {
      openWindow(winId);
      lastTappedIcon = null;
      return;
    }
    document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    icon.classList.add('selected');
    lastTappedIcon = icon;
    lastTapTime = now;
  } else {
    // Desktop: single click selects
    document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    icon.classList.add('selected');
  }
});

// Desktop: double-click opens
document.addEventListener('dblclick', (e) => {
  const icon = e.target.closest('.desktop-icon');
  if (icon && icon.dataset.window) {
    openWindow(icon.dataset.window);
  }
});

// ===== Window Manager =====
let topZ = 10;
const windowState = {}; // id -> { open, minimized, maximized }

function initWindows() {
  document.querySelectorAll('.win-window').forEach(win => {
    const id = win.id;
    const isHidden = win.classList.contains('hidden');
    windowState[id] = { open: !isHidden, minimized: false, maximized: false };

    if (!isHidden) {
      centerWindow(win);
      focusWindow(id);
    }
  });
  renderTaskbar();
}

function centerWindow(win) {
  const isMobile = window.innerWidth < 600;
  if (isMobile) return; // mobile is fullscreen via CSS
  const rect = win.getBoundingClientRect();
  const w = Math.min(460, window.innerWidth - 40);
  const maxH = window.innerHeight - 60;
  win.style.width = w + 'px';
  // Stagger windows slightly so they don't perfectly overlap
  const offset = Object.keys(windowState).indexOf(win.id) * 24;
  win.style.left = Math.max(10, (window.innerWidth - w) / 2 + offset) + 'px';
  win.style.top = Math.max(10, 40 + offset) + 'px';
}

function openWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;

  const state = windowState[id];
  if (!state) {
    windowState[id] = { open: true, minimized: false, maximized: false };
  } else {
    state.open = true;
    state.minimized = false;
  }

  win.classList.remove('hidden', 'minimized');
  if (!win.style.left || win.style.left === '0px') centerWindow(win);
  focusWindow(id);
  renderTaskbar();
}

function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.add('hidden');
  win.classList.remove('minimized', 'maximized', 'focused');
  windowState[id].open = false;
  windowState[id].minimized = false;
  windowState[id].maximized = false;
  renderTaskbar();
}

function minimizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.add('minimized');
  win.classList.remove('focused');
  windowState[id].minimized = true;
  renderTaskbar();
}

function maximizeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  const state = windowState[id];

  if (state.maximized) {
    win.classList.remove('maximized');
    state.maximized = false;
  } else {
    win.classList.add('maximized');
    state.maximized = true;
  }
  focusWindow(id);
}

function focusWindow(id) {
  document.querySelectorAll('.win-window').forEach(w => w.classList.remove('focused'));
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.add('focused');
  topZ++;
  win.style.zIndex = topZ;
  renderTaskbar();
}

function toggleWindow(id) {
  const state = windowState[id];
  if (!state || !state.open) {
    openWindow(id);
  } else if (state.minimized) {
    const win = document.getElementById(id);
    win.classList.remove('minimized');
    state.minimized = false;
    focusWindow(id);
    renderTaskbar();
  } else if (document.getElementById(id).classList.contains('focused')) {
    minimizeWindow(id);
  } else {
    focusWindow(id);
  }
}

function renderTaskbar() {
  const container = document.getElementById('taskbar-items');
  container.innerHTML = '';
  for (const id of Object.keys(windowState)) {
    const state = windowState[id];
    if (!state.open) continue;
    const win = document.getElementById(id);
    const name = win.dataset.name || id;
    const btn = document.createElement('button');
    btn.className = 'taskbar-item';
    if (win.classList.contains('focused') && !state.minimized) btn.classList.add('active');
    btn.textContent = name;
    btn.onclick = () => toggleWindow(id);
    container.appendChild(btn);
  }
}

// ===== Dragging =====
let dragWin = null, dragOffsetX = 0, dragOffsetY = 0;

function startDrag(e, id) {
  const win = document.getElementById(id);
  if (!win || windowState[id]?.maximized) return;
  if (window.innerWidth < 600) return; // no drag on mobile

  // Don't drag if clicking a button
  if (e.target.closest('.win-titlebar-buttons')) return;

  focusWindow(id);
  dragWin = win;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const rect = win.getBoundingClientRect();
  dragOffsetX = clientX - rect.left;
  dragOffsetY = clientY - rect.top;

  e.preventDefault();
}

document.addEventListener('mousemove', onDragMove);
document.addEventListener('touchmove', onDragMove, { passive: false });
document.addEventListener('mouseup', onDragEnd);
document.addEventListener('touchend', onDragEnd);

function onDragMove(e) {
  if (!dragWin) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = Math.max(0, Math.min(clientX - dragOffsetX, window.innerWidth - 50));
  const y = Math.max(0, Math.min(clientY - dragOffsetY, window.innerHeight - 60));
  dragWin.style.left = x + 'px';
  dragWin.style.top = y + 'px';
  e.preventDefault();
}

function onDragEnd() {
  dragWin = null;
}

// Click window body to focus
document.addEventListener('mousedown', (e) => {
  const win = e.target.closest('.win-window');
  if (win && win.id) focusWindow(win.id);
});

// ===== Countdown Timer =====
const PARTY_DATE = new Date('2026-04-30T19:00:00');

function updateCountdown() {
  const now = new Date();
  const diff = PARTY_DATE - now;

  if (diff <= 0) {
    document.getElementById('days').textContent = '🎉';
    document.getElementById('hours').textContent = '🎤';
    document.getElementById('minutes').textContent = '🎶';
    document.getElementById('seconds').textContent = '🎂';
    document.querySelectorAll('.countdown-label').forEach(el => el.textContent = '');
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  document.getElementById('days').textContent = String(days).padStart(2, '0');
  document.getElementById('hours').textContent = String(hours).padStart(2, '0');
  document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
  document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

// ===== Taskbar & Status Bar Clock =====
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tray = document.getElementById('tray-time');
  const statusbar = document.getElementById('statusbar-time');
  if (tray) tray.textContent = time;
  if (statusbar) statusbar.textContent = time;
}

// ===== Confetti =====
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let confettiPieces = [];
let confettiActive = false;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const CONFETTI_COLORS = ['#ff8888', '#ffcc66', '#88cc88', '#88bbdd', '#cc88cc', '#ffffff'];

class Confetti {
  constructor() {
    this.reset();
    this.y = Math.random() * -canvas.height;
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = -10;
    this.size = Math.random() * 8 + 4;
    this.speedY = Math.random() * 3 + 2;
    this.speedX = Math.random() * 2 - 1;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 6 - 3;
    this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    this.shape = Math.random() > 0.5 ? 'rect' : 'circle';
    this.opacity = Math.random() * 0.5 + 0.5;
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX + Math.sin(this.y * 0.01) * 0.5;
    this.rotation += this.rotationSpeed;
    if (this.y > canvas.height + 20) {
      if (confettiActive) { this.reset(); } else { return false; }
    }
    return true;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;
    if (this.shape === 'rect') {
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function launchConfetti(duration = 3000) {
  confettiActive = true;
  confettiPieces = [];
  for (let i = 0; i < 150; i++) confettiPieces.push(new Confetti());
  setTimeout(() => { confettiActive = false; }, duration);
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confettiPieces = confettiPieces.filter(c => c.update());
  confettiPieces.forEach(c => c.draw());
  if (confettiPieces.length > 0) requestAnimationFrame(animateConfetti);
}

// ===== RSVP Form Submission =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1Mw_XAH0WPOoxBK9S3GY_FaClWkU1-zDrZ0h4taWzIMX-BqkJXWaC4vW0TYzQfyzQ/exec';

function submitRSVP(e) {
  e.preventDefault();

  const form = document.getElementById('rsvp-form');
  const btn = document.getElementById('rsvp-submit-btn');
  const status = document.getElementById('rsvp-status');
  const name = document.getElementById('rsvp-name').value.trim();
  const email = document.getElementById('rsvp-email').value.trim();
  const attending = form.querySelector('input[name="attending"]:checked')?.value;

  if (!name || !email || !attending) return;

  btn.disabled = true;
  btn.textContent = 'Sending...';
  status.textContent = 'Locking you in...';
  status.className = 'rsvp-status loading';

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, attending })
  })
  .then(() => {
    if (attending === 'Yes' || attending === 'Maybe') {
      status.textContent = 'RSVP sent! A calendar invite is on its way to ' + email;
      status.className = 'rsvp-status success';
      launchConfetti(3000);
      animateConfetti();
    } else {
      status.textContent = "Sorry you can't make it! We'll miss you.";
      status.className = 'rsvp-status success';
    }

    btn.textContent = 'Sent!';

    // Reset form after a few seconds so another person can RSVP
    setTimeout(() => {
      form.reset();
      form.querySelectorAll('input').forEach(i => i.disabled = false);
      btn.disabled = false;
      btn.textContent = 'OK';
      status.textContent = 'Someone else need to RSVP? Go ahead!';
      status.className = 'rsvp-status success';
    }, 4000);
  })
  .catch(() => {
    status.textContent = 'Something went wrong. Try again!';
    status.className = 'rsvp-status error';
    btn.disabled = false;
    btn.textContent = 'OK';
  });
}

// ===== Init =====
// Don't init windows here — boot sequence calls initWindows() after boot completes.
// Countdown and clock still run immediately so they're ready when desktop shows.
updateCountdown();
setInterval(updateCountdown, 1000);
updateClock();
setInterval(updateClock, 10000);
