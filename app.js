// app.js: Demonstrates turning lists into draggable tabs with a single edit button
// that toggles rename/delete inside the tab.
// This file shows the relevant changes for tab-based reordering, inline edit controls,
// hiding the edit icon while editing, and building on the existing TimeTally code base.

/* Pseudocode high-level summary:
1. We store lists in 'lists' as before, plus an array 'listOrder' for tab ordering.
2. Each list is displayed as a 'tab' with draggable="true".
3. Drag-and-drop logic:
   - ondragstart, mark the dragged tab
   - ondragover, insert the dragged tab into the hovered position
   - ondragend, finalize new order in 'listOrder'
4. Each tab has an "edit" icon (fa-edit). Clicking it toggles inline rename/cancel/save/delete controls,
   and the edit icon itself is hidden during editing.
5. Deleting or renaming is done inline, then updated in 'lists' and 'listOrder'.
*/

let lists = {}; // { listName: [ tasks... ] }
let listOrder = []; // Maintains the visual/tab order
let currentList = 'default';
let currentTaskIndex = 0;
let timerInterval = null;
let importedFileData = null;
let isListCreating = false;

/* Called on page load to restore from cookie and build tabs. */
function initApp() {
    loadFromCookie();
    if (!lists['default']) {
        lists['default'] = [];
        if (!listOrder.includes('default')) {
            listOrder.push('default');
        }
    }
    if (!lists[currentList]) {
        if (listOrder.length > 0) {
            currentList = listOrder[0];
        } else {
            lists['default'] = [];
            listOrder.push('default');
            currentList = 'default';
        }
    }
    buildTabs();
    updateTaskListUI();
    setInterval(updateEstimatedFinishTime, 5000);
}

/* Rebuilds the tab UI based on listOrder. */
function buildTabs() {
    const tabsContainer = document.getElementById('tabsContainer');
    tabsContainer.innerHTML = '';

    // Create the "Add new list" button
    const addBtn = document.createElement('button');
    addBtn.className = 'tab-add-btn';
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addBtn.onclick = enterListCreateMode;
    addBtn.title = 'Create a New List';

    // Build one tab per list
    listOrder.forEach(listName => {
        const tab = document.createElement('div');
        tab.className = 'tab' + (listName === currentList ? ' active' : '');
        tab.draggable = true;
        tab.dataset.listName = listName;

        // Attach DnD handlers
        tab.addEventListener('dragstart', onTabDragStart);
        tab.addEventListener('dragover', onTabDragOver);
        tab.addEventListener('dragend', onTabDragEnd);
        tab.addEventListener('drop', onTabDrop);

        // Name label
        const tabNameEl = document.createElement('span');
        tabNameEl.className = 'tab-name';
        tabNameEl.textContent = listName;
        tab.appendChild(tabNameEl);

        // Edit icon (hidden if editing is active)
        const editIcon = document.createElement('i');
        editIcon.className = 'fas fa-edit tab-edit-icon';
        editIcon.onclick = e => toggleTabEdit(e, tab, listName);
        tab.appendChild(editIcon);

        // Inline rename/delete UI
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'tab-edit-controls';

        // Input for renaming
        const renameInput = document.createElement('input');
        renameInput.className = 'tab-edit-input';
        renameInput.value = listName;
        controlsDiv.appendChild(renameInput);

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'tab-edit-btn';
        saveBtn.innerHTML = '<i class="fas fa-save"></i>';
        saveBtn.onclick = e => saveTabEdit(e, tab, listName, renameInput);
        controlsDiv.appendChild(saveBtn);

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.className = 'tab-delete-btn';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.onclick = e => deleteTab(e, listName);
        controlsDiv.appendChild(delBtn);

        // Cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'tab-edit-btn';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
        cancelBtn.onclick = e => cancelTabEdit(e, tab);
        controlsDiv.appendChild(cancelBtn);

        tab.appendChild(controlsDiv);

        // Clicking tab outside the edit icon sets current list
        tab.addEventListener('click', event => {
            // If the click is on the editIcon or the controls, do not switch tabs
            if (event.target === editIcon || controlsDiv.contains(event.target)) return;
            setCurrentList(listName);
        });

        tabsContainer.appendChild(tab);
    });

    // Insert the "Add new list" button last
    tabsContainer.appendChild(addBtn);
}

/* DRAG-AND-DROP LOGIC FOR TABS */
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

/* Toggle the rename/delete UI */
function toggleTabEdit(e, tab, listName) {
    e.stopPropagation();
    const controls = tab.querySelector('.tab-edit-controls');
    const editIcon = tab.querySelector('.tab-edit-icon');

    // Show or hide the inline edit UI
    const isVisible = controls.style.display === 'flex';
    controls.style.display = isVisible ? 'none' : 'flex';

    // Hide the edit icon when controls are visible
    editIcon.style.display = isVisible ? '' : 'none';
}

/* Save rename */
function saveTabEdit(e, tab, oldName, renameInput) {
    e.stopPropagation();
    const newName = renameInput.value.trim();
    if (!newName) return;
    if (lists[newName] && newName !== oldName) {
        // skip if name taken
        return;
    }
    if (newName !== oldName) {
        lists[newName] = lists[oldName];
        delete lists[oldName];
        const idx = listOrder.indexOf(oldName);
        if (idx >= 0) {
            listOrder[idx] = newName;
        }
        if (currentList === oldName) {
            currentList = newName;
        }
    }
    storeInCookie();
    buildTabs();
    updateTaskListUI();
}

/* Cancel inline edit */
function cancelTabEdit(e, tab) {
    e.stopPropagation();
    const controls = tab.querySelector('.tab-edit-controls');
    controls.style.display = 'none';

    // Re-show the edit icon
    const editIcon = tab.querySelector('.tab-edit-icon');
    if (editIcon) {
        editIcon.style.display = '';
    }
}

/* Delete a list/tab */
function deleteTab(e, listName) {
    e.stopPropagation();
    if (listOrder.length <= 1) return;
    delete lists[listName];
    const idx = listOrder.indexOf(listName);
    if (idx >= 0) {
        listOrder.splice(idx, 1);
    }
    if (currentList === listName) {
        currentList = listOrder[0];
    }
    storeInCookie();
    buildTabs();
    updateTaskListUI();
}

/* Switch tabs */
function setCurrentList(listName) {
    currentList = listName;
    buildTabs();
    updateTaskListUI();
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
    }
    currentList = listName;
    isListCreating = false;
    document.getElementById('createListName').value = '';
    document.getElementById('listCreateFields').style.display = 'none';
    storeInCookie();
    buildTabs();
    updateTaskListUI();
}

/* ===== TASKS, TIMERS, IMPORT/EXPORT, ETC. ===== */

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
            saveButton.innerHTML = '<i class="fas fa-save"></i>';
            saveButton.onclick = () => {
                task.name = nameInput.value;
                const newTime = parseInt(timeInput.value, 10);
                task.time = isNaN(newTime) || newTime <= 0 ? task.time : newTime;
                task.remainingTime = task.time;
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
            taskDetails.appendChild(editFields);
        }

        li.appendChild(taskDetails);

        const taskActions = document.createElement('div');
        taskActions.className = 'task-actions';

        if (index > 0) {
            const upButton = document.createElement('button');
            upButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
            upButton.onclick = () => {
                [tasks[index], tasks[index - 1]] = [tasks[index - 1], tasks[index]];
                if (currentTaskIndex === index) currentTaskIndex--;
                else if (currentTaskIndex === index - 1) currentTaskIndex++;
                updateTaskListUI();
                storeInCookie();
            };
            taskActions.appendChild(upButton);
        }

        if (index < tasks.length - 1) {
            const downButton = document.createElement('button');
            downButton.innerHTML = '<i class="fas fa-arrow-down"></i>';
            downButton.onclick = () => {
                [tasks[index], tasks[index + 1]] = [tasks[index + 1], tasks[index]];
                if (currentTaskIndex === index) currentTaskIndex++;
                else if (currentTaskIndex === index + 1) currentTaskIndex--;
                updateTaskListUI();
                storeInCookie();
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
        removeButton.onmouseover = () => {
            removeButton.style.background = '#e53935';
        };
        removeButton.onmouseout = () => {
            removeButton.style.background = '#f44336';
        };
        removeButton.onclick = () => {
            tasks.splice(index, 1);
            if (currentTaskIndex >= tasks.length) currentTaskIndex = tasks.length - 1;
            updateTaskListUI();
            storeInCookie();
        };

        taskActions.appendChild(removeButton);
        li.appendChild(taskActions);
        taskList.appendChild(li);
    });

    updateProgressBar();
    updateEstimatedFinishTime();
    updateTimerInfo();
}

/* Timer logic: start, skip, complete, pause, restart */
function startTimer() {
    const tasks = getCurrentTasks();
    if (!tasks.length || timerInterval) return;
    runCurrentTask();
}

function runCurrentTask() {
    const tasks = getCurrentTasks();
    if (currentTaskIndex >= tasks.length) {
        currentTaskIndex = 0;
        tasks.forEach(t => t.remainingTime = t.time);
        updateTaskListUI();
        return;
    }
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
    const tasks = getCurrentTasks();
    currentTaskIndex = 0;
    tasks.forEach(t => t.remainingTime = t.time);
    updateTaskListUI();
}

/* Import/Export (export includes list name; import can rename if replacing or empty) */
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
        importedFileData = {
            tasks: importedTasks,
            listName: listNameFromImport
        };

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
    const {
        tasks: newTasks,
        listName: importedListName
    } = importedFileData;
    const currentTasks = getCurrentTasks();

    if (mode === 'replace') {
        if (importedListName && currentTasks.length >= 0) {
            if (!lists[importedListName] || importedListName === currentList) {
                lists[importedListName] = newTasks;
                if (importedListName !== currentList) {
                    delete lists[currentList];
                    const idx = listOrder.indexOf(currentList);
                    if (idx >= 0) {
                        listOrder[idx] = importedListName;
                    }
                }
                currentList = importedListName;
            } else {
                lists[currentList] = newTasks;
            }
        } else {
            lists[currentList] = newTasks;
        }
        currentTaskIndex = 0;
    } else {
        // add mode
        if (importedListName && currentTasks.length === 0) {
            if (!lists[importedListName]) {
                lists[importedListName] = newTasks;
                delete lists[currentList];
                const idx = listOrder.indexOf(currentList);
                if (idx >= 0) {
                    listOrder[idx] = importedListName;
                }
                currentList = importedListName;
            } else {
                lists[currentList] = currentTasks.concat(newTasks);
            }
        } else {
            lists[currentList] = currentTasks.concat(newTasks);
        }
    }

    storeInCookie();
    updateTaskListUI();
    importedFileData = null;

    const importSection = document.getElementById('importSection');
    importSection.innerHTML = `
    <input type="file" id="importFile" accept=".xml" onchange="onFileLoaded(event)" />
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

    const blob = new Blob([xmlString], {
        type: 'application/xml'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-${currentList}.xml`;
    link.click();
    URL.revokeObjectURL(url);
}

/* Timer progress, estimated finish, etc. */
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
    timerText.textContent = `Current: ${currentTask.name} — ${formatTime(currentTask.time)} total, ${formatTime(currentTask.remainingTime)} left`;
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

    // Format: e.g. "2025-10-05 14:07"
    const finishDateStr = finish.getFullYear() + '-' +
        String(finish.getMonth() + 1).padStart(2, '0') + '-' +
        String(finish.getDate()).padStart(2, '0') + ' ' +
        String(finish.getHours()).padStart(2, '0') + ':' +
        String(finish.getMinutes()).padStart(2, '0');

    estFinishElem.textContent = 'Estimated Finish: ' + finishDateStr;
}

/* Utility and storage */
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

function storeInCookie() {
    const data = {
        lists: lists,
        listOrder: listOrder,
        currentList: currentList
    };
    const encoded = encodeURIComponent(JSON.stringify(data));
    document.cookie = 'timeTallyData=' + encoded + '; path=/; max-age=31536000';
}

function loadFromCookie() {
    const allCookies = document.cookie.split(';');
    const c = allCookies.find(cookie => cookie.trim().startsWith('timeTallyData='));
    if (!c) {
        lists = {
            'default': []
        };
        listOrder = ['default'];
        currentList = 'default';
        return;
    }
    const jsonStr = decodeURIComponent(c.trim().split('=')[1]);
    const data = JSON.parse(jsonStr) || {};
    lists = data.lists || {
        'default': []
    };
    listOrder = data.listOrder || Object.keys(lists);
    currentList = data.currentList || 'default';
}

function escapeXML(str) {
    return str.replace(/[<>&'"]/g, c => {
        switch (c) {
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '&':
                return '&amp;';
            case '\'':
                return '&apos;';
            case '"':
                return '&quot;';
        }
    });
}

/* Initialize everything on DOMContentLoaded */
document.addEventListener('DOMContentLoaded', initApp);