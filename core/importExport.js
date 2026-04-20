/**
 * 成员管理系统 - 导入导出核心逻辑
 */
const ImportExport = {
    // 定义标准的数据结构（抬头规范）
    SCHEMA: {
        REQUIRED: ['id', 'nickname', 'rank'],
        OPTIONAL: ['pastNicknames', 'leftAlliance', 'powerRank']
    },

    // 导出逻辑：确保所有关联数据被序列化
    exportJSON: function(dataManager) {
        const members = dataManager.members.getAll();
        const dataStr = JSON.stringify(members, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `GTO_Members_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a); // 兼容某些浏览器的安全机制
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // 导入逻辑：包含抬头校验、空项过滤、差异报告
    importJSON: async function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const rawData = JSON.parse(e.target.result);
                    if (!Array.isArray(rawData)) throw new Error("无效的格式：预期为数组");

                    const report = {
                        success: true,
                        importedCount: 0,
                        skippedCount: 0,
                        missingHeaders: [],
                        extraHeaders: [],
                        data: []
                    };

                    // 1. 抬头校验 (取第一个有效项进行检查)
                    if (rawData.length > 0) {
                        const firstItemKeys = Object.keys(rawData[0]);
                        const allExpected = [...this.SCHEMA.REQUIRED, ...this.SCHEMA.OPTIONAL];
                        
                        report.missingHeaders = this.SCHEMA.REQUIRED.filter(k => !firstItemKeys.includes(k));
                        report.extraHeaders = firstItemKeys.filter(k => !allExpected.includes(k));
                    }

                    // 2. 数据清洗与过滤
                    report.data = rawData.filter(item => {
                        // 自动忽略空白项：必须有 ID 和 昵称
                        const isValid = item.id && item.nickname && item.id.toString().trim() !== "";
                        if (isValid) {
                            report.importedCount++;
                            return true;
                        } else {
                            report.skippedCount++;
                            return false;
                        }
                    }).map(item => {
                        // 过滤掉多余项，只保留 Schema 定义的字段
                        const cleanItem = {};
                        [...this.SCHEMA.REQUIRED, ...this.SCHEMA.OPTIONAL].forEach(key => {
                            cleanItem[key] = item[key] !== undefined ? item[key] : null;
                        });
                        return cleanItem;
                    });

                    resolve(report);
                } catch (err) {
                    reject(`解析失败: ${err.message}`);
                }
            };
            reader.readAsText(file);
        });
    }
};