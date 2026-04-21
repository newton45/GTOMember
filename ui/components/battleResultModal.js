class BattleResultModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
    }

    /**
     * @param {Object} activity 当前活动对象 (用于记录历史归属)
     * @param {Object} group 当前活动组对象 (提取参与人员)
     * @param {Array} allMembers 全部成员数据 (用于获取人员详情)
     */
    render(activity, group, allMembers) {
        this.activityId = activity.id;
        
        // 1. 获取组内所有成员的详细数据
        let participants = group.memberIds
            .map(id => allMembers.find(m => m.id === id))
            .filter(Boolean); // 过滤掉可能已被删除的脏数据

        // 2. 初始状态：强制根据正盟的 powerRank 进行排序，剔除空位
        participants.sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));

        const html = `
            <div class="modal modal-large" id="modal-battle-result">
                <div class="modal-header">
                    <h2>战果排名与出勤结算 - ${group.name}</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body battle-board-body">
                    
                    <div class="battle-main-section">
                        <h3>最终战果排名 (拖拽排序)</h3>
                        <p class="help-text">请将成员拖拽至下方对应状态栏，或在此区域内拖拽调整战绩名次。</p>
                        <div class="sortable-list battle-rank-list" id="list-battle" data-type="battle">
                            ${this.generateItemsHtml(participants)}
                        </div>
                    </div>

                    <div class="attendance-section">
                        <div class="attendance-col sub-col" data-type="substitute">
                            <h4 title="增加个人出勤率">替补参战 (算勤)</h4>
                            <div class="sortable-list" id="list-sub"></div>
                        </div>
                        <div class="attendance-col leave-col" data-type="leave">
                            <h4 title="不影响个人出勤率基数">请假/未参战 (豁免)</h4>
                            <div class="sortable-list" id="list-leave"></div>
                        </div>
                        <div class="attendance-col absent-col" data-type="absent">
                            <h4 title="降低个人出勤率">未请假缺席 (扣勤)</h4>
                            <div class="sortable-list" id="list-absent"></div>
                        </div>
                    </div>

                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">保存战果与出勤</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        
        this.bindEvents();
        this.updateRankNumbers(); // 初始化序号
    }

    generateItemsHtml(members) {
        return members.map(m => `
            <div class="member-entity rank-${m.rank} battle-item" draggable="true" data-id="${m.id}">
                <div class="entity-name">${m.nickname}</div>
                <div class="entity-info-index rank-number"></div>
                <div class="entity-rank">${m.rank}</div>
            </div>
        `).join('');
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();

        // --- 拖拽引擎 (原生 HTML5 Drag & Drop) ---
        const lists = this.container.querySelectorAll('.sortable-list');
        let draggedItem = null;

        lists.forEach(list => {
            // 开始拖拽
            list.ondragstart = (e) => {
                draggedItem = e.target.closest('.battle-item');
                if (draggedItem) {
                    setTimeout(() => draggedItem.classList.add('dragging'), 0);
                }
            };

            // 拖拽过程中的防抖与视觉反馈
            list.ondragover = (e) => {
                e.preventDefault();
                if (!draggedItem) return;
                
                const afterElement = this.getDragAfterElement(list, e.clientX, e.clientY);
                if (afterElement == null) {
                    list.appendChild(draggedItem);
                } else {
                    list.insertBefore(draggedItem, afterElement);
                }
            };

            // 拖拽结束
            list.ondragend = (e) => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                    draggedItem = null;
                    this.updateRankNumbers(); // 每次松手后，重新计算战果名次
                }
            };
        });

        // 保存逻辑：读取 DOM 结构，生成历史切片数据
        this.container.querySelector('[data-action="save"]').onclick = () => {
            this.save();
        };
    }

    // 辅助计算：在网格/列表中寻找应该插入到哪个元素的前面
    getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.battle-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            // 因为是横向/网格排布，我们需要综合考虑 X 和 Y 的偏移量
            const offset = x - (box.left + box.width / 2) + y - (box.top + box.height / 2);
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // 视觉刷新：只为在“战果区”的成员赋予名次编号
    updateRankNumbers() {
        const battleList = this.container.querySelector('#list-battle');
        const allItems = this.container.querySelectorAll('.battle-item');
        
        // 先清空所有名次显示
        allItems.forEach(item => {
            item.querySelector('.rank-number').innerText = '';
        });

        // 仅对主战果区的元素按顺序赋值
        const battleItems = battleList.querySelectorAll('.battle-item');
        battleItems.forEach((item, index) => {
            item.querySelector('.rank-number').innerText = `No.${index + 1}`;
        });
    }

    save() {
        const timestamp = Date.now();
        const historyUpdates = {}; // { memberId: historyRecordObject }

        // 提取并打包各个区域的数据
        const processList = (listId, statusType) => {
            const list = this.container.querySelector(`#${listId}`);
            if (!list) return;

            const items = list.querySelectorAll('.battle-item');
            items.forEach((item, index) => {
                const id = item.dataset.id;
                historyUpdates[id] = {
                    activityId: this.activityId,
                    date: timestamp,
                    type: statusType,
                    // 只有 statusType === 'battle' 时，rank 才有实际的整数值，否则为 null
                    rank: statusType === 'battle' ? (index + 1) : null 
                };
            });
        };

        processList('list-battle', 'battle');
        processList('list-sub', 'substitute');
        processList('list-leave', 'leave');
        processList('list-absent', 'absent');

        // 将组装好的数据抛出给主页面处理
        if (this.onSave) {
            this.onSave(historyUpdates);
        }
        
        this.close();
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}