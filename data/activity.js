class ActivityGroup {
    constructor(data = {}) {
        this.id = data.id || 'group_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        this.name = data.name || '新建活动组';
        this.description = data.description || '无';
        this.leaderId = data.leaderId || null;
        this.memberIds = data.memberIds || []; // 存放成员ID
    }
}

class ActivityTeam {
    constructor(data = {}) {
        this.groups = (data.groups || [new ActivityGroup()]).map(g => new ActivityGroup(g));
        this.unassignedIds = data.unassignedIds || []; // 待选框成员ID
    }
}

class Activity {
    constructor(data = {}) {
        this.id = data.id || 'act_' + Date.now();
        this.name = data.name || '未命名活动';
        this.description = data.description || '活动说明...';
        this.hasTeam2 = data.hasTeam2 || false;
        
        this.team1 = new ActivityTeam(data.team1 || {});
        this.team2 = new ActivityTeam(data.team2 || {});
    }
}