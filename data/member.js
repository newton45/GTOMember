class Member {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.nickname = data.nickname || '';
        this.rank = data.rank || 'R1';
        this.powerRank = data.powerRank || null;
        this.leftAlliance = data.leftAlliance || false;
        this.pastNicknames = data.pastNicknames || [];
        this.defaultTeam = data.defaultTeam || 1;
        // 格式增强：{ activityId, type, rank, team, groupName }
        this.activityHistory = data.activityHistory || [];
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