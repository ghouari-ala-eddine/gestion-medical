import localforage from 'localforage';

// Configure localforage to use IndexedDB as primary
localforage.config({
  name: 'MediCore',
  storeName: 'emr_hospital_data'
});

const STORE_KEY = 'emr_data';

// Default data structure
const initialData = {
  patients: [],
  records: [],
  appointments: [] // Optional feature for future
};

export const Store = {
  // Initialize the store if it's empty
  async init() {
    try {
      const data = await localforage.getItem(STORE_KEY);
      if (!data) {
        await this.save(initialData);
      }
    } catch (e) {
      console.error("Store init error:", e);
    }
  },

  // Get all data
  async get() {
    await this.init();
    const data = await localforage.getItem(STORE_KEY);
    return data || initialData;
  },

  // Save full data object
  async save(data) {
    try {
      await localforage.setItem(STORE_KEY, data);
    } catch (e) {
      console.error("Store save error:", e);
      alert("Erreur lors de la sauvegarde. Le fichier est peut-être trop volumineux.");
    }
  },

  // Patient Operations
  async getPatients(archived = false) {
    const data = await this.get();
    return data.patients.filter(p => !!p.archived === archived);
  },

  async getPatientById(id) {
    const data = await this.get();
    return data.patients.find(p => p.id === id);
  },

  async addPatient(patientData) {
    const data = await this.get();
    const newPatient = {
      ...patientData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      archived: false
    };
    data.patients.push(newPatient);
    await this.save(data);
    return newPatient;
  },

  async updatePatient(id, updates) {
    const data = await this.get();
    const index = data.patients.findIndex(p => p.id === id);
    if (index !== -1) {
      data.patients[index] = { ...data.patients[index], ...updates };
      await this.save(data);
      return data.patients[index];
    }
    return null;
  },

  async archivePatient(id) {
    return this.updatePatient(id, { archived: true, archivedAt: new Date().toISOString() });
  },
  
  async unarchivePatient(id) {
    return this.updatePatient(id, { archived: false, archivedAt: null });
  },

  // Medical Records Operations
  async getRecordsForPatient(patientId) {
    const data = await this.get();
    return data.records
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async addRecord(recordData) {
    const data = await this.get();
    const newRecord = {
      ...recordData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    data.records.push(newRecord);
    await this.save(data);
    return newRecord;
  },
  
  async getStats() {
    const data = await this.get();
    const activePatients = data.patients.filter(p => !p.archived).length;
    const archivedPatients = data.patients.filter(p => p.archived).length;
    const totalRecords = data.records.length;
    return { activePatients, archivedPatients, totalRecords };
  }
};
