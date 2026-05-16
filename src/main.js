import { Store } from './store.js';

// Application State
let currentView = 'dashboard';
let currentPatientId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  await Store.init();
  setupNavigation();
  setupModals();
  setupForms();
  setupSearch();
  
  // Render initial view
  await renderDashboard();
});

// Navigation Logic
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewSections = document.querySelectorAll('.view-section');

  const switchView = async (viewId) => {
    // Update nav active state
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewId) {
        item.classList.add('active');
      }
    });

    // Update view sections
    viewSections.forEach(section => section.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');

    currentView = viewId;
    
    // Render specific view data
    if (viewId === 'dashboard') await renderDashboard();
    if (viewId === 'patients') await renderPatients();
    if (viewId === 'archives') await renderArchives();
  };

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      switchView(e.currentTarget.dataset.view);
    });
  });

  // Global go-to buttons
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchView(e.currentTarget.dataset.goto);
    });
  });

  // Back button
  document.getElementById('btn-back-patients').addEventListener('click', () => {
    switchView('patients');
    currentPatientId = null;
  });
}

function setupModals() {
  const modalAddPatient = document.getElementById('modal-add-patient');
  const modalAddRecord = document.getElementById('modal-add-record');

  document.getElementById('btn-add-patient').addEventListener('click', () => modalAddPatient.classList.add('active'));
  document.getElementById('btn-quick-add-patient').addEventListener('click', () => modalAddPatient.classList.add('active'));
  document.getElementById('btn-add-record').addEventListener('click', () => {
    document.getElementById('record-patient-id').value = currentPatientId;
    document.getElementById('record-date-input').valueAsDate = new Date();
    modalAddRecord.classList.add('active');
  });

  const closePatientModal = () => {
    modalAddPatient.classList.remove('active');
    document.getElementById('form-add-patient').reset();
  };
  const closeRecordModal = () => {
    modalAddRecord.classList.remove('active');
    document.getElementById('form-add-record').reset();
  };

  document.getElementById('btn-close-patient-modal').addEventListener('click', closePatientModal);
  document.getElementById('btn-cancel-patient').addEventListener('click', closePatientModal);
  
  document.getElementById('btn-close-record-modal').addEventListener('click', closeRecordModal);
  document.getElementById('btn-cancel-record').addEventListener('click', closeRecordModal);
}

function setupForms() {
  // Add Patient Form
  document.getElementById('form-add-patient').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    await Store.addPatient(data);
    
    document.getElementById('modal-add-patient').classList.remove('active');
    e.target.reset();
    
    if (currentView === 'dashboard') await renderDashboard();
    if (currentView === 'patients') await renderPatients();
  });

  // Add Record Form
  document.getElementById('form-add-record').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const finishSave = async (finalData) => {
      await Store.addRecord(finalData);
      document.getElementById('modal-add-record').classList.remove('active');
      e.target.reset();
      await renderPatientDetails(currentPatientId);
    };

    const fileInput = document.getElementById('record-pdf-input');
    if (fileInput && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      reader.onload = async function(event) {
        data.pdfAttachment = event.target.result; // base64
        data.pdfName = file.name;
        await finishSave(data);
      };
      
      reader.readAsDataURL(file);
    } else {
      await finishSave(data);
    }
  });
}

function setupSearch() {
  const searchInput = document.getElementById('search-patient');
  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase();
    const patients = await Store.getPatients(false);
    const filtered = patients.filter(p => 
      p.name.toLowerCase().includes(query) || p.id.includes(query)
    );
    renderPatientsGrid(filtered); // Grid is sync
  });
}

// Global View Patient Function (accessible from DOM)
window.viewPatient = async (id) => {
  currentPatientId = id;
  
  document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
  document.getElementById('view-patient-details').classList.add('active');
  
  await renderPatientDetails(id);
};

window.archivePatient = async (id) => {
  if (confirm("Voulez-vous vraiment archiver ce patient ?")) {
    await Store.archivePatient(id);
    if (currentView === 'patients') await renderPatients();
    if (currentView === 'dashboard') await renderDashboard();
    if (currentPatientId === id) {
      document.getElementById('btn-back-patients').click();
    }
  }
};

window.unarchivePatient = async (id) => {
  if (confirm("Voulez-vous restaurer ce patient ?")) {
    await Store.unarchivePatient(id);
    await renderArchives();
  }
};

// Render Functions
async function renderDashboard() {
  const stats = await Store.getStats();
  document.getElementById('stat-active-patients').textContent = stats.activePatients;
  document.getElementById('stat-total-records').textContent = stats.totalRecords;
  document.getElementById('stat-archived-patients').textContent = stats.archivedPatients;

  const recentList = document.getElementById('recent-patients-list');
  const activePatients = await Store.getPatients(false);
  
  const recent = activePatients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  
  if (recent.length === 0) {
    recentList.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Aucun patient récent.</td></tr>`;
    return;
  }

  const htmlPromises = recent.map(async p => {
    const records = await Store.getRecordsForPatient(p.id);
    const lastVisit = records.length > 0 ? new Date(records[0].date).toLocaleDateString() : 'Nouvel inscrit';
    return `
      <tr>
        <td>#${p.id.slice(-4)}</td>
        <td style="font-weight: 500;">${p.name}</td>
        <td>${p.age} ans</td>
        <td><span class="badge ${p.gender === 'Homme' ? 'badge-blue' : 'badge-green'}">${p.gender}</span></td>
        <td>${lastVisit}</td>
        <td>
          <button class="btn btn-text" onclick="viewPatient('${p.id}')">Dossier</button>
        </td>
      </tr>
    `;
  });
  
  const htmlArray = await Promise.all(htmlPromises);
  recentList.innerHTML = htmlArray.join('');
}

async function renderPatients() {
  const patients = await Store.getPatients(false);
  renderPatientsGrid(patients);
}

function renderPatientsGrid(patients) {
  const grid = document.getElementById('patients-grid');
  
  if (patients.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="ph ph-users"></i>
        <h3>Aucun patient trouvé</h3>
        <p>Commencez par ajouter un nouveau patient.</p>
      </div>`;
    return;
  }

  grid.innerHTML = patients.map(p => `
    <div class="patient-card" onclick="viewPatient('${p.id}')">
      <div class="card-header">
        <div>
          <h3 class="card-title">${p.name}</h3>
          <span class="card-id">ID: #${p.id.slice(-6)}</span>
        </div>
        <span class="badge ${p.gender === 'Homme' ? 'badge-blue' : 'badge-green'}">${p.gender}</span>
      </div>
      <div class="card-body">
        <p><i class="ph ph-calendar"></i> ${p.age} ans</p>
        <p><i class="ph ph-stethoscope"></i> Dr: <strong>${p.doctor || 'Non spécifié'}</strong></p>
        <p><i class="ph ph-drop"></i> Groupe: <strong>${p.bloodType}</strong></p>
      </div>
    </div>
  `).join('');
}

async function renderPatientDetails(id) {
  const patient = await Store.getPatientById(id);
  const records = await Store.getRecordsForPatient(id);

  const profileMain = document.getElementById('profile-info-main');
  profileMain.innerHTML = `
    <h2>${patient.name}</h2>
    <div class="profile-meta-id">ID: ${patient.id} | Inscrit le ${new Date(patient.createdAt).toLocaleDateString()}</div>
    <div class="tags">
      <span class="badge badge-gray">${patient.age} ans</span>
      <span class="badge badge-gray">${patient.gender}</span>
      <span class="badge badge-blue">Sang: ${patient.bloodType}</span>
      <span class="badge badge-gray"><i class="ph ph-phone"></i> ${patient.phone || 'N/A'}</span>
    </div>
  `;

  const profileExtra = document.getElementById('profile-extra-info');
  profileExtra.innerHTML = `
    <div class="extra-info-item">
      <span class="extra-info-label">Médecin Traitant</span>
      <div class="extra-info-value"><i class="ph ph-stethoscope text-blue"></i> ${patient.doctor || 'Non spécifié'}</div>
    </div>
    <div class="extra-info-item">
      <span class="extra-info-label">Médicaments Actuels</span>
      <div class="extra-info-value"><i class="ph ph-pill text-orange"></i> ${patient.medications || 'Aucun traitement en cours'}</div>
    </div>
  `;

  const btnArchive = document.getElementById('btn-archive-patient');
  const newBtnArchive = btnArchive.cloneNode(true);
  btnArchive.parentNode.replaceChild(newBtnArchive, btnArchive);
  
  newBtnArchive.addEventListener('click', () => {
    archivePatient(id);
  });

  const recordsList = document.getElementById('records-list');
  if (records.length === 0) {
    recordsList.innerHTML = `
      <div class="empty-state">
        <i class="ph ph-file-text"></i>
        <h3>Aucun historique médical</h3>
        <p>Ajoutez la première consultation pour ce patient.</p>
      </div>
    `;
    return;
  }

  recordsList.innerHTML = records.map(r => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-date">${new Date(r.date).toLocaleDateString()}</div>
        <h3 class="timeline-title">${r.diagnosis}</h3>
        <p class="timeline-notes">${r.notes || 'Aucune note additionnelle.'}</p>
        ${r.pdfAttachment ? `
        <div class="timeline-attachment">
          <a href="${r.pdfAttachment}" download="${r.pdfName}" class="btn btn-download-pdf">
            <i class="ph ph-file-pdf"></i> Télécharger le Fichier
          </a>
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

async function renderArchives() {
  const archivesList = document.getElementById('archived-patients-list');
  const archived = await Store.getPatients(true);
  
  if (archived.length === 0) {
    archivesList.innerHTML = `<tr><td colspan="4" class="text-center text-muted empty-state">Aucun dossier archivé.</td></tr>`;
    return;
  }

  archivesList.innerHTML = archived.map(p => `
    <tr>
      <td>#${p.id.slice(-6)}</td>
      <td style="font-weight: 500;">${p.name}</td>
      <td>${new Date(p.archivedAt).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="unarchivePatient('${p.id}')">
          <i class="ph ph-arrow-counter-clockwise"></i> Restaurer
        </button>
      </td>
    </tr>
  `).join('');
}
