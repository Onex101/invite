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
    // Mobile: single tap opens immediately
    if (icon.dataset.notepadNew) {
      openNotepadNew();
    } else if (icon.dataset.noteId) {
      openSavedNote(icon.dataset.noteId);
    } else if (winId) {
      openWindow(winId);
    }
  } else {
    // Desktop: single click selects
    document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
    icon.classList.add('selected');
  }
});

// Desktop: double-click opens
document.addEventListener('dblclick', (e) => {
  const icon = e.target.closest('.desktop-icon');
  if (!icon) return;
  if (icon.dataset.notepadNew) {
    openNotepadNew();
  } else if (icon.dataset.noteId) {
    openSavedNote(icon.dataset.noteId);
  } else if (icon.dataset.window) {
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
  const isMobile = window.innerWidth < 900 || 'ontouchstart' in window;
  if (isMobile) return; // mobile/tablet is fullscreen via CSS
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
  // Force display in case CSS specificity issues on mobile
  win.style.display = 'flex';
  if (!win.style.left || win.style.left === '0px') centerWindow(win);
  focusWindow(id);
  renderTaskbar();
}

function closeWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.add('hidden');
  win.classList.remove('minimized', 'maximized', 'focused');
  // Clear inline display so the .hidden class takes effect cleanly
  win.style.display = '';
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
  win.style.display = '';
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
  // No drag when window is fullscreen (mobile/tablet)
  if (window.innerWidth < 900) return;

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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBy-1lxaXwTfVOfMicPyry6TLsatz9xVo6VhjHq2C3kL9G4kOZSWbZZD1LzDtAz1ks/exec';

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

// ===== Right-Click Context Menu =====
const contextMenu = document.getElementById('context-menu');

document.addEventListener('contextmenu', (e) => {
  // Only show custom menu on desktop area (not inside windows/taskbar)
  const isDesktop = e.target.closest('.desktop-layer') &&
    !e.target.closest('.win-window') &&
    !e.target.closest('.taskbar') &&
    !e.target.closest('.start-menu');

  if (isDesktop) {
    e.preventDefault();
    closeStartMenu();
    contextMenu.classList.remove('hidden');
    // Position the menu, keeping it in viewport
    let x = e.clientX;
    let y = e.clientY;
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    // Adjust if off-screen
    requestAnimationFrame(() => {
      const rect = contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        contextMenu.style.left = (window.innerWidth - rect.width - 4) + 'px';
      }
      if (rect.bottom > window.innerHeight - 30) {
        contextMenu.style.top = (window.innerHeight - 30 - rect.height - 4) + 'px';
      }
    });
  } else {
    contextMenu.classList.add('hidden');
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu')) {
    contextMenu.classList.add('hidden');
  }
});

function contextAction(action) {
  contextMenu.classList.add('hidden');
  if (action === 'refresh') {
    // Fun fake refresh — flash the desktop
    const desktop = document.getElementById('desktop-layer');
    desktop.style.opacity = '0.7';
    setTimeout(() => { desktop.style.opacity = '1'; }, 150);
  } else if (action === 'properties') {
    openWindow('main-window');
  }
}

// ===== Start Menu =====
const startMenu = document.getElementById('start-menu');
const startButton = document.querySelector('.start-button');
let startMenuOpen_flag = false;

startButton.addEventListener('click', (e) => {
  e.stopPropagation();
  contextMenu.classList.add('hidden');
  toggleStartMenu();
});

function toggleStartMenu() {
  startMenuOpen_flag = !startMenuOpen_flag;
  if (startMenuOpen_flag) {
    startMenu.classList.remove('hidden');
    startButton.classList.add('active');
  } else {
    closeStartMenu();
  }
}

function closeStartMenu() {
  startMenuOpen_flag = false;
  startMenu.classList.add('hidden');
  startButton.classList.remove('active');
}

function startMenuOpen(windowId) {
  closeStartMenu();
  openWindow(windowId);
}

function startMenuAction(action) {
  closeStartMenu();
  if (action === 'shutdown') {
    // Fun: go back to boot screen
    const desktopLayer = document.getElementById('desktop-layer');
    const bootScreen = document.getElementById('boot-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    desktopLayer.classList.add('hidden');
    // Close all windows
    Object.keys(windowState).forEach(id => {
      closeWindow(id);
    });
    // Reset welcome screen so it works again on next boot
    welcomeScreen.style.display = '';
    welcomeScreen.classList.add('hidden');
    welcomeScreen.classList.remove('fade-out');
    document.getElementById('welcome-text').textContent = 'Welcome';
    // Reset boot screen
    bootScreen.style.display = '';
    bootScreen.classList.remove('booting');
    document.getElementById('boot-loader').classList.remove('active');
    document.getElementById('boot-tap').classList.remove('hide');
    booted = false;
  } else if (action === 'logoff') {
    // Fun: flash to welcome screen briefly
    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.style.display = '';
    welcomeScreen.classList.remove('hidden', 'fade-out');
    document.getElementById('welcome-text').textContent = 'Logging off...';
    setTimeout(() => {
      document.getElementById('welcome-text').textContent = 'Welcome';
      welcomeScreen.classList.add('fade-out');
      setTimeout(() => {
        welcomeScreen.style.display = 'none';
      }, 600);
    }, 1500);
  }
}

// Close start menu when clicking elsewhere
document.addEventListener('click', (e) => {
  if (startMenuOpen_flag && !e.target.closest('.start-menu') && !e.target.closest('.start-button')) {
    closeStartMenu();
  }
});

// ===== My Documents — Easter Eggs =====
const EASTER_EGGS = {
  readme: {
    title: 'readme.txt',
    content: "WELCOME TO XENO'S DESKTOP\n========================\n\nIf you're reading this, you've been invited to the\nmost legendary karaoke night of 2026.\n\nPrepare your vocal cords.\nPrepare your dignity.\nPrepare to lose both.\n\n- Xeno"
  },
  karaoke_playlist: {
    title: 'karaoke_playlist.txt',
    content: "XENO'S FAVOURITE SONGS \u266b\n========================\n\n1. Butterflies - Michael Jackson\n2. Cry Me A River - Justin Timberlake\n3. I Need You - Jon Batiste\n4. Rock With You - Michael Jackson\n5. Heart, Mind and Soul - El DeBarge\n6. Never Too Much - Luther Vandross\n7. Lovely Day - Bill Withers\n8. Maria Maria - Santana\n\nif you sing any of these at the party\nyou will instantly become my best friend."
  },
  secret_recipe: {
    title: 'secret_recipe.txt',
    content: "SECRET BIRTHDAY CAKE RECIPE\n===========================\n\nIngredients:\n- 1 store-bought cake\n- 29 candles (NOT 30, I'm not 30 yet)\n- 1 lighter\n- The audacity to pretend I baked it\n\nInstructions:\n1. Open box\n2. Place candles\n3. Take credit\n4. Accept compliments gracefully"
  },

};

function openEasterEgg(id) {
  const egg = EASTER_EGGS[id];
  if (!egg) return;
  const textarea = document.getElementById('notepad-textarea');
  const title = document.getElementById('notepad-title');
  const saveBar = document.getElementById('notepad-save-bar');

  textarea.value = egg.content;
  textarea.readOnly = true;
  title.textContent = egg.title + ' - Notepad';
  saveBar.classList.add('hidden');
  openWindow('notepad-window');
}

// ===== Notepad — Create & Save Notes =====
function openNotepadNew() {
  closeStartMenu();
  const textarea = document.getElementById('notepad-textarea');
  const title = document.getElementById('notepad-title');
  const saveBar = document.getElementById('notepad-save-bar');
  const status = document.getElementById('notepad-save-status');

  textarea.value = '';
  textarea.readOnly = false;
  title.textContent = 'Untitled - Notepad';
  saveBar.classList.remove('hidden');
  status.textContent = '';
  document.getElementById('notepad-author').value = '';
  document.getElementById('notepad-filename').value = '';
  document.getElementById('notepad-save-btn').disabled = false;
  document.getElementById('notepad-save-btn').textContent = '💾 Save to Desktop';
  openWindow('notepad-window');
}

function resetNotepad() {
  openNotepadNew();
}

function saveNote() {
  const textarea = document.getElementById('notepad-textarea');
  const author = document.getElementById('notepad-author').value.trim() || 'Anonymous';
  let filename = document.getElementById('notepad-filename').value.trim();
  const content = textarea.value.trim();
  const btn = document.getElementById('notepad-save-btn');
  const status = document.getElementById('notepad-save-status');

  if (!content) {
    status.textContent = 'Write something first!';
    status.className = 'notepad-save-status error';
    return;
  }

  // Sanitize filename
  filename = filename.replace(/[^a-zA-Z0-9_\-. ]/g, '');
  if (!filename) filename = 'note_' + Date.now();
  if (!filename.endsWith('.txt')) filename += '.txt';

  btn.disabled = true;
  btn.textContent = 'Saving...';
  status.textContent = '';

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'saveNote',
      author: author,
      filename: filename,
      content: content
    })
  }).catch(() => {});

  // no-cors means we can't read the response, so treat as success immediately
  // (the data saves even if the opaque response looks like a failure)
  setTimeout(() => {
    status.textContent = '✅ Saved! Your note is now on the desktop for everyone.';
    status.className = 'notepad-save-status success';
    btn.textContent = 'Saved!';
    addNoteToDesktop({ author, filename, content, timestamp: new Date().toISOString() });
    setTimeout(() => loadSavedNotes(), 3000);
  }, 1500);
}

// ===== Desktop Notes — Load from Google Sheet =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function addNoteToDesktop(note) {
  const desktop = document.getElementById('desktop-icons');
  // Don't add duplicates
  if (desktop.querySelector('[data-note-id="' + CSS.escape(note.filename) + '"]')) return;

  const icon = document.createElement('div');
  icon.className = 'desktop-icon desktop-note-icon';
  icon.dataset.noteId = note.filename;
  icon.innerHTML = '<div class="desktop-icon-img">📄</div>' +
    '<span>' + escapeHtml(note.filename) + '</span>' +
    '<span class="note-author">by ' + escapeHtml(note.author) + '</span>';
  desktop.appendChild(icon);
}

function openSavedNote(noteId) {
  // Try to find the note content — check if we have it cached
  const cached = loadedNotes.find(n => n.filename === noteId);
  if (cached) {
    const textarea = document.getElementById('notepad-textarea');
    const title = document.getElementById('notepad-title');
    const saveBar = document.getElementById('notepad-save-bar');

    textarea.value = cached.content;
    textarea.readOnly = true;
    title.textContent = cached.filename + ' (by ' + cached.author + ') - Notepad';
    saveBar.classList.add('hidden');
    openWindow('notepad-window');
  }
}

let loadedNotes = [];

function loadSavedNotes() {
  fetch(APPS_SCRIPT_URL + '?action=getNotes', { redirect: 'follow' })
    .then(r => {
      console.log('Notes response status:', r.status);
      return r.json();
    })
    .then(data => {
      console.log('Notes data:', data);
      if (data.notes && data.notes.length > 0) {
        loadedNotes = data.notes;
        data.notes.forEach(note => addNoteToDesktop(note));
      }
    })
    .catch(err => {
      console.error('Failed to load notes:', err);
    });
}

// Load saved notes when desktop appears
const _origFinishBoot = finishBoot;
finishBoot = function() {
  _origFinishBoot();
  setTimeout(() => loadSavedNotes(), 500);
  setTimeout(() => startClippy(), 2000);
};

// ===== Clippy =====
const CLIPPY_MESSAGES = [
  "It looks like you're trying to RSVP to a party! Would you like help?",
  "Hi! I'm Clippy, your Office Assistant. Xeno is turning 29!",
  "Did you know? Karaoke means 'empty orchestra' in Japanese. 🎤",
  "You should check out My Documents. There's some good stuff in there.",
  "Pro tip: Don't pick Bohemian Rhapsody unless you've got the range.",
  "It looks like you're writing a note! Don't forget to save it. 💾",
  "Fun fact: The countdown is real. April 30th is coming fast!",
  "Have you RSVP'd yet? Click rsvp.exe on the desktop!",
  "Try right-clicking the desktop. Just like the good old days.",
  "🎵 Butterflies by Michael Jackson is on Xeno's playlist. Good taste!",
  "You look like someone who'd absolutely crush Lovely Day at karaoke.",
  "I see you haven't shut down the computer. Good. Never leave.",
  "Try the Start menu! It's very nostalgic.",
  "Remember: Venue is TBA. Xeno promises they'll let you know soon.",
  "Leave a note on the desktop so other guests can read it!",
];

let clippyTimeout = null;
let clippyIndex = 0;

function startClippy() {
  // Show first message after desktop loads
  clippyIndex = Math.floor(Math.random() * CLIPPY_MESSAGES.length);
  showClippyMessage(CLIPPY_MESSAGES[0]);
  // Auto-dismiss after 8 seconds
  clippyTimeout = setTimeout(() => dismissClippy(), 8000);
}

function clippySpeak() {
  clearTimeout(clippyTimeout);
  clippyIndex = (clippyIndex + 1) % CLIPPY_MESSAGES.length;
  showClippyMessage(CLIPPY_MESSAGES[clippyIndex]);
  clippyTimeout = setTimeout(() => dismissClippy(), 8000);
}

function showClippyMessage(msg) {
  const bubble = document.getElementById('clippy-bubble');
  const text = document.getElementById('clippy-text');
  text.textContent = msg;
  bubble.classList.remove('hidden');
}

function dismissClippy() {
  clearTimeout(clippyTimeout);
  const bubble = document.getElementById('clippy-bubble');
  bubble.classList.add('hidden');
}
