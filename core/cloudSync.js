/* core/cloudSync.js */
const CloudSync = {
    // 【请在这里填入你的 JSONbin 凭证】
    BIN_ID: "69eba566856a6821896b9ce1", 
    API_KEY: "$2a$10$85HxT6vXQPp1WcKghzrRsuNrzDSCPxKs8twXB0CfYKlynd/i.kogW",
    BASE_URL: "https://api.jsonbin.io/v3/b",

    // 获取云端数据
    fetchRemote: async function() {
        try {
            const response = await fetch(`${this.BASE_URL}/${this.BIN_ID}/latest`, {
                method: 'GET',
                headers: { 'X-Master-Key': this.API_KEY }
            });
            if (!response.ok) throw new Error('网络请求失败');
            const data = await response.json();
            return data.record || {}; // JSONbin 的数据包在 record 字段里
        } catch (error) {
            alert("读取云端数据失败，请检查网络或 API 配置。");
            return null;
        }
    },

    // 覆写云端数据
    pushRemote: async function(mergedData) {
        try {
            const response = await fetch(`${this.BASE_URL}/${this.BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.API_KEY
                },
                body: JSON.stringify(mergedData)
            });
            if (!response.ok) throw new Error('上传失败');
            return true;
        } catch (error) {
            alert("上传云端数据失败。");
            return false;
        }
    },

    // 核心算法：碎片化合并 (修复跨区 ID 碰撞及处理云端数据清理)
    mergeData: function(source, target, selections) {
        // 1. 成员隔离合并逻辑
        const getFlatMembers = (obj) => {
             if (!obj || !obj.members) return [];
             if (Array.isArray(obj.members)) return obj.members; // 兼容老版本
             return [
                 ...(obj.members.active || []),
                 ...(obj.members.out || []),
                 ...(obj.members.memorial || [])
             ];
        };

        let targetFlat = getFlatMembers(target);
        const sourceFlat = getFlatMembers(source);

        const processZone = (selectionKey, isZoneFn) => {
            if (selections.includes(selectionKey)) {
                const incoming = sourceFlat.filter(isZoneFn);
                const incomingIds = incoming.map(m => m.id);
                targetFlat = targetFlat.filter(m => !incomingIds.includes(m.id));
                targetFlat = targetFlat.filter(m => !isZoneFn(m));
                targetFlat.push(...incoming);
            }
        };

        processZone('members_active', m => !m.leftAlliance);
        processZone('members_out', m => m.leftAlliance && !m.isMemorial);
        processZone('members_memorial', m => m.leftAlliance && m.isMemorial);

        target.members = {
            active: targetFlat.filter(m => !m.leftAlliance),
            out: targetFlat.filter(m => m.leftAlliance && !m.isMemorial),
            memorial: targetFlat.filter(m => m.leftAlliance && m.isMemorial)
        };

        // 2. 合并座位
        if (selections.includes('seats')) {
            target.seatData = source.seatData || {};
            target.anchors = source.anchors || {};
            target.currentTab = source.currentTab || 'bear1';
        }

        // 3. 合并与删除独立活动
        // A. 提取常规的“更新/覆盖”活动 ID
        const actIds = selections.filter(s => s.startsWith('act_')).map(s => s.replace('act_', ''));
        if (actIds.length > 0) {
            target.activities = target.activities || [];
            source.activities = source.activities || [];
            target.activities = target.activities.filter(a => !actIds.includes(a.id));
            const actsToAdd = source.activities.filter(a => actIds.includes(a.id));
            target.activities.push(...actsToAdd);
        }

        // B. 【核心新增】：提取要求“删除”的云端活动 ID，并执行抹杀
        const delActIds = selections.filter(s => s.startsWith('del_act_')).map(s => s.replace('del_act_', ''));
        if (delActIds.length > 0 && target.activities) {
            target.activities = target.activities.filter(a => !delActIds.includes(a.id));
        }

        return target;
    }
};