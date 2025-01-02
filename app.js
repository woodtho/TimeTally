// app.js: JavaScript functionality for TimeTally, including dynamic import behavior and additional timer info

let tasks = []; // Stores tasks in the form { name, time, remainingTime, editing }
let currentTaskIndex = 0; // Tracks which task is currently running
let timerInterval = null; // Holds the interval ID for the countdown
let importedFileData = null; // Temporarily holds the parsed data from the selected file

loadTasksFromCookie(); // Loads tasks from cookie on page load
updateTaskListUI(); // Renders tasks in the UI

function addTask() {
  const taskName = document.getElementById('taskName').value.trim();
  const taskTime = parseInt(document.getElementById('taskTime').value, 10);
  const timeUnit = document.getElementById('timeUnit').value;
  if (!taskName || isNaN(taskTime) || taskTime <= 0) return;

  let timeInSeconds = 0;
  if (timeUnit === 'seconds') timeInSeconds = taskTime;
  if (timeUnit === 'minutes') timeInSeconds = taskTime * 60;
  if (timeUnit === 'hours')   timeInSeconds = taskTime * 3600;

  tasks.push({
    name: taskName,
    time: timeInSeconds,
    remainingTime: timeInSeconds,
    editing: false
  });

  document.getElementById('taskName').value = '';
  document.getElementById('taskTime').value = '';
  updateTaskListUI();
  storeTasksInCookie();
}

function updateTaskListUI() {
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const taskDetails = document.createElement('div');
    taskDetails.className = 'task-details';

    if (!task.editing) {
      const nameEl = document.createElement('div');
      nameEl.className = 'task-name';
      nameEl.textContent = (index === currentTaskIndex ? '[Current] ' : '') + task.name;

      const timeEl = document.createElement('div');
      timeEl.className = 'task-time';
      timeEl.textContent = '(' + formatTime(task.remainingTime) + ' remaining)';

      taskDetails.appendChild(nameEl);
      taskDetails.appendChild(timeEl);
    } else {
      const editFields = document.createElement('div');
      editFields.className = 'edit-fields';

      const nameInput = document.createElement('input');
      nameInput.value = task.name;

      const timeInput = document.createElement('input');
      timeInput.type = 'number';
      timeInput.value = task.time;

      const saveButton = document.createElement('button');
      saveButton.innerHTML = '<i class="fas fa-save"></i> Save';
      saveButton.onclick = () => {
        task.name = nameInput.value;
        const newTime = parseInt(timeInput.value, 10);
        task.time = isNaN(newTime) || newTime <= 0 ? task.time : newTime;
        task.remainingTime = task.time;
        task.editing = false;
        updateTaskListUI();
        storeTasksInCookie();
      };

      const cancelButton = document.createElement('button');
      cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancel';
      cancelButton.onclick = () => {
        task.editing = false;
        updateTaskListUI();
      };

      editFields.appendChild(nameInput);
      editFields.appendChild(timeInput);
      editFields.appendChild(saveButton);
      editFields.appendChild(cancelButton);
      taskDetails.appendChild(editFields);
    }

    li.appendChild(taskDetails);

    const taskActions = document.createElement('div');
    taskActions.className = 'task-actions';

    if (index > 0) {
      const upButton = document.createElement('button');
      upButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
      upButton.onclick = () => {
        const temp = tasks[index];
        tasks[index] = tasks[index - 1];
        tasks[index - 1] = temp;
        if (currentTaskIndex === index) currentTaskIndex--;
        else if (currentTaskIndex === index - 1) currentTaskIndex++;
        updateTaskListUI();
        storeTasksInCookie();
      };
      taskActions.appendChild(upButton);
    }

    if (index < tasks.length - 1) {
      const downButton = document.createElement('button');
      downButton.innerHTML = '<i class="fas fa-arrow-down"></i>';
      downButton.onclick = () => {
        const temp = tasks[index];
        tasks[index] = tasks[index + 1];
        tasks[index + 1] = temp;
        if (currentTaskIndex === index) currentTaskIndex++;
        else if (currentTaskIndex === index + 1) currentTaskIndex--;
        updateTaskListUI();
        storeTasksInCookie();
      };
      taskActions.appendChild(downButton);
    }

    if (!task.editing) {
      const editButton = document.createElement('button');
      editButton.innerHTML = '<i class="fas fa-edit"></i>';
      editButton.onclick = () => {
        task.editing = true;
        updateTaskListUI();
      };
      taskActions.appendChild(editButton);
    }

    const removeButton = document.createElement('button');
    removeButton.innerHTML = '<i class="fas fa-trash"></i>';
    removeButton.style.background = '#f44336';
    removeButton.onmouseover = () => { removeButton.style.background = '#e53935'; };
    removeButton.onmouseout = () => { removeButton.style.background = '#f44336'; };
    removeButton.onclick = () => {
      tasks.splice(index, 1);
      if (currentTaskIndex >= tasks.length) currentTaskIndex = tasks.length - 1;
      updateTaskListUI();
      storeTasksInCookie();
    };

    taskActions.appendChild(removeButton);
    li.appendChild(taskActions);
    taskList.appendChild(li);
  });

  updateProgressBar();
  updateEstimatedFinishTime();
  updateTimerInfo(); // Shows the timer text and percent
}

function startTimer() {
  if (!tasks.length || timerInterval) return;
  runCurrentTask();
}

function runCurrentTask() {
  if (currentTaskIndex >= tasks.length) return;
  timerInterval = setInterval(() => {
    tasks[currentTaskIndex].remainingTime--;
    updateTaskListUI();

    if (tasks[currentTaskIndex].remainingTime <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      playSound();
      currentTaskIndex++;
      runCurrentTask();
    }
  }, 1000);
}

function skipTask() {
  if (!tasks.length || currentTaskIndex >= tasks.length) return;
  clearInterval(timerInterval);
  timerInterval = null;
  currentTaskIndex++;
  updateTaskListUI();
  runCurrentTask();
}

function completeEarly() {
  if (!tasks.length || currentTaskIndex >= tasks.length) return;
  clearInterval(timerInterval);
  timerInterval = null;
  playSound();
  currentTaskIndex++;
  updateTaskListUI();
  runCurrentTask();
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function restartTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  currentTaskIndex = 0;
  tasks.forEach(t => t.remainingTime = t.time);
  updateTaskListUI();
}

function onFileLoaded(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(e.target.result, 'application/xml');
    importedFileData = Array.from(xmlDoc.getElementsByTagName('Task')).map(tNode => {
      const nameNode = tNode.getElementsByTagName('Name')[0];
      const timeNode = tNode.getElementsByTagName('Time')[0];
      const parsedTime = timeNode ? parseInt(timeNode.textContent, 10) : 0;
      return {
        name: nameNode ? nameNode.textContent : 'Unnamed',
        time: parsedTime,
        remainingTime: parsedTime,
        editing: false
      };
    });

    // Show two buttons to match the app's general style
    const importSection = document.getElementById('importSection');
    importSection.innerHTML = `
      <button class="btn-start" onclick="importData('add')">
        <i class="fas fa-plus"></i> Add
      </button>
      <button class="btn-red" onclick="importData('replace')">
        <i class="fas fa-exchange-alt"></i> Replace
      </button>
    `;
  };
  reader.readAsText(file);
}

function importData(mode) {
  if (!importedFileData) return;
  if (mode === 'replace') {
    tasks = importedFileData;
    currentTaskIndex = 0;
  } else {
    tasks = tasks.concat(importedFileData);
  }
  storeTasksInCookie();
  updateTaskListUI();
  importedFileData = null;

  // Reset the import section
  const importSection = document.getElementById('importSection');
  importSection.innerHTML = `
    <input type="file" id="importFile" accept=".xml" onchange="onFileLoaded(event)" />
  `;
  document.getElementById('importFile').value = '';
}

function exportTasksToXML() {
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?><Tasks>';
  tasks.forEach(task => {
    xmlString += '<Task><Name>' + escapeXML(task.name) + '</Name><Time>' + task.time + '</Time></Task>';
  });
  xmlString += '</Tasks>';

  const blob = new Blob([xmlString], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tasks.xml';
  link.click();
  URL.revokeObjectURL(url);
}

function updateProgressBar() {
  const progressBar = document.getElementById('progressBar');
  if (!tasks.length || currentTaskIndex >= tasks.length) {
    progressBar.style.width = '0%';
    return;
  }
  const currentTask = tasks[currentTaskIndex];
  const fraction = (currentTask.time - currentTask.remainingTime) / currentTask.time;
  progressBar.style.width = (fraction * 100).toFixed(2) + '%';
}

function updateEstimatedFinishTime() {
  const estFinishElem = document.getElementById('estimatedFinishTime');
  let totalSecLeft = 0;
  for (let i = currentTaskIndex; i < tasks.length; i++) {
    totalSecLeft += tasks[i].remainingTime;
  }
  if (totalSecLeft <= 0) {
    estFinishElem.textContent = 'All tasks completed or no tasks available.';
    return;
  }
  const now = new Date().getTime();
  const finish = new Date(now + totalSecLeft * 1000);
  estFinishElem.textContent = 'Estimated finish: ' + finish.toLocaleString();
}

function updateTimerInfo() {
  const timerText = document.getElementById('timerText');
  const timerPercent = document.getElementById('timerPercent');

  if (currentTaskIndex >= tasks.length) {
    timerText.textContent = 'No current task.';
    timerPercent.textContent = '';
    return;
  }

  const currentTask = tasks[currentTaskIndex];
  const fraction = (currentTask.time - currentTask.remainingTime) / currentTask.time;
  const percentage = (fraction * 100).toFixed(2) + '%';

  // Shows the task duration and time left
  timerText.textContent = `Current: ${currentTask.name} — ${formatTime(currentTask.time)} total, ${formatTime(currentTask.remainingTime)} left`;
  timerPercent.textContent = `Progress: ${percentage}`;
}

function playSound() {
  const sound = document.getElementById('notificationSound');
  sound.currentTime = 0;
  sound.play();
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const hStr = hrs > 0 ? hrs + 'h ' : '';
  const mStr = mins > 0 ? mins + 'm ' : '';
  const sStr = secs + 's';
  return hStr + mStr + sStr;
}

function storeTasksInCookie() {
  const encodedTasks = encodeURIComponent(JSON.stringify(tasks));
  document.cookie = 'taskList=' + encodedTasks + '; path=/; max-age=31536000';
}

function loadTasksFromCookie() {
  const allCookies = document.cookie.split(';');
  const taskCookie = allCookies.find(c => c.trim().startsWith('taskList='));
  if (!taskCookie) return;
  const jsonStr = decodeURIComponent(taskCookie.trim().split('=')[1]);
  tasks = JSON.parse(jsonStr) || [];
}

function escapeXML(str) {
  return str.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
