class Member {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.nickname = data.nickname || '';
        this.rank = data.rank || 'R1';
        this.powerRank = data.powerRank || null;
        this.leftAlliance = data.leftAlliance || false;
        this.pastNicknames = data.pastNicknames || [];
        
        // 新增：默认分团偏好（1 或 2，用于下次新建活动时的智能分配）
        this.defaultTeam = data.defaultTeam || 1;
        
        // 新增：历史活动记录。格式： { activityId, date, type: 'battle'|'substitute'|'leave'|'absent', rank: number|null }
        this.activityHistory = data.activityHistory || [];
    }

    // 硬计算：获取近3场有效战果平均值
    getRecentAverageRank() {
        const battleRecords = this.activityHistory.filter(h => h.type === 'battle' && h.rank !== null);
        if (battleRecords.length === 0) return '-';
        
        const recent = battleRecords.slice(-3); // 取最近3次
        const sum = recent.reduce((acc, curr) => acc + curr.rank, 0);
        return (sum / recent.length).toFixed(1);
    }

    // 硬计算：获取近3场出勤状态与出勤率
    getRecentAttendanceStats() {
        // 出勤率分母包含：正常参战(battle)、替补(substitute)、缺席(absent)。请假(leave)不计入分母。
        // 出勤率分子包含：正常参战(battle)、替补(substitute)。
        const recent3 = this.activityHistory.slice(-3);
        
        let attended = 0;
        let total = 0;
        let statsCount = { sub: 0, leave: 0, absent: 0 };

        recent3.forEach(record => {
            if (record.type === 'substitute') statsCount.sub++;
            if (record.type === 'leave') statsCount.leave++;
            if (record.type === 'absent') statsCount.absent++;

            if (record.type !== 'leave') total++;
            if (record.type === 'battle' || record.type === 'substitute') attended++;
        });

        const rate = total === 0 ? 0 : Math.round((attended / total) * 100);
        
        return {
            rate: rate + '%',
            ...statsCount
        };
    }
}