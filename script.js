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

const greetings = [
    "Доброе утро. Надеюсь, ты хорошо выспался, ведь столько всего тебя ждет.",
    "Герой, новый день уже здесь. Я рада тебя видеть.",
    "Доброе утро. Пусть сегодня всё складывается легко и приятно.",
    "Проснись и пой. Я здесь и готова помочь тебе с планами.",
    "Утро доброе. Ты сегодня выглядишь особенно хорошо.",
    "Новый день начинается. Давай сделаем его достойным тебя."
];

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
            <div class="alarm-info">${alarm.days.join(', ')} • ${alarm.type === 'smart' ? 'Умный' : 'Обычный'}</div>
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
        if (alarm.time === currentTime && alarm.days.includes(currentDay) && !alarm.triggeredToday) {
            alarm.triggeredToday = true;
            localStorage.setItem('alarms', JSON.stringify(alarms));
            triggerAlarm(alarm);
        }
    });
}

function triggerAlarm(alarm) {
    const screen = document.getElementById('alarm-active');
    screen.classList.remove('hidden');
    screen.innerHTML = `
        <h1>${alarm.time}</h1>
        <p>${alarm.type === 'smart' ? 'Умный ассистент' : 'Пора просыпаться!'}</p>
        <button id="snooze-btn">Отложить на 5 мин</button>
        <button id="stop-alarm-btn">Выключить</button>
    `;

    const audio = new Audio('sounds/alarm.mp3');
    audio.loop = true;
    audio.play().catch(() => console.warn('Audio playback failed'));

    // Start continuous vibration pattern
    if (navigator.vibrate) {
        currentVibrationId = setInterval(() => {
            navigator.vibrate([400, 150, 400, 150, 400]);
        }, 2100); // Pattern duration is 2100ms
    }

    document.getElementById('stop-alarm-btn').onclick = () => {
        stopAlarmSequence(audio);
        if (alarm.type === 'smart') setTimeout(startSmartAssistant, 600);
        resetTriggeredFlags();
    };

    document.getElementById('snooze-btn').onclick = () => {
        stopAlarmSequence(audio);
        setTimeout(() => triggerAlarm(alarm), 300000);
    };
}

function stopAlarmSequence(audio) {
    audio.pause();
    if (currentVibrationId) {
        clearInterval(currentVibrationId);
        currentVibrationId = null;
    }
    document.getElementById('alarm-active').classList.add('hidden');
}

async function startSmartAssistant() {
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    speak(greeting);

    setTimeout(async () => {
        const weather = await getWeather();
        if (weather) {
            speak(`Сейчас в ${weather.city} ${weather.temp}°, ${weather.condition}.`);
        } else {
            speak("Погода недоступна, но день начинается отлично!");
        }
        
        setTimeout(readTodayTasks, 2200);
    }, 1600);
}

function speak(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.96;
    utterance.pitch = 1.08;
    speechSynthesis.speak(utterance);
}

async function getWeather() {
    try {
        const locRes = await fetch('https://ip-api.com/json/?fields=city,lat,lon');
        if (!locRes.ok) throw new Error('Location API failed');
        
        const loc = await locRes.json();
        const city = loc.city || 'Неизвестно';
        const lat = loc.lat || 41.45;
        const lon = loc.lon || 69.2;

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        if (!res.ok) throw new Error('Weather API failed');
        
        const data = await res.json();

        const codes = {
            0: 'ясно', 1: 'преимущественно ясно', 2: 'облачно', 3: 'пасмурно',
            45: 'туман', 48: 'туман', 51: 'морось', 53: 'морось', 55: 'морось',
            61: 'дождь', 63: 'дождь', 65: 'дождь', 71: 'снег', 73: 'снег',
            75: 'снег', 77: 'снег', 80: 'ливень', 81: 'ливень', 82: 'ливень',
            85: 'снегопад', 86: 'снегопад', 95: 'гроза', 96: 'гроза', 99: 'гроза'
        };
        
        return {
            city,
            temp: Math.round(data.current_weather.temperature),
            condition: codes[data.current_weather.weathercode] || 'облачно'
        };
    } catch(e) {
        console.error('Weather error:', e.message);
        return null;
    }
}

function readTodayTasks() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === today && !t.done);
    
    if (todayTasks.length === 0) {
        speak("На сегодня задач нет. Хорошего дня!");
        return;
    }
    
    speak("Задачи на сегодня:");
    todayTasks.forEach(task => speak(task.text));
}

function resetTriggeredFlags() {
    alarms.forEach(alarm => alarm.triggeredToday = false);
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

// Timer + Drum
function initDrums() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    minDrum.innerHTML = Array.from({length: 61}, (_,i) => `<div class="drum-item">${i.toString().padStart(2,'0')}</div>`).join('');
    secDrum.innerHTML = Array.from({length: 60}, (_,i) => `<div class="drum-item">${i.toString().padStart(2,'0')}</div>`).join('');
}

function getTimerValue() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    const minutes = Math.round(minDrum.scrollTop / 40) || 0;
    const seconds = Math.round(secDrum.scrollTop / 40) || 0;
    return Math.min(minutes, 60) * 60 + Math.min(seconds, 59);
}

// Timer Controls - unified handlers to prevent multiple listeners
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
        new Audio('sounds/timer.mp3').play().catch(() => console.warn('Timer sound failed'));
    } catch (e) {
        console.error('Timer sound error:', e);
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
        // Switching to stopwatch mode
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
        // Switching back to timer mode
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
            <div class="type-selector">
                <label><input type="radio" name="type" value="normal" checked> Обычный</label>
                <label><input type="radio" name="type" value="smart"> Умный ассистент</label>
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
    const type = document.querySelector('#alarm-modal input[name="type"]:checked').value;
    
    if (time && days.length > 0) {
        // Validate time format
        if (!/^\d{2}:\d{2}$/.test(time)) {
            alert('Некорректный формат времени');
            return;
        }
        
        alarms.push({ time, days, type, triggeredToday: false });
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
