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
let currentAlarmData = null;

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

// Generate timer beep sound (1200Hz) - ONLY for timer
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

function triggerAlarm(alarm) {
    console.log('🔔 Будильник сработал:', alarm);
    isAlarmActive = true;
    currentAlarmData = alarm;
    
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
        <div style="display: flex; gap: 20px; margin-top: 50px; flex-wrap: wrap; justify-content: center;">
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

    // 🔧 ИСПРАВЛЕНО: Назначаем обработчики ПОСЛЕ создания элементов
    setTimeout(() => {
        const stopBtn = document.getElementById('stop-alarm-btn');
        const snoozeBtn = document.getElementById('snooze-btn');
        
        if (stopBtn) {
            stopBtn.onclick = (e) => {
                e.stopPropagation();
                console.log('🛑 Нажата кнопка ВЫКЛЮЧИТЬ');
                stopAlarmSequence(false);
            };
            stopBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛑 Тач по кнопке ВЫКЛЮЧИТЬ');
                stopAlarmSequence(false);
            });
        }
        
        if (snoozeBtn) {
            snoozeBtn.onclick = (e) => {
                e.stopPropagation();
                console.log('⏸️ Нажата кнопка ОТЛОЖИТЬ');
                stopAlarmSequence(true);
            };
            snoozeBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('⏸️ Тач по кнопке ОТЛОЖИТЬ');
                stopAlarmSequence(true);
            });
        }
    }, 100);

    // Initialize audio context
    initAudioContext();
    
    // Play alarm music ONLY (NO beeping)
    console.log('🎵 Включаю музыку будильника...');
    alarmAudio = new Audio('sounds/kolokolnyy-perekhod-43-5574f5.mp3');
    alarmAudio.volume = 1.0;
    alarmAudio.loop = true;
    
    // 🔧 ИСПРАВЛЕНО: Добавляем обработку ошибок воспроизведения
    const playPromise = alarmAudio.play();
    if (playPromise !== undefined) {
        playPromise.catch((err) => {
            console.error('❌ Ошибка при воспроизведении музыки:', err);
            // Пробуем ещё раз после взаимодействия
            document.addEventListener('click', () => {
                if (alarmAudio) {
                    alarmAudio.play().catch(e => console.error('Повторная ошибка:', e));
                }
            }, { once: true });
        });
    }

    // Aggressive continuous vibration
    if (navigator.vibrate) {
        // Сначала останавливаем предыдущую вибрацию
        if (currentVibrationId) {
            clearInterval(currentVibrationId);
        }
        navigator.vibrate(0);
        
        currentVibrationId = setInterval(() => {
            navigator.vibrate([600, 200, 600, 200]);
        }, 1600);
        console.log('📳 Вибрация включена');
    }
}

function stopAlarmSequence(isSnooze = false) {
    console.log('🔇 Остановка последовательности будильника. Snooze:', isSnooze);
    
    // Stop all sounds - ПОЛНАЯ ОСТАНОВКА
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
        alarmAudio = null;
        console.log('🔇 Музыка остановлена');
    }
    
    // Stop vibration
    if (currentVibrationId) {
        clearInterval(currentVibrationId);
        currentVibrationId = null;
        navigator.vibrate(0); // 🔧 ИСПРАВЛЕНО: Полная остановка вибрации
        console.log('📳 Вибрация отключена');
    }
    
    // Exit fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.warn('Exit fullscreen:', err));
    }
    
    const screen = document.getElementById('alarm-active');
    screen.classList.add('hidden');
    
    // 🔧 ИСПРАВЛЕНО: Сразу сбрасываем флаг isAlarmActive
    if (isSnooze) {
        console.log('⏱️ Установка отсрочки на 5 минут');
        // Reset trigger flag for snooze
        if (currentAlarmData) {
            currentAlarmData.triggeredToday = false;
            localStorage.setItem('alarms', JSON.stringify(alarms));
        }
        isAlarmActive = false;
        currentAlarmData = null;
        
        // Trigger again in 5 minutes
        setTimeout(() => {
            if (!isAlarmActive && currentAlarmData) {
                console.log('⏰ Повторный запуск после отсрочки');
                triggerAlarm(currentAlarmData);
            }
        }, 300000);
    } else {
        console.log('✅ Будильник отключен');
        isAlarmActive = false;
        
        // Show greeting if smart alarm
        const alarmType = currentAlarmData ? currentAlarmData.type : null;
        currentAlarmData = null;
        resetTriggeredFlags();
        
        if (alarmType === 'smart') {
            console.log('🤖 Запуск умного ассистента');
            setTimeout(startSmartAssistant, 600);
        }
    }
}

// 🔧 ИСПРАВЛЕНО: Добавлен голосовой синтез
function speakText(text) {
    if ('speechSynthesis' in window) {
        // Останавливаем предыдущую речь
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        // Выбираем русский голос если доступен
        const voices = window.speechSynthesis.getVoices();
        const russianVoice = voices.find(voice => voice.lang.startsWith('ru'));
        if (russianVoice) {
            utterance.voice = russianVoice;
        }
        
        window.speechSynthesis.speak(utterance);
        console.log('🔊 Озвучено:', text);
    } else {
        console.log('⚠️ Speech synthesis не поддерживается');
    }
}

async function startSmartAssistant() {
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    console.log('🎤 Приветствие:', greeting);
    speakText(greeting);
    
    setTimeout(async () => {
        const weather = await getWeather();
        if (weather) {
            const weatherText = `В городе ${weather.city} сейчас ${weather.temp} градусов, ${weather.condition}`;
            console.log(`🌤️ Погода: ${weatherText}`);
            speakText(weatherText);
        } else {
            const noWeatherText = 'Не удалось получить прогноз погоды';
            console.log('🌤️ Погода недоступна');
            speakText(noWeatherText);
        }
        
        setTimeout(readTodayTasks, 3000);
    }, 2000);
}

async function getWeather() {
    try {
        console.log('📡 Загрузка погоды...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch('https://wttr.in/?format=j1', { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            console.warn('❌ Weather API failed:', res.status);
            return null;
        }
        
        const data = await res.json();
        const current = data.current_condition[0];
        const location = data.nearest_area[0];
        
        return {
            city: location.areaName[0].value || 'Город',
            temp: Math.round(current.temp_C),
            condition: current.weatherDesc[0].value || 'облачно'
        };
    } catch(e) {
        console.error('❌ Weather error:', e.message);
        return null;
    }
}

function readTodayTasks() {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.date === today && !t.done);
    
    if (todayTasks.length === 0) {
        const noTasksText = 'На сегодня задач нет';
        console.log('📋 ' + noTasksText);
        speakText(noTasksText);
        return;
    }
    
    const tasksText = 'На сегодня запланировано: ' + todayTasks.map(t => t.text).join('. ');
    console.log('📋 Задачи на сегодня:');
    todayTasks.forEach(task => console.log('  - ' + task.text));
    speakText(tasksText);
}

function resetTriggeredFlags() {
    alarms.forEach(alarm => alarm.triggeredToday = false);
    localStorage.setItem('alarms', JSON.stringify(alarms));
}

// 🔧 ИСПРАВЛЕНО: Бесконечный барабан
function initDrums() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    if (!minDrum || !secDrum) return;
    
    // Создаем много элементов для имитации бесконечности
    const createInfiniteItems = () => {
        let html = '';
        for (let i = 0; i < 300; i++) {  // 300 элементов для плавного скролла
            html += `<div class="drum-item">${(i % 60).toString().padStart(2,'0')}</div>`;
        }
        return html;
    };
    
    minDrum.innerHTML = createInfiniteItems();
    secDrum.innerHTML = createInfiniteItems();
    
    // Добавляем стили
    if (!document.querySelector('style[data-drum]')) {
        const style = document.createElement('style');
        style.setAttribute('data-drum', 'true');
        style.textContent = `
            .drum-item {
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.1s;
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
            }
        `;
        document.head.appendChild(style);
    }
    
    // Скроллим в середину (там где числа 00-59)
    const middlePosition = 120 * 40; // 120 элементов * высота
    minDrum.scrollTop = middlePosition;
    secDrum.scrollTop = middlePosition;
    
    updateDrumHighlight();
    
    // 🔧 ИСПРАВЛЕНО: Добавляем обработку бесконечного скролла
    const handleInfiniteScroll = (drum) => {
        const scrollTop = drum.scrollTop;
        const maxScroll = drum.scrollHeight - drum.clientHeight;
        
        // Если скроллимся к концу - перепрыгиваем в начало
        if (scrollTop >= maxScroll - 40) {
            drum.scrollTop = middlePosition;
        }
        // Если скроллимся к началу - перепрыгиваем в конец
        else if (scrollTop <= 40) {
            drum.scrollTop = maxScroll - middlePosition;
        }
        
        updateDrumHighlight();
    };
    
    minDrum.addEventListener('scroll', () => handleInfiniteScroll(minDrum));
    secDrum.addEventListener('scroll', () => handleInfiniteScroll(secDrum));
    
    // Обработка тапов/кликов по элементам
    const handleDrumClick = (e, drum) => {
        const item = e.target.closest('.drum-item');
        if (item) {
            const drumRect = drum.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();
            const offset = itemRect.top - drumRect.top + drum.scrollTop - (drumRect.height / 2) + (itemRect.height / 2);
            drum.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
        }
    };
    
    minDrum.addEventListener('click', (e) => handleDrumClick(e, minDrum));
    secDrum.addEventListener('click', (e) => handleDrumClick(e, secDrum));
}

function updateDrumHighlight() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    
    if (!minDrum || !secDrum) return;
    
    // Remove old highlights
    document.querySelectorAll('.drum-item.selected').forEach(el => el.classList.remove('selected'));
    
    // Add new highlights to center items
    const getCenterIndex = (drum) => {
        const center = drum.scrollTop + drum.clientHeight / 2;
        return Math.floor(center / 40);
    };
    
    const minItems = minDrum.querySelectorAll('.drum-item');
    const secItems = secDrum.querySelectorAll('.drum-item');
    
    const minIndex = getCenterIndex(minDrum);
    const secIndex = getCenterIndex(secDrum);
    
    if (minItems[minIndex]) minItems[minIndex].classList.add('selected');
    if (secItems[secIndex]) secItems[secIndex].classList.add('selected');
}

function getTimerValue() {
    const minDrum = document.getElementById('minutes-drum');
    const secDrum = document.getElementById('seconds-drum');
    if (!minDrum || !secDrum) return 0;
    
    const minutes = Math.round(minDrum.scrollTop / 40) % 60;
    const seconds = Math.round(secDrum.scrollTop / 40) % 60;
    return minutes * 60 + seconds;
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const min = Math.floor(timerSeconds / 60);
    const sec = timerSeconds % 60;
    display.textContent = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

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
        console.log('🔔 Таймер завершён, воспроизведение звука...');
        generateTimerSound();
        const audio = new Audio('sounds/timer-bell_m1tycbno.mp3');
        audio.volume = 1.0;
        audio.play().catch(() => console.log('⚠️ Timer sound not found, используется сгенерированный звук'));
    } catch (e) {
        console.error('❌ Timer error:', e);
    }
}

function updateStopwatchDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const hours = Math.floor(stopwatchSeconds / 3600);
    const mins = Math.floor((stopwatchSeconds % 3600) / 60);
    const secs = stopwatchSeconds % 60;
    display.textContent = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

// Stopwatch toggle
let isStopwatchMode = false;

function toggleStopwatch() {
    const stopwatchBtn = document.getElementById('stopwatch-btn');
    const drumContainer = document.querySelector('.drum-container');
    
    isStopwatchMode = !isStopwatchMode;
    
    if (isStopwatchMode) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        
        if (stopwatchBtn) stopwatchBtn.textContent = 'Таймер';
        if (drumContainer) drumContainer.style.display = 'none';
        stopwatchSeconds = 0;
        updateStopwatchDisplay();
    } else {
        clearInterval(stopwatchInterval);
        isStopwatchRunning = false;
        
        if (stopwatchBtn) stopwatchBtn.textContent = 'Секундомер';
        if (drumContainer) drumContainer.style.display = 'grid';
        timerSeconds = 0;
        updateTimerDisplay();
    }
}

// ALARM MODAL
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
        if (!/^\d{2}:\d{2}$/.test(time)) {
            alert('Некорректный формат времени');
            return;
        }
        
        alarms.push({ time, days, type, triggeredToday: false });
        localStorage.setItem('alarms', JSON.stringify(alarms));
        renderAlarms();
        closeModal('alarm-modal');
        console.log('✅ Будильник создан:', { time, days, type });
    } else {
        alert('Выбери время и дни недели');
    }
}

function deleteAlarm(index) {
    alarms.splice(index, 1);
    localStorage.setItem('alarms', JSON.stringify(alarms));
    renderAlarms();
    console.log('🗑️ Будильник удалён');
}

// TASK MODAL
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
        console.log('✅ Задача добавлена:', text);
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
    console.log('🗑️ Задача удалена');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}

// 🔧 ИСПРАВЛЕНО: Инициализация после загрузки DOM
function initApp() {
    console.log('✨ Ailarm приложение загружено!');
    
    // Назначаем обработчики кнопок
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
    
    // Close modal when clicking outside
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
    
    // Инициализируем компоненты
    renderAlarms();
    renderTasks();
    initDrums();
    
    // Предзагружаем голоса для speech synthesis
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }
}

// Запускаем приложение после полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
