FF.Storage = {
    KEY: 'familyflow_data',

    save(state) {
        try {
            const data = {
                people: state.people,
                relationships: state.relationships,
                boards: state.boards,
                notes: state.notes,
                currentBoardId: state.currentBoardId,
                settings: state.settings
            };
            localStorage.setItem(this.KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error('Storage load error:', e);
            return null;
        }
    },

    clear() {
        localStorage.removeItem(this.KEY);
    },

    hasData() {
        return !!localStorage.getItem(this.KEY);
    },

    exportFull(state) {
        return JSON.stringify({
            version: '1.0',
            exportDate: new Date().toISOString(),
            people: state.people,
            relationships: state.relationships,
            boards: state.boards,
            notes: state.notes,
            settings: state.settings
        }, null, 2);
    },

    importFull(jsonStr) {
        try {
            const data = JSON.parse(jsonStr);
            if (!data.people || !Array.isArray(data.people)) throw new Error('Invalid data: missing people array');
            if (!data.relationships || !Array.isArray(data.relationships)) throw new Error('Invalid data: missing relationships array');
            if (!data.boards || !Array.isArray(data.boards)) throw new Error('Invalid data: missing boards array');
            return { success: true, data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};
