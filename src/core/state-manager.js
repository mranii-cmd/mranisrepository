class StateManager {
    constructor(initialState = {}) {
        this.state = initialState;
        this.subscribers = [];
        this.history = [];
        this.loadState();
    }

    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    setState(newState) {
        this.history.push(JSON.parse(JSON.stringify(this.state)));
        this.state = { ...this.state, ...newState };
        this.saveState();
        this.notifySubscribers();
    }

    getState() {
        return this.state;
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.state));
    }

    saveState() {
        try {
            localStorage.setItem('edtAppState', JSON.stringify(this.state));
        } catch (error) {
            console.error('Erreur sauvegarde état:', error);
        }
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('edtAppState');
            if (savedState) {
                this.state = JSON.parse(savedState);
            }
        } catch (error) {
            console.error('Erreur chargement état:', error);
        }
    }

    undo() {
        if (this.history.length > 0) {
            this.state = this.history.pop();
            this.notifySubscribers();
        }
    }

    clearHistory() {
        this.history = [];
    }
}

export default StateManager;