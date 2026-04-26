/* data/member.js */
class Member {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.nickname = data.nickname || '';
        this.rank = data.rank || 'R1';
        this.powerRank = data.powerRank || null;
        
        // 区域状态管理
        this.leftAlliance = data.leftAlliance || false;
        this.isMemorial = data.isMemorial || false; 
        this.poolRank = data.poolRank || null;

        this.pastNicknames = data.pastNicknames || [];
        this.defaultTeam = data.defaultTeam || 1;
        
        // 格式增强：{ activityId, type, rank, team, groupName }
        this.activityHistory = data.activityHistory || [];
        this.activityStatus = data.activityStatus || 0; // 0: 活跃, 1: 半活跃, 2: 不活跃
        this.targetBear = data.targetBear || 'bear1';   // 归属地图：默认熊1
        this.participation = data.participation || 'bear1'; 
    }

    getRecentAverageRank() {
        const battleRecords = this.activityHistory.filter(h => h.type === 'battle' && h.rank !== null);
        if (battleRecords.length === 0) return '-';
        const recent = battleRecords.slice(-3);
        return (recent.reduce((a, b) => a + b.rank, 0) / recent.length).toFixed(1);
    }

    getRecentAttendanceStats() {
        const recent3 = this.activityHistory.slice(-3);
        let attended = 0, total = 0, sub = 0, leave = 0, absent = 0;
        recent3.forEach(r => {
            if (r.type === 'substitute') sub++;
            if (r.type === 'leave') leave++;
            if (r.type === 'absent') absent++;
            if (r.type !== 'leave') total++;
            if (r.type === 'battle' || r.type === 'substitute') attended++;
        });
        return { rate: total === 0 ? '0%' : Math.round((attended / total) * 100) + '%', sub, leave, absent };
    }
}