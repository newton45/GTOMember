class MemberManager {
    constructor(storageKey = 'gto_members') {
        this.storageKey = storageKey;
        this.members = [];
        this.load();
    }

    // 从本地存储加载并实例化成员
    load() {
        try {
            const dataStr = localStorage.getItem(this.storageKey);
            const data = dataStr ? JSON.parse(dataStr) : [];
            // 确保读取的数据都被转化为 Member 类的实例
            this.members = data.map(mData => new Member(mData));
        } catch (e) {
            console.error("解析成员数据失败，已重置为空:", e);
            this.members = [];
        }
    }

    // 【关键修复】：赋予 MemberManager 原生的自我保存能力
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.members));
        } catch (e) {
            console.error("保存成员数据失败:", e);
        }
    }

    getAll() {
        return this.members;
    }

    findById(id) {
        return this.members.find(m => m.id === id);
    }

    add(member) {
        this.members.push(member);
        this.save();
    }

    update(id, updates) {
        const index = this.members.findIndex(m => m.id === id);
        if (index !== -1) {
            Object.assign(this.members[index], updates);
            this.save();
        }
    }

    remove(id) {
        this.members = this.members.filter(m => m.id !== id);
        this.save();
    }

    clear() {
        this.members = [];
        this.save();
    }
}