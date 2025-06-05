import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

export function initResumen() {
    const summaryForm = document.getElementById('summaryForm');
    const monthSelect = document.getElementById('month');
    const yearSelectElement = document.getElementById('year');
    const clearForm = document.getElementById('clearForm');
    const tableHead = document.querySelector('#summaryTable thead');
    const tableBody = document.querySelector('#summaryTable tbody');

    function getWeeksInMonth(month, year) {
        const weeks = [];
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        let startDate = new Date(firstDay);
        
        // Ajustar el inicio de la primera semana al lunes
        if (startDate.getDay() !== 1) {
            startDate.setDate(startDate.getDate() - (startDate.getDay() === 0 ? 6 : startDate.getDay() - 1));
        }
        
        while (startDate <= lastDay) {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            if (endDate > lastDay) {
                endDate.setDate(lastDay.getDate());
            }
            weeks.push({
                start: new Date(startDate),
                end: new Date(endDate)
            });
            startDate.setDate(startDate.getDate() + 7);
        }
        
        return weeks;
    }

    function formatDate(date) {
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    }

    function parseTimeString(timeStr) {
        if (!timeStr || timeStr === 'N/A') return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
    }

    async function loadSchedules() {
        const schedules = new Map();
        try {
            const querySnapshot = await getDocs(collection(db, 'schedules'));
            querySnapshot.forEach(doc => {
                const data = doc.data();
                schedules.set(data.reference, {
                    totalHours: data.totalHours,
                    isFreeDay: data.reference.includes('L') || data.reference.includes('4') || data.reference.includes('0')
                });
            });
        } catch (error) {
            console.error('Error al cargar horarios:', error);
        }
        return schedules;
    }

    async function loadTurns(month, year) {
        const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
        const collaboratorHours = new Map();
        try {
            const schedules = await loadSchedules();
            const querySnapshot = await getDocs(collection(db, `turns/${monthYear}/days`));
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const collaboratorName = data.collaborator.name;
                const dailyAssignments = data.dailyAssignments || [];
                
                if (!collaboratorHours.has(collaboratorName)) {
                    collaboratorHours.set(collaboratorName, []);
                }
                
                dailyAssignments.forEach((assignment, index) => {
                    if (assignment && !schedules.get(assignment)?.isFreeDay) {
                        const hours = parseTimeString(schedules.get(assignment)?.totalHours);
                        collaboratorHours.get(collaboratorName)[index] = (collaboratorHours.get(collaboratorName)[index] || 0) + hours;
                    } else {
                        collaboratorHours.get(collaboratorName)[index] = collaboratorHours.get(collaboratorName)[index] || 0;
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar turnos:', error);
        }
        return collaboratorHours;
    }

    function renderTable(month, year, collaboratorHours, weeks) {
        tableHead.innerHTML = '<tr><th>Colaborador</th></tr>';
        tableBody.innerHTML = '';

        // Renderizar encabezados de semanas
        const headerRow = tableHead.querySelector('tr');
        weeks.forEach((week, index) => {
            const th = document.createElement('th');
            th.textContent = `Semana ${index + 1} (${formatDate(week.start)} - ${formatDate(week.end)})`;
            headerRow.appendChild(th);
        });

        // Renderizar filas de colaboradores
        collaboratorHours.forEach((hours, collaborator) => {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.textContent = collaborator;
            row.appendChild(nameCell);

            weeks.forEach(week => {
                const weekCell = document.createElement('td');
                let totalHours = 0;
                const startDay = week.start.getDate();
                const endDay = week.end.getDate();
                const weekMonth = week.start.getMonth() + 1;
                const weekYear = week.start.getFullYear();

                // Solo sumar horas si la semana está dentro del mes/año seleccionado
                if (weekYear === year && (weekMonth === month || (weekMonth === month - 1 && startDay > endDay))) {
                    for (let day = startDay; day <= (endDay < startDay ? 31 : endDay); day++) {
                        const dayIndex = day - 1;
                        if (hours[dayIndex]) {
                            totalHours += hours[dayIndex];
                        }
                    }
                }

                weekCell.textContent = totalHours.toFixed(2);
                row.appendChild(weekCell);
            });

            tableBody.appendChild(row);
        });
    }

    async function generateSummary(month, year) {
        tableBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
        try {
            const weeks = getWeeksInMonth(month, year);
            const collaboratorHours = await loadTurns(month, year);
            if (collaboratorHours.size === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">No hay turnos registrados para este mes.</td></tr>';
                tableHead.innerHTML = '<tr><th>Colaborador</th></tr>';
                return;
            }
            renderTable(month, year, collaboratorHours, weeks);
        } catch (error) {
            console.error('Error al generar resumen:', error);
            tableBody.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`;
        }
    }

    if (summaryForm) {
        summaryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const month = parseInt(monthSelect.value);
            const year = parseInt(yearSelect.value);
            await generateSummary(month, year);
        });
    }

    if (clearForm) {
        clearForm.addEventListener('click', () => {
            summaryForm.reset();
            tableBody.innerHTML = '';
            tableHead.innerHTML = '<tr><th>Colaborador</th></tr>';
        });
    }

    // Inicializar con el mes y año actuales
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    if (monthSelect && yearSelectElement) {
        monthSelect.value = currentMonth;
        yearSelectElement.value = currentYear;
        generateSummary(currentMonth, currentYear);
    }
}

window.addEventListener('moduleCleanup', () => {
    const summaryForm = document.getElementById('summaryForm');
    const clearForm = document.getElementById('clearForm');
    if (summaryForm) summaryForm.removeEventListener('submit', () => {});
    if (clearForm) clearForm.removeEventListener('click', () => {});
});

initResumen();