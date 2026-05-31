let alarms = JSON.parse(localStorage.getItem('bento_alarms')) || [];
let tasks = JSON.parse(localStorage.getItem('bento_tasks')) || [];
let currentTheme = localStorage.getItem('bento_theme') || 'day';

let activeAudioInstance = null;
let triggeredAlarmObject = null;
let detoxInterval = null;
let timerInterval = null;
let timerTimeLeft = 0;
let isTimerRunning = false;

// Хранилище выбранных дней для модалки будильника
let selectedModalDays = [];

// Аудиопотоки
const ALARM_SOUND_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"; // Твой Lo-Fi выбор!
const TIMER_END_SOUND_URL = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"; // Четкий сигнал конца таймера

const greetings = [
    "Привет! Просыпайся плавно, новый день уже ждет.",
    "Доброе утро. Время стряхнуть сон и начать двигаться к целям.",
    "Утречко! Надеюсь, ты выспался. Давай глянем, что у нас на сегодня."
    "Хозяин, дрыхнуть весь день не вариант, мир ждет вас."
];

const dayNamesShort = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 0: "Вс" };

document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeButtonUI();

    updateClock();
    setInterval(updateClock, 1000);

    buildTimerWheels(); // Строим барабаны прокрутки
    renderAlarms();
    renderTasks();
    setupModalDayListeners();
});

// КОРРЕКТНЫЕ ЧАСЫ И ПРОВЕРКА ДНЕЙ НЕДЕЛИ
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const currentDayOfWeek = now.getDay(); // 0 (Вс) - 6 (Сб)
    
    document.getElementById('main-clock').textContent = `${hours}:${minutes}:${seconds}`;
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('main-date').textContent = now.toLocaleDateString('ru-RU', options);
    
    // Проверка будильников раз в минуту на 00 секунде
    if (seconds === "00") {
        const currentTimeString = `${hours}:${minutes}`;
        alarms.forEach(alarm => {
            if (alarm.isActive && alarm.time === currentTimeString) {
                // Проверяем, выбран ли сегодняшний день недели в настройках будильника
                if (alarm.days.length === 0 || alarm.days.includes(currentDayOfWeek)) {
                    fireAlarm(alarm);
                }
            }
        });
    }
}

// ГЕНЕРАЦИЯ БАРАБАНОВ ДЛЯ ТАЙМЕРА (ПРОКРУТКА)
function buildTimerWheels() {
    const minWheel = document.getElementById('wheel-minutes');
    const secWheel = document.getElementById('wheel-seconds');
    
    // Набиваем минуты (0-99) и секунды (0-59)
    minWheel.innerHTML = '<div class="wheel-item"></div>' + Array.from({length: 100}, (_, i) => `<div class="wheel-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`).join('') + '<div class="wheel-item"></div>';
    secWheel.innerHTML = '<div class="wheel-item"></div>' + Array.from({length: 60}, (_, i) => `<div class="wheel-item" data-val="${i}">${String(i).padStart(2, '0')}</div>`).join('') + '<div class="wheel-item"></div>';

    // Скроллим на дефолтные 5 минут
    setTimeout(() => {
        minWheel.scrollTop = 5 * 40;
        secWheel.scrollTop = 0;
    }, 100);
}

// Функция считывания текущего времени с барабанов
function getTimerValuesFromWheels() {
    const minWheel = document.getElementById('wheel-minutes');
    const secWheel = document.getElementById('wheel-seconds');
    
    const minIdx = Math.round(minWheel.scrollTop / 40);
    const secIdx = Math.round(secWheel.scrollTop / 40);
    
    return {
        minutes: minIdx,
        seconds: secIdx
    };
}

// ЛОГИКА ТАЙМЕРА
function toggleTimer() {
    const btnStart = document.getElementById('btn-timer-start');
    const btnReset = document.getElementById('btn-timer-reset');
    const wheels = document.getElementById('timer-pickers');
    const display = document.getElementById('timer-display');

    if (!isTimerRunning) {
        if (timerTimeLeft === 0) {
            const timeData = getTimerValuesFromWheels();
            timerTimeLeft = (timeData.minutes * 60) + timeData.seconds;
        }
        
        if (timerTimeLeft <= 0) return;

        isTimerRunning = true;
        wheels.style.display = 'none';
        display.style.display = 'block';
        btnReset.style.display = 'inline-block';
        btnStart.textContent = "Пауза";

        updateTimerDisplay();

        timerInterval = setInterval(() => {
            timerTimeLeft--;
            updateTimerDisplay();

            if (timerTimeLeft <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                btnStart.textContent = "Старт";
                fireSimpleSignal("Время вышло!");
                resetTimer();
            }
        }, 1000);
    } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        btnStart.textContent = "Продолжить";
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerTimeLeft = 0;
    document.getElementById('btn-timer-start').textContent = "Старт";
    document.getElementById('btn-timer-reset').style.display = 'none';
    document.getElementById('timer-pickers').style.display = 'flex';
    document.getElementById('timer-display').style.display = 'none';
}

function updateTimerDisplay() {
    let m = String(Math.floor(timerTimeLeft / 60)).padStart(2, '0');
    let s = String(timerTimeLeft % 60).padStart(2, '0');
    document.getElementById('timer-display').textContent = `${m}:${s}`;
}

// НАСТРОЙКА ДНЕЙ НЕДЕЛИ В МОДАЛКЕ
function setupModalDayListeners() {
    document.querySelectorAll('.day-dot').forEach(btn => {
        btn.addEventListener('click', () => {
            const day = parseInt(btn.getAttribute('data-day'));
            if (selectedModalDays.includes(day)) {
                selectedModalDays = selectedModalDays.filter(d => d !== day);
                btn.classList.remove('selected');
            } else {
                selectedModalDays.push(day);
                btn.classList.add('selected');
            }
        });
    });
}

function openModal() {
    selectedModalDays = [];
    document.querySelectorAll('.day-dot').forEach(b => b.classList.remove('selected'));
    document.getElementById('alarm-modal').style.display = 'flex';
}
function closeModal() { document.getElementById('alarm-modal').style.display = 'none'; }

function saveAlarm() {
    const time = document.getElementById('new-alarm-time').value;
    const type = document.getElementById('new-alarm-type').value;
    if (!time) return;

    alarms.push({
        id: Date.now(),
        time,
        type,
        days: [...selectedModalDays], // Сохраняем массив выбранных дней недели
        isActive: true
    });

    localStorage.setItem('bento_alarms', JSON.stringify(alarms));
    renderAlarms();
    closeModal();
}

function renderAlarms() {
    const container = document.getElementById('alarms-list');
    container.innerHTML = '';
    
    alarms.sort((a,b) => a.time.localeCompare(b.time)).forEach(alarm => {
        const item = document.createElement('div');
        item.className = `card alarm-item ${alarm.isActive ? '' : 'disabled'}`;
        
        // Красивый вывод дней
        let daysText = "Каждый день";
        if (alarm.days.length > 0) {
            daysText = alarm.days.map(d => dayNamesShort[d]).join(', ');
        }

        item.innerHTML = `
            <div>
                <div class="alarm-time-text">${alarm.time}</div>
                <div class="alarm-days-display">🔁 ${daysText}</div>
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

// СРАБОТКА СИГНАЛОВ
function fireAlarm(alarmObject) {
    triggeredAlarmObject = alarmObject;
    activeAudioInstance = new Audio(ALARM_SOUND_URL);
    activeAudioInstance.loop = true;
    activeAudioInstance.play().catch(e => console.log(e));

    const overlay = document.getElementById('alarm-overlay');
    document.getElementById('overlay-title').textContent = "Время подняться";
    document.getElementById('overlay-subtitle').textContent = alarmObject.type === 'smart' ? "Ассистент готовит сводку..." : "Сигнал времени";
    overlay.style.display = 'flex';

    document.getElementById('btn-alarm-dismiss').onclick = dismissAlarmAction;
}

function fireSimpleSignal(titleText) {
    activeAudioInstance = new Audio(TIMER_END_SOUND_URL);
    activeAudioInstance.play().catch(e => console.log(e));
    
    const overlay = document.getElementById('alarm-overlay');
    document.getElementById('overlay-title').textContent = titleText;
    document.getElementById('overlay-subtitle').textContent = "Таймер успешно завершил отсчет";
    overlay.style.display = 'flex';
    
    document.getElementById('btn-alarm-dismiss').onclick = () => {
        if(activeAudioInstance) activeAudioInstance.pause();
        overlay.style.display = 'none';
    };
}

function dismissAlarmAction() {
    if (activeAudioInstance) activeAudioInstance.pause();
    document.getElementById('alarm-overlay').style.display = 'none';

    if (triggeredAlarmObject && triggeredAlarmObject.type === 'smart') {
        document.getElementById('assistant-overlay').style.display = 'flex';
        executeSmartReporting();
    }
}

// УТРЕННИЙ АССИСТЕНТ + АВТОУДАЛЕНИЕ ЗАДАЧ
async function executeSmartReporting() {
    startDetoxTimer(20);
    
    let weatherText = "Погоду проверить не удалось, но день точно будет хорошим.";
    try {
        const res = await fetch('https://wttr.in/?format=j1');
        const data = await res.json();
        const temp = data.current_condition[0].temp_C;
        const desc = data.current_condition[0].lang_ru ? data.current_condition[0].lang_ru[0].value : "отличная погода";
        weatherText = `За окном сейчас около ${temp} градусов, на улице ${desc}.`;
    } catch(e) {}

    // Фильтруем задачи на сегодня
    const todayISO = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === todayISO);
    
    let tasksText = "На сегодня у вас нет запланированных дел.";
    if (todayTasks.length > 0) {
        tasksText = `Твои дела на сегодня: ` + todayTasks.map(t => t.text).join('. ') + '.';
        
        // КЛЮЧЕВОЕ ОБНОВЛЕНИЕ: Стираем прочитанные задачи из общего списка
        tasks = tasks.filter(t => t.date !== todayISO);
        localStorage.setItem('bento_tasks', JSON.stringify(tasks));
    }

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const fullSpeech = `${randomGreeting} ${weatherText} ${tasksText} Хорошего дня!`;

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

function closeAssistant() {
    window.speechSynthesis.cancel();
    clearInterval(detoxInterval);
    document.getElementById('assistant-overlay').style.display = 'none';
    renderTasks(); // Обновляем список задач на экране (сегодняшние исчезнут)
}

// ОСТАЛЬНЫЕ ФУНКЦИИ (ЗАДАЧИ, ТЕМЫ)
function renderTasks() {
    const container = document.getElementById('tasks-list');
    container.innerHTML = '';
    if (tasks.length === 0) {
        container.innerHTML = `<p style="color: var(--text-dim); text-align:center; padding: 20px;">Планы отсутствуют</p>`;
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
    if (!text || !date) return;

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

function startDetoxTimer(minutes) {
    let time = minutes * 60;
    const display = document.getElementById('detox-clock');
    if (detoxInterval) clearInterval(detoxInterval);
    detoxInterval = setInterval(() => {
        let mins = String(Math.floor(time / 60)).padStart(2, '0');
        let secs = String(time % 60).padStart(2, '0');
        display.textContent = `${mins}:${secs}`;
        if (time <= 0) clearInterval(detoxInterval);
        time--;
    }, 1000);
}

function cancelDetox() { clearInterval(detoxInterval); document.getElementById('detox-clock').textContent = "Отменено"; }
function setMood(status) { document.getElementById('mood-text').textContent = status; }
function switchTab(tabName) { document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); event.target.classList.add('active'); document.getElementById(`tab-${tabName}`).classList.add('active'); }
function toggleTheme() { currentTheme = currentTheme === 'day' ? 'night' : 'day'; document.documentElement.setAttribute('data-theme', currentTheme); localStorage.setItem('bento_theme', currentTheme); updateThemeButtonUI(); }
function updateThemeButtonUI() { const btn = document.getElementById('theme-toggle'); btn.innerHTML = currentTheme === 'day' ? `<span class="theme-icon">🌙</span> Ночной режим` : `<span class="theme-icon">☀️</span> Светлый дзен`; }
