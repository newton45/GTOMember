class DataManager {
    constructor() {
        this.members = new MemberManager();
        this.activities = new ActivityManager(); // 新增活动管理模块
    }

    save() {
        this.members.save();
        this.activities.save(); // 同步保存活动
    }

    clear() {
        this.members.clear();
        this.activities.clear(); // 同步清空
    }
}