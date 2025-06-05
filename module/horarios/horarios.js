
   import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
   import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

   export function initHorarios() {
       const scheduleForm = document.getElementById('scheduleForm');
       const scheduleId = document.getElementById('scheduleId');
       const reference = document.getElementById('reference');
       const description = document.getElementById('description');
       const startTime = document.getElementById('startTime');
       const endTime = document.getElementById('endTime');
       const breakTime = document.getElementById('breakTime');
       const totalHours = document.getElementById('totalHours');
       const clearForm = document.getElementById('clearForm');
       const tableBody = document.querySelector('#scheduleTable tbody');

       function calculateTotalHours() {
           if (reference && (reference.value.includes('L') || reference.value.includes('4') || reference.value.includes('0'))) {
               totalHours.value = 'N/A';
               startTime.value = '';
               endTime.value = '';
               breakTime.value = '';
               startTime.disabled = true;
               endTime.disabled = true;
               breakTime.disabled = true;
               return 'N/A';
           }

           const start = startTime.value;
           const end = endTime.value;
           const breakMinutes = parseInt(breakTime.value) || 0;

           if (start && end) {
               const startDate = new Date(`1970-01-01T${start}:00`);
               let endDate = new Date(`1970-01-01T${end}:00`);
               if (endDate < startDate) {
                   endDate.setDate(endDate.getDate() + 1);
               }
               const diffMs = endDate - startDate;
               const totalMinutes = diffMs / 60000;
               const totalHoursFull = Math.floor(totalMinutes / 60);
               const totalMinutesRemainder = totalMinutes % 60;
               const workedMinutes = totalMinutes - breakMinutes;
               const workedHours = Math.floor(workedMinutes / 60);
               const workedMinutesRemainder = workedMinutes % 60;
               totalHours.value = `${workedHours}:${workedMinutesRemainder.toString().padStart(2, '0')}`;
               return `${totalHoursFull}:${totalMinutesRemainder.toString().padStart(2, '0')}`;
           } else {
               totalHours.value = '';
               return '';
           }
       }

       function updateFormState() {
           const isFreeDay = reference && (reference.value.includes('L') || reference.value.includes('4') || reference.value.includes('0'));
           startTime.disabled = isFreeDay;
           endTime.disabled = isFreeDay;
           breakTime.disabled = isFreeDay;
           if (isFreeDay) {
               startTime.value = '';
               endTime.value = '';
               breakTime.value = '';
               totalHours.value = 'N/A';
           } else if (!isFreeDay && !startTime.disabled) {
               calculateTotalHours();
           }
       }

       async function loadSchedules() {
           tableBody.innerHTML = '';
           try {
               const querySnapshot = await getDocs(collection(db, 'schedules'));
               querySnapshot.forEach(doc => {
                   const data = doc.data();
                   const isFreeDay = data.reference.includes('L') || data.reference.includes('4') || data.reference.includes('0');
                   const start = isFreeDay ? 'N/A' : data.startTime;
                   const end = isFreeDay ? 'N/A' : data.endTime;
                   const breakMin = isFreeDay ? 'N/A' : data.breakTime;
                   const totalHrs = isFreeDay ? 'N/A' : data.totalHours;
                   const totalHrsFull = isFreeDay ? 'N/A' : data.totalHoursFull;

                   const row = document.createElement('tr');
                   row.innerHTML = `
                       <td>${data.reference}</td>
                       <td>${data.description}</td>
                       <td>${start}</td>
                       <td>${end}</td>
                       <td>${breakMin}</td>
                       <td>${totalHrsFull}</td>
                       <td>${totalHrs}</td>
                       <td>${isFreeDay ? (data.reference.includes('L') || data.reference.includes('4') ? 'Libre' : 'Vacaciones/Licencia') : ''}</td>
                       <td>
                           <button class="edit" data-id="${doc.id}">Editar</button>
                           <button class="delete" data-id="${doc.id}">Eliminar</button>
                       </td>
                   `;
                   tableBody.appendChild(row);
               });

               document.querySelectorAll('.edit').forEach(button => {
                   button.addEventListener('click', async () => {
                       const id = button.getAttribute('data-id');
                       const docRef = doc(db, 'schedules', id);
                       const docSnap = await getDoc(docRef);
                       if (docSnap.exists()) {
                           const data = docSnap.data();
                           scheduleId.value = id;
                           reference.value = data.reference;
                           description.value = data.description;
                           startTime.value = data.startTime || '';
                           endTime.value = data.endTime || '';
                           breakTime.value = data.breakTime || '';
                           totalHours.value = data.totalHours || '';
                           updateFormState();
                           scheduleForm.querySelector('button[type="submit"]').textContent = 'Actualizar';
                       }
                   });
               });

               document.querySelectorAll('.delete').forEach(button => {
                   button.addEventListener('click', async () => {
                       if (confirm('¿Estás seguro de que deseas eliminar este horario?')) {
                           const id = button.getAttribute('data-id');
                           await deleteDoc(doc(db, 'schedules', id));
                           loadSchedules();
                       }
                   });
               });
           } catch (error) {
               console.error('Error al cargar horarios:', error);
               tableBody.innerHTML = `<tr><td colspan="9">Error al cargar horarios: ${error.message}</td></tr>`;
           }
       }

       if (reference && startTime && endTime && breakTime) {
           reference.addEventListener('input', updateFormState);
           startTime.addEventListener('change', calculateTotalHours);
           endTime.addEventListener('change', calculateTotalHours);
           breakTime.addEventListener('input', calculateTotalHours);
       }

       if (scheduleForm) {
           scheduleForm.addEventListener('submit', async (e) => {
               e.preventDefault();
               try {
                   const totalHoursFull = calculateTotalHours();
                   const scheduleData = {
                       reference: reference.value,
                       description: reference.value.includes('0') ? 'Vacaciones/Licencia' : description.value,
                       startTime: startTime.value || null,
                       endTime: endTime.value || null,
                       breakTime: parseInt(breakTime.value) || null,
                       totalHours: totalHours.value === 'N/A' ? null : totalHours.value,
                       totalHoursFull: totalHours.value === 'N/A' ? null : totalHoursFull
                   };

                   if (scheduleId.value) {
                       const docRef = doc(db, 'schedules', scheduleId.value);
                       await updateDoc(docRef, scheduleData);
                       alert('Horario actualizado con éxito');
                   } else {
                       await addDoc(collection(db, 'schedules'), scheduleData);
                       alert('Horario agregado con éxito');
                   }
                   scheduleForm.reset();
                   scheduleId.value = '';
                   startTime.disabled = false;
                   endTime.disabled = false;
                   breakTime.disabled = false;
                   scheduleForm.querySelector('button[type="submit"]').textContent = 'Guardar';
                   loadSchedules();
               } catch (error) {
                   console.error('Error al guardar horario:', error);
                   alert('Error al guardar horario: ' + error.message);
               }
           });
       }

       if (clearForm) {
           clearForm.addEventListener('click', () => {
               scheduleForm.reset();
               scheduleId.value = '';
               startTime.disabled = false;
               endTime.disabled = false;
               breakTime.disabled = false;
               scheduleForm.querySelector('button[type="submit"]').textContent = 'Guardar';
           });
       }

       loadSchedules();
   }

   window.addEventListener('moduleCleanup', () => {
       const scheduleForm = document.getElementById('scheduleForm');
       const reference = document.getElementById('reference');
       const startTime = document.getElementById('startTime');
       const endTime = document.getElementById('endTime');
       const breakTime = document.getElementById('breakTime');
       const clearForm = document.getElementById('clearForm');

       if (reference) reference.removeEventListener('input', () => {});
       if (startTime) startTime.removeEventListener('change', () => {});
       if (endTime) endTime.removeEventListener('change', () => {});
       if (breakTime) breakTime.removeEventListener('input', () => {});
       if (scheduleForm) scheduleForm.removeEventListener('submit', () => {});
       if (clearForm) clearForm.removeEventListener('click', () => {});
   });

   initHorarios();
