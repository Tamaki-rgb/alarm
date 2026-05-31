// script.js
let alarms = JSON.parse(localStorage.getItem('alarms')) || [];
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentTheme = localStorage.getItem('theme') || 'light';
let timerInterval = null;
let stopwatchInterval = null;
let timerSeconds = 0;
let isTimerRunning = false;
let isStopwatch = false;

const greetings = [
    "Доброе утро, солнышко. Надеюсь, ты хорошо выспался.",
    "Мой хороший, новый день уже здесь. Я рада тебя видеть.",
    "Доброе утро. Пусть сегодня всё складывается легко и приятно.",
    "Просыпайся, любимый. Я здесь и готова помочь тебе с планами.",
    "Утро доброе. Ты сегодня выглядишь особенно мило.",
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
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === today);
    
    list.innerHTML = todayTasks.length ? todayTasks.map((task, idx) => `
        <div class="task-item">
            <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${tasks.indexOf(task)})">
            <span>${task.text}</span>
        </div>
    `).join('') : '<p style="opacity:0.6">Задач на сегодня нет</p>';
}

// Alarm checking every second
setInterval(() => {
    checkAlarms();
}, 1000);

function checkAlarms() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][now.getDay()];

    alarms.forEach((alarm, index) => {
        if (alarm.time === currentTime && alarm.days.includes(currentDay) && !alarm.triggeredToday) {
            alarm.triggeredToday = true;
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
    audio.play();

    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);

    document.getElementById('stop-alarm-btn').onclick = () => {
        audio.pause();
        screen.classList.add('hidden');
        if (alarm.type === 'smart') setTimeout(startSmartAssistant, 600);
        resetTriggeredFlags();
    };

    document.getElementById('snooze-btn').onclick = () => {
        audio.pause();
        screen.classList.add('hidden');
        setTimeout(() => triggerAlarm(alarm), 300000);
    };
}

async function startSmartAssistant() {
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    speak(greeting);

    setTimeout(async () => {
        const weather = await getWeather();
        speak(weather ? `Сейчас в ${weather.city} ${weather.temp}°, ${weather.condition}.` : "Погода сейчас недоступна.");
        
        setTimeout(readTodayTasks, 2200);
    }, 1600);
}

function speak(text) {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.96;
    utterance.pitch = 1.08;
    speechSynthesis.speak(utterance);
}

async function getWeather() {
    try {
        const locRes = await fetch('https://ip-api.com/json/?fields=city,lat,lon');
        const loc = await locRes.json();
        const city = loc.city || 'Сарыагаш';

        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat || 41.45}&longitude=${loc.lon || 69.2}&current_weather=true`);
        const data = await res.json();

        const codes = {0: 'ясно', 1: 'преимущественно ясно', 2: 'облачно', 3: 'пасмурно'};
        return {
            city,
            temp: Math.round(data.current_weather.temperature),
            condition: codes[data.current_weather.weathercode] || 'облачно'
        };
    } catch(e) {
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

// Timer + Drum
function initDrums() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    minDrum.innerHTML = Array.from({length: 61}, (_,i) => `<div class="drum-item">${i.toString().padStart(2,'0')}</div>`).join('');
    secDrum.innerHTML = Array.from({length: 60}, (_,i) => `<div class="drum-item">${i.toString().padStart(2,'0')}</div>`).join('');
}

// Timer Controls
document.getElementById('timer-start').addEventListener('click', () => {
    if (isTimerRunning) return;
    isTimerRunning = true;
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            isTimerRunning = false;
            new Audio('sounds/timer.mp3').play();
        }
    }, 1000);
});

document.getElementById('timer-pause').addEventListener('click', () => {
    clearInterval(timerInterval);
    isTimerRunning = false;
});

document.getElementById('timer-reset').addEventListener('click', () => {
    clearInterval(timerInterval);
    timerSeconds = 0;
    updateTimerDisplay();
    isTimerRunning = false;
});

function updateTimerDisplay() {
    const min = Math.floor(timerSeconds / 60);
    const sec = timerSeconds % 60;
    document.getElementById('timer-display').textContent = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

// Modals and other functions (add alarm, add task, etc.) — я сделал основные, остальное можно расширять.

renderAlarms();
renderTasks();
initDrums();
