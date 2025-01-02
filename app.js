// app.js: JavaScript functionality for the Task Timer App (Enhanced)

let tasks = []; // Stores tasks in the form { name, time, remainingTime, editing }
let currentTaskIndex = 0; // Tracks which task is currently running
let timerInterval = null; // Holds the interval for the countdown

loadTasksFromCookie(); // Loads tasks from cookie on page load
updateTaskListUI(); // Renders tasks in the UI

function addTask() {
  // Reads user inputs for name, time, and time unit
  const taskName = document.getElementById('taskName').value.trim();
  const taskTime = parseInt(document.getElementById('taskTime').value, 10);
  const timeUnit = document.getElementById('timeUnit').value;

  // Exits if input is invalid
  if (!taskName || isNaN(taskTime) || taskTime <= 0) return;

  // Converts user-input to seconds
  let timeInSeconds = 0;
  if (timeUnit === 'seconds') timeInSeconds = taskTime;
  if (timeUnit === 'minutes') timeInSeconds = taskTime * 60;
  if (timeUnit === 'hours')   timeInSeconds = taskTime * 3600;

  // Adds new task
  tasks.push({
    name: taskName,
    time: timeInSeconds,
    remainingTime: timeInSeconds,
    editing: false
  });

  // Clears input fields and updates UI
  document.getElementById('taskName').value = '';
  document.getElementById('taskTime').value = '';
  updateTaskListUI();
  storeTasksInCookie();
}

function updateTaskListUI() {
  // Renders tasks in the UI
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    // Container for task name/time or editing fields
    const taskDetails = document.createElement('div');
    taskDetails.className = 'task-details';

    if (!task.editing) {
      // Static display of task name and time if not editing
      const nameEl = document.createElement('div');
      nameEl.className = 'task-name';
      nameEl.textContent = (index === currentTaskIndex ? '[Current] ' : '') + task.name;

      const timeEl = document.createElement('div');
      timeEl.className = 'task-time';
      timeEl.textContent = '(' + formatTime(task.remainingTime) + ' remaining)';

      taskDetails.appendChild(nameEl);
      taskDetails.appendChild(timeEl);
    } else {
      // If task is in editing mode, create input fields for name/time
      const editFields = document.createElement('div');
      editFields.className = 'edit-fields';

      const nameInput = document.createElement('input');
      nameInput.value = task.name;

      const timeInput = document.createElement('input');
      timeInput.type = 'number';
      timeInput.value = task.time;

      // Updates the task data when user saves
      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save';
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
      cancelButton.textContent = 'Cancel';
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

    // Controls for moving or editing each task
    const taskActions = document.createElement('div');
    taskActions.className = 'task-actions';

    // Move Up button
    if (index > 0) {
      const upButton = document.createElement('button');
      upButton.textContent = '↑';
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

    // Move Down button
    if (index < tasks.length - 1) {
      const downButton = document.createElement('button');
      downButton.textContent = '↓';
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

    // Edit button (if not already editing)
    if (!task.editing) {
      const editButton = document.createElement('button');
      editButton.textContent = 'Edit';
      editButton.onclick = () => {
        task.editing = true;
        updateTaskListUI();
      };
      taskActions.appendChild(editButton);
    }

    // Remove button
    const removeButton = document.createElement('button');
    removeButton.textContent = 'X';
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

  // Updates the progress bar width based on the current task’s time
  updateProgressBar();
  // Updates the estimated finish time label
  updateEstimatedFinishTime();
}

function startTimer() {
  // Prevents starting a new timer if one is already running or if there are no tasks
  if (!tasks.length || timerInterval) return;
  runCurrentTask();
}

function runCurrentTask() {
  if (currentTaskIndex >= tasks.length) return; // No tasks left
  alertNewTask(currentTaskIndex); // Alerts user that a new task is starting

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

function exitTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  currentTaskIndex = 0;
  tasks.forEach(t => t.remainingTime = t.time);
  updateTaskListUI();
}

function playSound() {
  const sound = document.getElementById('notificationSound');
  sound.currentTime = 0;
  sound.play();
}

function alertNewTask(index) {
  // Alerts user that a new task has started
  if (index >= 0 && index < tasks.length) {
    alert('Starting: ' + tasks[index].name);
  }
}

function updateProgressBar() {
  // Updates progress bar for the current task
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
  // Calculates remaining time for all tasks and displays the estimated finish time
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

function formatTime(seconds) {
  // Converts total seconds into an HH:MM:SS style string
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const hStr = hrs > 0 ? hrs + 'h ' : '';
  const mStr = mins > 0 ? mins + 'm ' : '';
  const sStr = secs + 's';
  return hStr + mStr + sStr;
}

function storeTasksInCookie() {
  // Saves tasks array to a cookie in JSON format
  const encodedTasks = encodeURIComponent(JSON.stringify(tasks));
  document.cookie = 'taskList=' + encodedTasks + '; path=/; max-age=31536000';
}

function loadTasksFromCookie() {
  // Retrieves cookie named 'taskList' and parses JSON
  const allCookies = document.cookie.split(';');
  const taskCookie = allCookies.find(c => c.trim().startsWith('taskList='));
  if (!taskCookie) return;
  const jsonStr = decodeURIComponent(taskCookie.trim().split('=')[1]);
  tasks = JSON.parse(jsonStr) || [];
}

function exportTasksToXML() {
  // Constructs an XML structure for current tasks
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?><Tasks>';
  tasks.forEach(task => {
    xmlString += '<Task><Name>' + escapeXML(task.name) + '</Name><Time>' + task.time + '</Time></Task>';
  });
  xmlString += '</Tasks>';

  // Creates a downloadable link for the XML
  const blob = new Blob([xmlString], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tasks.xml';
  link.click();
  URL.revokeObjectURL(url);
}

function importTasksFromXML(event) {
  // Reads the selected XML file and merges tasks
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(e.target.result, 'application/xml');
    const importedTasks = Array.from(xmlDoc.getElementsByTagName('Task')).map(tNode => {
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
    tasks = tasks.concat(importedTasks);
    storeTasksInCookie();
    updateTaskListUI();
  };
  reader.readAsText(file);
}

function escapeXML(str) {
  // Escapes special characters for valid XML
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
