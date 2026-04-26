class ActivityGroup {
    constructor(data = {}) {
        this.name = data.name || '新小组';
        this.description = data.description || '无';
        this.memberIds = data.memberIds || [];
        this.leaderId = data.leaderId || null;
        
        // 【核心修复】：为替补名单增加反序列化/水合通道
        // 这样从 LocalStorage 或外部 JSON 导入时，替补数据就不会再被系统丢弃了
        this.substituteIds = data.substituteIds || [];
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