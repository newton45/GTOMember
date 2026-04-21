class ActivityManager {
    constructor(storageKey = 'gto_activities') {
        this.storageKey = storageKey;
        this.activities = [];
        this.load();
    }

    // 【关键修复】：改用原生 localStorage 与 JSON 解析
    load() {
        try {
            const dataStr = localStorage.getItem(this.storageKey);
            const data = dataStr ? JSON.parse(dataStr) : [];
            this.activities = data.map(actData => new Activity(actData));
        } catch (e) {
            console.error("解析活动数据失败，已重置为空:", e);
            this.activities = [];
        }
    }

    // 【关键修复】：改用原生 localStorage 与 JSON 序列化
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.activities));
        } catch (e) {
            console.error("保存活动数据失败:", e);
        }
    }

    getAll() {
        return this.activities;
    }

    findById(id) {
        return this.activities.find(act => act.id === id);
    }

    add(activity) {
        this.activities.push(activity);
        this.save();
    }

    update(id, updates) {
        const index = this.activities.findIndex(act => act.id === id);
        if (index !== -1) {
            Object.assign(this.activities[index], updates);
            this.save();
        }
    }

    remove(id) {
        this.activities = this.activities.filter(act => act.id !== id);
        this.save();
    }

    clear() {
        this.activities = [];
        this.save();
    }
}