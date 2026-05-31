// Хранилища данных
let alarms = JSON.parse(localStorage.getItem('bento_alarms')) || [];
let tasks = JSON.parse(localStorage.getItem('bento_tasks')) || [];
let currentTheme = localStorage.getItem('bento_theme') || 'day';

// Системные переменные плеера и таймеров
let activeAlarmInstance = null;
let triggeredAlarmObject = null;
let detoxInterval = null;
let timerInterval = null;
let timerTimeLeft = 300; // 5 минут по дефолту
let isTimerRunning = false;

// Бодрый аудиопоток для пробуждения
const ALARM_SOUND_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

const greetings = [
    "С добрым утром! Новый прекрасный день настал, время создавать.",
    "Привет! Просыпайся легко, сегодня тебя ждут отличные дела.",
    "Добрейшего утречка! Пора открывать глаза навстречу новому дню."
];

document.addEventListener("DOMContentLoaded", () => {
    // Применяем тему оформления
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeButtonUI();

    // Запуск часов
    updateClock();
    setInterval(updateClock, 1000);

    // Рендеринг списков
    renderAlarms();
    renderTasks();
});

// КОРРЕКТНЫЕ ЧАСЫ И ПРОВЕРКА СИГНАЛОВ
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('main-clock').textContent = `${hours}:${minutes}:${seconds}`;
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('main-date').textContent = now.toLocaleDateString('ru-RU', options);
    
    // Проверка совпадения времени (только на нулевой секунде)
    if (seconds === "00") {
        const currentTimeString = `${hours}:${minutes}`;
        alarms.forEach(alarm => {
            if (alarm.isActive && alarm.time === currentTimeString) {
                fireAlarm(alarm);
            }
        });
    }
}

// ПЕРЕКЛЮЧЕНИЕ ТЕМЫ (ДЕНЬ/КИБЕРПАНК)
function toggleTheme() {
    currentTheme = currentTheme === 'day' ? 'night' : 'day';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('bento_theme', currentTheme);
    updateThemeButtonUI();
}

function updateThemeButtonUI() {
    const btn = document.getElementById('theme-toggle');
    if (currentTheme === 'day') {
        btn.innerHTML = `<span class="theme-icon">🌙</span> Ночной режим`;
    } else {
        btn.innerHTML = `<span class="theme-icon">☀️</span> Светлый дзен`;
    }
}

// НАВИГАЦИЯ МЕЖДУ ТАБАМИ
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

// РАБОТА С БУДИЛЬНИКАМИ
function renderAlarms() {
    const container = document.getElementById('alarms-list');
    container.innerHTML = '';
    
    alarms.sort((a,b) => a.time.localeCompare(b.time)).forEach(alarm => {
        const item = document.createElement('div');
        item.className = `card alarm-item ${alarm.isActive ? '' : 'disabled'}`;
        item.innerHTML = `
            <div>
                <div class="alarm-time-text">${alarm.time}</div>
                <div class="alarm-type-badge">${alarm.type === 'smart' ? '🧠 Умный' : '🔔 Обычный'}</div>
            </div>
            <div class="alarm-footer">
                <input type="checkbox" ${alarm.isActive ? 'checked' : ''} onchange="toggleAlarmActive(${alarm.id})" style="width: auto; cursor:pointer;">
                <button onclick="deleteAlarm(${alarm.id})" class="btn-delete">Удалить</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function openModal() { document.getElementById('alarm-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('alarm-modal').style.display = 'none'; }

function saveAlarm() {
    const time = document.getElementById('new-alarm-time').value;
    const type = document.getElementById('new-alarm-type').value;
    if (!time) return;

    alarms.push({ id: Date.now(), time, type, isActive: true });
    localStorage.setItem('bento_alarms', JSON.stringify(alarms));
    renderAlarms();
    closeModal();
}

function deleteAlarm(id) {
    alarms = alarms.filter(a => a.id !== id);
    localStorage.setItem('bento_alarms', JSON.stringify(alarms));
    renderAlarms();
}

function toggleAlarmActive(id) {
    const alarm = alarms.find(a => a.id === id);
    if (alarm) {
        alarm.isActive = !alarm.isActive;
        localStorage.setItem('bento_alarms', JSON.stringify(alarms));
    }
}

// РАБОТА С ЗАДАЧАМИ
function renderTasks() {
    const container = document.getElementById('tasks-list');
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = `<p style="color: var(--text-dim); text-align:center; padding: 20px;">Нет запланированных дел</p>`;
        return;
    }

    tasks.sort((a,b) => a.date.localeCompare(b.date)).forEach(task => {
        const item = document.createElement('div');
        item.className = 'card task-item';
        const taskDateFormatted = new Date(task.date).toLocaleDateString('ru-RU');
        item.innerHTML = `
            <div class="task-info">
                <p>${task.text}</p>
                <span>📅 ${taskDateFormatted}</span>
            </div>
            <button onclick="deleteTask(${task.id})" class="btn-delete">Удалить</button>
        `;
        container.appendChild(item);
    });
}

function addTask() {
    const text = document.getElementById('task-text').value;
    const date = document.getElementById('task-date').value;
    if (!text || !date) return alert("Заполните описание и дату задачи!");

    tasks.push({ id: Date.now(), text, date });
    localStorage.setItem('bento_tasks', JSON.stringify(tasks));
    renderTasks();
    
    document.getElementById('task-text').value = '';
    document.getElementById('task-date').value = '';
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem('bento_tasks', JSON.stringify(tasks));
    renderTasks();
}

// ТАЙМЕР
function updateTimerDisplay() {
    let m = String(Math.floor(timerTimeLeft / 60)).padStart(2, '0');
    let s = String(timerTimeLeft % 60).padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
}

function toggleTimer() {
    const btn = document.getElementById('btn-timer-start');
    if (!isTimerRunning) {
        const m = parseInt(document.getElementById('timer-min').value) || 0;
        const s = parseInt(document.getElementById('timer-sec').value) || 0;
        if (m === 0 && s === 0) return;
        
        timerTimeLeft = (m * 60) + s;
        isTimerRunning = true;
        btn.textContent = "Пауза";
        
        timerInterval = setInterval(() => {
            timerTimeLeft--;
            updateTimerDisplay();
            if (timerTimeLeft <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                btn.textContent = "Старт";
                fireSimpleSignal("Таймер завершен!");
            }
        }, 1000);
    } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        btn.textContent = "Старт";
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    document.getElementById('btn-timer-start').textContent = "Старт";
    timerTimeLeft = 300;
    updateTimerDisplay();
}

// СРАБОТКА СИГНАЛОВ И БУДИЛЬНИКОВ
function fireAlarm(alarmObject) {
    triggeredAlarmObject = alarmObject;
    
    // Включаем звук
    activeAlarmInstance = new Audio(ALARM_SOUND_URL);
    activeAlarmInstance.loop = true;
    activeAlarmInstance.play().catch(e => console.log("Блокировка звука браузером", e));

    const overlay = document.getElementById('alarm-overlay');
    document.getElementById('overlay-title').textContent = "Время подняться";
    document.getElementById('overlay-subtitle').textContent = alarmObject.type === 'smart' ? "Ассистент подготавливает сводку..." : "Обычный сигнал времени";
    overlay.style.display = 'flex';

    document.getElementById('btn-alarm-dismiss').onclick = dismissAlarmAction;
}

function fireSimpleSignal(titleText) {
    activeAlarmInstance = new Audio(ALARM_SOUND_URL);
    activeAlarmInstance.play();
    const overlay = document.getElementById('alarm-overlay');
    document.getElementById('overlay-title').textContent = titleText;
    document.getElementById('overlay-subtitle').textContent = "";
    overlay.style.display = 'flex';
    document.getElementById('btn-alarm-dismiss').onclick = () => {
        if(activeAlarmInstance) activeAlarmInstance.pause();
        overlay.style.display = 'none';
    };
}

function dismissAlarmAction() {
    if (activeAlarmInstance) activeAlarmInstance.pause();
    document.getElementById('alarm-overlay').style.display = 'none';

    if (triggeredAlarmObject && triggeredAlarmObject.type === 'smart') {
        // Запускаем режим утреннего дашборда
        document.getElementById('assistant-overlay').style.display = 'flex';
        executeSmartReporting();
    }
}

// ЛОГИКА УТРЕННЕГО АССИСТЕНТА И ПОГОДЫ
async function executeSmartReporting() {
    startDetoxTimer(20);
    
    let weatherText = "Не удалось обновить погоду, но уверен, за окном хороший день.";
    try {
        const res = await fetch('https://wttr.in/?format=j1');
        const data = await res.json();
        const temp = data.current_condition[0].temp_C;
        const desc = data.current_condition[0].lang_ru ? data.current_condition[0].lang_ru[0].value : "отличная погода";
        weatherText = `Сейчас на улице около ${temp} градусов, ${desc}.`;
    } catch(e) { console.log(e); }

    // Фильтрация задач строго на СЕГОДНЯ
    const todayISO = new Date().toISOString().split('T')[0]; // ГГГГ-ММ-ДД
    const todayTasks = tasks.filter(t => t.date === todayISO);
    
    let tasksText = "На сегодня у вас нет запланированных дел.";
    if (todayTasks.length > 0) {
        tasksText = `На сегодня у вас запланировано дел: ${todayTasks.length}. Напоминаю: ` + todayTasks.map(t => t.text).join('. ') + '.';
    }

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const fullSpeech = `${randomGreeting} ${weatherText} ${tasksText} Успешного дня!`;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(fullSpeech);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.95;
        
        setTimeout(() => {
            const voices = window.speechSynthesis.getVoices();
            const bestVoice = voices.find(v => v.lang.includes('ru') && v.name.includes('Google')) || voices.find(v => v.lang.includes('ru'));
            if(bestVoice) utterance.voice = bestVoice;
            window.speechSynthesis.speak(utterance);
        }, 200);
    }
}

// ФУНКЦИОНИРОВАНИЕ ДЕТОКСА
function startDetoxTimer(minutes) {
    let time = minutes * 60;
    const display = document.getElementById('detox-clock');
    
    if (detoxInterval) clearInterval(detoxInterval);
    detoxInterval = setInterval(() => {
        let mins = String(Math.floor(time / 60)).padStart(2, '0');
        let secs = String(time % 60).padStart(2, '0');
        display.textContent = `${mins}:${secs}`;
        
        if (time <= 0) {
            clearInterval(detoxInterval);
            display.textContent = "Завершено";
        }
        time--;
    }, 1000);
}

function cancelDetox() {
    clearInterval(detoxInterval);
    document.getElementById('detox-clock').textContent = "Отменено";
}

function setMood(status) {
    document.getElementById('mood-text').textContent = status;
}

function closeAssistant() {
    window.speechSynthesis.cancel();
    clearInterval(detoxInterval);
    document.getElementById('assistant-overlay').style.display = 'none';
    // Будильник отработал и не зависает — возвращаемся на главный рабочий экран
}
