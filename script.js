// script.js
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

const greetings = [
    "Доброе утро. Надеюсь, ты хорошо выспался, ведь столько всего тебя ждет.",
    "Герой, новый день уже здесь. Я рада тебя видеть.",
    "Доброе утро. Пусть сегодня всё складывается легко и приятно.",
    "Проснись и пой. Я здесь и готова помочь тебе с планами.",
    "Утро доброе. Ты сегодня выглядишь особенно хорошо.",
    "Новый день начинается. Давай сделаем его достойным тебя."
];

// Initialize Web Audio API
function initAudioContext() {
    if (!audioContext) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
        } catch(e) {
            console.error('Web Audio API not supported:', e);
        }
    }
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

// Generate loud alarm beep sound (800Hz) as backup
function generateAlarmSound() {
    const ctx = initAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.6;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 800;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.setValueAtTime(1.0, now + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    
    osc.start(now);
    osc.stop(now + duration);
}

// Generate timer beep sound (1200Hz) as backup
function generateTimerSound() {
    const ctx = initAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.3;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = 1200;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    
    osc.start(now);
    osc.stop(now + duration);
}

// Theme
document.documentElement.setAttribute('data-theme', currentTheme);
document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';

document.getElementById('theme-toggle').addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
});

// Render
function renderAlarms() {
    const list = document.getElementById('alarms-list');
    list.innerHTML = alarms.map((alarm, i) => `
        <div class="alarm-item">
            <div class="alarm-time">${alarm.time}</div>
            <div class="alarm-info">${alarm.days.join(', ')}</div>
            <button class="delete-btn" onclick="deleteAlarm(${i})">✕</button>
        </div>
    `).join('');
    if (alarms.length === 0) {
        list.innerHTML = '<p style="opacity:0.6">Будильников нет</p>';
    }
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === today);
    
    list.innerHTML = todayTasks.length ? todayTasks.map((task, idx) => `
        <div class="task-item">
            <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${tasks.indexOf(task)})">
            <span class="${task.done ? 'done' : ''}">${task.text}</span>
            <button class="delete-btn" onclick="deleteTask(${tasks.indexOf(task)})" style="margin-left:auto;">✕</button>
        </div>
    `).join('') : '<p style="opacity:0.6">Задач на сегодня нет</p>';
}

// Check for day change and reset triggered flags
function checkDayChange() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== lastCheckDate) {
        lastCheckDate = today;
        resetTriggeredFlags();
    }
}

// Alarm checking every second
setInterval(() => {
    checkDayChange();
    checkAlarms();
}, 1000);

function checkAlarms() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][now.getDay()];

    alarms.forEach((alarm, index) => {
        if (alarm.time === currentTime && alarm.days.includes(currentDay) && !alarm.triggeredToday && !isAlarmActive) {
            alarm.triggeredToday = true;
            localStorage.setItem('alarms', JSON.stringify(alarms));
            triggerAlarm(alarm);
        }
    });
}

let alarmSoundInterval = null;

function triggerAlarm(alarm) {
    isAlarmActive = true;
    
    const screen = document.getElementById('alarm-active');
    screen.classList.remove('hidden');
    
    // Request fullscreen
    if (screen.requestFullscreen) {
        screen.requestFullscreen().catch(err => console.warn('Fullscreen:', err));
    } else if (screen.webkitRequestFullscreen) {
        screen.webkitRequestFullscreen();
    }
    
    screen.innerHTML = `
        <h1 style="font-size: 6rem; margin: 0; animation: blink 0.5s infinite;">${alarm.time}</h1>
        <p style="font-size: 2.5rem; margin: 30px 0; font-weight: bold;">⏰ ПОРА ПРОСЫПАТЬСЯ!</p>
        <div style="display: flex; gap: 20px; margin-top: 50px;">
            <button id="snooze-btn" style="padding: 25px 60px; font-size: 1.6rem; background: #ff9500; color: white; border: none; border-radius: 15px; cursor: pointer; font-weight: bold;">Отложить (5 мин)</button>
            <button id="stop-alarm-btn" style="padding: 25px 60px; font-size: 1.6rem; background: #f44336; color: white; border: none; border-radius: 15px; cursor: pointer; font-weight: bold;">ВЫКЛЮЧИТЬ</button>
        </div>
    `;

    // Add CSS animation
    if (!document.querySelector('style[data-animation]')) {
        const style = document.createElement('style');
        style.setAttribute('data-animation', 'true');
        style.textContent = `
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.3; }
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize audio context
    initAudioContext();
    
    // Start backup beep sound (every 600ms)
    alarmSoundInterval = setInterval(() => {
        generateAlarmSound();
    }, 600);
    
    // Play uploaded alarm music (kolokolnyy-perekhod-43-5574f5.mp3 - 4.4 MB)
    alarmAudio = new Audio('sounds/kolokolnyy-perekhod-43-5574f5.mp3');
    alarmAudio.volume = 1.0;
    alarmAudio.loop = true;
    alarmAudio.play().catch(() => {
        console.log('Using generated alarm sound');
    });

    // Aggressive continuous vibration
    if (navigator.vibrate) {
        currentVibrationId = setInterval(() => {
            navigator.vibrate([600, 200, 600, 200]);
        }, 1600);
    }

    document.getElementById('stop-alarm-btn').onclick = () => {
        stopAlarmSequence(alarm, false);
    };

    document.getElementById('snooze-btn').onclick = () => {
        stopAlarmSequence(alarm, true);
    };
}

function stopAlarmSequence(alarm, isSnooze = false) {
    // Stop all sounds
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        alarmAudio = null;
    }
    
    if (alarmSoundInterval) {
        clearInterval(alarmSoundInterval);
        alarmSoundInterval = null;
    }
    
    // Stop vibration
    if (currentVibrationId) {
        clearInterval(currentVibrationId);
        currentVibrationId = null;
    }
    
    // Exit fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.warn('Exit fullscreen:', err));
    }
    
    const screen = document.getElementById('alarm-active');
    screen.classList.add('hidden');
    
    if (isSnooze) {
        // Set snooze flag
        alarm.triggeredToday = false;
        localStorage.setItem('alarms', JSON.stringify(alarms));
        isAlarmActive = false;
        
        // Trigger again in 5 minutes
        setTimeout(() => {
            if (!isAlarmActive) {
                triggerAlarm(alarm);
            }
        }, 300000);
    } else {
        // Permanently disable for today
        resetTriggeredFlags();
        isAlarmActive = false;
        
        // Show greeting message (no audio, just logged)
        setTimeout(startSmartAssistant, 600);
    }
}

async function startSmartAssistant() {
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    console.log('🎤 Приветствие:', greeting);
    
    // Greeting logged, no audio output
    
    setTimeout(() => {
        console.log('📋 Задачи на сегодня:');
        const today = new Date().toISOString().split('T')[0];
        const todayTasks = tasks.filter(t => t.date === today && !t.done);
        if (todayTasks.length === 0) {
            console.log('На сегодня задач нет');
        } else {
            todayTasks.forEach(task => console.log('- ' + task.text));
        }
    }, 2000);
}

function resetTriggeredFlags() {
    alarms.forEach(alarm => alarm.triggeredToday = false);
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

// Timer + Drum
function initDrums() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    // Create infinite scrolling - repeat items
    const minItems = Array.from({length: 120}, (_,i) => `<div class="drum-item">${(i % 60).toString().padStart(2,'0')}</div>`).join('');
    const secItems = Array.from({length: 120}, (_,i) => `<div class="drum-item">${(i % 60).toString().padStart(2,'0')}</div>`).join('');
    
    minDrum.innerHTML = minItems;
    secDrum.innerHTML = secItems;
    
    // Add styles for highlighting
    const style = document.createElement('style');
    style.textContent = `
        .drum-item.selected {
            background: var(--accent);
            color: white;
            font-weight: bold;
            border-radius: 8px;
        }
    `;
    document.head.appendChild(style);
    
    // Scroll to middle (item 30 which is 0)
    minDrum.scrollTop = 30 * 40;
    secDrum.scrollTop = 30 * 40;
    
    updateDrumHighlight();
}

function updateDrumHighlight() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    if (!minDrum || !secDrum) return;
    
    // Remove old highlights
    document.querySelectorAll('.drum-item.selected').forEach(el => el.classList.remove('selected'));
    
    // Add new highlights to center items
    const minItems = minDrum.querySelectorAll('.drum-item');
    const secItems = secDrum.querySelectorAll('.drum-item');
    
    const minIndex = Math.round(minDrum.scrollTop / 40);
    const secIndex = Math.round(secDrum.scrollTop / 40);
    
    if (minItems[minIndex]) minItems[minIndex].classList.add('selected');
    if (secItems[secIndex]) secItems[secIndex].classList.add('selected');
}

function getTimerValue() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    const minutes = Math.round(minDrum.scrollTop / 40) % 60;
    const seconds = Math.round(secDrum.scrollTop / 40) % 60;
    return minutes * 60 + seconds;
}

// Drum scroll event
setTimeout(() => {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    if (minDrum) minDrum.addEventListener('scroll', updateDrumHighlight);
    if (secDrum) secDrum.addEventListener('scroll', updateDrumHighlight);
}, 100);

// Timer Controls
function handleTimerStart() {
    if (isStopwatchMode) {
        if (isStopwatchRunning) return;
        isStopwatchRunning = true;
        stopwatchInterval = setInterval(() => {
            stopwatchSeconds++;
            updateStopwatchDisplay();
        }, 1000);
    } else {
        if (isTimerRunning) return;
        timerSeconds = getTimerValue();
        if (timerSeconds > 0) {
            isTimerRunning = true;
            timerInterval = setInterval(() => {
                timerSeconds--;
                updateTimerDisplay();
                if (timerSeconds <= 0) {
                    clearInterval(timerInterval);
                    isTimerRunning = false;
                    playTimerSound();
                }
            }, 1000);
        }
    }
}

function handleTimerPause() {
    if (isStopwatchMode) {
        clearInterval(stopwatchInterval);
        isStopwatchRunning = false;
    } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
    }
}

function handleTimerReset() {
    if (isStopwatchMode) {
        clearInterval(stopwatchInterval);
        stopwatchSeconds = 0;
        isStopwatchRunning = false;
        updateStopwatchDisplay();
    } else {
        clearInterval(timerInterval);
        timerSeconds = 0;
        updateTimerDisplay();
        isTimerRunning = false;
    }
}

function playTimerSound() {
    try {
        generateTimerSound();
        // Play timer bell (timer-bell_m1tycbno.mp3 - 26 KB)
        const audio = new Audio('sounds/timer-bell_m1tycbno.mp3');
        audio.volume = 1.0;
        audio.play().catch(() => console.log('Timer sound not found'));
    } catch (e) {
        console.error('Timer error:', e);
    }
}

document.getElementById('timer-start').addEventListener('click', handleTimerStart);
document.getElementById('timer-pause').addEventListener('click', handleTimerPause);
document.getElementById('timer-reset').addEventListener('click', handleTimerReset);

function updateTimerDisplay() {
    const min = Math.floor(timerSeconds / 60);
    const sec = timerSeconds % 60;
    document.getElementById('timer-display').textContent = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

// Stopwatch
let isStopwatchMode = false;
document.getElementById('stopwatch-btn').addEventListener('click', () => {
    isStopwatchMode = !isStopwatchMode;
    
    if (isStopwatchMode) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        
        document.getElementById('stopwatch-btn').textContent = 'Таймер';
        document.getElementById('timer-start').textContent = 'Старт';
        document.getElementById('timer-pause').textContent = 'Пауза';
        document.getElementById('timer-reset').textContent = 'Сброс';
        document.querySelector('.drum-container').style.display = 'none';
        stopwatchSeconds = 0;
        updateStopwatchDisplay();
    } else {
        clearInterval(stopwatchInterval);
        isStopwatchRunning = false;
        
        document.getElementById('stopwatch-btn').textContent = 'Секундомер';
        document.querySelector('.drum-container').style.display = 'grid';
        timerSeconds = 0;
        updateTimerDisplay();
    }
});

function updateStopwatchDisplay() {
    const hours = Math.floor(stopwatchSeconds / 3600);
    const mins = Math.floor((stopwatchSeconds % 3600) / 60);
    const secs = stopwatchSeconds % 60;
    document.getElementById('timer-display').textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

// ALARM MODAL
document.getElementById('add-alarm-btn').addEventListener('click', () => {
    const modal = document.getElementById('alarm-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Новый будильник</h3>
            <input type="time" id="alarm-time" required>
            <div class="days-selector">
                <label><input type="checkbox" value="Пн"> Пн</label>
                <label><input type="checkbox" value="Вт"> Вт</label>
                <label><input type="checkbox" value="Ср"> Ср</label>
                <label><input type="checkbox" value="Чт"> Чт</label>
                <label><input type="checkbox" value="Пт"> Пт</label>
                <label><input type="checkbox" value="Сб"> Сб</label>
                <label><input type="checkbox" value="Вс"> Вс</label>
            </div>
            <button onclick="saveAlarm()">Сохранить</button>
            <button onclick="closeModal('alarm-modal')" style="background: #999;">Отмена</button>
        </div>
    `;
    modal.classList.remove('hidden');
});

function saveAlarm() {
    const time = document.getElementById('alarm-time').value;
    const days = Array.from(document.querySelectorAll('#alarm-modal input[type="checkbox"]:checked'))
        .map(el => el.value);
    
    if (time && days.length > 0) {
        if (!/^\d{2}:\d{2}$/.test(time)) {
            alert('Некорректный формат времени');
            return;
        }
        
        alarms.push({ time, days, triggeredToday: false });
        localStorage.setItem('alarms', JSON.stringify(alarms));
        renderAlarms();
        closeModal('alarm-modal');
    } else {
        alert('Выбери время и дни недели');
    }
}

function deleteAlarm(index) {
    alarms.splice(index, 1);
    localStorage.setItem('alarms', JSON.stringify(alarms));
    renderAlarms();
}

// TASK MODAL
document.getElementById('add-task-btn').addEventListener('click', () => {
    const modal = document.getElementById('task-modal');
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Добавить задачу</h3>
            <input type="text" id="task-text" placeholder="Текст задачи" maxlength="100">
            <button onclick="saveTask()">Сохранить</button>
            <button onclick="closeModal('task-modal')" style="background: #999;">Отмена</button>
        </div>
    `;
    modal.classList.remove('hidden');
    document.getElementById('task-text').focus();
});

function saveTask() {
    const text = document.getElementById('task-text').value.trim();
    if (text) {
        const today = new Date().toISOString().split('T')[0];
        tasks.push({ text, date: today, done: false });
        localStorage.setItem('tasks', JSON.stringify(tasks));
        renderTasks();
        closeModal('task-modal');
    } else {
        alert('Задача не может быть пустой');
    }
}

function toggleTask(index) {
    tasks[index].done = !tasks[index].done;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTasks();
}

function deleteTask(index) {
    tasks.splice(index, 1);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    renderTasks();
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Close modal when clicking outside
document.getElementById('alarm-modal').addEventListener('click', (e) => {
    if (e.target.id === 'alarm-modal') closeModal('alarm-modal');
});

document.getElementById('task-modal').addEventListener('click', (e) => {
    if (e.target.id === 'task-modal') closeModal('task-modal');
});

// Init
renderAlarms();
renderTasks();
initDrums();
