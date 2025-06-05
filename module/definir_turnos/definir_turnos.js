import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

export function initTurnDefinition() {
    const turnDefinitionForm = document.getElementById('turnDefinitionForm');
    const turnId = document.getElementById('turnId');
    const areaSelect = document.getElementById('areaSelect');
    const turnNumber = document.getElementById('turnNumber');
    const turnPatternSelect = document.getElementById('turnPatternSelect');
    const turnPattern = document.getElementById('turnPattern');
    const observation = document.getElementById('observation');
    const addToPattern = document.getElementById('addToPattern');
    const clearForm = document.getElementById('clearForm');
    const definedTurnsTable = document.getElementById('definedTurnsTable');

    let patternArray = [];

    async function loadSchedules() {
        try {
            const querySnapshot = await getDocs(collection(db, 'schedules'));
            turnPatternSelect.innerHTML = '<option value="" disabled selected>Selecciona un horario</option>';
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const option = document.createElement('option');
                option.value = data.reference;
                option.textContent = `${data.reference} (${data.description})`;
                turnPatternSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar horarios:', error);
            alert('Error al cargar horarios: ' + error.message);
        }
    }

    async function loadDefinedTurns() {
        try {
            const querySnapshot = await getDocs(collection(db, 'turnPatterns'));
            const tbody = definedTurnsTable.querySelector('tbody');
            tbody.innerHTML = '';
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.area}</td>
                    <td>Turno ${data.turnNumber}</td>
                    <td>${data.pattern}</td>
                    <td>${data.observation || '-'}</td>
                    <td>
                        <button class="edit" data-id="${doc.id}">Editar</button>
                        <button class="delete" data-id="${doc.id}">Eliminar</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.querySelectorAll('.edit').forEach(button => {
                button.addEventListener('click', async () => {
                    const id = button.getAttribute('data-id');
                    const docRef = doc(db, 'turnPatterns', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        turnId.value = id;
                        areaSelect.value = data.area;
                        turnNumber.value = data.turnNumber;
                        turnPattern.value = data.pattern;
                        observation.value = data.observation || '';
                        patternArray = data.pattern.split('-');
                        turnPatternSelect.value = '';
                        turnDefinitionForm.querySelector('button[type="submit"]').textContent = 'Actualizar';
                    }
                });
            });

            document.querySelectorAll('.delete').forEach(button => {
                button.addEventListener('click', async () => {
                    if (confirm('¿Estás seguro de que deseas eliminar este turno?')) {
                        const id = button.getAttribute('data-id');
                        await deleteDoc(doc(db, 'turnPatterns', id));
                        loadDefinedTurns();
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar turnos definidos:', error);
            alert('Error al cargar turnos definidos: ' + error.message);
        }
    }

    if (addToPattern) {
        addToPattern.addEventListener('click', () => {
            const selectedValue = turnPatternSelect.value;
            if (selectedValue && selectedValue !== '') {
                patternArray.push(selectedValue);
                turnPattern.value = patternArray.join('-');
                turnPatternSelect.value = '';
            } else {
                alert('Por favor, selecciona un horario para agregar al patrón.');
            }
        });
    }

    if (turnDefinitionForm) {
        turnDefinitionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const area = areaSelect.value;
            const turnNum = parseInt(turnNumber.value);
            const pattern = turnPattern.value;
            const obs = observation.value.trim();

            if (patternArray.length === 0) {
                alert('Por favor, agrega al menos un horario al patrón.');
                return;
            }

            try {
                // Sanitize the area name to create a valid document ID
                const sanitizedArea = area.replace(/[^a-zA-Z0-9-_]/g, '-');
                const turnDocId = turnId.value || `${sanitizedArea}-turn-${turnNum}`;
                await setDoc(doc(db, 'turnPatterns', turnDocId), {
                    area: area,
                    turnNumber: turnNum,
                    pattern: pattern,
                    observation: obs || null
                });
                alert(turnId.value ? 'Turno actualizado con éxito' : 'Turno guardado con éxito');
                turnDefinitionForm.reset();
                turnId.value = '';
                patternArray = [];
                turnPattern.value = '';
                turnPatternSelect.value = '';
                observation.value = '';
                turnDefinitionForm.querySelector('button[type="submit"]').textContent = 'Guardar Turno';
                loadDefinedTurns();
            } catch (error) {
                console.error('Error al guardar turno:', error);
                alert('Error al guardar turno: ' + error.message);
            }
        });
    }

    if (clearForm) {
        clearForm.addEventListener('click', () => {
            turnDefinitionForm.reset();
            turnId.value = '';
            patternArray = [];
            turnPattern.value = '';
            turnPatternSelect.value = '';
            observation.value = '';
            turnDefinitionForm.querySelector('button[type="submit"]').textContent = 'Guardar Turno';
        });
    }

    loadSchedules();
    loadDefinedTurns();
}

window.addEventListener('moduleCleanup', () => {
    const turnDefinitionForm = document.getElementById('turnDefinitionForm');
    const addToPattern = document.getElementById('addToPattern');
    const clearForm = document.getElementById('clearForm');
    if (turnDefinitionForm) turnDefinitionForm.removeEventListener('submit', () => {});
    if (addToPattern) addToPattern.removeEventListener('click', () => {});
    if (clearForm) clearForm.removeEventListener('click', () => {});
});

initTurnDefinition();