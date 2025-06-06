import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDB161UeDkuzvC_3mW_UTKVItNeVULYdXY",
    authDomain: "turnos-58bf0.firebaseapp.com",
    projectId: "turnos-58bf0",
    storageBucket: "turnos-58bf0.firebasestorage.app",
    messagingSenderId: "404495359283",
    appId: "1:404495359283:web:7a1ac027761d93f9ec7246",
    measurementId: "G-11VQ87L31F"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function initGenerador() {
    console.log('Inicializando generador...');

    // Verificar si los elementos principales existen en el DOM
    const contentContainer = document.querySelector('.content-container');
    if (!contentContainer) {
        console.error('No se encontró el contenedor .content-container en el DOM.');
        return;
    }

    const turnForm = document.getElementById('turnForm');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const clearForm = document.getElementById('clearForm');
    const printTable = document.getElementById('printTable');
    const exportExcel = document.getElementById('exportExcel');
    const tableHead = document.querySelector('#turnTable thead');
    const tableBody = document.querySelector('#turnTable tbody');
    const modal = document.getElementById('modal');
    const editModal = document.getElementById('editModal');
    const collaboratorSelect = document.getElementById('collaboratorSelect');
    const areaSelect = document.getElementById('areaSelect');
    const turnSelect = document.getElementById('turnSelect');
    const startDateSelect = document.getElementById('startDateSelect');
    const patternStartSelect = document.getElementById('patternStartSelect');
    const editScheduleSelect = document.getElementById('editScheduleSelect');
    const calendar = document.getElementById('calendar');
    const confirmSelection = document.getElementById('confirmSelection');
    const cancelSelection = document.getElementById('cancelSelection');
    const confirmEdit = document.getElementById('confirmEdit');
    const cancelEdit = document.getElementById('cancelEdit');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Verificar que los elementos clave existan
    if (!editModal) {
        console.error('No se encontró el elemento #editModal en el DOM.');
        return;
    }
    const editModalTitle = document.getElementById('editModalTitle');
    if (!editModalTitle) {
        console.error('No se encontró el elemento #editModalTitle en el DOM.');
        return;
    }

    let collaborators = [];
    let turnPatterns = [];
    let schedules = [];
    let assignedCollaborators = new Map();
    let currentRow = null;
    let editingRowId = null;
    let editedAssignments = [];

    function showSpinner() {
        if (loadingSpinner) loadingSpinner.style.display = 'block';
    }

    function hideSpinner() {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }

    if (modal) modal.style.display = 'none';
    if (editModal) editModal.style.display = 'none';
    hideSpinner();

    async function loadCollaborators() {
        try {
            const querySnapshot = await getDocs(collection(db, 'collaborators'));
            collaborators = [];
            querySnapshot.forEach(doc => {
                collaborators.push({ id: doc.id, name: doc.data().name });
            });
            console.log('Colaboradores cargados:', collaborators);
        } catch (error) {
            console.error('Error loading collaborators:', error);
            alert('Error al cargar colaboradores: ' + error.message);
        }
    }

    async function loadTurnPatterns() {
        try {
            const querySnapshot = await getDocs(collection(db, 'turnPatterns'));
            turnPatterns = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                turnPatterns.push({
                    id: doc.id,
                    area: data.area,
                    turnNumber: data.turnNumber,
                    pattern: data.pattern,
                    observation: data.observation || ''
                });
            });
            console.log('Patrones de turnos cargados:', turnPatterns);
        } catch (error) {
            console.error('Error loading turn patterns:', error);
            alert('Error al cargar patrones de turnos: ' + error.message);
        }
    }

    async function loadSchedules() {
        try {
            const querySnapshot = await getDocs(collection(db, 'schedules'));
            schedules = [];
            querySnapshot.forEach(doc => {
                schedules.push({
                    id: doc.id,
                    reference: doc.data().reference,
                    description: doc.data().description
                });
            });
            console.log('Horarios cargados:', schedules);
        } catch (error) {
            console.error('Error loading schedules:', error);
            alert('Error al cargar horarios: ' + error.message);
        }
    }

    async function getLastModifiedMonthAssignments(currentYear, currentMonth) {
        let assignments = new Map();
        const currentDateValue = currentYear * 12 + currentMonth;

        for (let year = currentYear; year >= 2025; year--) {
            const startMonth = (year === currentYear) ? currentMonth - 1 : 12;
            for (let month = startMonth; month >= 1; month--) {
                const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
                const dateValue = year * 12 + month;
                if (dateValue >= currentDateValue) continue;

                try {
                    const querySnapshot = await getDocs(collection(db, `turns/${monthYear}/days`));
                    if (!querySnapshot.empty) {
                        querySnapshot.forEach(doc => {
                            assignments.set(doc.id, doc.data());
                        });
                        return { assignments, lastMonth: month, lastYear: year };
                    }
                } catch (error) {
                    console.error(`Error checking assignments for ${monthYear}:`, error);
                }
            }
        }
        return { assignments, lastMonth: null, lastYear: null };
    }

    async function loadAssignments(month, year, generateNew = false) {
        try {
            const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
            const daysInMonth = getDaysInMonth(month, year);
            assignedCollaborators.clear();

            const querySnapshot = await getDocs(collection(db, `turns/${monthYear}/days`));
            if (!querySnapshot.empty && !generateNew) {
                querySnapshot.forEach(doc => {
                    assignedCollaborators.set(doc.id, doc.data());
                });
            } else if (generateNew) {
                const { assignments, lastMonth, lastYear } = await getLastModifiedMonthAssignments(year, month);
                if (assignments.size > 0 && lastMonth && lastYear) {
                    for (const [rowId, data] of assignments) {
                        const startDateObj = new Date(data.startDate);
                        const futureStartDate = `${year}-${month.toString().padStart(2, '0')}-01`;
                        const futureDateObj = new Date(futureStartDate);
                        const daysSinceStart = Math.floor(
                            (futureDateObj - startDateObj) / (1000 * 60 * 60 * 24)
                        );

                        const patternArray = data.pattern.split('-');
                        let patternStartIndex = (data.patternStartIndex + daysSinceStart) % patternArray.length;
                        if (patternStartIndex < 0) {
                            patternStartIndex += patternArray.length;
                        }

                        const dailyAssignments = calculateDailyAssignments(
                            data.startDate,
                            data.pattern,
                            patternStartIndex,
                            daysInMonth,
                            year,
                            month
                        );

                        const newData = {
                            collaborator: data.collaborator,
                            area: data.area,
                            turnId: data.turnId,
                            turnNumber: data.turnNumber,
                            pattern: data.pattern,
                            observation: data.observation,
                            startDate: data.startDate,
                            patternStartIndex: patternStartIndex,
                            dailyAssignments: dailyAssignments,
                            timestamp: new Date().toISOString()
                        };

                        assignedCollaborators.set(rowId, newData);
                        await setDoc(doc(db, `turns/${monthYear}/days`, rowId), newData);
                    }
                }
            }

            renderTableWithAssignments(month, year);
        } catch (error) {
            console.error('Error loading assignments:', error);
            renderTableWithAssignments(month, year);
        }
    }

    function getDaysInMonth(month, year) {
        return new Date(year, month, 0).getDate();
    }

    function calculateDailyAssignments(startDate, pattern, patternStartIndex, daysInMonth, year, month) {
        const assignments = [];
        const patternArray = pattern.split('-');
        const start = new Date(startDate);
        const currentDate = new Date(year, month - 1, 1);
        let patternIndex = parseInt(patternStartIndex);

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month - 1, day);
            if (currentDayDate < start) {
                assignments.push('');
            } else {
                assignments.push(patternArray[patternIndex % patternArray.length]);
                patternIndex++;
            }
        }
        return assignments;
    }

    function renderTableHeaders(daysInMonth, month, year) {
        tableHead.innerHTML = '';
        const numberRow = document.createElement('tr');
        const nameRow = document.createElement('tr');
        nameRow.id = 'dayNames';

        const thCollaborator = document.createElement('th');
        thCollaborator.textContent = 'Colaborador';
        numberRow.appendChild(thCollaborator);

        const thEmpty = document.createElement('th');
        nameRow.appendChild(thEmpty);

        const dayInitials = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

        for (let day = 1; day <= daysInMonth; day++) {
            const thDay = document.createElement('th');
            thDay.textContent = day;
            const date = new Date(year, month - 1, day);
            const dayIndex = date.getDay();
            if (dayIndex === 0) thDay.classList.add('sunday');
            else if (dayIndex === 6) thDay.classList.add('saturday');
            numberRow.appendChild(thDay);

            const thName = document.createElement('th');
            thName.textContent = dayInitials[dayIndex];
            if (dayIndex === 0) thName.classList.add('sunday');
            else if (dayIndex === 6) thName.classList.add('saturday');
            nameRow.appendChild(thName);
        }

        tableHead.appendChild(numberRow);
        tableHead.appendChild(nameRow);
    }

    function renderAreaRows(areaName, rowCount, currentMonth, currentYear) {
        const areaRow = document.createElement('tr');
        const areaCell = document.createElement('td');
        areaCell.colSpan = getDaysInMonth(currentMonth, currentYear) + 1;
        areaCell.textContent = areaName;
        areaCell.classList.add('area-title');
        areaRow.appendChild(areaCell);
        tableBody.appendChild(areaRow);

        for (let i = 0; i < rowCount; i++) {
            const rowId = `${areaName.replace(/[\s/]+/g, '-')}-row-${i}`;
            const row = document.createElement('tr');
            row.dataset.area = areaName;
            row.dataset.rowId = rowId;

            const collaboratorCell = document.createElement('td');
            collaboratorCell.innerHTML = `<i class="fas fa-plus add-icon" data-row="${i}"></i>`;
            row.appendChild(collaboratorCell);

            for (let day = 1; day <= getDaysInMonth(currentMonth, currentYear); day++) {
                const td = document.createElement('td');
                const date = new Date(currentYear, currentMonth - 1, day);
                const dayIndex = date.getDay();
                if (dayIndex === 0) td.classList.add('sunday');
                else if (dayIndex === 6) td.classList.add('saturday');
                row.appendChild(td);
            }
            tableBody.appendChild(row);
        }
    }

    function renderTableWithAssignments(month, year) {
        tableBody.innerHTML = '';
        const daysInMonth = getDaysInMonth(month, year);

        const areas = [
            { name: 'Mater / Upc', rows: 10 },
            { name: 'Urgencias', rows: 4 },
            { name: 'MQ / CEM 1 / CEM 2 / ADM', rows: 5 },
            { name: 'Espacio Comunes', rows: 2 },
            { name: 'Traslado', rows: 5 }
        ];

        renderTableHeaders(daysInMonth, month, year);
        areas.forEach(area => renderAreaRows(area.name, area.rows, month, year));

        assignedCollaborators.forEach((data, rowId) => {
            const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
            if (!row) {
                console.warn(`Row not found for rowId: ${rowId}`, data);
                return;
            }
            const firstCell = row.querySelector('td:first-child');
            if (firstCell) {
                firstCell.innerHTML = `
                    ${data.collaborator.name}
                    <i class="fas fa-edit edit-icon" data-row-id="${rowId}" data-month="${month}" data-year="${year}"></i>
                    <i class="fas fa-trash delete-icon" data-row-id="${rowId}" data-month="${month}" data-year="${year}"></i>
                `;
                const addIcon = row.querySelector('.add-icon');
                if (addIcon) {
                    addIcon.style.display = 'none';
                }
                if (data.dailyAssignments) {
                    const cells = row.querySelectorAll('td:not(:first-child)');
                    data.dailyAssignments.forEach((assignment, index) => {
                        if (cells[index]) {
                            cells[index].textContent = assignment || '';
                        }
                    });
                }
            } else {
                console.warn(`No td:first-child found for rowId: ${rowId}`);
            }
        });

        // Vincular eventos a los íconos de "add"
        document.querySelectorAll('.add-icon').forEach(icon => {
            icon.addEventListener('click', async () => {
                currentRow = icon.closest('tr');
                if (!currentRow) {
                    console.error('Could not find active row');
                    alert('Error: No se pudo identificar la fila seleccionada.');
                    return;
                }
                const availableCollaborators = collaborators.filter(c => 
                    !Array.from(assignedCollaborators.values()).some(ac => ac.collaborator.id === c.id)
                );
                collaboratorSelect.innerHTML = '<option value="" disabled selected>Seleccionar colaborador</option>';
                availableCollaborators.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.textContent = c.name;
                    collaboratorSelect.appendChild(option);
                });

                const uniqueAreas = [...new Set(turnPatterns.map(t => t.area))];
                areaSelect.innerHTML = '<option value="" disabled selected>Seleccionar área</option>';
                uniqueAreas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = area;
                    areaSelect.appendChild(option);
                });

                turnSelect.innerHTML = '<option value="" disabled selected>Seleccionar turno</option>';

                areaSelect.addEventListener('change', () => {
                    const selectedArea = areaSelect.value;
                    const areaTurns = turnPatterns.filter(t => t.area === selectedArea);
                    turnSelect.innerHTML = '<option value="" disabled selected>Seleccionar turno</option>';
                    areaTurns.forEach(turno => {
                        const option = document.createElement('option');
                        option.value = turno.id;
                        option.textContent = `Turno ${turno.turnNumber}: ${turno.pattern} (${turno.observation || '-'})`;
                        turnSelect.appendChild(option);
                    });
                }, { once: true });

                turnSelect.addEventListener('change', () => {
                    const selectedTurnId = turnSelect.value;
                    const selectedTurn = turnPatterns.find(t => t.id === selectedTurnId);
                    if (selectedTurn) {
                        const patternArray = selectedTurn.pattern.split('-');
                        patternStartSelect.innerHTML = '<option value="" disabled selected>Seleccionar inicio del patrón</option>';
                        patternArray.forEach((value, index) => {
                            const option = document.createElement('option');
                            option.value = index;
                            option.textContent = `${index + 1}ª ${value === 'D' ? 'Día' : value === 'L' ? 'Libre' : 'Noche'}`;
                            patternStartSelect.appendChild(option);
                        });
                    }
                }, { once: true });

                startDateSelect.min = `${yearSelect.value}-${monthSelect.value.padStart(2, '0')}-01`;
                startDateSelect.max = `${yearSelect.value}-${monthSelect.value.padStart(2, '0')}-${getDaysInMonth(parseInt(monthSelect.value), parseInt(yearSelect.value)).toString().padStart(2, '0')}`;

                modal.style.display = 'flex';
            });
        });

        // Vincular eventos a los íconos de "edit"
        document.querySelectorAll('.edit-icon').forEach(icon => {
            icon.addEventListener('click', async () => {
                console.log('Clic en edit-icon, verificando DOM...');
                const editModal = document.getElementById('editModal');
                const editModalTitle = document.getElementById('editModalTitle');
                console.log('Elemento editModal:', editModal);
                console.log('Elemento editModalTitle:', editModalTitle);

                if (!editModal || !editModalTitle) {
                    console.error('El elemento con ID "editModal" o "editModalTitle" no se encontró en el DOM.');
                    alert('Error: No se encontró el modal de edición o su título.');
                    return;
                }

                editingRowId = icon.dataset.rowId;
                const month = parseInt(icon.dataset.month);
                const year = parseInt(icon.dataset.year);
                const data = assignedCollaborators.get(editingRowId);
                if (!data) {
                    console.error('No data found for rowId:', editingRowId);
                    alert('Error: No se encontraron datos para este colaborador.');
                    return;
                }

                showSpinner();
                try {
                    await loadSchedules();
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    editModalTitle.textContent = `Editar Turnos: ${data.collaborator.name} - ${monthNames[month - 1]} ${year}`;
                    editedAssignments = [...(data.dailyAssignments || Array(getDaysInMonth(month, year)).fill(''))];

                    calendar.innerHTML = '';
                    const daysInMonth = getDaysInMonth(month, year);
                    const firstDay = new Date(year, month - 1, 1).getDay();
                    const calendarGrid = document.createElement('div');
                    calendarGrid.classList.add('calendar-grid');

                    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                    dayNames.forEach(day => {
                        const dayHeader = document.createElement('div');
                        dayHeader.classList.add('calendar-day-header');
                        dayHeader.textContent = day;
                        calendarGrid.appendChild(dayHeader);
                    });

                    for (let i = 0; i < firstDay; i++) {
                        const emptyCell = document.createElement('div');
                        emptyCell.classList.add('calendar-day', 'empty');
                        calendarGrid.appendChild(emptyCell);
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                        const dayCell = document.createElement('div');
                        dayCell.classList.add('calendar-day');
                        const date = new Date(year, month - 1, day);
                        if (date.getDay() === 0) dayCell.classList.add('sunday');
                        else if (date.getDay() === 6) dayCell.classList.add('saturday');

                        dayCell.innerHTML = `
                            <span>${day}</span>
                            <select class="assignment-select" data-day="${day - 1}">
                                <option value="D" ${editedAssignments[day - 1] === 'D' ? 'selected' : ''}>Día</option>
                                <option value="N" ${editedAssignments[day - 1] === 'N' ? 'selected' : ''}>Noche</option>
                                <option value="L" ${editedAssignments[day - 1] === 'L' ? 'selected' : ''}>Libre</option>
                                <option value="" ${!editedAssignments[day - 1] ? 'selected' : ''}>Ninguno</option>
                                ${schedules.map(s => `<option value="${s.reference}" ${editedAssignments[day - 1] === s.reference ? 'selected' : ''}>${s.reference}</option>`).join('')}
                            </select>
                        `;
                        calendarGrid.appendChild(dayCell);
                    }

                    calendar.appendChild(calendarGrid);
                    editModal.style.display = 'flex';
                } catch (error) {
                    console.error('Error loading edit modal:', error);
                    alert('Error al cargar el modal de edición: ' + error.message);
                } finally {
                    hideSpinner();
                }
            });
        });
    }

    if (tableBody) {
        tableBody.addEventListener('click', async (event) => {
            if (event.target.classList.contains('delete-icon')) {
                showSpinner();
                try {
                    const icon = event.target;
                    const rowId = icon.dataset.rowId;
                    const currentMonth = parseInt(icon.dataset.month);
                    const currentYear = parseInt(icon.dataset.year);
                    const row = document.querySelector(`tr[data-row-id="${rowId}"]`);
                    if (!row) {
                        console.error(`Row not found for rowId: ${rowId}`);
                        return;
                    }

                    if (confirm('¿Estás seguro de que deseas eliminar este colaborador y sus turnos?')) {
                        const monthYear = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
                        await deleteDoc(doc(db, `turns/${monthYear}/days`, rowId));
                        assignedCollaborators.delete(rowId);

                        const firstCell = row.querySelector('td:first-child');
                        if (firstCell) {
                            firstCell.innerHTML = `<i class="fas fa-plus add-icon" data-row="${rowId.split('-').pop()}"></i>`;
                        }
                        const cells = row.querySelectorAll('td:not(:first-child)');
                        cells.forEach(cell => {
                            cell.textContent = '';
                        });

                        renderTableWithAssignments(currentMonth, currentYear);
                    }
                } catch (error) {
                    console.error('Error deleting collaborator:', error);
                    alert('Error al eliminar colaborador: ' + error.message);
                } finally {
                    hideSpinner();
                }
            }
        });
    }

    if (confirmEdit) {
        confirmEdit.addEventListener('click', async () => {
            showSpinner();
            try {
                console.log('Iniciando guardado de cambios...');
                const assignmentSelects = calendar.querySelectorAll('.assignment-select');
                const newAssignments = Array.from(assignmentSelects).map(select => select.value);

                console.log('Nuevos turnos/horarios:', newAssignments);

                const data = assignedCollaborators.get(editingRowId);
                if (!data) {
                    console.error('No data found for rowId:', editingRowId);
                    alert('Error: No se encontraron datos para este colaborador.');
                    return;
                }

                const updatedData = {
                    ...data,
                    dailyAssignments: newAssignments,
                    timestamp: new Date().toISOString()
                };

                console.log('Datos actualizados:', updatedData);

                const monthYear = `${yearSelect.value}-${monthSelect.value.padStart(2, '0')}`;
                console.log('Guardando en Firestore en:', `turns/${monthYear}/days/${editingRowId}`);
                await setDoc(doc(db, `turns/${monthYear}/days`, editingRowId), updatedData);
                assignedCollaborators.set(editingRowId, updatedData);

                console.log('Cambios guardados exitosamente.');

                editModal.style.display = 'none';
                editingRowId = null;
                renderTableWithAssignments(parseInt(monthSelect.value), parseInt(yearSelect.value));
            } catch (error) {
                console.error('Error saving edited assignments:', error);
                alert('Error al guardar los cambios: ' + error.message);
            } finally {
                hideSpinner();
            }
        });
    }

    if (cancelEdit) {
        cancelEdit.addEventListener('click', () => {
            editModal.style.display = 'none';
            editingRowId = null;
            calendar.innerHTML = '';
            if (editScheduleSelect) editScheduleSelect.value = '';
        });
    }

    if (printTable) {
        printTable.addEventListener('click', () => {
            if (!monthSelect.value || !yearSelect.value) {
                alert('Por favor, selecciona un mes y año antes de generar el PDF.');
                return;
            }
            if (tableBody.innerHTML.trim() === '') {
                alert('No hay turnos generados para el PDF.');
                return;
            }

            const month = parseInt(monthSelect.value);
            const year = parseInt(yearSelect.value);
            const daysInMonth = getDaysInMonth(month, year);
            const monthNames = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            doc.setFontSize(14);
            doc.text(`Turnos - ${monthNames[month - 1]} ${year}`, 148.5, 10, { align: 'center' });

            const headers = [['Colaborador']];
            const dayNames = [['']];
            const dayInitials = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
            const totalRows = 26;
            const columnStyles = {
                0: { cellWidth: 30 }
            };
            const body = [];

            for (let day = 1; day <= daysInMonth; day++) {
                headers[0].push(day.toString());
                const date = new Date(year, month - 1, day);
                const dayNamesIndex = date.getDay();
                dayNames[0].push(dayInitials[dayNamesIndex]);
                columnStyles[day] = { cellWidth: (267 - 30) / daysInMonth };
            }

            const areas = [
                { name: 'Mater / Upc', rows: 10 },
                { name: 'Urgencias', rows: 4 },
                { name: 'MQ / CEM 1 / CEM 2 / ADM', rows: 5 },
                { name: 'Espacio Comunes', rows: 2 },
                { name: 'Traslado', rows: 5 }
            ];

            areas.forEach(area => {
                body.push([{ content: area.name, colSpan: daysInMonth + 1, styles: { fillColor: [237, 242, 247], fontSize: 8, halign: 'left' } }]);
                for (let i = 0; i < area.rows; i++) {
                    const rowId = `${area.name.replace(/[\s/]+/g, '-')}-row-${i}`;
                    const data = assignedCollaborators.get(rowId);
                    const row = [data ? data.collaborator.name : ''];
                    if (data && data.dailyAssignments) {
                        row.push(...data.dailyAssignments);
                    } else {
                        for (let day = 1; day <= daysInMonth; day++) {
                            row.push('');
                        }
                    }
                    body.push(row);
                }
            });

            const rowHeight = 5;
            const totalHeight = (totalRows + 2) * rowHeight;
            const pageHeight = 190;
            const scaleFactor = totalHeight > pageHeight ? pageHeight / totalHeight : 1;

            doc.autoTable({
                head: [headers[0], dayNames[0]],
                body: body,
                startY: 15,
                theme: 'grid',
                headStyles: { fillColor: [247, 249, 252], textColor: [45, 55, 72], fontSize: 6, halign: 'center' },
                bodyStyles: { textColor: [0, 0, 0], fontSize: 5, halign: 'center', cellPadding: 0.5 },
                columnStyles: columnStyles,
                tableWidth: 267,
                margin: { left: 15, right: 15 },
                showHead: 'firstPage',
                didParseCell: (data) => {
                    if (data.section === 'head' && data.column.index > 0) {
                        const day = data.column.index;
                        const date = new Date(year, month - 1, day);
                        const dayIndex = date.getDay();
                        if (dayIndex === 0) {
                            data.cell.styles.fillColor = [255, 230, 230];
                        } else if (dayIndex === 6) {
                            data.cell.styles.fillColor = [230, 240, 255];
                        }
                    } else if (data.section === 'body' && data.column.index > 0) {
                        const day = data.column.index;
                        const date = new Date(year, month - 1, day);
                        const dayIndex = date.getDay();
                        if (dayIndex === 0) {
                            data.cell.styles.fillColor = [255, 230, 230];
                        } else if (dayIndex === 6) {
                            data.cell.styles.fillColor = [230, 240, 255];
                        }
                    }
                },
                didDrawPage: (data) => {
                    if (scaleFactor < 1) {
                        data.doc.scale(scaleFactor, scaleFactor, { origin: [0, 0] });
                    }
                }
            });

            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
        });
    }

    if (exportExcel) {
        exportExcel.addEventListener('click', () => {
            if (!monthSelect.value || !yearSelect.value) {
                alert('Por favor, selecciona un mes y año antes de exportar.');
                return;
            }
            if (tableBody.innerHTML.trim() === '') {
                alert('No hay turnos generados para exportar.');
                return;
            }

            if (typeof XLSX === 'undefined') {
                console.error('SheetJS (XLSX) library not loaded.');
                alert('Error: No se pudo cargar la librería de Excel. Por favor, intenta de nuevo.');
                return;
            }

            try {
                const month = parseInt(monthSelect.value);
                const year = parseInt(yearSelect.value);
                const daysInMonth = getDaysInMonth(month, year);
                const dayInitials = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
                const monthNames = [
                    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                ];

                const wsData = [];
                wsData.push([`Turnos - ${monthNames[month - 1]} ${year}`]);
                wsData.push([]);
                const numberRow = ['Colaborador'];
                const nameRow = [''];
                for (let day = 1; day <= daysInMonth; day++) {
                    numberRow.push(day);
                    const date = new Date(year, month - 1, day);
                    nameRow.push(dayInitials[date.getDay()]);
                }
                wsData.push(numberRow);
                wsData.push(nameRow);

                const areas = [
                    { name: 'Mater / Upc', rows: 10 },
                    { name: 'Urgencias', rows: 4 },
                    { name: 'MQ / CEM 1 / CEM 2 / ADM', rows: 5 },
                    { name: 'Espacio Comunes', rows: 2 },
                    { name: 'Traslado', rows: 5 }
                ];

                areas.forEach(area => {
                    wsData.push([area.name]);
                    for (let i = 0; i < area.rows; i++) {
                        const rowId = `${area.name.replace(/[\s/]+/g, '-')}-row-${i}`;
                        const data = assignedCollaborators.get(rowId);
                        const row = [data ? data.collaborator.name : ''];
                        if (data && data.dailyAssignments) {
                            row.push(...data.dailyAssignments.map(val => val || ''));
                        } else {
                            for (let day = 1; day <= daysInMonth; day++) {
                                row.push('');
                            }
                        }
                        wsData.push(row);
                    }
                    wsData.push([]);
                });

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const colWidths = [
                    { wch: 20 },
                    ...Array(daysInMonth).fill({ wch: 5 })
                ];
                ws['!cols'] = colWidths;

                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, `${monthNames[month - 1]} ${year}`);

                const fileName = `Turnos_${year}-${month.toString().padStart(2, '0')}.xlsx`;
                XLSX.write(wb, fileName, { bookType: 'xlsx', type: 'binary' });
            } catch (error) {
                console.error('Error exporting to Excel:', error);
                alert('Error al generar el archivo Excel: ' + error.message);
            }
        });
    }

    async function loadTurns(month, year, generateNew = false) {
        showSpinner();
        try {
            await loadCollaborators();
            await loadTurnPatterns();
            if (collaborators.length === 0) {
                alert('Debe haber al menos un colaborador registrado.');
                tableBody.innerHTML = '';
                tableHead.innerHTML = '';
                return;
            }
            if (turnPatterns.length === 0) {
                alert('Debe haber al menos un turno definido en la colección turnPatterns.');
                tableBody.innerHTML = '';
                tableHead.innerHTML = '';
                return;
            }
            await loadAssignments(month, year, generateNew);
        } finally {
            hideSpinner();
        }
    }

    if (turnForm) {
        turnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedMonth = parseInt(monthSelect.value);
            const selectedYear = parseInt(yearSelect.value);

            if (collaborators.length === 0) {
                alert('No hay colaboradores registrados.');
                return;
            }

            if (turnPatterns.length === 0) {
                alert('No hay turnos definidos en la colección turnPatterns.');
                return;
            }

            tableBody.innerHTML = '';
            await loadTurns(selectedMonth, selectedYear, true);
        });
    }

    if (clearForm) {
        clearForm.addEventListener('click', () => {
            turnForm.reset();
            tableBody.innerHTML = '';
            tableHead.innerHTML = '';
            assignedCollaborators.clear();
        });
    }

    if (monthSelect && yearSelect) {
        yearSelect.innerHTML = `
            <option value="2025">2025</option>
            <option value="2026">2026</option>
            <option value="2027">2027</option>
        `;

        monthSelect.addEventListener('change', async () => {
            if (monthSelect.value && yearSelect.value) {
                showSpinner();
                try {
                    const month = parseInt(monthSelect.value);
                    const year = parseInt(yearSelect.value);
                    await loadCollaborators();
                    await loadTurnPatterns();
                    await loadTurns(month, year);
                } finally {
                    hideSpinner();
                }
            }
        });

        yearSelect.addEventListener('change', async () => {
            if (monthSelect.value && yearSelect.value) {
                showSpinner();
                try {
                    const month = parseInt(monthSelect.value);
                    const year = parseInt(yearSelect.value);
                    await loadCollaborators();
                    await loadTurnPatterns();
                    await loadTurns(month, year);
                } finally {
                    hideSpinner();
                }
            }
        });
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    if (monthSelect && yearSelect) {
        monthSelect.value = currentMonth;
        yearSelect.value = '2025';
        (async () => {
            showSpinner();
            try {
                await loadCollaborators();
                await loadTurnPatterns();
                if (collaborators.length === 0) {
                    alert('Debe haber al menos un colaborador registrado.');
                    return;
                }
                if (turnPatterns.length === 0) {
                    alert('No hay turnos disponibles en la colección turnPatterns.');
                    return;
                }
                await loadAssignments(currentMonth, 2025);
            } finally {
                hideSpinner();
            }
        })();
    }

    if (confirmSelection) {
        confirmSelection.addEventListener('click', async () => {
            if (!currentRow || !(currentRow instanceof HTMLElement)) {
                console.error('currentRow es nulo o no es un elemento DOM válido:', currentRow);
                alert('Error: No se ha seleccionado ninguna fila válida.');
                modal.style.display = 'none';
                return;
            }

            const selectedId = collaboratorSelect.value;
            const selectedArea = areaSelect.value;
            const selectedTurnId = turnSelect.value;
            const startDate = startDateSelect.value;
            const patternStartIndex = patternStartSelect.value;
            const rowId = currentRow.dataset.rowId;

            if (selectedId && selectedArea && selectedTurnId && startDate && patternStartIndex) {
                const selectedCollaborator = collaborators.find(c => c.id === selectedId);
                const selectedTurn = turnPatterns.find(t => t.id === selectedTurnId);

                if (!selectedCollaborator || !selectedTurn) {
                    console.error('Colaborador o turno no encontrado:', { selectedId, selectedTurnId });
                    alert('Error: Colaborador o turno no válido.');
                    modal.style.display = 'none';
                    return;
                }

                const dailyAssignments = calculateDailyAssignments(
                    startDate,
                    selectedTurn.pattern,
                    parseInt(patternStartIndex),
                    getDaysInMonth(parseInt(monthSelect.value), parseInt(yearSelect.value)),
                    parseInt(yearSelect.value),
                    parseInt(monthSelect.value)
                );

                const data = {
                    collaborator: selectedCollaborator,
                    area: selectedArea,
                    turnId: selectedTurn.id,
                    turnNumber: selectedTurn.turnNumber,
                    pattern: selectedTurn.pattern,
                    observation: selectedTurn.observation,
                    startDate: startDate,
                    patternStartIndex: parseInt(patternStartIndex),
                    dailyAssignments: dailyAssignments,
                    timestamp: new Date().toISOString()
                };
                assignedCollaborators.set(rowId, data);

                const monthYear = `${yearSelect.value}-${monthSelect.value.padStart(2, '0')}`;
                showSpinner();
                try {
                    await setDoc(doc(db, `turns/${monthYear}/days`, rowId), {
                        collaborator: {
                            id: selectedCollaborator.id,
                            name: selectedCollaborator.name
                        },
                        area: selectedArea,
                        turnId: selectedTurnId,
                        turnNumber: selectedTurn.turnNumber,
                        pattern: selectedTurn.pattern,
                        observation: selectedTurn.observation || null,
                        startDate: startDate,
                        patternStartIndex: parseInt(patternStartIndex),
                        dailyAssignments: dailyAssignments,
                        timestamp: new Date().toISOString()
                    });

                    modal.style.display = 'none';
                    collaboratorSelect.innerHTML = '<option value="" disabled selected>Seleccionar colaborador</option>';
                    areaSelect.innerHTML = '<option value="" disabled selected>Seleccionar área</option>';
                    turnSelect.innerHTML = '<option value="" disabled selected>Seleccionar turno</option>';
                    startDateSelect.value = '';
                    patternStartSelect.innerHTML = '<option value="" disabled selected>Seleccionar inicio del patrón</option>';
                    currentRow = null;

                    await renderTableWithAssignments(parseInt(monthSelect.value), parseInt(yearSelect.value));
                } catch (error) {
                    console.error('Error al guardar turnos:', error);
                    alert('Error al asignar turno: ' + error.message);
                } finally {
                    hideSpinner();
                }
            } else {
                alert('Por favor, selecciona un colaborador, un área, un turno, una fecha de inicio y un punto de inicio del patrón.');
            }
        });
    }

    if (cancelSelection) {
        cancelSelection.addEventListener('click', () => {
            modal.style.display = 'none';
            collaboratorSelect.innerHTML = '<option value="" disabled selected>Seleccionar colaborador</option>';
            areaSelect.innerHTML = '<option value="" disabled selected>Seleccionar área</option>';
            turnSelect.innerHTML = '<option value="" disabled selected>Seleccionar turno</option>';
            startDateSelect.value = '';
            patternStartSelect.innerHTML = '<option value="" disabled selected>Confirmar selección</option>';
            currentRow = null;
        });
    }

    // Limpiar eventos al salir del módulo
    window.addEventListener('moduleCleanup', () => {
        console.log('Limpiando eventos del módulo generador...');
        if (turnForm) {
            turnForm.removeEventListener('submit', null);
            const newTurnForm = turnForm.cloneNode(true);
            turnForm.replaceWith(newTurnForm);
        }
        if (monthSelect) {
            monthSelect.removeEventListener('change', null);
            const newMonthSelect = monthSelect.cloneNode(true);
            monthSelect.replaceWith(newMonthSelect);
        }
        if (yearSelect) {
            yearSelect.removeEventListener('change', null);
            const newYearSelect = yearSelect.cloneNode(true);
            yearSelect.replaceWith(newYearSelect);
        }
        if (clearForm) {
            clearForm.removeEventListener('click', null);
            const newClearForm = clearForm.cloneNode(true);
            clearForm.replaceWith(newClearForm);
        }
        if (printTable) {
            printTable.removeEventListener('click', null);
            const newPrintTable = printTable.cloneNode(true);
            printTable.replaceWith(newPrintTable);
        }
        if (exportExcel) {
            exportExcel.removeEventListener('click', null);
            const newExportExcel = exportExcel.cloneNode(true);
            exportExcel.replaceWith(newExportExcel);
        }
        if (tableBody) {
            tableBody.removeEventListener('click', null);
            const newTableBody = tableBody.cloneNode(true);
            tableBody.replaceWith(newTableBody);
        }
        if (confirmEdit) {
            confirmEdit.removeEventListener('click', null);
            const newConfirmEdit = confirmEdit.cloneNode(true);
            confirmEdit.replaceWith(newConfirmEdit);
        }
        if (cancelEdit) {
            cancelEdit.removeEventListener('click', null);
            const newCancelEdit = cancelEdit.cloneNode(true);
            cancelEdit.replaceWith(newCancelEdit);
        }
        if (confirmSelection) {
            confirmSelection.removeEventListener('click', null);
            const newConfirmSelection = confirmSelection.cloneNode(true);
            confirmSelection.replaceWith(newConfirmSelection);
        }
        if (cancelSelection) {
            cancelSelection.removeEventListener('click', null);
            const newCancelSelection = cancelSelection.cloneNode(true);
            cancelSelection.replaceWith(newCancelSelection);
        }
        // Limpiar eventos dinámicos clonando los elementos
        document.querySelectorAll('.add-icon').forEach(icon => {
            const newIcon = icon.cloneNode(true);
            icon.replaceWith(newIcon);
        });
        document.querySelectorAll('.edit-icon').forEach(icon => {
            const newIcon = icon.cloneNode(true);
            icon.replaceWith(newIcon);
        });
        document.querySelectorAll('.delete-icon').forEach(icon => {
            const newIcon = icon.cloneNode(true);
            icon.replaceWith(newIcon);
        });
    });
}

// Ejecutar initGenerador inmediatamente, ya que main.js garantiza que el DOM está listo
initGenerador();
