let alarmTime = null;
let isAlarmActive = false;
let audioCtx = null;
let oscillator = null;
let gainNode = null;
let detoxInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    updateClock();
    setInterval(updateClock, 1000);
    loadSavedData();
    
    document.getElementById('btn-toggle-alarm').addEventListener('click', toggleAlarm);
    document.getElementById('btn-dismiss').addEventListener('click', dismissAlarm);
});

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').textContent = now.toLocaleDateString('ru-RU', options);
    
    if (isAlarmActive && alarmTime) {
        const currentTime = `${hours}:${minutes}`;
        if (currentTime === alarmTime) {
            triggerAlarm();
        }
    }
}

function setPreset(time) {
    document.getElementById('alarm-time').value = time;
}

function toggleAlarm() {
    const timeInput = document.getElementById('alarm-time').value;
    const statusText = document.getElementById('alarm-status');
    const btn = document.getElementById('btn-toggle-alarm');
    
    if (!timeInput) {
        statusText.textContent = "Укажите время!";
        return;
    }
    
    if (!isAlarmActive) {
        alarmTime = timeInput;
        isAlarmActive = true;
        statusText.textContent = `Будильник установлен на ${alarmTime}`;
        btn.textContent = "Отменить";
        btn.classList.add('active');
        initAudioContext();
    } else {
        isAlarmActive = false;
        alarmTime = null;
        statusText.textContent = "Будильник не установлен";
        btn.textContent = "Включить будильник";
        btn.classList.remove('active');
    }
}

function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function triggerAlarm() {
    isAlarmActive = false;
    switchScreen('night-screen', 'alarm-screen');
    
    if (audioCtx) {
        oscillator = audioCtx.createOscillator();
        gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(85, audioCtx.currentTime); // Мягкий басовый гул
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 3); 
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
    }
}

function dismissAlarm() {
    if (gainNode) {
        gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 1);
    }
    
    switchScreen('alarm-screen', 'dashboard-screen');
    startVoiceAssistant();
    startDetoxTimer(20);
}

// Новый спокойный стиль речи
function startVoiceAssistant() {
    if ('speechSynthesis' in window) {
        const t1 = localStorage.getItem('task1');
        const t2 = localStorage.getItem('task2');
        const t3 = localStorage.getItem('task3');
        
        let taskText = "";
        if (t1 || t2 || t3) {
            taskText = "Напоминаю ваши планы на сегодня: ";
            if (t1) taskText += `${t1}. `;
            if (t2) taskText += `Затем: ${t2}. `;
            if (t3) taskText += `И еще: ${t3}.`;
        } else {
            taskText = "На сегодня планов не записано, можно отдохнуть.";
        }

        const greeting = `Доброе утро. На часах время подъема. ${taskText} Хорошего дня.`;
        
        const utterance = new SpeechSynthesisUtterance(greeting);
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9; // Естественная, спокойная скорость
        
        window.speechSynthesis.speak(utterance);
    }
}

function startDetoxTimer(minutes) {
    let time = minutes * 60;
    const display = document.getElementById('detox-timer');
    
    if (detoxInterval) clearInterval(detoxInterval);
    
    detoxInterval = setInterval(() => {
        let mins = String(Math.floor(time / 60)).padStart(2, '0');
        let secs = String(time % 60).padStart(2, '0');
        
        display.textContent = `${mins}:${secs}`;
        
        if (time <= 0) {
            stopEverything();
        }
        time--;
    }, 1000);
}

// Функция мгновенного выхода из детокса и отключения звуков
function cancelDetox() {
    stopEverything();
    const display = document.getElementById('detox-timer');
    display.textContent = "Пропущено";
    display.style.color = "#45a29e";
}

function stopEverything() {
    if (detoxInterval) clearInterval(detoxInterval);
    if (oscillator) {
        try { oscillator.stop(); } catch(e) {}
    }
    window.speechSynthesis.cancel(); // Если ассистент еще говорит — прерываем речь
}

function selectMood(mood) {
    const reply = document.getElementById('mood-reply');
    if (mood === 'заряжен') {
        reply.textContent = "Отлично, продуктивного дня!";
    } else if (mood === 'на чилле') {
        reply.textContent = "Хороший настрой. Двигайтесь в своем темпе.";
    } else {
        reply.textContent = "Понял. Не торопитесь, начните с кофе.";
        if (gainNode && audioCtx) gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1);
    }
}

function switchScreen(fromId, toId) {
    document.getElementById(fromId).classList.remove('active');
    setTimeout(() => {
        document.getElementById(toId).classList.add('active');
    }, 400);
}

function saveTasks() {
    localStorage.setItem('task1', document.getElementById('task1').value);
    localStorage.setItem('task2', document.getElementById('task2').value);
    localStorage.setItem('task3', document.getElementById('task3').value);
    alert('Список задач сохранен.');
}

function loadSavedData() {
    document.getElementById('task1').value = localStorage.getItem('task1') || '';
    document.getElementById('task2').value = localStorage.getItem('task2') || '';
    document.getElementById('task3').value = localStorage.getItem('task3') || '';
}
