class DataManager {
    constructor() {
        this.storage = new StorageManager(CONSTANTS.STORAGE_KEY);
        this.memberManager = new MemberManager();
        this.load();
    }

    save() {
        const data = {
            members: this.memberManager.toArray(),
            activities: [],
            version: '1.0.0',
            lastUpdated: new Date().toISOString()
        };
        return this.storage.save(data);
    }

    load() {
        const data = this.storage.load();
        if (data) {
            if (data.members) {
                this.memberManager.fromArray(data.members);
            }
        }
    }

    export(filename) {
        const data = {
            members: this.memberManager.toArray(),
            activities: [],
            version: '1.0.0',
            exportedAt: new Date().toISOString()
        };
        const importExport = new ImportExportManager();
        importExport.exportJSON(data, filename);
    }

    import(file) {
        const importExport = new ImportExportManager();
        return importExport.importJSON(file).then(data => {
            if (data.members) {
                this.memberManager.fromArray(data.members);
                return this.save();
            }
            throw new Error('无效的数据格式');
        });
    }

    clear() {
        this.memberManager.clear();
        return this.storage.clear();
    }

    get members() {
        return this.memberManager;
    }
}
