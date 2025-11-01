class DataRepository {
    constructor() {
        this.data = [];
    }

    saveToLocalStorage(key) {
        localStorage.setItem(key, JSON.stringify(this.data));
    }

    loadFromLocalStorage(key) {
        const storedData = localStorage.getItem(key);
        this.data = storedData ? JSON.parse(storedData) : [];
    }

    exportToJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    exportToExcel() {
        // Placeholder for Excel export logic
        console.log('Exporting to Excel...');
    }

    exportToPDF() {
        // Placeholder for PDF export logic
        console.log('Exporting to PDF...');
    }

    importFromJSON(jsonData) {
        this.data = JSON.parse(jsonData);
    }

    clearLocalStorage(key) {
        localStorage.removeItem(key);
        this.data = [];
    }
}

export default DataRepository;
