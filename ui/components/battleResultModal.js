class BattleResultModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
        this.isAnimating = false;
        this.activityId = null;
        this.currentTeamNum = 1;
        this.currentGroupName = '';
    }

    render(activity, group, allMembers) {
        this.activityId = activity.id;
        this.currentTeamNum = group.name.includes('团 1') ? 1 : 2; 
        this.currentGroupName = group.name;

        // 提取组内成员并生成 DOM 数据
        const members = group.memberIds.map(id => allMembers.find(m => m.id === id)).filter(Boolean);

        const html = `
            <div class="modal modal-large" id="modal-battle-result">
                <div class="modal-header">
                    <h2>战果录入 - ${group.name}</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:13px; color:var(--gray-700); margin-bottom:15px; line-height: 1.6;">
                        在下方拖拽卡片进行战果排序（自左向右即为名次先后）。<br>
                        报但未参战人员请拖入对应的“请假/少人时替补未到”或“缺席”池。<br>
                        成员卡片 左上角 为近三场平均活动排名；<br>
                        成员卡片 右上角 为近三场<span class="attendance-tooltip-trigger">出勤率</span>；<br>
                        成员卡片 左下角 为盟内实力排名
                    </p>
                    
                    <h4 style="margin-bottom: 8px; border-left: 3px solid var(--primary); padding-left: 8px;">战果排名 (自左向右排列)</h4>
                    <div class="group-members-row sortable-list" id="list-battle" data-drop-target="battle" style="min-height: 70px; background: #fff; margin-bottom: 25px; border: 1px solid var(--gray-200);">
                        ${this.renderList(members)}
                    </div>

                    <h4 style="margin-bottom: 8px; border-left: 3px solid var(--warning); padding-left: 8px; color: var(--gray-700);">请假，或少人时替补未到，出勤率-0.5</h4>
                    <div class="group-members-row sortable-list" id="list-leave" data-drop-target="leave" style="min-height: 70px; background: var(--gray-50); border: 1px dashed var(--warning); margin-bottom: 25px;">
                        </div>

                    <h4 style="margin-bottom: 8px; border-left: 3px solid var(--danger); padding-left: 8px; color: var(--gray-700);">缺席，出勤率-1</h4>
                    <div class="group-members-row sortable-list" id="list-absent" data-drop-target="absent" style="min-height: 70px; background: var(--gray-50); border: 1px dashed var(--danger);">
                        </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">保存战果</button>
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        this.initDragAndDrop();
    }

    renderList(members) {
        return members.map(m => {
            // 左上角：近三场平均排名
            const battleRecords = m.activityHistory.filter(h => h.type === 'battle' && h.rank !== null);
            let avgRank = '-';
            if (battleRecords.length > 0) {
                const recent = battleRecords.slice(-3);
                avgRank = (recent.reduce((a, b) => a + b.rank, 0) / recent.length).toFixed(1);
            }

            // 右上角：出勤率文字判定（忽略未参战记录）
            const recentHistory = m.activityHistory.filter(h => h.type !== 'unparticipated').slice(-3);
            let missCount = 0;
            recentHistory.forEach(h => { 
                if (h.type === 'absent') missCount += 1;          // 缺席扣 1
                else if (h.type === 'leave') missCount += 0.5;    // 请假扣 0.5
            });
            let attText = "-";
            if (recentHistory.length > 0) {
                if (missCount < 1) attText = "好";
                else if (missCount < 2) attText = "中";
                else if (missCount <3) attText = "差";
                else attText = "死";
            }

            return `
            <div class="member-entity rank-${m.rank} battle-item" data-id="${m.id}" draggable="true" style="margin:0;">
                <div class="top-left-badge">${avgRank}</div>
                <div class="top-right-badge">${attText}</div>
                <div class="entity-name">${m.nickname}</div>
                <div class="entity-info-index">${m.powerRank || ''}</div>
                <div class="entity-rank">${m.rank}</div>
            </div>
            `;
        }).join('');
    }

    // --- 核心：实时 FLIP 排队挤压动画引擎 ---
    applyStateWithAnimation(logicFn) {
        const entities = Array.from(this.container.querySelectorAll('.battle-item'));
        const firstRects = new Map();
        // 1. 记录所有卡片原本的位置
        entities.forEach(el => firstRects.set(el.dataset.id, el.getBoundingClientRect()));

        // 2. 瞬间移动 DOM 节点
        logicFn();

        // 3. 记录新位置并计算位移，倒置后执行顺滑过渡
        const newEntities = Array.from(this.container.querySelectorAll('.battle-item'));
        newEntities.forEach(el => {
            const oldRect = firstRects.get(el.dataset.id);
            if (oldRect) {
                const newRect = el.getBoundingClientRect();
                const dx = oldRect.left - newRect.left;
                const dy = oldRect.top - newRect.top;
                if (dx !== 0 || dy !== 0) {
                    el.style.transition = 'none';
                    el.style.transform = `translate(${dx}px, ${dy}px)`;
                    requestAnimationFrame(() => {
                        void el.offsetHeight; // 强制回流
                        el.style.transition = 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1)';
                        el.style.transform = 'translate(0, 0)';
                    });
                }
            }
        });

        // 4. 动画结束后清理行迹
        setTimeout(() => {
            newEntities.forEach(el => { el.style.transition = ''; el.style.transform = ''; });
        }, 320);
    }

    initDragAndDrop() {
        let draggedItem = null;

        this.container.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.battle-item');
            if (item) {
                draggedItem = item;
                setTimeout(() => item.classList.add('dragging'), 0);
            }
        });

        this.container.addEventListener('dragend', (e) => {
            if (draggedItem) draggedItem.classList.remove('dragging');
            draggedItem = null;
            this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        this.container.addEventListener('dragover', (e) => {
            e.preventDefault(); // 必须阻止默认行为以允许 drop
            const list = e.target.closest('.sortable-list');
            
            if (list && draggedItem) {
                list.classList.add('drag-over');
                const afterElement = this.getDragAfterElement(list, e.clientX, e.clientY);
                
                const currentNext = draggedItem.nextElementSibling;
                const currentParent = draggedItem.parentNode;
                
                // 【核心逻辑】：只有当鼠标移动导致了物理排序需要改变时，才触发 FLIP 动画，杜绝高频闪烁
                if (currentParent !== list || currentNext !== afterElement) {
                    this.applyStateWithAnimation(() => {
                        if (afterElement == null) {
                            list.appendChild(draggedItem);
                        } else {
                            list.insertBefore(draggedItem, afterElement);
                        }
                    });
                }
            }
        });

        this.container.addEventListener('dragleave', (e) => {
            const list = e.target.closest('.sortable-list');
            if (list) list.classList.remove('drag-over');
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
    }

    // 智能计算鼠标目前悬浮在哪个卡片的“前面”或“后面”
    getDragAfterElement(container, x, y) {
        const draggableElements = [...container.querySelectorAll('.battle-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const boxCenterY = box.top + box.height / 2;
            const inSameRow = y >= box.top && y <= box.bottom;
            
            if (inSameRow) {
                const offset = x - (box.left + box.width / 2);
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                }
            } else if (y < box.top) {
                const offset = y - boxCenterY;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                }
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="save"]').onclick = () => this.save();
    }

    save() {
        const timestamp = Date.now();
        const historyUpdates = {};

        // 遍历三个池子，映射出不同的出勤与战果状态
        const lists = [
            { id: 'list-battle', type: 'battle' },
            { id: 'list-leave', type: 'leave' },
            { id: 'list-absent', type: 'absent' }
        ];

        lists.forEach(config => {
            const list = this.container.querySelector(`#${config.id}`);
            if (list) {
                list.querySelectorAll('.battle-item').forEach((item, index) => {
                    historyUpdates[item.dataset.id] = {
                        activityId: this.activityId,
                        date: timestamp,
                        type: config.type,
                        rank: config.type === 'battle' ? (index + 1) : null,
                        team: this.currentTeamNum,
                        groupName: this.currentGroupName
                    };
                });
            }
        });

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