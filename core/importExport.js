/* core/importExport.js */
const ImportExport = {
    // 1. 全量快照采集 (用于云端同步和本地导出)
    collectFullSnapshot: function(dataManager) {
        const allMembers = dataManager.members.getAll();
        
        return {
            version: "3.0", // 升级为 3.0 数据架构
            timestamp: Date.now(),
            
            // 【核心架构升级】：在 JSON 层面彻底隔离三态数据
            members: {
                active: allMembers.filter(m => !m.leftAlliance),
                out: allMembers.filter(m => m.leftAlliance && !m.isMemorial),
                memorial: allMembers.filter(m => m.leftAlliance && m.isMemorial)
            },
            
            // 活动与地图数据保持原样
            activities: dataManager.activities.getAll(),
            seatData: JSON.parse(localStorage.getItem('SeatPage_seatData')) || {},
            anchors: JSON.parse(localStorage.getItem('SeatPage_anchors')) || {},
            currentTab: localStorage.getItem('SeatPage_currentTab') || 'bear1'
        };
    },

    // 2. 存为本地实体文件 (下载 JSON 备份)
    savePresetToFile: function(dataManager) {
        const snapshot = this.collectFullSnapshot(dataManager);
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `GTO_数据备份_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    },

    // 为了兼容你 app.js 里可能残留的旧调用方法名
    exportJSON: function(dataManager) {
        this.savePresetToFile(dataManager);
    },

    // 3. 全量快照载入 (用于云端下载和本地导入)
    applyFullSnapshot: function(snapshot, dataManager) {
        if (!snapshot || !snapshot.members) {
            alert("文件格式不正确，载入中止。");
            return false;
        }

        try {
            // A. 成员降维注入 (向下兼容旧版一维数组，向上兼容新版三态对象)
            const memArr = dataManager.members.getAll();
            memArr.length = 0; // 原地清空内存引用
            
            let incomingMembers = [];
            if (Array.isArray(snapshot.members)) {
                // 如果载入的是 V2.0 以前的旧备份
                incomingMembers = snapshot.members; 
            } else {
                // 如果载入的是 V3.0 的新备份：将隔离的三区数据重新拍扁
                incomingMembers = [
                    ...(snapshot.members.active || []),
                    ...(snapshot.members.out || []),
                    ...(snapshot.members.memorial || [])
                ];
            }

            // 【核心修复：原型重铸】
            // 赋予解析出来的纯文本 JSON 对象以 Member 类的灵魂
            incomingMembers.forEach(m => {
                const finalEntity = (typeof Member !== 'undefined') ? new Member(m) : m;
                memArr.push(finalEntity);
            });

            // B. 活动数据覆盖
            const actArr = dataManager.activities.getAll();
            actArr.length = 0;
            if (snapshot.activities) {
                snapshot.activities.forEach(a => actArr.push(a));
            }

            // C. 强制重写地图相关的 LocalStorage
            localStorage.setItem('SeatPage_seatData', JSON.stringify(snapshot.seatData || {}));
            localStorage.setItem('SeatPage_anchors', JSON.stringify(snapshot.anchors || {}));
            localStorage.setItem('SeatPage_currentTab', snapshot.currentTab || 'bear1');

            // 唤醒 DataManager，让它用正确的 Key 写入硬盘
            dataManager.save();
            return true;

        } catch (e) {
            console.error("数据载入失败:", e);
            alert("载入过程中发生错误，请检查控制台 (F12)。");
            return false;
        }
    }
};