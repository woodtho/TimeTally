/************************************
  app.js
  - Per-list config in listConfigs
  - Options UI at the top, bound to the current list’s config
  - If time < 60 seconds, format as "xx seconds"
************************************/

let lists = {};          // { listName: [ {name, time, remainingTime, editing}, ... ] }
let listOrder = [];      // Tab order
let currentList = 'default';
let currentTaskIndex = 0;
let timerInterval = null;
let importedFileData = null;
let isListCreating = false;

// The per-list config is stored in listConfigs
// e.g. listConfigs[listName] = { beepEnabled, ttsEnabled, selectedVoiceName, ttsMode, ttsCustomMessage }
let listConfigs = {}; // { [listName]: {...config...} }

// Default TTS config
const DEFAULT_CONFIG = {
  beepEnabled: true,
  ttsEnabled: false,
  selectedVoiceName: '',
  ttsMode: 'taskNamePlusDurationStart',
  ttsCustomMessage: 'Task completed!'
};

// Affirmations array (used if ttsMode = randomAffirmation)
const AFFIRMATIONS = [
  "Great job!",
  "Well done!",
  "You did it!",
  "Keep it up!",
  "Nice work!"
];

// Keep a global array of voices
let availableVoices = [];

/* Called on page load to restore from cookie and build UI. */
function initApp() {
  loadFromCookie();

  // Create default if no lists
  if (Object.keys(lists).length === 0) {
    lists['default'] = [];
    listOrder.push('default');
    listConfigs['default'] = { ...DEFAULT_CONFIG };
  }

  // If currentList doesn't exist, pick first
  if (!lists[currentList]) {
    if (listOrder.length > 0) {
      currentList = listOrder[0];
    } else {
      lists['default'] = [];
      listOrder.push('default');
      listConfigs['default'] = { ...DEFAULT_CONFIG };
      currentList = 'default';
    }
  }

  buildTabs();
  updateTaskListUI();

  // Populate voices
  populateVoiceList();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // On first load, set the UI fields for the current list
  updateOptionsUI();

  // Update the estimated finish time periodically
  setInterval(updateEstimatedFinishTime, 5000);
}

/* Populate the <select> with available voices from speechSynthesis */
function populateVoiceList() {
  availableVoices = speechSynthesis.getVoices();
  const voiceSelect = document.getElementById('voiceSelect');
  voiceSelect.innerHTML = '';

  availableVoices.forEach((v) => {
    const option = document.createElement('option');
    option.value = v.name;
    option.textContent = v.name + (v.default ? ' (default)' : '');
    voiceSelect.appendChild(option);
  });

  // If user’s selectedVoice is valid, set it; else pick first
  const config = getConfig(currentList);
  if (config.selectedVoiceName && availableVoices.some((v) => v.name === config.selectedVoiceName)) {
    voiceSelect.value = config.selectedVoiceName;
  } else if (availableVoices.length > 0) {
    config.selectedVoiceName = availableVoices[0].name;
    voiceSelect.value = config.selectedVoiceName;
    storeInCookie();
  }
}

/* Build the tab UI */
function buildTabs() {
  const tabsContainer = document.getElementById('tabsContainer');
  tabsContainer.innerHTML = '';

  // "Add new list" button
  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add-btn';
  addBtn.innerHTML = '<i class="fas fa-plus"></i>';
  addBtn.title = 'Create a New List';
  addBtn.onclick = enterListCreateMode;

  listOrder.forEach(listName => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (listName === currentList ? ' active' : '');
    tab.draggable = true;
    tab.dataset.listName = listName;

    tab.addEventListener('dragstart', onTabDragStart);
    tab.addEventListener('dragover', onTabDragOver);
    tab.addEventListener('dragend', onTabDragEnd);
    tab.addEventListener('drop', onTabDrop);

    const tabNameEl = document.createElement('span');
    tabNameEl.className = 'tab-name';
    tabNameEl.textContent = listName;
    tab.appendChild(tabNameEl);

    const editIcon = document.createElement('i');
    editIcon.className = 'fas fa-edit tab-edit-icon';
    editIcon.onclick = e => toggleTabEdit(e, tab, listName);
    tab.appendChild(editIcon);

    // Inline rename/delete
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'tab-edit-controls';

    const renameInput = document.createElement('input');
    renameInput.className = 'tab-edit-input';
    renameInput.value = listName;
    controlsDiv.appendChild(renameInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'tab-edit-btn';
    saveBtn.innerHTML = '<i class="fas fa-save"></i>';
    saveBtn.onclick = e => saveTabEdit(e, tab, listName, renameInput);
    controlsDiv.appendChild(saveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'tab-delete-btn';
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.onclick = e => deleteTab(e, listName);
    controlsDiv.appendChild(delBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'tab-edit-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.onclick = e => cancelTabEdit(e, tab);
    controlsDiv.appendChild(cancelBtn);

    tab.appendChild(controlsDiv);

    tab.addEventListener('click', event => {
      if (event.target === editIcon || controlsDiv.contains(event.target)) return;
      setCurrentList(listName);
    });

    tabsContainer.appendChild(tab);
  });

  tabsContainer.appendChild(addBtn);
}

/* Drag-and-drop logic for tabs */
let draggedTab = null;
function onTabDragStart(e) {
  draggedTab = e.currentTarget;
  draggedTab.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onTabDragOver(e) {
  e.preventDefault();
  const targetTab = e.currentTarget;
  if (targetTab === draggedTab) return;
  const bounding = targetTab.getBoundingClientRect();
  if (e.clientY < bounding.y + bounding.height / 2) {
    targetTab.parentNode.insertBefore(draggedTab, targetTab);
  } else {
    targetTab.parentNode.insertBefore(draggedTab, targetTab.nextSibling);
  }
}
function onTabDrop(e) {
  e.preventDefault();
}
function onTabDragEnd() {
  if (!draggedTab) return;
  draggedTab.classList.remove('dragging');
  const tabsContainer = document.getElementById('tabsContainer');
  const tabElements = tabsContainer.querySelectorAll('.tab');
  listOrder = Array.from(tabElements).map(t => t.dataset.listName);
  storeInCookie();
  draggedTab = null;
}

/* Inline rename / delete */
function toggleTabEdit(e, tab, listName) {
  e.stopPropagation();
  const controls = tab.querySelector('.tab-edit-controls');
  const editIcon = tab.querySelector('.tab-edit-icon');
  const isVisible = (controls.style.display === 'flex');
  controls.style.display = isVisible ? 'none' : 'flex';
  editIcon.style.display = isVisible ? '' : 'none';
}
function saveTabEdit(e, tab, oldName, renameInput) {
  e.stopPropagation();
  const newName = renameInput.value.trim();
  if (!newName) return;
  if (lists[newName] && newName !== oldName) {
    return; // already exists
  }
  if (newName !== oldName) {
    // rename list in 'lists' and 'listOrder'
    lists[newName] = lists[oldName];
    delete lists[oldName];
    const idx = listOrder.indexOf(oldName);
    if (idx >= 0) {
      listOrder[idx] = newName;
    }
    if (currentList === oldName) {
      currentList = newName;
    }
    // Also rename in listConfigs
    listConfigs[newName] = listConfigs[oldName];
    delete listConfigs[oldName];
  }
  storeInCookie();
  buildTabs();
  updateTaskListUI();
}
function cancelTabEdit(e, tab) {
  e.stopPropagation();
  const controls = tab.querySelector('.tab-edit-controls');
  controls.style.display = 'none';
  const editIcon = tab.querySelector('.tab-edit-icon');
  if (editIcon) editIcon.style.display = '';
}
function deleteTab(e, listName) {
  e.stopPropagation();
  if (listOrder.length <= 1) return; // can't delete the only list
  delete lists[listName];
  delete listConfigs[listName];
  const idx = listOrder.indexOf(listName);
  if (idx >= 0) listOrder.splice(idx, 1);
  if (currentList === listName) {
    currentList = listOrder[0];
  }
  storeInCookie();
  buildTabs();
  updateTaskListUI();
}

/* Switch current list => update everything including top options UI */
function setCurrentList(listName) {
  currentList = listName;
  buildTabs();
  updateTaskListUI();
  updateOptionsUI();
}

/* CREATE NEW LIST */
function enterListCreateMode() {
  if (isListCreating) return;
  isListCreating = true;
  document.getElementById('listCreateFields').style.display = 'flex';
}
function cancelListCreate() {
  isListCreating = false;
  document.getElementById('createListName').value = '';
  document.getElementById('listCreateFields').style.display = 'none';
}
function saveNewList() {
  const listName = document.getElementById('createListName').value.trim();
  if (!listName) return;
  if (!lists[listName]) {
    lists[listName] = [];
    listOrder.push(listName);
    listConfigs[listName] = { ...DEFAULT_CONFIG };
  }
  currentList = listName;
  isListCreating = false;
  document.getElementById('createListName').value = '';
  document.getElementById('listCreateFields').style.display = 'none';
  storeInCookie();
  buildTabs();
  updateTaskListUI();
  updateOptionsUI();
}

/************************
 * PER-LIST OPTIONS
 ************************/
function updateOptionsUI() {
  const config = getConfig(currentList);
  document.getElementById('beepCheckbox').checked = config.beepEnabled;
  document.getElementById('ttsCheckbox').checked = config.ttsEnabled;

  // voiceSelect: set value if voice is valid
  const voiceEl = document.getElementById('voiceSelect');
  if (config.selectedVoiceName && availableVoices.some(v => v.name === config.selectedVoiceName)) {
    voiceEl.value = config.selectedVoiceName;
  } else if (availableVoices.length > 0) {
    config.selectedVoiceName = availableVoices[0].name;
    voiceEl.value = config.selectedVoiceName;
  }

  document.getElementById('ttsModeSelect').value = config.ttsMode;
  document.getElementById('ttsCustomMessage').value = config.ttsCustomMessage;
  toggleCustomMessageRow(config.ttsMode);
  storeInCookie(); // ensure we update cookie if needed
}

function onBeepCheckboxChange() {
  const config = getConfig(currentList);
  config.beepEnabled = document.getElementById('beepCheckbox').checked;
  storeInCookie();
}
function onTTSCheckboxChange() {
  const config = getConfig(currentList);
  config.ttsEnabled = document.getElementById('ttsCheckbox').checked;
  storeInCookie();
}
function onVoiceSelectChange() {
  const config = getConfig(currentList);
  config.selectedVoiceName = document.getElementById('voiceSelect').value;
  storeInCookie();
}
function onTTSModeChange() {
  const config = getConfig(currentList);
  config.ttsMode = document.getElementById('ttsModeSelect').value;
  toggleCustomMessageRow(config.ttsMode);
  storeInCookie();
}
function onCustomMessageChange() {
  const config = getConfig(currentList);
  config.ttsCustomMessage = document.getElementById('ttsCustomMessage').value.trim();
  storeInCookie();
}

/* Show/hide the custom message input if ttsMode === 'customCompletion' */
function toggleCustomMessageRow(ttsMode) {
  const row = document.getElementById('customMessageRow');
  row.style.display = (ttsMode === 'customCompletion') ? 'flex' : 'none';
}

/* Helper to get config object for a list, creating default if missing */
function getConfig(listName) {
  if (!listConfigs[listName]) {
    listConfigs[listName] = { ...DEFAULT_CONFIG };
  }
  return listConfigs[listName];
}

/************************
 * TASK / TIMER LOGIC
 ************************/
function getCurrentTasks() {
  return lists[currentList] || [];
}

function addTask() {
  const tasks = getCurrentTasks();
  const taskName = document.getElementById('taskName').value.trim();
  const taskTime = parseInt(document.getElementById('taskTime').value, 10);
  const timeUnit = document.getElementById('timeUnit').value;
  if (!taskName || isNaN(taskTime) || taskTime <= 0) return;

  let timeInSeconds = 0;
  if (timeUnit === 'seconds') timeInSeconds = taskTime;
  if (timeUnit === 'minutes') timeInSeconds = taskTime * 60;
  if (timeUnit === 'hours') timeInSeconds = taskTime * 3600;

  tasks.push({
    name: taskName,
    time: timeInSeconds,
    remainingTime: timeInSeconds,
    editing: false
  });

  document.getElementById('taskName').value = '';
  document.getElementById('taskTime').value = '';
  updateTaskListUI();
  storeInCookie();
}

function updateTaskListUI() {
  const tasks = getCurrentTasks();
  const taskList = document.getElementById('taskList');
  taskList.innerHTML = '';

  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const details = document.createElement('div');
    details.className = 'task-details';

    if (!task.editing) {
      const nameEl = document.createElement('div');
      nameEl.className = 'task-name';
      nameEl.textContent = (index === currentTaskIndex ? '[Current] ' : '') + task.name;

      const timeEl = document.createElement('div');
      timeEl.className = 'task-time';
      timeEl.textContent = '(' + formatTime(task.remainingTime) + ' remaining)';

      details.appendChild(nameEl);
      details.appendChild(timeEl);
    } else {
      // editing
      const editFields = document.createElement('div');
      editFields.className = 'edit-fields';

      const nameInput = document.createElement('input');
      nameInput.value = task.name;

      const timeInput = document.createElement('input');
      timeInput.type = 'number';
      timeInput.value = task.time;

      const saveButton = document.createElement('button');
      saveButton.innerHTML = '<i class="fas fa-save"></i>';
      saveButton.onclick = () => {
        task.name = nameInput.value;
        const newTime = parseInt(timeInput.value, 10);
        if (!isNaN(newTime) && newTime > 0) {
          task.time = newTime;
          task.remainingTime = newTime;
        }
        task.editing = false;
        updateTaskListUI();
        storeInCookie();
      };

      const cancelButton = document.createElement('button');
      cancelButton.innerHTML = '<i class="fas fa-times"></i>';
      cancelButton.className = 'btn-cancel';
      cancelButton.onclick = () => {
        task.editing = false;
        updateTaskListUI();
      };

      editFields.appendChild(nameInput);
      editFields.appendChild(timeInput);
      editFields.appendChild(saveButton);
      editFields.appendChild(cancelButton);
      details.appendChild(editFields);
    }

    li.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    // Move up
    if (index > 0) {
      const upBtn = document.createElement('button');
      upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
      upBtn.onclick = () => {
        [tasks[index], tasks[index - 1]] = [tasks[index - 1], tasks[index]];
        if (currentTaskIndex === index) currentTaskIndex--;
        else if (currentTaskIndex === index - 1) currentTaskIndex++;
        updateTaskListUI();
        storeInCookie();
      };
      actions.appendChild(upBtn);
    }

    // Move down
    if (index < tasks.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
      downBtn.onclick = () => {
        [tasks[index], tasks[index + 1]] = [tasks[index + 1], tasks[index]];
        if (currentTaskIndex === index) currentTaskIndex++;
        else if (currentTaskIndex === index + 1) currentTaskIndex--;
        updateTaskListUI();
        storeInCookie();
      };
      actions.appendChild(downBtn);
    }

    // Edit
    if (!task.editing) {
      const editBtn = document.createElement('button');
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.onclick = () => {
        task.editing = true;
        updateTaskListUI();
      };
      actions.appendChild(editBtn);
    }

    // Remove
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
    removeBtn.style.background = '#f44336';
    removeBtn.onmouseover = () => { removeBtn.style.background = '#e53935'; };
    removeBtn.onmouseout = () => { removeBtn.style.background = '#f44336'; };
    removeBtn.onclick = () => {
      tasks.splice(index, 1);
      if (currentTaskIndex >= tasks.length) {
        currentTaskIndex = tasks.length - 1;
      }
      updateTaskListUI();
      storeInCookie();
      // if last task deleted => restart
      if (tasks.length === 0) {
        restartTimer();
      }
    };

    actions.appendChild(removeBtn);
    li.appendChild(actions);
    taskList.appendChild(li);
  });

  updateProgressBar();
  updateEstimatedFinishTime();
  updateTimerInfo();
}

/************************
 * Timer / Start / Skip / Etc
 ************************/
function startTimer() {
  const tasks = getCurrentTasks();
  if (!tasks.length || timerInterval) return;
  runCurrentTask();
}

function runCurrentTask() {
  const tasks = getCurrentTasks();
  if (currentTaskIndex >= tasks.length) {
    currentTaskIndex = 0;
    tasks.forEach(t => (t.remainingTime = t.time));
    updateTaskListUI();
    return;
  }
  // TTS at start if so configured
  const config = getConfig(currentList);
  if (config.ttsEnabled) {
    const currentTask = tasks[currentTaskIndex];
    if (config.ttsMode === 'taskNamePlusDurationStart') {
      const msg = `Starting: ${currentTask.name}, which is ${formatTime(currentTask.time)}.`;
      speakNotification(msg, config);
    } else if (config.ttsMode === 'taskNameStart') {
      speakNotification(`Starting task: ${currentTask.name}.`, config);
    } else if (config.ttsMode === 'durationStart') {
      speakNotification(`This task will take ${formatTime(currentTask.time)}.`, config);
    }
  }

  timerInterval = setInterval(() => {
    tasks[currentTaskIndex].remainingTime--;
    updateTaskListUI();
    if (tasks[currentTaskIndex].remainingTime <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      onTaskComplete();
      currentTaskIndex++;
      runCurrentTask();
    }
  }, 1000);
}

function onTaskComplete() {
  const config = getConfig(currentList);
  if (config.beepEnabled) {
    playBeep();
  }
  // TTS if completion-based
  if (config.ttsEnabled) {
    if (config.ttsMode === 'customCompletion') {
      speakNotification(config.ttsCustomMessage, config);
    } else if (config.ttsMode === 'randomAffirmation') {
      const message = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
      speakNotification(message, config);
    }
  }
}

function skipTask() {
  const tasks = getCurrentTasks();
  if (!tasks.length || currentTaskIndex >= tasks.length) return;
  clearInterval(timerInterval);
  timerInterval = null;
  currentTaskIndex++;
  updateTaskListUI();
  runCurrentTask();
}

function completeEarly() {
  const tasks = getCurrentTasks();
  if (!tasks.length || currentTaskIndex >= tasks.length) return;
  clearInterval(timerInterval);
  timerInterval = null;
  onTaskComplete();
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
  const tasks = getCurrentTasks();
  currentTaskIndex = 0;
  tasks.forEach(t => (t.remainingTime = t.time));
  updateTaskListUI();
}

/************************
 * Import/Export
 ************************/
function onFileLoaded(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(e.target.result, 'application/xml');

    const listNameNode = xmlDoc.getElementsByTagName('ListName')[0];
    let listNameFromImport = listNameNode ? listNameNode.textContent.trim() : '';

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
    importedFileData = { tasks: importedTasks, listName: listNameFromImport };

    const importSection = document.getElementById('importSection');
    importSection.innerHTML = `
      <button class="btn-start" onclick="importData('add')">
        <i class="fas fa-plus"></i>
      </button>
      <button class="btn-red" onclick="importData('replace')">
        <i class="fas fa-exchange-alt"></i>
      </button>
    `;
  };
  reader.readAsText(file);
}

function importData(mode) {
  if (!importedFileData) return;
  const { tasks: newTasks, listName: importedListName } = importedFileData;
  const currentTasks = getCurrentTasks();

  if (mode === 'replace') {
    if (importedListName) {
      // If imported list doesn't exist, create it
      if (!lists[importedListName]) {
        lists[importedListName] = [];
        listConfigs[importedListName] = { ...DEFAULT_CONFIG };
        listOrder.push(importedListName);
      }
      // Replace that list's tasks
      lists[importedListName] = newTasks;
      if (importedListName !== currentList) {
        delete lists[currentList];
        delete listConfigs[currentList];
        const idx = listOrder.indexOf(currentList);
        if (idx >= 0) listOrder[idx] = importedListName;
      }
      currentList = importedListName;
    } else {
      // no listName => just replace current tasks
      lists[currentList] = newTasks;
    }
    currentTaskIndex = 0;
  } else {
    // add
    if (importedListName && currentTasks.length === 0) {
      if (!lists[importedListName]) {
        lists[importedListName] = newTasks;
        listConfigs[importedListName] = { ...DEFAULT_CONFIG };
        delete lists[currentList];
        delete listConfigs[currentList];
        const idx = listOrder.indexOf(currentList);
        if (idx >= 0) listOrder[idx] = importedListName;
        currentList = importedListName;
      } else {
        // combine
        lists[currentList] = currentTasks.concat(newTasks);
      }
    } else {
      lists[currentList] = currentTasks.concat(newTasks);
    }
  }

  storeInCookie();
  updateTaskListUI();
  updateOptionsUI();
  importedFileData = null;

  const importSection = document.getElementById('importSection');
  importSection.innerHTML = `
    <input
      type="file"
      id="importFile"
      accept=".xml"
      onchange="onFileLoaded(event)"
    />
  `;
  document.getElementById('importFile').value = '';
}

function exportTasksToXML() {
  const tasks = getCurrentTasks();
  let xmlString = '<?xml version="1.0" encoding="UTF-8"?>';
  xmlString += `<List><ListName>${escapeXML(currentList)}</ListName>`;
  tasks.forEach(task => {
    xmlString += '<Task><Name>' + escapeXML(task.name) + '</Name><Time>' + task.time + '</Time></Task>';
  });
  xmlString += '</List>';

  const blob = new Blob([xmlString], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tasks-${currentList}.xml`;
  link.click();
  URL.revokeObjectURL(url);
}

/************************
 * Timer progress, finish time
 ************************/
function updateProgressBar() {
  const tasks = getCurrentTasks();
  const progressBar = document.getElementById('progressBar');
  if (!tasks.length || currentTaskIndex >= tasks.length) {
    progressBar.style.width = '0%';
    return;
  }
  const currentTask = tasks[currentTaskIndex];
  const fraction = (currentTask.time - currentTask.remainingTime) / currentTask.time;
  progressBar.style.width = (fraction * 100).toFixed(2) + '%';
}

function updateTimerInfo() {
  const timerText = document.getElementById('timerText');
  const timerPercent = document.getElementById('timerPercent');
  const tasks = getCurrentTasks();
  if (!tasks.length || currentTaskIndex >= tasks.length) {
    timerText.textContent = 'No current task.';
    timerPercent.textContent = '';
    return;
  }
  const currentTask = tasks[currentTaskIndex];
  const fraction = (currentTask.time - currentTask.remainingTime) / currentTask.time;
  const percentage = (fraction * 100).toFixed(2) + '%';
  timerText.textContent =
    `Current: ${currentTask.name} — ${formatTime(currentTask.time)} total, ` +
    `${formatTime(currentTask.remainingTime)} left`;
  timerPercent.textContent = `Progress: ${percentage}`;
}

function updateEstimatedFinishTime() {
  const estFinishElem = document.getElementById('estimatedFinishTime');
  const tasks = getCurrentTasks();
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

  const finishDateStr =
    finish.getFullYear() + '-' +
    String(finish.getMonth() + 1).padStart(2, '0') + '-' +
    String(finish.getDate()).padStart(2, '0') + ' ' +
    String(finish.getHours()).padStart(2, '0') + ':' +
    String(finish.getMinutes()).padStart(2, '0');

  estFinishElem.textContent = 'Estimated Finish: ' + finishDateStr;
}

/************************
 * Utility
 ************************/
function formatTime(seconds) {
  // If under a minute, show e.g. "45 seconds"
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  // If under an hour, show e.g. "5m 30s"
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  // Otherwise show e.g. "1h 10m 20s"
  const hrs = Math.floor(seconds / 3600);
  const remainder = seconds % 3600;
  const mins = Math.floor(remainder / 60);
  const secs = remainder % 60;
  let result = `${hrs}h`;
  if (mins > 0) {
    result += ` ${mins}m`;
  }
  if (secs > 0) {
    result += ` ${secs}s`;
  }
  return result;
}

function playBeep() {
  const sound = document.getElementById('notificationSound');
  sound.currentTime = 0;
  sound.play();
}

function speakNotification(msg, config) {
  if (!config || !config.ttsEnabled) return;
  const utter = new SpeechSynthesisUtterance(msg);
  if (config.selectedVoiceName) {
    const voiceObj = availableVoices.find(v => v.name === config.selectedVoiceName);
    if (voiceObj) {
      utter.voice = voiceObj;
    }
  }
  speechSynthesis.speak(utter);
}

function storeInCookie() {
  const data = {
    lists,
    listOrder,
    currentList,
    listConfigs
  };
  const encoded = encodeURIComponent(JSON.stringify(data));
  document.cookie = 'timeTallyData=' + encoded + '; path=/; max-age=31536000';
}

function loadFromCookie() {
  const allCookies = document.cookie.split(';');
  const c = allCookies.find(cookie => cookie.trim().startsWith('timeTallyData='));
  if (!c) {
    lists = { default: [] };
    listOrder = ['default'];
    currentList = 'default';
    listConfigs = { default: { ...DEFAULT_CONFIG } };
    return;
  }
  const jsonStr = decodeURIComponent(c.trim().split('=')[1]);
  const parsed = JSON.parse(jsonStr) || {};
  lists = parsed.lists || { default: [] };
  listOrder = parsed.listOrder || Object.keys(lists);
  currentList = parsed.currentList || 'default';
  listConfigs = parsed.listConfigs || {};
  // If any list is missing a config, fill with default
  for (let ln of Object.keys(lists)) {
    if (!listConfigs[ln]) {
      listConfigs[ln] = { ...DEFAULT_CONFIG };
    }
  }
}

function escapeXML(str) {
  return str.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
    }
  });
}

/* Initialize on DOM load */
document.addEventListener('DOMContentLoaded', initApp);
