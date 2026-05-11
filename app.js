const storageKey = 'fittracker_mobile_users';
const screen = document.getElementById('screen');

const getUsers = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
const saveUsers = (users) => localStorage.setItem(storageKey, JSON.stringify(users));
const todayKey = () => new Date().toISOString().slice(0, 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sha256 = async (message) => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

let timerInterval = null;
let elapsedMs = 0;
let timerRunning = false;

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const setTimerLabel = () => {
  const label = document.getElementById('timerLabel');
  if (label) label.textContent = formatTime(elapsedMs);
};

const startTimer = () => {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    elapsedMs += 50;
    setTimerLabel();
  }, 50);
};

const pauseTimer = () => {
  timerRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

const resetTimer = () => {
  pauseTimer();
  elapsedMs = 0;
  setTimerLabel();
};

const getCurrentUser = () => JSON.parse(localStorage.getItem('fittracker_current_user') || 'null');
const setCurrentUser = (user) => localStorage.setItem('fittracker_current_user', JSON.stringify(user));

const renderLogin = () => {
  screen.innerHTML = `
    <div class="card">
      <h2>Accedi</h2>
      <label>Email</label>
      <input id="email" type="email" placeholder="tuo@email.com" />
      <label>Password</label>
      <input id="password" type="password" placeholder="Password" />
      <div class="actions">
        <button class="primary" id="loginBtn">Login</button>
        <button class="secondary" id="showRegisterBtn">Registrati</button>
      </div>
      <p class="note">Usa questa app direttamente dal browser mobile.</p>
    </div>
  `;

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const users = getUsers();

    if (!email || !password) {
      alert('Compila email e password');
      return;
    }

    const user = users[email];
    if (!user) {
      alert('Email non trovata. Registrati.');
      return;
    }

    const hash = await sha256(password);
    if (hash !== user.password) {
      alert('Password errata.');
      return;
    }

    setCurrentUser({ email, name: user.name });
    renderHome();
  });

  document.getElementById('showRegisterBtn').addEventListener('click', renderRegister);
};

const renderRegister = () => {
  screen.innerHTML = `
    <div class="card">
      <h2>Registrazione</h2>
      <label>Nome</label>
      <input id="name" type="text" placeholder="Il tuo nome" />
      <label>Email</label>
      <input id="email" type="email" placeholder="tuo@email.com" />
      <label>Password</label>
      <input id="password" type="password" placeholder="Password" />
      <label>Conferma password</label>
      <input id="confirmPassword" type="password" placeholder="Conferma password" />
      <div class="actions">
        <button class="primary" id="registerBtn">Registrati</button>
        <button class="secondary" id="backLoginBtn">Torni al login</button>
      </div>
    </div>
  `;

  document.getElementById('registerBtn').addEventListener('click', async () => {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const users = getUsers();

    if (!name || !email || !password || !confirmPassword) {
      alert('Compila tutti i campi');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      alert('Email non valida');
      return;
    }

    if (password.length < 6) {
      alert('La password deve avere almeno 6 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      alert('Le password non corrispondono');
      return;
    }

    if (users[email]) {
      alert('Email già registrata');
      return;
    }

    const hash = await sha256(password);
    users[email] = {
      name,
      password: hash,
      registeredAt: new Date().toISOString(),
      daysCompleted: 0,
      lastWorkout: null,
      progress: []
    };
    saveUsers(users);
    alert('Registrazione completata! Effettua il login.');
    renderLogin();
  });

  document.getElementById('backLoginBtn').addEventListener('click', renderLogin);
};

const renderHome = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    renderLogin();
    return;
  }

  const users = getUsers();
  const user = users[currentUser.email];
  const today = todayKey();
  const alreadyDone = user.lastWorkout === today;

  screen.innerHTML = `
    <div class="card">
      <h2>Benvenuto, ${user.name}</h2>
      <div class="stats-grid">
        <div class="status-pill">Giorni completati: ${user.daysCompleted}</div>
        <div class="status-pill">Iscritto: ${new Date(user.registeredAt).toLocaleDateString()}</div>
        <div class="status-pill">Ultimo allenamento: ${user.lastWorkout || 'Mai'}</div>
      </div>
      <div class="actions">
        <button class="primary" id="workoutBtn" ${alreadyDone ? 'disabled' : ''}>${alreadyDone ? 'Hai già allenato oggi' : 'Inizia allenamento'}</button>
        <button class="secondary" id="statsBtn">Statistiche</button>
        <button class="secondary" id="logoutBtn">Logout</button>
      </div>
    </div>
  `;

  document.getElementById('workoutBtn').addEventListener('click', renderWorkout);
  document.getElementById('statsBtn').addEventListener('click', renderStats);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('fittracker_current_user');
    pauseTimer();
    resetTimer();
    renderLogin();
  });
};

const renderWorkout = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return renderLogin();

  screen.innerHTML = `
    <div class="card">
      <h2>Allenamento Full Body</h2>
      <div class="timer-display" id="timerLabel">00:00:00.000</div>
      <div class="actions">
        <button class="primary" id="startTimerBtn">Avvia</button>
        <button class="secondary" id="pauseTimerBtn">Pausa</button>
        <button class="secondary" id="resetTimerBtn">Reset</button>
      </div>
    </div>
    <div class="card">
      <h2>Riscaldamento</h2>
      <ul>
        <li>Corsa sul posto - 2 minuti</li>
        <li>Saltelli - 2 minuti</li>
        <li>Rotazioni braccia - 30 secondi per braccio</li>
        <li>Jumping jack - 1 minuto</li>
        <li>Allungamenti leggeri - 2-3 minuti</li>
      </ul>
    </div>
    <div class="card">
      <h2>Full Body</h2>
      <ul>
        <li>Petto: Flessioni - 3 serie x 10-15 ripetizioni</li>
        <li>Schiena: Rematori - 3 serie x 10-15 ripetizioni</li>
        <li>Gambe: Squat - 3 serie x 10-15 ripetizioni</li>
        <li>Braccia: Push-up - 3 serie x 10-15 ripetizioni</li>
        <li>Core: Plank - 3 serie da 30-45 sec</li>
      </ul>
    </div>
    <div class="card">
      <h2>Shadow Boxing</h2>
      <ul>
        <li>Posizionati in guardia</li>
        <li>Colpi in aria a ritmo controllato</li>
        <li>5-10 minuti</li>
      </ul>
      <div class="actions">
        <button class="primary" id="completeBtn">Completa l'allenamento</button>
        <button class="secondary" id="backHomeBtn">Torna alla Home</button>
      </div>
    </div>
  `;

  elapsedMs = 0;
  timerRunning = false;
  setTimerLabel();

  document.getElementById('startTimerBtn').addEventListener('click', startTimer);
  document.getElementById('pauseTimerBtn').addEventListener('click', pauseTimer);
  document.getElementById('resetTimerBtn').addEventListener('click', resetTimer);
  document.getElementById('completeBtn').addEventListener('click', completeWorkoutMobile);
  document.getElementById('backHomeBtn').addEventListener('click', () => {
    pauseTimer();
    renderHome();
  });
};

const completeWorkoutMobile = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return renderLogin();

  pauseTimer();
  const users = getUsers();
  const user = users[currentUser.email];
  const today = todayKey();

  if (user.lastWorkout === today) {
    alert('Hai già completato l\'allenamento oggi. Torna domani.');
    return;
  }

  user.daysCompleted += 1;
  user.lastWorkout = today;
  user.progress.push({
    date: new Date().toLocaleString(),
    day: user.daysCompleted,
    duration: formatTime(elapsedMs)
  });
  saveUsers(users);

  alert(`Hai completato l'allenamento! Tempo: ${formatTime(elapsedMs)}`);
  elapsedMs = 0;
  renderHome();
};

const renderStats = () => {
  const currentUser = getCurrentUser();
  if (!currentUser) return renderLogin();

  const users = getUsers();
  const user = users[currentUser.email];

  screen.innerHTML = `
    <div class="card">
      <h2>Statistiche</h2>
      <p><strong>Nome:</strong> ${user.name}</p>
      <p><strong>Email:</strong> ${currentUser.email}</p>
      <p><strong>Giorni completati:</strong> ${user.daysCompleted}</p>
      <p><strong>Ultimo allenamento:</strong> ${user.lastWorkout || 'Mai'}</p>
      <div class="actions">
        <button class="primary" id="homeBtn">Torna Home</button>
      </div>
    </div>
    <div class="card">
      <h2>Storico</h2>
      ${user.progress.length ? `<ol>${user.progress.slice(-10).reverse().map((item) => `<li>${item.date} - Giorno ${item.day} - ${item.duration}</li>`).join('')}</ol>` : '<p>Nessun allenamento ancora.</p>'}
    </div>
  `;

  document.getElementById('homeBtn').addEventListener('click', renderHome);
};

const initApp = () => {
  const currentUser = getCurrentUser();
  if (currentUser) {
    renderHome();
  } else {
    renderLogin();
  }
};

initApp();
