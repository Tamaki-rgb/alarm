// script.js - РАДИКАЛЬНОЕ ИСПРАВЛЕНИЕ
let alarms = JSON.parse(localStorage.getItem('alarms')) || [];
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentTheme = localStorage.getItem('theme') || 'light';
let timerInterval = null;
let stopwatchInterval = null;
let timerSeconds = 0;
let stopwatchSeconds = 0;
let isTimerRunning = false;
let isStopwatchRunning = false;
let lastCheckDate = new Date().toISOString().split('T')[0];
let currentVibrationId = null;
let audioContext = null;
let alarmAudio = null;
let isAlarmActive = false;
let currentAlarmData = null;

const greetings = [
    "Доброе утро. Надеюсь, ты хорошо выспался, ведь столько всего тебя ждет.",
    "Герой, новый день уже здесь. Я рада тебя видеть.",
    "Доброе утро. Пусть сегодня всё складывается легко и приятно.",
    "Проснись и пой. Я здесь и готова помочь тебе с планами.",
    "Утро доброе. Ты сегодня выглядишь особенно хорошо.",
    "Новый день начинается. Давай сделаем его достойным тебя."
];

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ КНОПОК ====================
// Эти функции вызываются напрямую из HTML onclick

window.stopAlarmGlobal = function() {
    console.log('🛑 ГЛОБАЛЬНАЯ ФУНКЦИЯ ВЫКЛЮЧЕНИЯ');
    
    // Останавливаем звук
    if (window.alarmAudio) {
        window.alarmAudio.loop = false;
        window.alarmAudio.pause();
        window.alarmAudio.currentTime = 0;
        window.alarmAudio.src = '';
        window.alarmAudio.load();
        window.alarmAudio = null;
    }
    
    // Останавливаем вибрацию
    if (window.currentVibrationId) {
        clearInterval(window.currentVibrationId);
        window.currentVibrationId = null;
    }
    if (navigator.vibrate) {
        navigator.vibrate(0);
    }
    
    // Выходим из fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    
    // Показываем экран пробуждения
    const screen = document.getElementById('alarm-active');
    const wasSmart = window.currentAlarmData && window.currentAlarmData.type === 'smart';
    
    screen.innerHTML = `
        <div style="text-align: center; width: 100%; pointer-events: auto;">
            <div style="font-size: 5rem; margin-bottom: 20px;">🌅</div>
            <h2 style="font-size: 2rem; margin: 20px 0;">Доброе утро!</h2>
            <p style="font-size: 1.3rem; opacity: 0.8; margin: 20px 0;">
                ${wasSmart ? 'Сейчас расскажу о погоде и задачах' : 'Хорошего дня!'}
            </p>
            <button onclick="window.wakeUpGlobal(${wasSmart})" style="
                padding: 30px 60px; 
                font-size: 1.8rem; 
                background: #4CAF50; 
                color: white; 
                border: none; 
                border-radius: 20px; 
                cursor: pointer; 
                font-weight: bold; 
                margin-top: 40px;
                pointer-events: auto;
            ">
                ☀️ Окончательно пробудился!
            </button>
        </div>
    `;
};

window.snoozeGlobal = function() {
    console.log('⏸️ ГЛОБАЛЬНАЯ ФУНКЦИЯ ОТЛОЖИТЬ');
    
    if (window.alarmAudio) {
        window.alarmAudio.loop = false;
        window.alarmAudio.pause();
        window.alarmAudio.currentTime = 0;
        window.alarmAudio.src = '';
        window.alarmAudio.load();
        window.alarmAudio = null;
    }
    
    if (window.currentVibrationId) {
        clearInterval(window.currentVibrationId);
        window.currentVibrationId = null;
    }
    if (navigator.vibrate) {
        navigator.vibrate(0);
    }
    
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    
    if (window.currentAlarmData) {
        window.currentAlarmData.triggeredToday = false;
        localStorage.setItem('alarms', JSON.stringify(alarms));
    }
    
    const snoozeData = window.currentAlarmData;
    
    const screen = document.getElementById('alarm-active');
    screen.classList.add('hidden');
    screen.innerHTML = '';
    
    window.isAlarmActive = false;
    window.currentAlarmData = null;
    
    setTimeout(() => {
        if (!window.isAlarmActive && snoozeData) {
            triggerAlarm(snoozeData);
        }
    }, 300000);
};

window.wakeUpGlobal = function(wasSmart) {
    console.log('☀️ ГЛОБАЛЬНАЯ ФУНКЦИЯ ПРОБУЖДЕНИЯ');
    
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    
    const screen = document.getElementById('alarm-active');
    screen.classList.add('hidden');
    screen.innerHTML = '';
    
    resetTriggeredFlags();
    window.isAlarmActive = false;
    window.currentAlarmData = null;
    
    if (wasSmart) {
        setTimeout(startSmartAssistant, 500);
    }
};

// Экспортируем переменные в window для доступа из глобальных функций
window.alarmAudio = null;
window.currentVibrationId = null;
window.isAlarmActive = false;
window.currentAlarmData = null;

// ==================== АУДИО ====================

function generateTimerSound() {
    if (!audioContext || audioContext.state === 'closed') {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) { return; }
    }
    
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.frequency.value = 1200;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
}

// ==================== ТЕМА ====================

document.documentElement.setAttribute('data-theme', currentTheme);
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.onclick = () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    };
}

// ==================== РЕНДЕРИНГ ====================

function renderAlarms() {
    const list = document.getElementById('alarms-list');
    if (!list) return;
    list.innerHTML = alarms.map((alarm, i) => `
        <div class="alarm-item">
            <div class="alarm-time">${alarm.time}</div>
            <div class="alarm-info">${alarm.days.join(', ')} • ${alarm.type === 'smart' ? '🤖 Умный' : '⏰ Обычный'}</div>
            <button class="delete-btn" onclick="deleteAlarm(${i})">✕</button>
        </div>
    `).join('') || '<p style="opacity:0.6">Будильников нет</p>';
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === today);
    list.innerHTML = todayTasks.length ? todayTasks.map((task) => `
        <div class="task-item">
            <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${tasks.indexOf(task)})">
            <span class="${task.done ? 'done' : ''}">${task.text}</span>
            <button class="delete-btn" onclick="deleteTask(${tasks.indexOf(task)})">✕</button>
        </div>
    `).join('') : '<p style="opacity:0.6">Задач на сегодня нет</p>';
}

// ==================== БУДИЛЬНИК ====================

function resetTriggeredFlags() {
    alarms.forEach(alarm => alarm.triggeredToday = false);
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

function checkDayChange() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== lastCheckDate) {
        lastCheckDate = today;
        resetTriggeredFlags();
    }
}

setInterval(() => {
    checkDayChange();
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][now.getDay()];

    alarms.forEach((alarm) => {
        if (alarm.time === currentTime && alarm.days.includes(currentDay) && !alarm.triggeredToday && !window.isAlarmActive) {
            alarm.triggeredToday = true;
            localStorage.setItem('alarms', JSON.stringify(alarms));
            triggerAlarm(alarm);
        }
    });
}, 1000);

function triggerAlarm(alarm) {
    console.log('🔔 Будильник сработал');
    
    if (window.isAlarmActive) return;
    
    window.isAlarmActive = true;
    window.currentAlarmData = alarm;
    
    const screen = document.getElementById('alarm-active');
    screen.classList.remove('hidden');
    
    if (screen.requestFullscreen) {
        screen.requestFullscreen().catch(() => {});
    }
    
    // 🔧 ВАЖНО: кнопки вызывают глобальные функции через window.
    screen.innerHTML = `
        <div style="text-align: center; width: 100%; pointer-events: auto;">
            <h1 style="font-size: 6rem; margin: 0; animation: alarmBlink 0.5s infinite;">${alarm.time}</h1>
            <p style="font-size: 2.5rem; margin: 30px 0; font-weight: bold;">⏰ ПОРА ПРОСЫПАТЬСЯ!</p>
            <div style="display: flex; gap: 20px; margin-top: 50px; flex-wrap: wrap; justify-content: center;">
                <button onclick="window.snoozeGlobal()" style="
                    padding: 25px 40px; 
                    font-size: 1.4rem; 
                    background: #ff9500; 
                    color: white; 
                    border: none; 
                    border-radius: 15px; 
                    cursor: pointer; 
                    font-weight: bold;
                    pointer-events: auto;
                ">Отложить (5 мин)</button>
                
                <button onclick="window.stopAlarmGlobal()" style="
                    padding: 25px 40px; 
                    font-size: 1.4rem; 
                    background: #f44336; 
                    color: white; 
                    border: none; 
                    border-radius: 15px; 
                    cursor: pointer; 
                    font-weight: bold;
                    pointer-events: auto;
                ">ВЫКЛЮЧИТЬ</button>
            </div>
        </div>
    `;
    
    // Звук
    setTimeout(() => {
        try {
            window.alarmAudio = new Audio('sounds/kolokolnyy-perekhod-43-5574f5.mp3');
            window.alarmAudio.volume = 1.0;
            window.alarmAudio.loop = true;
            window.alarmAudio.play().catch(() => {});
        } catch(e) {}
    }, 300);
    
    // Вибрация
    if (navigator.vibrate) {
        window.currentVibrationId = setInterval(() => {
            navigator.vibrate([600, 200, 600, 200]);
        }, 1600);
    }
}

// ==================== АССИСТЕНТ ====================

async function startSmartAssistant() {
    const screen = document.getElementById('alarm-active');
    screen.classList.remove('hidden');
    screen.innerHTML = '<div style="text-align:center;color:white;padding:40px;"><h2>🤖 Ассистент говорит...</h2><p id="assistant-text"></p></div>';
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    document.getElementById('assistant-text').textContent = greeting;
    
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(greeting);
        u.lang = 'ru-RU';
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
    }
    
    setTimeout(async () => {
        try {
            const res = await fetch('https://wttr.in/?format=j1');
            const data = await res.json();
            const weather = `Погода: ${data.current_condition[0].temp_C}°, ${data.current_condition[0].weatherDesc[0].value}`;
            document.getElementById('assistant-text').textContent = weather;
            if ('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance(weather);
                u.lang = 'ru-RU';
                u.rate = 0.9;
                window.speechSynthesis.speak(u);
            }
        } catch(e) {}
        
        setTimeout(() => {
            const today = new Date().toISOString().split('T')[0];
            const t = tasks.filter(x => x.date === today && !x.done);
            const text = t.length ? 'Задачи: ' + t.map(x => x.text).join('. ') : 'Задач нет';
            document.getElementById('assistant-text').textContent = text;
            if ('speechSynthesis' in window) {
                const u = new SpeechSynthesisUtterance(text);
                u.lang = 'ru-RU';
                u.rate = 0.9;
                window.speechSynthesis.speak(u);
            }
            
            setTimeout(() => {
                screen.classList.add('hidden');
                screen.innerHTML = '';
            }, 5000);
        }, 3000);
    }, 2000);
}

// ==================== ТАЙМЕР ====================

let isStopwatchMode = false;

function initDrums() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    if (!minDrum || !secDrum) return;
    
    let html = '';
    for (let i = 0; i < 300; i++) html += `<div class="drum-item">${(i % 60).toString().padStart(2,'0')}</div>`;
    minDrum.innerHTML = html;
    secDrum.innerHTML = html;
    
    const mid = 120 * 40;
    minDrum.scrollTop = mid;
    secDrum.scrollTop = mid;
}

function getTimerValue() {
    const m = document.getElementById('minutes-drum');
    const s = document.getElementById('seconds-drum');
    if (!m || !s) return 0;
    return (Math.round(m.scrollTop / 40) % 60) * 60 + (Math.round(s.scrollTop / 40) % 60);
}

function handleTimerStart() {
    if (isStopwatchMode) {
        if (isStopwatchRunning) return;
        isStopwatchRunning = true;
        stopwatchInterval = setInterval(() => {
            stopwatchSeconds++;
            const d = document.getElementById('timer-display');
            if (d) d.textContent = new Date(stopwatchSeconds * 1000).toISOString().substr(11, 8);
        }, 1000);
    } else {
        if (isTimerRunning) return;
        timerSeconds = getTimerValue();
        if (timerSeconds > 0) {
            isTimerRunning = true;
            timerInterval = setInterval(() => {
                timerSeconds--;
                const d = document.getElementById('timer-display');
                if (d) d.textContent = `${Math.floor(timerSeconds/60).toString().padStart(2,'0')}:${(timerSeconds%60).toString().padStart(2,'0')}`;
                if (timerSeconds <= 0) {
                    clearInterval(timerInterval);
                    isTimerRunning = false;
                    generateTimerSound();
                }
            }, 1000);
        }
    }
}

function handleTimerPause() {
    clearInterval(timerInterval);
    clearInterval(stopwatchInterval);
    isTimerRunning = false;
    isStopwatchRunning = false;
}

function handleTimerReset() {
    clearInterval(timerInterval);
    clearInterval(stopwatchInterval);
    timerSeconds = 0;
    stopwatchSeconds = 0;
    isTimerRunning = false;
    isStopwatchRunning = false;
    const d = document.getElementById('timer-display');
    if (d) d.textContent = '00:00';
}

function toggleStopwatch() {
    isStopwatchMode = !isStopwatchMode;
    document.getElementById('stopwatch-btn').textContent = isStopwatchMode ? 'Таймер' : 'Секундомер';
    document.querySelector('.drum-container').style.display = isStopwatchMode ? 'none' : 'grid';
    handleTimerReset();
}

// ==================== МОДАЛКИ ====================

function openAlarmModal() {
    const modal = document.getElementById('alarm-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Новый будильник</h3>
            <input type="time" id="alarm-time">
            <div class="days-selector">
                ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `<label><input type="checkbox" value="${d}"> ${d}</label>`).join('')}
            </div>
            <div class="type-selector">
                <label><input type="radio" name="type" value="normal" checked> Обычный</label>
                <label><input type="radio" name="type" value="smart"> Умный</label>
            </div>
            <button onclick="saveAlarm()">Сохранить</button>
            <button onclick="closeModal('alarm-modal')" style="background:#999">Отмена</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

function saveAlarm() {
    const time = document.getElementById('alarm-time').value;
    const days = [...document.querySelectorAll('#alarm-modal input[type="checkbox"]:checked')].map(e => e.value);
    const type = document.querySelector('#alarm-modal input[name="type"]:checked').value;
    if (time && days.length) {
        alarms.push({ time, days, type, triggeredToday: false });
        localStorage.setItem('alarms', JSON.stringify(alarms));
        renderAlarms();
        closeModal('alarm-modal');
    }
}

function deleteAlarm(i) { alarms.splice(i, 1); localStorage.setItem('alarms', JSON.stringify(alarms)); renderAlarms(); }

function openTaskModal() {
    const modal = document.getElementById('task-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Добавить задачу</h3>
            <input type="text" id="task-text" placeholder="Текст задачи">
            <button onclick="saveTask()">Сохранить</button>
            <button onclick="closeModal('task-modal')" style="background:#999">Отмена</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

function saveTask() {
    const text = document.getElementById('task-text').value.trim();
    if (text) {
        tasks.push({ text, date: new Date().toISOString().split('T')[0], done: false });
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
        closeModal('task-modal');
    }
}

function toggleTask(i) { tasks[i].done = !tasks[i].done; localStorage.setItem('tasks', JSON.stringify(tasks)); renderTasks(); }
function deleteTask(i) { tasks.splice(i, 1); localStorage.setItem('tasks', JSON.stringify(tasks)); renderTasks(); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ==================== СТАРТ ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✨ Ailarm запущен');
    
    document.getElementById('add-alarm-btn').onclick = openAlarmModal;
    document.getElementById('add-task-btn').onclick = openTaskModal;
    document.getElementById('stopwatch-btn').onclick = toggleStopwatch;
    document.getElementById('timer-start').onclick = handleTimerStart;
    document.getElementById('timer-pause').onclick = handleTimerPause;
    document.getElementById('timer-reset').onclick = handleTimerReset;
    
    document.getElementById('alarm-modal').onclick = (e) => { if (e.target.id === 'alarm-modal') closeModal('alarm-modal'); };
    document.getElementById('task-modal').onclick = (e) => { if (e.target.id === 'task-modal') closeModal('task-modal'); };
    
    renderAlarms();
    renderTasks();
    initDrums();
    
    // Предзагрузка голосов
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
});
