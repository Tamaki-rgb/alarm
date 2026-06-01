// script.js - ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ ВЕРСИЯ
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

// ==================== АУДИО СИСТЕМА ====================

function initAudioContext() {
    if (!audioContext || audioContext.state === 'closed') {
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

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        const voices = window.speechSynthesis.getVoices();
        const russianVoice = voices.find(voice => voice.lang.startsWith('ru'));
        if (russianVoice) {
            utterance.voice = russianVoice;
        }
        
        window.speechSynthesis.speak(utterance);
        console.log('🔊 Озвучено:', text);
    }
}

// ==================== ТЕМА ====================

document.documentElement.setAttribute('data-theme', currentTheme);
document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';

document.getElementById('theme-toggle').addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    document.getElementById('theme-toggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
});

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
    `).join('');
    
    if (alarms.length === 0) {
        list.innerHTML = '<p style="opacity:0.6">Будильников нет</p>';
    }
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
            <button class="delete-btn" onclick="deleteTask(${tasks.indexOf(task)})" style="margin-left:auto;">✕</button>
        </div>
    `).join('') : '<p style="opacity:0.6">Задач на сегодня нет</p>';
}

// ==================== ПРОВЕРКА БУДИЛЬНИКОВ ====================

function checkDayChange() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== lastCheckDate) {
        lastCheckDate = today;
        resetTriggeredFlags();
    }
}

function resetTriggeredFlags() {
    alarms.forEach(alarm => alarm.triggeredToday = false);
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

setInterval(() => {
    checkDayChange();
    checkAlarms();
}, 1000);

function checkAlarms() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][now.getDay()];

    alarms.forEach((alarm) => {
        if (alarm.time === currentTime && alarm.days.includes(currentDay) && !alarm.triggeredToday && !isAlarmActive) {
            alarm.triggeredToday = true;
            localStorage.setItem('alarms', JSON.stringify(alarms));
            triggerAlarm(alarm);
        }
    });
}

// ==================== СИСТЕМА БУДИЛЬНИКА ====================

function triggerAlarm(alarm) {
    console.log('🔔 Будильник сработал:', alarm);
    
    if (isAlarmActive) {
        console.log('⚠️ Будильник уже активен');
        return;
    }
    
    isAlarmActive = true;
    currentAlarmData = alarm;
    
    const screen = document.getElementById('alarm-active');
    if (!screen) return;
    
    screen.classList.remove('hidden');
    
    // Fullscreen
    if (screen.requestFullscreen) {
        screen.requestFullscreen().catch(() => {});
    }
    
    screen.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <h1 style="font-size: 6rem; margin: 0; animation: alarm-blink 0.5s infinite;">${alarm.time}</h1>
            <p style="font-size: 2.5rem; margin: 30px 0; font-weight: bold;">⏰ ПОРА ПРОСЫПАТЬСЯ!</p>
            <div style="display: flex; gap: 20px; margin-top: 50px; flex-wrap: wrap; justify-content: center;">
                <button id="snooze-btn" style="padding: 25px 60px; font-size: 1.6rem; background: #ff9500; color: white; border: none; border-radius: 15px; cursor: pointer; font-weight: bold; -webkit-tap-highlight-color: transparent; user-select: none; touch-action: manipulation;">
                    Отложить (5 мин)
                </button>
                <button id="stop-alarm-btn" style="padding: 25px 60px; font-size: 1.6rem; background: #f44336; color: white; border: none; border-radius: 15px; cursor: pointer; font-weight: bold; -webkit-tap-highlight-color: transparent; user-select: none; touch-action: manipulation;">
                    ВЫКЛЮЧИТЬ
                </button>
            </div>
        </div>
    `;

    // Добавляем анимацию
    if (!document.getElementById('alarm-blink-style')) {
        const style = document.createElement('style');
        style.id = 'alarm-blink-style';
        style.textContent = `
            @keyframes alarm-blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.3; }
            }
            #stop-alarm-btn:active, #snooze-btn:active {
                transform: scale(0.95);
                opacity: 0.8;
            }
        `;
        document.head.appendChild(style);
    }

    // Назначаем обработчики кнопок
    setTimeout(() => {
        const stopBtn = document.getElementById('stop-alarm-btn');
        const snoozeBtn = document.getElementById('snooze-btn');
        
        if (stopBtn) {
            stopBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛑 ВЫКЛЮЧИТЬ - КЛИК');
                stopAlarmSequence(false);
            };
            stopBtn.ontouchend = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛑 ВЫКЛЮЧИТЬ - ТАЧ');
                stopAlarmSequence(false);
            };
        }
        
        if (snoozeBtn) {
            snoozeBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('⏸️ ОТЛОЖИТЬ - КЛИК');
                stopAlarmSequence(true);
            };
            snoozeBtn.ontouchend = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('⏸️ ОТЛОЖИТЬ - ТАЧ');
                stopAlarmSequence(true);
            };
        }
    }, 100);

    // Запускаем звук с задержкой
    setTimeout(() => {
        playAlarmSound();
    }, 300);

    // Запускаем вибрацию
    startVibration();
}

function playAlarmSound() {
    try {
        // Останавливаем предыдущий звук если есть
        if (alarmAudio) {
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
            alarmAudio.src = '';
            alarmAudio.load();
            alarmAudio = null;
        }
        
        alarmAudio = new Audio('sounds/kolokolnyy-perekhod-43-5574f5.mp3');
        alarmAudio.volume = 1.0;
        alarmAudio.loop = true;
        alarmAudio.preload = 'auto';
        
        alarmAudio.play().then(() => {
            console.log('🎵 Будильник играет');
        }).catch(err => {
            console.error('❌ Ошибка звука:', err);
        });
    } catch(e) {
        console.error('❌ Критическая ошибка:', e);
    }
}

function startVibration() {
    if (!navigator.vibrate) return;
    
    if (currentVibrationId) {
        clearInterval(currentVibrationId);
    }
    navigator.vibrate(0);
    
    currentVibrationId = setInterval(() => {
        navigator.vibrate([600, 200, 600, 200]);
    }, 1600);
    console.log('📳 Вибрация запущена');
}

function stopAlarmSequence(isSnooze = false) {
    console.log('🔇 ОСТАНОВКА БУДИЛЬНИКА. Отложить:', isSnooze);
    
    // 1. ПОЛНАЯ ОСТАНОВКА ЗВУКА
    if (alarmAudio) {
        alarmAudio.loop = false;
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        alarmAudio.src = '';
        alarmAudio.load();
        alarmAudio = null;
        console.log('🔇 Звук остановлен');
    }
    
    // 2. Остановка AudioContext
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().then(() => {
            audioContext = null;
            console.log('🔇 AudioContext закрыт');
        }).catch(() => {
            audioContext = null;
        });
    }
    
    // 3. ОСТАНОВКА ВИБРАЦИИ
    if (currentVibrationId) {
        clearInterval(currentVibrationId);
        currentVibrationId = null;
    }
    if (navigator.vibrate) {
        navigator.vibrate(0);
        console.log('📳 Вибрация остановлена');
    }
    
    // 4. Выход из fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        } catch(e) {}
    }
    
    // 5. Скрываем экран будильника
    const screen = document.getElementById('alarm-active');
    if (screen) {
        screen.classList.add('hidden');
        screen.innerHTML = '';
    }
    
    // 6. Обрабатываем логику
    if (isSnooze && currentAlarmData) {
        // Отложить
        console.log('⏱️ Будильник отложен на 5 минут');
        currentAlarmData.triggeredToday = false;
        localStorage.setItem('alarms', JSON.stringify(alarms));
        
        const snoozeAlarm = currentAlarmData;
        isAlarmActive = false;
        currentAlarmData = null;
        
        setTimeout(() => {
            if (!isAlarmActive && snoozeAlarm) {
                console.log('⏰ Повторный запуск после отсрочки');
                triggerAlarm(snoozeAlarm);
            }
        }, 300000); // 5 минут
        
    } else {
        // Выключить полностью
        console.log('✅ Будильник полностью выключен');
        
        const wasSmartAlarm = currentAlarmData && currentAlarmData.type === 'smart';
        
        resetTriggeredFlags();
        isAlarmActive = false;
        currentAlarmData = null;
        
        // Запускаем ассистента только для умного будильника
        if (wasSmartAlarm) {
            console.log('🤖 Запуск умного ассистента');
            setTimeout(() => {
                startSmartAssistant();
            }, 1000);
        }
    }
}

// ==================== УМНЫЙ АССИСТЕНТ ====================

async function startSmartAssistant() {
    console.log('🎤 Ассистент запущен');
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    speakText(greeting);
    
    // Погода через 2 секунды
    setTimeout(async () => {
        const weather = await getWeather();
        if (weather) {
            const weatherText = `В городе ${weather.city} сейчас ${weather.temp} градусов, ${weather.condition}`;
            speakText(weatherText);
        } else {
            speakText('Не удалось получить прогноз погоды');
        }
        
        // Задачи через 3 секунды
        setTimeout(() => {
            readTodayTasks();
        }, 3000);
        
    }, 2500);
}

async function getWeather() {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch('https://wttr.in/?format=j1', { 
            signal: controller.signal 
        });
        
        if (!res.ok) return null;
        
        const data = await res.json();
        const current = data.current_condition[0];
        const location = data.nearest_area[0];
        
        return {
            city: location.areaName[0].value || 'Город',
            temp: Math.round(current.temp_C),
            condition: current.weatherDesc[0].value || 'облачно'
        };
    } catch(e) {
        console.error('Погода не загружена:', e);
        return null;
    }
}

function readTodayTasks() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === today && !t.done);
    
    if (todayTasks.length === 0) {
        speakText('На сегодня задач нет');
    } else {
        const tasksList = todayTasks.map(t => t.text).join(', ');
        speakText(`На сегодня запланировано: ${tasksList}`);
    }
}

// ==================== БАРАБАН ТАЙМЕРА ====================

function initDrums() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    if (!minDrum || !secDrum) return;
    
    // Создаем много элементов для бесконечного скролла
    const createItems = () => {
        let html = '';
        for (let i = 0; i < 300; i++) {
            html += `<div class="drum-item">${(i % 60).toString().padStart(2,'0')}</div>`;
        }
        return html;
    };
    
    minDrum.innerHTML = createItems();
    secDrum.innerHTML = createItems();
    
    // Стили для барабана
    if (!document.getElementById('drum-style')) {
        const style = document.createElement('style');
        style.id = 'drum-style';
        style.textContent = `
            .drum-item {
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.1s;
                user-select: none;
            }
            .drum-item.selected {
                background: var(--accent);
                color: white;
                font-weight: bold;
                border-radius: 8px;
            }
            #minutes-drum, #seconds-drum {
                scroll-behavior: smooth;
                -webkit-overflow-scrolling: touch;
                scroll-snap-type: y mandatory;
            }
            .drum-item {
                scroll-snap-align: center;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Начальная позиция - середина
    const middlePos = 120 * 40; // 120 элементов по 40px
    minDrum.scrollTop = middlePos;
    secDrum.scrollTop = middlePos;
    
    updateDrumHighlight();
    
    // Обработчик бесконечного скролла
    const handleScroll = (drum) => {
        const maxScroll = drum.scrollHeight - drum.clientHeight;
        
        if (drum.scrollTop >= maxScroll - 40) {
            drum.scrollTop = middlePos;
        } else if (drum.scrollTop <= 40) {
            drum.scrollTop = maxScroll - middlePos;
        }
        
        updateDrumHighlight();
    };
    
    minDrum.addEventListener('scroll', () => handleScroll(minDrum));
    secDrum.addEventListener('scroll', () => handleScroll(secDrum));
    
    // Клик по элементу
    const handleClick = (e, drum) => {
        const item = e.target.closest('.drum-item');
        if (item) {
            const drumRect = drum.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            const offset = itemRect.top - drumRect.top + drum.scrollTop - (drumRect.height / 2) + (itemRect.height / 2);
            drum.scrollTo({ top: offset, behavior: 'smooth' });
        }
    };
    
    minDrum.addEventListener('click', (e) => handleClick(e, minDrum));
    secDrum.addEventListener('click', (e) => handleClick(e, secDrum));
}

function updateDrumHighlight() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    if (!minDrum || !secDrum) return;
    
    document.querySelectorAll('.drum-item.selected').forEach(el => el.classList.remove('selected'));
    
    const getCenterIndex = (drum) => Math.floor((drum.scrollTop + drum.clientHeight / 2) / 40);
    
    const minItems = minDrum.querySelectorAll('.drum-item');
    const secItems = secDrum.querySelectorAll('.drum-item');
    
    const minIdx = getCenterIndex(minDrum);
    const secIdx = getCenterIndex(secDrum);
    
    if (minItems[minIdx]) minItems[minIdx].classList.add('selected');
    if (secItems[secIdx]) secItems[secIdx].classList.add('selected');
}

function getTimerValue() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    if (!minDrum || !secDrum) return 0;
    
    const minutes = Math.round(minDrum.scrollTop / 40) % 60;
    const seconds = Math.round(secDrum.scrollTop / 40) % 60;
    return minutes * 60 + seconds;
}

// ==================== ТАЙМЕР / СЕКУНДОМЕР ====================

let isStopwatchMode = false;

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const min = Math.floor(timerSeconds / 60);
    const sec = timerSeconds % 60;
    display.textContent = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

function updateStopwatchDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const hours = Math.floor(stopwatchSeconds / 3600);
    const mins = Math.floor((stopwatchSeconds % 3600) / 60);
    const secs = stopwatchSeconds % 60;
    display.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

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
        isTimerRunning = false;
        updateTimerDisplay();
    }
}

function playTimerSound() {
    try {
        generateTimerSound();
        const audio = new Audio('sounds/timer-bell_m1tycbno.mp3');
        audio.volume = 1.0;
        audio.play().catch(() => {});
    } catch (e) {
        console.error('Ошибка звука таймера:', e);
    }
}

function toggleStopwatch() {
    isStopwatchMode = !isStopwatchMode;
    
    const btn = document.getElementById('stopwatch-btn');
    const drumContainer = document.querySelector('.drum-container');
    
    if (isStopwatchMode) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        if (btn) btn.textContent = 'Таймер';
        if (drumContainer) drumContainer.style.display = 'none';
        stopwatchSeconds = 0;
        updateStopwatchDisplay();
    } else {
        clearInterval(stopwatchInterval);
        isStopwatchRunning = false;
        if (btn) btn.textContent = 'Секундомер';
        if (drumContainer) drumContainer.style.display = 'grid';
        timerSeconds = 0;
        updateTimerDisplay();
    }
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================

function openAlarmModal() {
    const modal = document.getElementById('alarm-modal');
    if (!modal) return;
    
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
                <label><input type="radio" name="type" value="normal" checked> ⏰ Обычный</label>
                <label><input type="radio" name="type" value="smart"> 🤖 Умный ассистент</label>
            </div>
            <button onclick="saveAlarm()">Сохранить</button>
            <button onclick="closeModal('alarm-modal')" style="background: #999;">Отмена</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

function saveAlarm() {
    const timeInput = document.getElementById('alarm-time');
    if (!timeInput) return;
    
    const time = timeInput.value;
    const days = Array.from(document.querySelectorAll('#alarm-modal input[type="checkbox"]:checked'))
        .map(el => el.value);
    const typeRadio = document.querySelector('#alarm-modal input[name="type"]:checked');
    const type = typeRadio ? typeRadio.value : 'normal';
    
    if (time && days.length > 0) {
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

function openTaskModal() {
    const modal = document.getElementById('task-modal');
    if (!modal) return;
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Добавить задачу</h3>
            <input type="text" id="task-text" placeholder="Текст задачи" maxlength="100">
            <button onclick="saveTask()">Сохранить</button>
            <button onclick="closeModal('task-modal')" style="background: #999;">Отмена</button>
        </div>
    `;
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        const input = document.getElementById('task-text');
        if (input) input.focus();
    }, 100);
}

function saveTask() {
    const textInput = document.getElementById('task-text');
    if (!textInput) return;
    
    const text = textInput.value.trim();
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
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

function initApp() {
    console.log('✨ Ailarm запущен!');
    
    // Назначаем обработчики
    const addAlarmBtn = document.getElementById('add-alarm-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const stopwatchBtn = document.getElementById('stopwatch-btn');
    const timerStart = document.getElementById('timer-start');
    const timerPause = document.getElementById('timer-pause');
    const timerReset = document.getElementById('timer-reset');
    const alarmModal = document.getElementById('alarm-modal');
    const taskModal = document.getElementById('task-modal');
    
    if (addAlarmBtn) addAlarmBtn.addEventListener('click', openAlarmModal);
    if (addTaskBtn) addTaskBtn.addEventListener('click', openTaskModal);
    if (stopwatchBtn) stopwatchBtn.addEventListener('click', toggleStopwatch);
    if (timerStart) timerStart.addEventListener('click', handleTimerStart);
    if (timerPause) timerPause.addEventListener('click', handleTimerPause);
    if (timerReset) timerReset.addEventListener('click', handleTimerReset);
    
    // Закрытие модалок по клику вне
    if (alarmModal) {
        alarmModal.addEventListener('click', (e) => {
            if (e.target.id === 'alarm-modal') closeModal('alarm-modal');
        });
    }
    if (taskModal) {
        taskModal.addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') closeModal('task-modal');
        });
    }
    
    // Предзагрузка голосов
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }
    
    // Рендерим всё
    renderAlarms();
    renderTasks();
    initDrums();
}

// Запуск при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Обработчик для кнопки "Назад" в браузере (выход из fullscreen)
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        const screen = document.getElementById('alarm-active');
        if (screen && !screen.classList.contains('hidden')) {
            console.log('⚠️ Fullscreen закрыт вручную');
        }
    }
});

// Предотвращаем случайное закрытие во время будильника
window.addEventListener('beforeunload', (e) => {
    if (isAlarmActive) {
        e.preventDefault();
        e.returnValue = 'Будильник активен! Вы уверены что хотите уйти?';
        return e.returnValue;
    }
});

console.log('✅ script.js полностью загружен и готов к работе');
