import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

export function initColaboradores() {
    const collaboratorForm = document.getElementById('collaboratorForm');
    const collaboratorName = document.getElementById('collaboratorName');
    const clearForm = document.getElementById('clearForm');
    const tableBody = document.querySelector('#collaboratorTable tbody');

    async function loadCollaborators() {
        tableBody.innerHTML = '';
        try {
            const querySnapshot = await getDocs(collection(db, 'collaborators'));
            querySnapshot.forEach(doc => {
                const data = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${data.name}</td>
                    <td><button class="delete" data-id="${doc.id}">Eliminar</button></td>
                `;
                tableBody.appendChild(row);
            });

            document.querySelectorAll('.delete').forEach(button => {
                button.addEventListener('click', async () => {
                    if (confirm('¿Estás seguro de que deseas eliminar este colaborador?')) {
                        const id = button.getAttribute('data-id');
                        await deleteDoc(doc(db, 'collaborators', id));
                        loadCollaborators();
                    }
                });
            });
        } catch (error) {
            console.error('Error al cargar colaboradores:', error);
            tableBody.innerHTML = `<tr><td colspan="2">Error al cargar colaboradores: ${error.message}</td></tr>`;
        }
    }

    if (collaboratorForm) {
        collaboratorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                if (!collaboratorName.value.trim()) {
                    alert('Por favor, ingrese un nombre válido.');
                    return;
                }
                await addDoc(collection(db, 'collaborators'), {
                    name: collaboratorName.value.trim()
                });
                alert('Colaborador agregado con éxito');
                collaboratorForm.reset();
                loadCollaborators();
            } catch (error) {
                console.error('Error al agregar colaborador:', error);
                alert('Error al agregar colaborador: ' + error.message);
            }
        });
    }

    if (clearForm) {
        clearForm.addEventListener('click', () => {
            collaboratorForm.reset();
        });
    }

    loadCollaborators();
}

window.addEventListener('moduleCleanup', () => {
    const collaboratorForm = document.getElementById('collaboratorForm');
    const clearForm = document.getElementById('clearForm');

    if (collaboratorForm) collaboratorForm.removeEventListener('submit', () => {});
    if (clearForm) clearForm.removeEventListener('click', () => {});
});

initColaboradores();