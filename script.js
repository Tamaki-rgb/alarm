/* ═══════════════════════════════════════════════
   AILARM — script.js
   Full PWA Logic: Alarms, Timer, Stopwatch,
   Tasks, Weather, Quotes, Sleep, Assistant
   ═══════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════
   STATE
══════════════════════════════ */
const State = {
  alarms: [],
  tasks: [],
  sleepLog: [],        // [{date, rating}]
  selectedMelody: 'default',
  customMelodies: [],  // [{name, dataUrl}]
  theme: 'auto',       // 'auto'|'dark'|'light'
  quoteCategory: 'all',
  timerDrums: { h: 0, m: 0, s: 0 },
  timerRunning: false,
  timerEnd: null,
  timerInterval: null,
  stopwatchRunning: false,
  stopwatchStart: null,
  stopwatchOffset: 0,
  stopwatchInterval: null,
  laps: [],
  weatherData: null,
  weatherLastFetch: 0,
  volume: 0.8,
  currentAlarmId: null,
  snoozeTimeout: null,
};

/* ══════════════════════════════
   PERSIST
══════════════════════════════ */
const Store = {
  save() {
    try {
      localStorage.setItem('ailarm_alarms',    JSON.stringify(State.alarms));
      localStorage.setItem('ailarm_tasks',     JSON.stringify(State.tasks));
      localStorage.setItem('ailarm_sleep',     JSON.stringify(State.sleepLog));
      localStorage.setItem('ailarm_melody',    State.selectedMelody);
      localStorage.setItem('ailarm_theme',     State.theme);
      localStorage.setItem('ailarm_volume',    State.volume);
      localStorage.setItem('ailarm_custommel', JSON.stringify(State.customMelodies));
      localStorage.setItem('ailarm_quotecat',  State.quoteCategory);
    } catch(e) { console.warn('Store.save', e); }
  },
  load() {
    try {
      State.alarms         = JSON.parse(localStorage.getItem('ailarm_alarms')    || '[]');
      State.tasks          = JSON.parse(localStorage.getItem('ailarm_tasks')     || '[]');
      State.sleepLog       = JSON.parse(localStorage.getItem('ailarm_sleep')     || '[]');
      State.selectedMelody = localStorage.getItem('ailarm_melody') || 'default';
      State.theme          = localStorage.getItem('ailarm_theme')  || 'auto';
      State.volume         = parseFloat(localStorage.getItem('ailarm_volume') || '0.8');
      State.customMelodies = JSON.parse(localStorage.getItem('ailarm_custommel') || '[]');
      State.quoteCategory  = localStorage.getItem('ailarm_quotecat') || 'all';
    } catch(e) { console.warn('Store.load', e); }
  }
};

/* ══════════════════════════════
   AUDIO ENGINE
══════════════════════════════ */
const Audio = (() => {
  let ctx = null;
  let gainNode = null;
  let activeNodes = [];

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
    }
    return ctx;
  }

  function stop() {
    activeNodes.forEach(n => { try { n.stop(); } catch(e){} });
    activeNodes = [];
  }

  const MELODIES = {
    default: { name: 'Gentle Rise', icon: '🔔' },
    chime:   { name: 'Crystal Chime', icon: '🎐' },
    pulse:   { name: 'Cosmic Pulse', icon: '💫' },
    nature:  { name: 'Forest Dawn', icon: '🌿' },
    digital: { name: 'Digital Wave', icon: '📡' },
  };

  function playMelody(id, volume = 0.8) {
    stop();
    const c = getCtx();
    gainNode.gain.setValueAtTime(volume, c.currentTime);

    const patterns = {
      default: [
        [523, 0, 0.3], [659, 0.35, 0.3], [784, 0.7, 0.3],
        [1047, 1.1, 0.4], [784, 1.6, 0.3], [1047, 2.0, 0.5],
      ],
      chime: [
        [1047, 0, 0.6], [1319, 0.2, 0.6], [1568, 0.4, 0.6],
        [2093, 0.7, 0.8], [1568, 1.2, 0.5], [2093, 1.8, 0.8],
      ],
      pulse: [
        [200, 0, 0.1], [200, 0.15, 0.1], [400, 0.3, 0.2],
        [800, 0.55, 0.3], [1600, 0.9, 0.4],
      ],
      nature: [
        [440, 0, 0.8], [494, 0.4, 0.8], [523, 0.8, 0.8],
        [587, 1.3, 0.8], [659, 1.8, 1.0],
      ],
      digital: [
        [880, 0, 0.15], [880, 0.2, 0.15], [1760, 0.4, 0.3],
        [880, 0.75, 0.15], [880, 0.95, 0.15], [1760, 1.15, 0.4],
      ],
    };

    const loop = (pattern) => {
      pattern.forEach(([freq, when, dur]) => {
        const osc = c.createOscillator();
        const env = c.createGain();
        osc.connect(env); env.connect(gainNode);
        osc.frequency.value = freq;
        osc.type = id === 'pulse' ? 'sawtooth' : id === 'digital' ? 'square' : 'sine';
        env.gain.setValueAtTime(0, c.currentTime + when);
        env.gain.linearRampToValueAtTime(0.6, c.currentTime + when + 0.03);
        env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + when + dur);
        osc.start(c.currentTime + when);
        osc.stop(c.currentTime + when + dur + 0.1);
        activeNodes.push(osc);
      });
    };

    const pat = patterns[id] || patterns.default;
    loop(pat);
    // Repeat every 2.5s
    const interval = setInterval(() => {
      if (activeNodes.length === 0 && !State.currentAlarmId) { clearInterval(interval); return; }
      loop(pat);
    }, 2500);
    activeNodes._loopInterval = interval;
  }

  function playCustom(dataUrl, volume = 0.8) {
    stop();
    const audio = new window.Audio(dataUrl);
    audio.volume = volume;
    audio.loop = true;
    audio.play().catch(() => {});
    activeNodes._customAudio = audio;
  }

  function playBeep(freq = 880, dur = 0.15) {
    const c = getCtx();
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.connect(env); env.connect(gainNode);
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.3, c.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.start(); osc.stop(c.currentTime + dur);
  }

  function setVolume(v) {
    if (gainNode) gainNode.gain.setValueAtTime(v, getCtx().currentTime);
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { stop, playMelody, playCustom, playBeep, setVolume, resume, MELODIES };
})();

/* ══════════════════════════════
   QUOTES DATA
══════════════════════════════ */
const QUOTES = {
  business: [
    { text: 'Успех — это не конечная точка, провал — не фатален. Главное — мужество продолжать.', author: 'Уинстон Черчилль' },
    { text: 'Ваше время ограничено, не тратьте его на чужую жизнь.', author: 'Стив Джобс' },
    { text: 'Единственный способ делать великую работу — любить то, что делаешь.', author: 'Стив Джобс' },
    { text: 'Если вы не строите свою мечту, кто-то другой наймёт вас строить свою.', author: 'Тони Гаскинс' },
    { text: 'Риск — это цена возможности.', author: 'Тём Питерс' },
  ],
  sport: [
    { text: 'Чемпион — это не тот, кто не падает, а тот, кто встаёт.', author: 'Вита Герасимив' },
    { text: 'Боль временна. Сдаться — навсегда.', author: 'Лэнс Армстронг' },
    { text: 'Всё невозможное становится возможным, когда веришь.', author: 'Мухаммед Али' },
    { text: 'Успех — это 99% пота и 1% таланта.', author: 'Томас Эдисон' },
    { text: 'Каждое утро ты конкурируешь с тем, кем был вчера.', author: 'Аноним' },
  ],
  creative: [
    { text: 'Творчество — это разум, который веселится.', author: 'Альберт Эйнштейн' },
    { text: 'Воображение важнее знания.', author: 'Альберт Эйнштейн' },
    { text: 'Каждый художник вначале был любителем.', author: 'Ральф Эмерсон' },
    { text: 'Искусство — это ложь, которая помогает нам понять правду.', author: 'Пабло Пикассо' },
    { text: 'Создавай то, что ты хотел бы видеть в мире.', author: 'Аноним' },
  ],
  morning: [
    { text: 'Каждое утро — это второй шанс стать лучше.', author: 'Аноним' },
    { text: 'Утро — это обещание нового начала.', author: 'Аноним' },
    { text: 'Победи утро — победишь день.', author: 'Робин Шарма' },
    { text: 'Ты встал раньше большинства. Это уже победа.', author: 'Аноним' },
    { text: 'Великие дела начинаются с маленьких утренних решений.', author: 'Аноним' },
  ],
};

/* ══════════════════════════════
   WEATHER
══════════════════════════════ */
const Weather = {
  icons: {
    'Clear': '☀️', 'Clouds': '☁️', 'Rain': '🌧️',
    'Drizzle': '🌦️', 'Thunderstorm': '⛈️', 'Snow': '❄️',
    'Mist': '🌫️', 'Fog': '🌫️', 'Haze': '🌫️', 'default': '🌤️',
  },
  advice(data) {
    if (!data) return '';
    const t = data.temp, w = data.wind, h = data.humidity, main = data.main;
    if (main === 'Rain' || main === 'Drizzle') return '☔ Возьмите зонт сегодня!';
    if (main === 'Snow') return '🧣 Оденьтесь теплее, на улице снег';
    if (main === 'Thunderstorm') return '⚡ Лучше остаться дома, гроза!';
    if (t > 30) return '🥵 Очень жарко — пейте больше воды';
    if (t > 22) return '😎 Отличная погода для прогулки!';
    if (t < 0)  return '🧤 Морозно — надевайте перчатки';
    if (t < 10) return '🧥 Прохладно, возьмите куртку';
    if (w > 10) return '💨 Ветрено — возможно, закройте окна';
    if (h > 80) return '💧 Высокая влажность, может быть душно';
    return '🌈 Хороший день — наслаждайтесь!';
  },
  async fetch() {
    const now = Date.now();
    if (State.weatherData && now - State.weatherLastFetch < 15 * 60 * 1000) {
      return State.weatherData;
    }
    try {
      // Use open-meteo (no API key needed)
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      ).catch(() => null);

      const lat = pos?.coords?.latitude  || 41.2995;
      const lon = pos?.coords?.longitude || 69.2401;

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure&timezone=auto`;
      const r = await fetch(url);
      const j = await r.json();
      const c = j.current;

      // Map weather_code to description
      const wc = c.weather_code;
      let main = 'Clear', desc = 'Ясно', icon = '☀️';
      if (wc >= 0 && wc <= 3)   { main='Clear';  desc='Ясно';          icon='☀️'; }
      if (wc >= 4 && wc <= 49)  { main='Clouds'; desc='Облачно';       icon='☁️'; }
      if (wc >= 50 && wc <= 69) { main='Drizzle';desc='Морось';        icon='🌦️'; }
      if (wc >= 70 && wc <= 79) { main='Snow';   desc='Снег';          icon='❄️'; }
      if (wc >= 80 && wc <= 82) { main='Rain';   desc='Дождь';         icon='🌧️'; }
      if (wc >= 95)             { main='Thunderstorm'; desc='Гроза';   icon='⛈️'; }

      State.weatherData = {
        temp: Math.round(c.temperature_2m),
        humidity: c.relative_humidity_2m,
        wind: Math.round(c.wind_speed_10m),
        pressure: Math.round(c.surface_pressure * 0.750062), // hPa → mmHg
        main, desc, icon,
      };
      State.weatherLastFetch = now;
      return State.weatherData;
    } catch (e) {
      // Fallback mock
      return State.weatherData || { temp: 22, humidity: 60, wind: 5, pressure: 755, main: 'Clear', desc: 'Нет данных', icon: '🌤️' };
    }
  }
};

/* ══════════════════════════════
   SPEECH
══════════════════════════════ */
const Speech = {
  supported: 'speechSynthesis' in window,
  speaking: false,

  speak(text, onEnd) {
    if (!this.supported) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'ru-RU';
    utt.rate = 0.95;
    utt.pitch = 1.05;
    utt.volume = 1;
    this.speaking = true;
    utt.onend = () => { this.speaking = false; onEnd?.(); };
    utt.onerror = () => { this.speaking = false; onEnd?.(); };
    // Pick Russian voice if available
    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find(v => v.lang.startsWith('ru'));
    if (ruVoice) utt.voice = ruVoice;
    window.speechSynthesis.speak(utt);
  },

  stop() {
    window.speechSynthesis.cancel();
    this.speaking = false;
  }
};

/* ══════════════════════════════
   UTILS
══════════════════════════════ */
function pad(n) { return String(n).padStart(2, '0'); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmt(ms) {
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  const cs = Math.floor((ms % 1000) / 10);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}.${pad(cs)}`;
}
function fmtTimer(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAY_NAMES_FULL = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const MONTH_NAMES = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function greeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function hasBirthday(task) {
  return task.text?.toLowerCase().includes('день рождения') || task.birthday;
}

/* ══════════════════════════════
   THEME
══════════════════════════════ */
function applyTheme(theme) {
  const h = new Date().getHours();
  const auto = h >= 7 && h < 20 ? 'light' : 'dark';
  const actual = theme === 'auto' ? auto : theme;
  document.documentElement.setAttribute('data-theme', actual === 'light' ? 'light' : '');
}

function initTheme() {
  applyTheme(State.theme);
  // Check every minute for auto theme
  setInterval(() => { if (State.theme === 'auto') applyTheme('auto'); }, 60000);
}

/* ══════════════════════════════
   CLOCK
══════════════════════════════ */
let clockInterval = null;
function startClock() {
  function tick() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    const is12 = false; // 24h
    const timeStr = `${pad(h)}<span class="clock-colon">:</span>${pad(m)}`;
    const el = document.getElementById('clockTime');
    if (el) el.innerHTML = timeStr;
    const dateEl = document.getElementById('clockDate');
    if (dateEl) {
      const dow = DAY_NAMES_FULL[(now.getDay() + 6) % 7];
      dateEl.textContent = `${dow}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    }
    const greetEl = document.getElementById('clockGreeting');
    if (greetEl) greetEl.textContent = greeting() + ' 👋';
    // Topbar time
    const topTime = document.getElementById('topTime');
    if (topTime) topTime.textContent = `${pad(h)}:${pad(m)}`;
    // Check alarms every second
    checkAlarms(now);
  }
  tick();
  clockInterval = setInterval(tick, 1000);
}

/* ══════════════════════════════
   ALARM ENGINE
══════════════════════════════ */
function checkAlarms(now) {
  if (State.currentAlarmId) return; // already ringing
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  if (s !== 0) return; // only check on minute boundary
  const timeStr = `${pad(h)}:${pad(m)}`;
  const dow = (now.getDay() + 6) % 7; // 0=Mon

  for (const alarm of State.alarms) {
    if (!alarm.active) continue;
    if (alarm.time !== timeStr) continue;
    if (!alarm.days.includes(dow)) continue;
    triggerAlarm(alarm);
    break;
  }
}

function triggerAlarm(alarm) {
  State.currentAlarmId = alarm.id;
  Audio.resume();

  // Play melody
  const mel = alarm.melody || State.selectedMelody;
  const custom = State.customMelodies.find(c => c.name === mel);
  if (custom) Audio.playCustom(custom.dataUrl, State.volume);
  else Audio.playMelody(mel, State.volume);

  // Vibrate
  if (navigator.vibrate) {
    navigator.vibrate([500, 200, 500, 200, 500, 200, 1000]);
  }

  // Fullscreen
  try { document.documentElement.requestFullscreen?.(); } catch(e){}

  // Show ring screen
  const rs = document.getElementById('alarmRingScreen');
  rs.classList.add('visible');
  document.getElementById('ringTime').textContent = alarm.time;
  document.getElementById('ringLabel').textContent = alarm.label || (alarm.type === 'smart' ? '🤖 Умный будильник' : '⏰ Будильник');
}

function stopAlarm(withAssistant = true) {
  Audio.stop();
  if (navigator.vibrate) navigator.vibrate(0);
  const rs = document.getElementById('alarmRingScreen');
  rs.classList.remove('visible');

  const alarmId = State.currentAlarmId;
  const alarm = State.alarms.find(a => a.id === alarmId);
  State.currentAlarmId = null;

  // Exit fullscreen
  try { document.exitFullscreen?.(); } catch(e){}

  // Show sleep rating
  showSleepRatingPrompt(() => {
    // After rating, smart alarm plays assistant
    if (alarm?.type === 'smart' && withAssistant) {
      setTimeout(() => runAssistant(), 400);
    }
  });
}

function snoozeAlarm() {
  Audio.stop();
  if (navigator.vibrate) navigator.vibrate(0);
  document.getElementById('alarmRingScreen').classList.remove('visible');
  State.currentAlarmId = null;
  showToast('⏰ Повтор через 5 минут', 'info');
  State.snoozeTimeout = setTimeout(() => {
    const alarm = State.alarms.find(a => a.active);
    if (alarm) triggerAlarm(alarm);
  }, 5 * 60 * 1000);
}

/* ══════════════════════════════
   SMART ASSISTANT
══════════════════════════════ */
async function runAssistant() {
  const panel = document.getElementById('assistantPanel');
  const textEl = document.getElementById('assistantText');
  panel.classList.add('visible');

  const now = new Date();
  const weather = await Weather.fetch();
  const pendingTasks = State.tasks.filter(t => !t.done);
  const birthdays = State.tasks.filter(t => hasBirthday(t) && !t.done);
  const quotes = getAllQuotes();
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  // Build message
  let msg = `${greeting()}! `;
  msg += `Сегодня ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}, ${DAY_NAMES_FULL[(now.getDay()+6)%7]}. `;
  msg += `На улице ${weather.temp}°, ${weather.desc.toLowerCase()}. `;
  if (weather.main === 'Rain') msg += 'Не забудьте зонт. ';
  if (pendingTasks.length > 0) {
    msg += `На сегодня у вас ${pendingTasks.length} ${pluralTasks(pendingTasks.length)}: `;
    msg += pendingTasks.slice(0, 3).map(t => t.text).join(', ') + '. ';
  } else {
    msg += 'Задач на сегодня нет — отличное время для новых дел! ';
  }
  if (birthdays.length > 0) {
    msg += `Кстати, сегодня день рождения у ${birthdays.map(t=>t.text).join(' и ')}! Не забудьте поздравить! `;
  }
  msg += `И напоследок: «${quote.text}» — ${quote.author}.`;

  // Display
  textEl.textContent = msg;

  // Speak
  Speech.speak(msg, () => {
    setTimeout(() => closeAssistant(), 1500);
  });
}

function closeAssistant() {
  Speech.stop();
  document.getElementById('assistantPanel').classList.remove('visible');
}

function pluralTasks(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'задача';
  if ([2,3,4].includes(n%10) && ![12,13,14].includes(n%100)) return 'задачи';
  return 'задач';
}

function getAllQuotes() {
  if (State.quoteCategory === 'all') {
    return Object.values(QUOTES).flat();
  }
  return QUOTES[State.quoteCategory] || Object.values(QUOTES).flat();
}

/* ══════════════════════════════
   SLEEP RATING
══════════════════════════════ */
function showSleepRatingPrompt(cb) {
  const el = document.getElementById('sleepRatingPrompt');
  el.classList.add('visible');
  // Reset stars
  document.querySelectorAll('#sleepPromptStars .star-btn').forEach(s => s.classList.remove('lit'));
  el._callback = cb;
}

function submitSleepRating(rating) {
  const entry = { date: today(), rating };
  // Remove existing today entry
  State.sleepLog = State.sleepLog.filter(e => e.date !== today());
  State.sleepLog.push(entry);
  if (State.sleepLog.length > 30) State.sleepLog = State.sleepLog.slice(-30);
  Store.save();
  document.getElementById('sleepRatingPrompt').classList.remove('visible');
  renderSleepChart();
  showToast('😴 Оценка сна сохранена', 'success');
  document.getElementById('sleepRatingPrompt')._callback?.();
}

function renderSleepChart() {
  const container = document.getElementById('sleepBars');
  if (!container) return;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const entry = State.sleepLog.find(e => e.date === key);
    days.push({ label: DAY_NAMES[(d.getDay()+6)%7], rating: entry?.rating || 0 });
  }
  container.innerHTML = days.map(d => {
    const h = d.rating ? (d.rating / 5) * 72 : 4;
    const color = d.rating >= 4 ? '#06d6a0' : d.rating >= 3 ? '#9b5de5' : d.rating > 0 ? '#f15bb5' : '#333';
    return `<div class="sleep-bar-wrap">
      <div class="sleep-bar-val">${d.rating > 0 ? '⭐'.repeat(d.rating) : '—'}</div>
      <div class="sleep-bar" style="height:${h}px;background:${color}"></div>
      <div class="sleep-bar-day">${d.label}</div>
    </div>`;
  }).join('');

  const ratings = State.sleepLog.filter(e => e.rating > 0).map(e => e.rating);
  const avg = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '—';
  const avgEl = document.getElementById('sleepAvg');
  if (avgEl) avgEl.innerHTML = `<span>${avg}</span>`;
}

/* ══════════════════════════════
   TASKS
══════════════════════════════ */
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;
  if (State.tasks.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">📝</span>Нет задач на сегодня</div>`;
    updateTaskProgress();
    return;
  }
  list.innerHTML = State.tasks.map(t => {
    const bday = hasBirthday(t);
    return `<div class="task-item ${t.done ? 'done' : ''} ${bday ? 'birthday' : ''}" data-id="${t.id}">
      <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
      <span class="task-text">${escHtml(t.text)}</span>
      <button class="task-del" onclick="deleteTask('${t.id}')" title="Удалить">✕</button>
    </div>`;
  }).join('');
  updateTaskProgress();
}

function updateTaskProgress() {
  const done = State.tasks.filter(t => t.done).length;
  const total = State.tasks.length;
  const pct = total ? Math.round((done/total)*100) : 0;
  const fill = document.getElementById('taskProgressFill');
  const label = document.getElementById('taskProgressLabel');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = `${done}/${total}`;
}

function addTask(text, birthday = false) {
  if (!text.trim()) return;
  State.tasks.push({ id: uid(), text: text.trim(), done: false, birthday, created: Date.now() });
  Store.save();
  renderTasks();
}

function toggleTask(id) {
  const t = State.tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; Store.save(); renderTasks(); Audio.playBeep(t.done ? 1046 : 440, 0.1); }
}

function deleteTask(id) {
  State.tasks = State.tasks.filter(t => t.id !== id);
  Store.save(); renderTasks();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ══════════════════════════════
   ALARMS RENDER
══════════════════════════════ */
function renderAlarms() {
  const list = document.getElementById('alarmList');
  if (!list) return;
  if (State.alarms.length === 0) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">⏰</span>Нет будильников.<br>Нажмите + чтобы добавить</div>`;
    return;
  }
  list.innerHTML = State.alarms.map(a => {
    const dayBadges = DAY_NAMES.map((d, i) =>
      `<span class="day-badge ${a.days.includes(i) ? 'on' : ''}">${d}</span>`
    ).join('');
    return `<div class="alarm-item ${a.active ? 'active-alarm' : ''}" onclick="openEditAlarm('${a.id}')">
      <div class="alarm-time-block">
        <div class="alarm-time">${a.time}</div>
        <div class="alarm-label">${escHtml(a.label || (a.type === 'smart' ? 'Умный' : 'Обычный'))}</div>
        <div class="alarm-days">${dayBadges}
          <span class="alarm-type-badge">${a.type === 'smart' ? '🤖 Smart' : '⏰ Classic'}</span>
        </div>
      </div>
      <div class="alarm-toggle" onclick="event.stopPropagation()">
        <label class="toggle">
          <input type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleAlarm('${a.id}', this.checked)">
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
        </label>
      </div>
    </div>`;
  }).join('');
}

function toggleAlarm(id, active) {
  const a = State.alarms.find(a => a.id === id);
  if (a) { a.active = active; Store.save(); renderAlarms(); }
}

function openEditAlarm(id) {
  const a = State.alarms.find(a => a.id === id);
  openAlarmModal(a);
}

/* ══════════════════════════════
   ALARM MODAL
══════════════════════════════ */
let editingAlarmId = null;

function openAlarmModal(alarm = null) {
  editingAlarmId = alarm?.id || null;
  const modal = document.getElementById('alarmModal');
  modal.querySelector('.modal-title').textContent = alarm ? 'Редактировать будильник' : 'Новый будильник';

  // Time
  const now = new Date();
  document.getElementById('alarmTimeInput').value = alarm?.time || `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  // Label
  document.getElementById('alarmLabelInput').value = alarm?.label || '';
  // Days
  const selectedDays = alarm?.days || [0,1,2,3,4]; // Weekdays default
  document.querySelectorAll('.day-btn[data-day]').forEach(btn => {
    const d = parseInt(btn.dataset.day);
    btn.classList.toggle('selected', selectedDays.includes(d));
  });
  // Type
  const type = alarm?.type || 'classic';
  document.querySelectorAll('.type-btn[data-type]').forEach(b => {
    b.classList.toggle('selected', b.dataset.type === type);
  });
  // Melody select
  populateMelodySelect('alarmMelodySelect', alarm?.melody || State.selectedMelody);
  // Delete btn
  document.getElementById('alarmDeleteBtn').style.display = alarm ? 'flex' : 'none';
  openModal('alarmModal');
}

function saveAlarm() {
  const time = document.getElementById('alarmTimeInput').value;
  if (!time) { showToast('Укажите время', 'error'); return; }
  const days = [...document.querySelectorAll('.day-btn[data-day].selected')].map(b => parseInt(b.dataset.day));
  const type = document.querySelector('.type-btn.selected')?.dataset.type || 'classic';
  const label = document.getElementById('alarmLabelInput').value.trim();
  const melody = document.getElementById('alarmMelodySelect').value;

  if (editingAlarmId) {
    const a = State.alarms.find(a => a.id === editingAlarmId);
    if (a) Object.assign(a, { time, days, type, label, melody });
  } else {
    State.alarms.push({ id: uid(), time, days, type, label, melody, active: true });
  }
  Store.save(); renderAlarms(); closeModal('alarmModal');
  showToast('✅ Будильник сохранён', 'success');
}

function deleteAlarm() {
  if (!editingAlarmId) return;
  State.alarms = State.alarms.filter(a => a.id !== editingAlarmId);
  Store.save(); renderAlarms(); closeModal('alarmModal');
  showToast('🗑 Удалено', 'info');
}

/* ══════════════════════════════
   MELODY
══════════════════════════════ */
function populateMelodySelect(elId, selected) {
  const sel = document.getElementById(elId);
  if (!sel) return;
  const opts = Object.entries(Audio.MELODIES).map(([k, v]) =>
    `<option value="${k}" ${k === selected ? 'selected' : ''}>${v.icon} ${v.name}</option>`
  );
  State.customMelodies.forEach(c => {
    opts.push(`<option value="${c.name}" ${c.name === selected ? 'selected' : ''}>🎵 ${c.name}</option>`);
  });
  sel.innerHTML = opts.join('');
}

function renderMelodies() {
  const grid = document.getElementById('melodyGrid');
  if (!grid) return;
  const builtIn = Object.entries(Audio.MELODIES).map(([k, v]) =>
    `<div class="melody-item ${State.selectedMelody===k?'selected':''}" onclick="selectMelody('${k}')">
      <div class="melody-icon">${v.icon}</div>
      <div class="melody-name">${v.name}</div>
    </div>`
  );
  const custom = State.customMelodies.map(c =>
    `<div class="melody-item ${State.selectedMelody===c.name?'selected':''}" onclick="selectMelody('${c.name}')">
      <div class="melody-icon">🎵</div>
      <div class="melody-name">${escHtml(c.name)}</div>
    </div>`
  );
  grid.innerHTML = [...builtIn, ...custom].join('');
}

function selectMelody(id) {
  State.selectedMelody = id;
  Store.save();
  renderMelodies();
  // Preview
  Audio.resume();
  const custom = State.customMelodies.find(c => c.name === id);
  if (custom) Audio.playCustom(custom.dataUrl, State.volume);
  else Audio.playMelody(id, State.volume);
  setTimeout(() => Audio.stop(), 3000);
}

function handleMelodyUpload(file) {
  if (!file || !file.type.startsWith('audio/')) { showToast('Только аудио файлы', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const name = file.name.replace(/\.[^/.]+$/, '');
    State.customMelodies.push({ name, dataUrl: e.target.result });
    State.selectedMelody = name;
    Store.save(); renderMelodies();
    showToast('🎵 Мелодия добавлена', 'success');
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════
   WEATHER UI
══════════════════════════════ */
async function loadWeatherUI() {
  const data = await Weather.fetch();
  // Mini card on home
  const mini = document.getElementById('weatherMiniTemp');
  const miniIcon = document.getElementById('weatherMiniIcon');
  const miniDesc = document.getElementById('weatherMiniDesc');
  if (mini) mini.textContent = `${data.temp}°`;
  if (miniIcon) miniIcon.textContent = data.icon;
  if (miniDesc) miniDesc.textContent = data.desc;

  // Full weather page
  const fullTemp = document.getElementById('weatherFullTemp');
  if (fullTemp) fullTemp.textContent = `${data.temp}°C`;
  document.getElementById('weatherFullIcon').textContent = data.icon;
  document.getElementById('weatherFullDesc').textContent = data.desc;
  document.getElementById('weatherHumidity').textContent = `${data.humidity}%`;
  document.getElementById('weatherWind').textContent = `${data.wind} м/с`;
  document.getElementById('weatherPressure').textContent = `${data.pressure} мм`;
  document.getElementById('weatherAdvice').textContent = Weather.advice(data);
}

/* ══════════════════════════════
   QUOTES UI
══════════════════════════════ */
function renderQuote() {
  const quotes = getAllQuotes();
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  document.getElementById('quoteText').textContent = q.text;
  document.getElementById('quoteAuthor').textContent = '— ' + q.author;
  document.getElementById('quoteCategory').textContent = State.quoteCategory === 'all' ? '✨ Все категории' : State.quoteCategory;
}

function setQuoteCategory(cat) {
  State.quoteCategory = cat;
  Store.save();
  document.querySelectorAll('.cat-btn[data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  renderQuote();
}

/* ══════════════════════════════
   DRUM PICKER (Timer)
══════════════════════════════ */
class DrumPicker {
  constructor(el, max, value = 0, onChange) {
    this.el = el;
    this.max = max;
    this.value = value;
    this.onChange = onChange;
    this.dragging = false;
    this.startY = 0;
    this.startVal = 0;
    this.init();
  }

  init() {
    this.render();
    this.el.addEventListener('touchstart', e => this.onDown(e.touches[0].clientY), { passive: true });
    this.el.addEventListener('touchmove', e => { e.preventDefault(); this.onMove(e.touches[0].clientY); }, { passive: false });
    this.el.addEventListener('touchend', () => this.onUp());
    this.el.addEventListener('mousedown', e => this.onDown(e.clientY));
    window.addEventListener('mousemove', e => { if (this.dragging) this.onMove(e.clientY); });
    window.addEventListener('mouseup', () => { if (this.dragging) this.onUp(); });
    this.el.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      this.setValue((this.value + delta + this.max) % this.max);
    }, { passive: false });
  }

  onDown(y) { this.dragging = true; this.startY = y; this.startVal = this.value; }
  onMove(y) {
    if (!this.dragging) return;
    const dy = this.startY - y;
    const delta = Math.round(dy / 30);
    this.setValue((this.startVal + delta + this.max * 100) % this.max);
  }
  onUp() { this.dragging = false; }

  setValue(v) {
    this.value = ((v % this.max) + this.max) % this.max;
    this.render();
    this.onChange?.(this.value);
  }

  render() {
    const items = [];
    for (let i = -2; i <= 2; i++) {
      const v = ((this.value + i) % this.max + this.max) % this.max;
      const cls = i === 0 ? 'selected' : Math.abs(i) === 1 ? 'near' : '';
      items.push(`<div class="drum-item ${cls}" style="transform:scale(${1 - Math.abs(i)*0.12})">${pad(v)}</div>`);
    }
    this.el.querySelector('.drum-list').innerHTML = items.join('');
  }
}

let drums = {};

function initDrums() {
  drums.h = new DrumPicker(
    document.getElementById('drumH'), 24, State.timerDrums.h,
    v => { State.timerDrums.h = v; updateTimerDisplay(); }
  );
  drums.m = new DrumPicker(
    document.getElementById('drumM'), 60, State.timerDrums.m,
    v => { State.timerDrums.m = v; updateTimerDisplay(); }
  );
  drums.s = new DrumPicker(
    document.getElementById('drumS'), 60, State.timerDrums.s,
    v => { State.timerDrums.s = v; updateTimerDisplay(); }
  );
}

function updateTimerDisplay() {
  const total = State.timerDrums.h * 3600 + State.timerDrums.m * 60 + State.timerDrums.s;
  const el = document.getElementById('timerDisplay');
  if (el) el.textContent = fmtTimer(total);
}

/* ══════════════════════════════
   TIMER
══════════════════════════════ */
function startTimer() {
  if (State.timerRunning) return;
  const total = State.timerDrums.h * 3600 + State.timerDrums.m * 60 + State.timerDrums.s;
  if (!total) { showToast('Установите время', 'error'); return; }
  State.timerRunning = true;
  State.timerEnd = Date.now() + total * 1000;
  document.getElementById('timerStartBtn').style.display = 'none';
  document.getElementById('timerPauseBtn').style.display = 'flex';
  document.getElementById('drumSection').style.display = 'none';
  document.getElementById('timerDisplay').style.display = 'block';
  State.timerInterval = setInterval(tickTimer, 250);
  tickTimer();
}

function tickTimer() {
  const rem = Math.max(0, Math.ceil((State.timerEnd - Date.now()) / 1000));
  const el = document.getElementById('timerDisplay');
  if (el) el.textContent = fmtTimer(rem);
  if (rem <= 0) { timerDone(); }
}

function pauseTimer() {
  clearInterval(State.timerInterval);
  State.timerRunning = false;
  document.getElementById('timerStartBtn').style.display = 'flex';
  document.getElementById('timerPauseBtn').style.display = 'none';
}

function resetTimer() {
  clearInterval(State.timerInterval);
  State.timerRunning = false;
  State.timerEnd = null;
  document.getElementById('timerStartBtn').style.display = 'flex';
  document.getElementById('timerPauseBtn').style.display = 'none';
  document.getElementById('drumSection').style.display = 'flex';
  document.getElementById('timerDisplay').style.display = 'none';
  updateTimerDisplay();
}

function timerDone() {
  clearInterval(State.timerInterval);
  State.timerRunning = false;
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  Audio.resume();
  Audio.playMelody('chime', State.volume);
  setTimeout(() => Audio.stop(), 4000);
  showToast('⏰ Время вышло!', 'success');
  resetTimer();
}

/* ══════════════════════════════
   STOPWATCH
══════════════════════════════ */
function startStopwatch() {
  if (State.stopwatchRunning) return;
  State.stopwatchRunning = true;
  State.stopwatchStart = Date.now();
  document.getElementById('swStartBtn').style.display = 'none';
  document.getElementById('swPauseBtn').style.display = 'flex';
  State.stopwatchInterval = setInterval(tickSw, 33);
}

function pauseStopwatch() {
  State.stopwatchOffset += Date.now() - State.stopwatchStart;
  clearInterval(State.stopwatchInterval);
  State.stopwatchRunning = false;
  document.getElementById('swStartBtn').style.display = 'flex';
  document.getElementById('swPauseBtn').style.display = 'none';
}

function resetStopwatch() {
  clearInterval(State.stopwatchInterval);
  State.stopwatchRunning = false;
  State.stopwatchOffset = 0;
  State.stopwatchStart = null;
  State.laps = [];
  document.getElementById('swDisplay').textContent = '00:00.00';
  document.getElementById('swStartBtn').style.display = 'flex';
  document.getElementById('swPauseBtn').style.display = 'none';
  document.getElementById('lapList').innerHTML = '';
}

function lapStopwatch() {
  const el = document.getElementById('swDisplay');
  const txt = el.textContent;
  const elapsed = State.stopwatchOffset + (State.stopwatchRunning ? Date.now() - State.stopwatchStart : 0);
  const prev = State.laps.length ? State.laps[State.laps.length-1].total : 0;
  State.laps.push({ n: State.laps.length + 1, time: txt, split: fmt(elapsed - prev), total: elapsed });
  renderLaps();
  Audio.playBeep(880, 0.08);
}

function tickSw() {
  const elapsed = State.stopwatchOffset + Date.now() - State.stopwatchStart;
  document.getElementById('swDisplay').textContent = fmt(elapsed);
}

function renderLaps() {
  const list = document.getElementById('lapList');
  if (!list) return;
  const times = State.laps.map(l => l.total);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);
  list.innerHTML = [...State.laps].reverse().map(l => {
    const cls = l.laps > 1 ? (l.total === fastest ? 'lap-best' : l.total === slowest ? 'lap-worst' : '') : '';
    return `<div class="lap-item">
      <span class="lap-num">Круг ${l.n}</span>
      <span>${l.split}</span>
      <span class="${cls}">${l.time}</span>
    </div>`;
  }).join('');
}

/* ══════════════════════════════
   MODAL HELPERS
══════════════════════════════ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ══════════════════════════════
   TOAST
══════════════════════════════ */
function showToast(msg, type = 'info', dur = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = '0.3s ease'; setTimeout(() => toast.remove(), 300); }, dur);
}

/* ══════════════════════════════
   NAVIGATION
══════════════════════════════ */
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');
  // Page-specific refresh
  if (pageId === 'pageWeather') loadWeatherUI();
  if (pageId === 'pageQuotes') renderQuote();
  if (pageId === 'pageSleep') renderSleepChart();
  if (pageId === 'pageMelody') renderMelodies();
}

/* ══════════════════════════════
   PWA INSTALL
══════════════════════════════ */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBar').classList.add('visible');
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') showToast('✅ Приложение установлено!', 'success');
    document.getElementById('installBar').classList.remove('visible');
    deferredPrompt = null;
  });
}

/* ══════════════════════════════
   SERVICE WORKER
══════════════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(e => console.log('SW error:', e));
  }
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  Store.load();
  initTheme();
  startClock();
  registerSW();
  renderAlarms();
  renderTasks();
  renderSleepChart();

  // Load weather in background
  loadWeatherUI().catch(() => {});

  // Volume slider
  const volSlider = document.getElementById('volumeSlider');
  if (volSlider) {
    volSlider.value = State.volume;
    volSlider.addEventListener('input', e => {
      State.volume = parseFloat(e.target.value);
      Audio.setVolume(State.volume);
      Store.save();
    });
  }

  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });
  navigate('pageHome');

  // Timer drums
  initDrums();
  updateTimerDisplay();

  // Drum display toggle
  document.getElementById('timerDisplay').style.display = 'none';

  // Timer tab / stopwatch tab
  document.getElementById('tabTimer').addEventListener('click', () => {
    document.getElementById('tabTimer').classList.add('active');
    document.getElementById('tabStopwatch').classList.remove('active');
    document.getElementById('timerSection').style.display = 'block';
    document.getElementById('stopwatchSection').style.display = 'none';
  });
  document.getElementById('tabStopwatch').addEventListener('click', () => {
    document.getElementById('tabStopwatch').classList.add('active');
    document.getElementById('tabTimer').classList.remove('active');
    document.getElementById('timerSection').style.display = 'none';
    document.getElementById('stopwatchSection').style.display = 'block';
  });

  // Timer controls
  document.getElementById('timerStartBtn').addEventListener('click', () => { Audio.resume(); startTimer(); });
  document.getElementById('timerPauseBtn').addEventListener('click', pauseTimer);
  document.getElementById('timerResetBtn').addEventListener('click', resetTimer);

  // Stopwatch controls
  document.getElementById('swStartBtn').addEventListener('click', () => { Audio.resume(); startStopwatch(); });
  document.getElementById('swPauseBtn').addEventListener('click', pauseStopwatch);
  document.getElementById('swResetBtn').addEventListener('click', resetStopwatch);
  document.getElementById('swLapBtn').addEventListener('click', lapStopwatch);

  // Task add
  const taskInput = document.getElementById('taskInput');
  const taskAddBtn = document.getElementById('taskAddBtn');
  const taskBdayCheck = document.getElementById('taskBdayCheck');
  taskAddBtn.addEventListener('click', () => {
    addTask(taskInput.value, taskBdayCheck?.checked || false);
    taskInput.value = '';
    if (taskBdayCheck) taskBdayCheck.checked = false;
  });
  taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') taskAddBtn.click();
  });

  // Alarm FAB
  document.getElementById('alarmFab').addEventListener('click', () => { Audio.resume(); openAlarmModal(); });
  // Alarm save
  document.getElementById('alarmSaveBtn').addEventListener('click', saveAlarm);
  // Alarm delete
  document.getElementById('alarmDeleteBtn').addEventListener('click', deleteAlarm);
  // Day buttons in modal
  document.querySelectorAll('.day-btn[data-day]').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });
  // Type buttons
  document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn[data-type]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Alarm ring controls
  document.getElementById('ringStopBtn').addEventListener('click', () => stopAlarm(true));
  document.getElementById('ringSnoozeBtn').addEventListener('click', snoozeAlarm);

  // Assistant close
  document.getElementById('assistantCloseBtn').addEventListener('click', closeAssistant);

  // Sleep rating
  document.querySelectorAll('#sleepPromptStars .star-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sleepPromptStars .star-btn').forEach((s, j) => {
        s.classList.toggle('lit', j <= i);
      });
      setTimeout(() => submitSleepRating(i + 1), 400);
    });
    btn.addEventListener('mouseenter', () => {
      document.querySelectorAll('#sleepPromptStars .star-btn').forEach((s, j) => {
        s.classList.toggle('lit', j <= i);
      });
    });
  });
  document.getElementById('sleepPromptStars').addEventListener('mouseleave', () => {
    document.querySelectorAll('#sleepPromptStars .star-btn').forEach(s => {
      const current = parseInt(document.getElementById('sleepRatingPrompt')._current || 0);
      // Reset to saved
    });
  });
  document.getElementById('sleepSkipBtn').addEventListener('click', () => {
    document.getElementById('sleepRatingPrompt').classList.remove('visible');
    document.getElementById('sleepRatingPrompt')._callback?.();
  });

  // Sleep stars on sleep page
  document.querySelectorAll('#sleepPageStars .star-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sleepPageStars .star-btn').forEach((s,j) => s.classList.toggle('lit', j<=i));
      submitSleepRating(i+1);
    });
    btn.addEventListener('mouseenter', () => {
      document.querySelectorAll('#sleepPageStars .star-btn').forEach((s,j) => s.classList.toggle('lit', j<=i));
    });
  });

  // Quotes category
  document.querySelectorAll('.cat-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => setQuoteCategory(btn.dataset.cat));
    btn.classList.toggle('active', btn.dataset.cat === State.quoteCategory);
  });
  document.getElementById('nextQuoteBtn').addEventListener('click', renderQuote);

  // Theme toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const themes = ['auto', 'dark', 'light'];
    const idx = themes.indexOf(State.theme);
    State.theme = themes[(idx + 1) % themes.length];
    applyTheme(State.theme);
    Store.save();
    const icons = { auto: '🌓', dark: '🌙', light: '☀️' };
    document.getElementById('themeToggleBtn').textContent = icons[State.theme];
  });

  // Melody upload
  document.getElementById('melodyUploadInput').addEventListener('change', e => {
    if (e.target.files[0]) handleMelodyUpload(e.target.files[0]);
  });
  document.getElementById('melodyUploadBtn').addEventListener('click', () => {
    document.getElementById('melodyUploadInput').click();
  });

  // Weather refresh
  document.getElementById('weatherRefreshBtn').addEventListener('click', () => {
    State.weatherLastFetch = 0;
    loadWeatherUI().then(() => showToast('🌤 Погода обновлена', 'success'));
  });

  // PWA install
  document.getElementById('installPwaBtn').addEventListener('click', installPWA);
  document.getElementById('installDismissBtn').addEventListener('click', () => {
    document.getElementById('installBar').classList.remove('visible');
  });

  // iOS standalone check
  if (window.navigator.standalone) {
    document.getElementById('installBar').classList.remove('visible');
  }

  // Wake lock (prevent screen off)
  if ('wakeLock' in navigator) {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && State.currentAlarmId) {
        try { await navigator.wakeLock.request('screen'); } catch(e){}
      }
    });
  }

  console.log('🚀 Ailarm ready!');
});
