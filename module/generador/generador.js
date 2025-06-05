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
    const turnForm = document.getElementById('turnForm');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const clearForm = document.getElementById('clearForm');
    const printTable = document.getElementById('printTable');
    const exportExcel = document.getElementById('exportExcel');
    const tableHead = document.querySelector('#turnTable thead');
    const tableBody = document.querySelector('#turnTable tbody');
    const modal = document.getElementById('modal');
    const collaboratorSelect = document.getElementById('collaboratorSelect');
    const areaSelect = document.getElementById('areaSelect');
    const turnSelect = document.getElementById('turnSelect');
    const startDateSelect = document.getElementById('startDateSelect');
    const patternStartSelect = document.getElementById('patternStartSelect');
    const confirmSelection = document.getElementById('confirmSelection');
    const cancelSelection = document.getElementById('cancelSelection');
    const loadingSpinner = document.getElementById('loadingSpinner');

    let collaborators = [];
    let turnPatterns = [];
    let assignedCollaborators = new Map();
    let currentRow = null;

    function showSpinner() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }
    }

    function hideSpinner() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }

    if (modal) {
        modal.style.display = 'none';
    }
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
            console.error('Error al cargar colaboradores:', error);
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
            console.error('Error al cargar patrones de turnos:', error);
            alert('Error al cargar patrones de turnos: ' + error.message);
        }
    }

    async function getLastModifiedMonthAssignments(currentYear, currentMonth) {
        let assignments = new Map();
        const currentDateValue = currentYear * 12 + currentMonth;

        for (let year = currentYear; year >= 2025; year--) {
            const startMonth = (year === currentYear) ? currentMonth : 12;
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
                        console.log(`Asignaciones encontradas para ${monthYear}:`, assignments);
                        return assignments;
                    }
                } catch (error) {
                    console.error(`Error al verificar asignaciones para ${monthYear}:`, error);
                }
            }
        }
        console.log('No se encontraron asignaciones previas, retornando mapa vacío');
        return assignments;
    }

    async function loadAssignments(month, year) {
        try {
            const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
            const querySnapshot = await getDocs(collection(db, `turns/${monthYear}/days`));
            assignedCollaborators.clear();
            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    assignedCollaborators.set(doc.id, doc.data());
                });
                console.log(`Asignaciones cargadas para ${monthYear}:`, assignedCollaborators);
            } else {
                assignedCollaborators = await getLastModifiedMonthAssignments(year, month);
                console.log(`Asignaciones cargadas desde último mes para ${monthYear}:`, assignedCollaborators);
            }
            renderTableWithAssignments(month, year);
        } catch (error) {
            console.error('Error al cargar asignaciones:', error);
            renderTableWithAssignments(month, year);
        }
    }

    async function updateFutureMonths(month, year, deletedRowId = null) {
        showSpinner();
        try {
            if (assignedCollaborators.size === 0 && !deletedRowId) {
                console.log('No hay asignaciones para propagar.');
                return;
            }

            const currentMonthYearValue = year * 12 + month;
            let maxYear = year;
            if (year === 2025 && month === 12) {
                maxYear = 2026;
            }

            for (let y = year; y <= maxYear; y++) {
                const startMonth = (y === year) ? month + 1 : 1;
                const endMonth = (y === maxYear && y === 2025) ? 12 : 12;
                for (let m = startMonth; m <= endMonth; m++) {
                    const monthYear = `${y}-${m.toString().padStart(2, '0')}`;
                    const monthYearValue = y * 12 + m;
                    if (monthYearValue <= currentMonthYearValue) continue;

                    try {
                        const querySnapshot = await getDocs(collection(db, `turns/${monthYear}/days`));
                        const existingDocs = new Set(querySnapshot.docs.map(doc => doc.id));

                        if (deletedRowId) {
                            if (existingDocs.has(deletedRowId)) {
                                await deleteDoc(doc(db, `turns/${monthYear}/days`, deletedRowId));
                                console.log(`Eliminado documento para rowId ${deletedRowId} en ${monthYear}`);
                            }
                        } else {
                            for (const [rowId, data] of assignedCollaborators) {
                                if (!existingDocs.has(rowId)) {
                                    const daysInFutureMonth = getDaysInMonth(m, y);
                                    const futureStartDate = `${y}-${m.toString().padStart(2, '0')}-01`;
                                    const daysSinceStart = Math.floor(
                                        (new Date(futureStartDate) - new Date(data.startDate)) / (1000 * 60 * 60 * 24)
                                    );
                                    const patternArray = data.pattern.split('-');
                                    const patternStartIndex = (data.patternStartIndex + daysSinceStart) % patternArray.length;
                                    const dailyAssignments = calculateDailyAssignments(
                                        futureStartDate,
                                        data.pattern,
                                        patternStartIndex,
                                        daysInFutureMonth,
                                        y,
                                        m
                                    );

                                    await setDoc(doc(db, `turns/${monthYear}/days`, rowId), {
                                        collaborator: data.collaborator,
                                        area: data.area,
                                        turnId: data.turnId,
                                        turnNumber: data.turnNumber,
                                        pattern: data.pattern,
                                        observation: data.observation,
                                        startDate: data.startDate,
                                        patternStartIndex: data.patternStartIndex,
                                        dailyAssignments: dailyAssignments,
                                        timestamp: new Date().toISOString()
                                    });
                                }
                            }
                            console.log(`Asignaciones propagadas a ${monthYear}:`, assignedCollaborators);
                        }
                    } catch (error) {
                        console.error(`Error al propagar o eliminar asignaciones en ${monthYear}:`, error);
                    }
                }
            }
        } finally {
            hideSpinner();
        }
    }

    function getDaysInMonth(month, year) {
        return new Date(year, month, 0).getDate();
    }

    function calculateDailyAssignments(startDate, pattern, patternStartIndex, daysInMonth, year, month) {
        const assignments = [];
        const patternArray = pattern.split('-');
        const start = new Date(startDate);
        const startDay = start.getDate();
        let patternIndex = parseInt(patternStartIndex);

        for (let day = 1; day <= daysInMonth; day++) {
            if (day < startDay && start.getMonth() + 1 === month && start.getFullYear() === year) {
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
                console.warn(`Fila no encontrada para rowId: ${rowId}`, data);
                return;
            }
            const firstCell = row.querySelector('td:first-child');
            if (firstCell) {
                firstCell.innerHTML = `
                    ${data.collaborator.name}
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
                console.warn(`No se encontró td:first-child para rowId: ${rowId}`);
            }
        });

        document.querySelectorAll('.add-icon').forEach(icon => {
            icon.addEventListener('click', async () => {
                currentRow = icon.closest('tr');
                if (!currentRow) {
                    console.error('No se pudo encontrar la fila activa');
                    alert('Error: No se pudo identificar la fila seleccionada.');
                    return;
                }
                console.log('Fila seleccionada:', currentRow.dataset.rowId);
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

                modal.style.display = 'block';
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
                        console.error(`Fila no encontrada para rowId: ${rowId}`);
                        return;
                    }

                    console.log(`Intento de eliminar colaborador para rowId: ${rowId}, mes: ${currentMonth}, año: ${currentYear}`);

                    if (confirm('¿Estás seguro de que deseas eliminar este colaborador y sus turnos?')) {
                        const monthYear = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
                        await deleteDoc(doc(db, `turns/${monthYear}/days`, rowId));
                        console.log(`Documento eliminado para rowId ${rowId} en ${monthYear}`);

                        assignedCollaborators.delete(rowId);

                        const firstCell = row.querySelector('td:first-child');
                        if (firstCell) {
                            firstCell.innerHTML = `<i class="fas fa-plus add-icon" data-row="${rowId.split('-').pop()}"></i>`;
                        }
                        const cells = row.querySelectorAll('td:not(:first-child)');
                        cells.forEach(cell => {
                            cell.textContent = '';
                        });

                        await updateFutureMonths(currentMonth, currentYear, rowId);

                        renderTableWithAssignments(currentMonth, currentYear);
                    }
                } catch (error) {
                    console.error('Error al eliminar colaborador:', error);
                    alert('Error al eliminar colaborador: ' + error.message);
                } finally {
                    hideSpinner();
                }
            }
        });
    }

    // Generate PDF functionality
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

            // Initialize jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            // Add title
            doc.setFontSize(14);
            doc.text(`Turnos - ${monthNames[month - 1]} ${year}`, 148.5, 10, { align: 'center' });

            // Prepare table data
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

            // Calculate scaling factor to fit all rows in one page
            const rowHeight = 5;
            const totalHeight = (totalRows + 2) * rowHeight;
            const pageHeight = 190;
            const scaleFactor = totalHeight > pageHeight ? pageHeight / totalHeight : 1;

            // Add table in a single page
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

            // Generate PDF and open in new tab
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            window.open(pdfUrl, '_blank');
        });
    }

    // Export to Excel functionality
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
                console.error('Librería SheetJS (XLSX) no está cargada.');
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

                // Prepare data for Excel
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

                // Create worksheet
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const colWidths = [
                    { wch: 20 },
                    ...Array(daysInMonth).fill({ wch: 5 })
                ];
                ws['!cols'] = colWidths;

                // Create workbook
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, `${monthNames[month - 1]} ${year}`);

                // Download Excel file
                const fileName = `Turnos_${year}-${month.toString().padStart(2, '0')}.xlsx`;
                XLSX.write(wb, fileName, { bookType: 'xlsx', type: 'binary' });
            } catch (error) {
                console.error('Error al exportar a Excel:', error);
                alert('Error al generar el archivo Excel: ' + error.message);
            }
        });
    }

    async function loadTurns(month, year) {
        showSpinner(); // Mostrar spinner al inicio de la carga
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
            await loadAssignments(month, year);
        } finally {
            hideSpinner(); // Ocultar spinner al finalizar, incluso si hay error
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
            await loadTurns(selectedMonth, selectedYear);
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
                showSpinner(); // Mostrar spinner al cambiar mes
                try {
                    const selectedMonth = parseInt(monthSelect.value);
                    const selectedYear = parseInt(yearSelect.value);
                    await loadCollaborators();
                    await loadTurnPatterns();
                    await loadTurns(selectedMonth, selectedYear);
                } finally {
                    hideSpinner(); // Ocultar spinner al finalizar
                }
            }
        });

        yearSelect.addEventListener('change', async () => {
            if (monthSelect.value && yearSelect.value) {
                showSpinner(); // Mostrar spinner al cambiar año
                try {
                    const selectedMonth = parseInt(monthSelect.value);
                    const selectedYear = parseInt(yearSelect.value);
                    await loadCollaborators();
                    await loadTurnPatterns();
                    await loadTurns(selectedMonth, selectedYear);
                } finally {
                    hideSpinner(); // Ocultar spinner al finalizar
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
            showSpinner(); // Mostrar spinner al cargar inicialmente
            try {
                await loadCollaborators();
                await loadTurnPatterns();
                if (collaborators.length === 0) {
                    alert('Debe haber al menos un colaborador registrado.');
                    return;
                }
                if (turnPatterns.length === 0) {
                    alert('No hay turnos definidos en la colección turnPatterns.');
                    return;
                }
                await loadAssignments(currentMonth, 2025);
            } finally {
                hideSpinner(); // Ocultar spinner al finalizar
            }
        })();
    }

    if (confirmSelection) {
        confirmSelection.addEventListener('click', async () => {
            if (!currentRow || !(currentRow instanceof HTMLElement)) {
                console.error('currentRow es null o no es un elemento válido del DOM:', currentRow);
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
                    patternStartIndex,
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
                    dailyAssignments: dailyAssignments
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
                    await updateFutureMonths(parseInt(monthSelect.value), parseInt(yearSelect.value));
                    modal.style.display = 'none';
                    collaboratorSelect.value = '';
                    areaSelect.value = '';
                    turnSelect.value = '';
                    startDateSelect.value = '';
                    patternStartSelect.innerHTML = '<option value="" disabled selected>Seleccionar inicio del patrón</option>';
                    currentRow = null;

                    await renderTableWithAssignments(parseInt(monthSelect.value), parseInt(yearSelect.value));
                } catch (error) {
                    console.error('Error al guardar turno:', error);
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
            collaboratorSelect.value = '';
            areaSelect.value = '';
            turnSelect.value = '';
            startDateSelect.value = '';
            patternStartSelect.innerHTML = '<option value="" disabled selected>Seleccionar inicio del patrón</option>';
            currentRow = null;
        });
    }
}

window.addEventListener('moduleCleanup', () => {
    const turnForm = document.getElementById('turnForm');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const clearForm = document.getElementById('clearForm');
    if (turnForm) turnForm.removeEventListener('submit', () => {});
    if (monthSelect) monthSelect.removeEventListener('change', () => {});
    if (yearSelect) yearSelect.removeEventListener('change', () => {});
    if (clearForm) clearForm.removeEventListener('click', () => {});
});

initGenerador();