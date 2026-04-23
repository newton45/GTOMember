/* core/importExport.js */
const ImportExport = {
    // 1. 全量收集：确保涵盖所有页面的物理键名
    collectFullSnapshot: function(dataManager) {
        return {
            version: "2.5",
            // 成员与活动 (对应各页面读取的根数据)
            members: dataManager.members.getAll(),
            activities: dataManager.activities.getAll(),
            // 地图布局与坐标
            seatData: JSON.parse(localStorage.getItem('SeatPage_seatData')) || {},
            anchors: JSON.parse(localStorage.getItem('SeatPage_anchors')) || {},
            currentTab: localStorage.getItem('SeatPage_currentTab') || 'bear1',
            timestamp: Date.now()
        };
    },

    // 2. 存为预设文件
    savePresetToFile: function(dataManager) {
        const snapshot = this.collectFullSnapshot(dataManager);
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `GTO全量预设_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    // 3. 【核心修复】全量载入：必须同步重写物理存储
    applyFullSnapshot: function(snapshot, dataManager) {
        if (!snapshot || !snapshot.members) {
            alert("预设文件格式不正确，载入中止。");
            return false;
        }

        try {
            // 1. 内存级注入：获取内部数组的物理引用，原地清空并推入新数据
            // 这样完美绕过了对 data 变量名和 LocalStorage 键名的猜测
            const memArr = dataManager.members.getAll();
            memArr.length = 0; 
            snapshot.members.forEach(m => memArr.push(m));

            const actArr = dataManager.activities.getAll();
            actArr.length = 0;
            if (snapshot.activities) {
                snapshot.activities.forEach(a => actArr.push(a));
            }

            // 2. 强制重写地图相关的 LocalStorage (这里的 Key 是我们确定的)
            localStorage.setItem('SeatPage_seatData', JSON.stringify(snapshot.seatData || {}));
            localStorage.setItem('SeatPage_anchors', JSON.stringify(snapshot.anchors || {}));
            localStorage.setItem('SeatPage_currentTab', snapshot.currentTab || 'bear1');

            // 3. 唤醒 DataManager，让它用自己正确的 Key 将内存数组写入硬盘
            dataManager.save();

            return true;
        } catch (e) {
            console.error("预设载入失败:", e);
            alert("载入过程中发生错误，请检查控制台输出。");
            return false;
        }
    }
};