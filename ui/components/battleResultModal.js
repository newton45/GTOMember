class BattleResultModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
        this.isAnimating = false;
        this.activityId = null;
        this.currentTeamNum = 1;
        this.currentGroupName = '';
        this.isContinuousSorting = false;
        this.currentSortTarget = null;
        this.allMembers = [];
    }

    render(activity, group, allMembers) {
        this.activityId = activity.id;
        this.currentTeamNum = group.name.includes('团 1') ? 1 : 2; 
        this.currentGroupName = group.name;
        this.isContinuousSorting = false;
        this.currentSortTarget = null;

        const members = group.memberIds.map(id => allMembers.find(m => m.id === id)).filter(Boolean);
        this.allMembers = members;

        const html = `
            <div class="modal modal-large" id="modal-battle-result">
                <div class="modal-header">
                    <h2>战果录入 - ${group.name}</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:13px; color:var(--gray-700); margin-bottom:15px; line-height: 1.6;">
                        在下方拖拽卡片进行战果排序（自左向右即为名次先后）。<br>
                        报但未参战人员请拖入对应的"请假/少人时替补未到"或"缺席"池。<br>
                        成员卡片 左上角 为近三场平均活动排名；<br>
                        成员卡片 右上角 为近三场<span class="attendance-tooltip-trigger">出勤率</span>；<br>
                        成员卡片 左下角 为盟内实力排名
                    </p>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <h4 style="margin: 0; border-left: 3px solid var(--primary); padding-left: 8px;">战果排名 (自左向右排列)</h4>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <input type="text" id="battle-search" placeholder="搜索成员..." style="padding: 4px 8px; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 12px; width: 160px;">
                            <button id="btn-battle-sort" class="btn" style="background: #18181b; color: white; border: none; padding: 4px 12px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer; white-space: nowrap;">⚡ 开始连续排序</button>
                        </div>
                    </div>
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
        return members.map(m => this.renderMemberCard(m)).join('');
    }

    renderMemberCard(m) {
        const battleRecords = m.activityHistory.filter(h => h.type === 'battle' && h.rank !== null);
        let avgRank = '-';
        if (battleRecords.length > 0) {
            const recent = battleRecords.slice(-3);
            avgRank = (recent.reduce((a, b) => a + b.rank, 0) / recent.length).toFixed(1);
        }

        const recentHistory = m.activityHistory.filter(h => h.type !== 'unparticipated').slice(-3);
        let missCount = 0;
        recentHistory.forEach(h => { 
            if (h.type === 'absent') missCount += 1;
            else if (h.type === 'leave') missCount += 0.5;
        });
        let attText = "-";
        if (recentHistory.length > 0) {
            if (missCount < 1) attText = "好";
            else if (missCount < 2) attText = "中";
            else if (missCount < 3) attText = "差";
            else attText = "死";
        }

        const isTarget = this.isContinuousSorting && this.isItemInBattleList(m.id)
            && this.getBattleItemIndex(m.id) === this.currentSortTarget - 1;

        return `
        <div class="member-entity rank-${m.rank} battle-item ${isTarget ? 'sorting-target' : ''}" data-id="${m.id}" draggable="true" style="margin:0;">
            <div class="top-left-badge">${avgRank}</div>
            <div class="top-right-badge">${attText}</div>
            <div class="entity-name">${m.nickname}</div>
            <div class="entity-info-index">${m.powerRank || ''}</div>
            <div class="entity-rank">${m.rank}</div>
        </div>
        `;
    }

    isItemInBattleList(id) {
        const battleList = this.container.querySelector('#list-battle');
        if (!battleList) return false;
        return !!battleList.querySelector(`.battle-item[data-id="${id}"]`);
    }

    getBattleItemIndex(id) {
        const battleList = this.container.querySelector('#list-battle');
        if (!battleList) return -1;
        const items = Array.from(battleList.querySelectorAll('.battle-item'));
        return items.findIndex(el => el.dataset.id === id);
    }

    toggleSortMode() {
        if (this.isContinuousSorting) {
            this.isContinuousSorting = false;
            this.currentSortTarget = null;
            this.updateSortButtonUI();
            this.refreshAllLists();
        } else {
            const maxCount = this.container.querySelectorAll('#list-battle .battle-item').length;
            const modalRoot = this.container.querySelector('#modal-battle-result .modal-body') || this.container;

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            overlay.innerHTML = `
                <div class="modal modal-selector" style="width: 320px; text-align: center; padding: 25px; position: relative;">
                    <h3 style="margin-top:0; margin-bottom: 15px;">⚡ 连续排序</h3>
                    <p style="font-size: 13px; color: var(--gray-600); margin-bottom: 15px;">请输入起始排名编号 (1-${maxCount}):</p>
                    <input type="number" id="battle-sort-start-input" min="1" max="${maxCount}" value="1" 
                           style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid var(--gray-300); border-radius: 4px; text-align: center; font-size: 16px;">
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn" id="btn-battle-sort-cancel" style="flex: 1;">取消</button>
                        <button class="btn btn-primary" id="btn-battle-sort-confirm" style="flex: 1;">锁定起跑线</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = overlay.querySelector('#battle-sort-start-input');
            setTimeout(() => input.focus(), 50);

            const closeOverlay = () => {
                overlay.remove();
            };

            overlay.querySelector('#btn-battle-sort-cancel').onclick = closeOverlay;

            overlay.querySelector('#btn-battle-sort-confirm').onclick = () => {
                let startPos = parseInt(input.value, 10);
                if (isNaN(startPos) || startPos < 1 || startPos > maxCount) {
                    alert(`⚠️ 请输入 1 到 ${maxCount} 之间的有效数字！`);
                    return;
                }
                
                this.isContinuousSorting = true;
                this.currentSortTarget = startPos;
                
                this.updateSortButtonUI();
                this.refreshAllLists();
                closeOverlay();
            };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') overlay.querySelector('#btn-battle-sort-confirm').click();
            };
        }
    }

    updateSortButtonUI() {
        const btn = this.container.querySelector('#btn-battle-sort');
        if (!btn) return;
        
        if (this.isContinuousSorting) {
            btn.innerText = "🛑 结束连续排序";
            btn.style.background = "#ef4444";
        } else {
            btn.innerText = "⚡ 开始连续排序";
            btn.style.background = "#18181b";
        }
    }

    handleContinuousSortClick(entity) {
        if (!entity || this.isAnimating) return;

        const id = entity.dataset.id;
        const battleList = this.container.querySelector('#list-battle');
        if (!battleList) return;

        const targetIndex = this.currentSortTarget - 1;
        const items = Array.from(battleList.querySelectorAll('.battle-item'));

        const clickedItem = items.find(el => el.dataset.id === id);
        if (!clickedItem) return;

        this.isAnimating = true;

        this.container.querySelectorAll('.battle-item.sorting-target').forEach(el => el.classList.remove('sorting-target'));

        this.applyStateWithAnimation(() => {
            if (clickedItem.parentNode !== battleList) {
                battleList.appendChild(clickedItem);
            }

            const currentItems = Array.from(battleList.querySelectorAll('.battle-item'));
            const currentIndex = currentItems.indexOf(clickedItem);

            if (currentIndex !== targetIndex) {
                if (targetIndex >= currentItems.length) {
                    battleList.appendChild(clickedItem);
                } else {
                    const referenceItem = currentItems[targetIndex];
                    if (clickedItem === referenceItem) return;
                    battleList.insertBefore(clickedItem, referenceItem);
                }
            }
        });

        setTimeout(() => {
            this.isAnimating = false;

            this.currentSortTarget++;
            const totalInBattle = this.container.querySelectorAll('#list-battle .battle-item').length;

            if (this.currentSortTarget > totalInBattle) {
                alert('🏁 连续排序自动结束。');
                this.isContinuousSorting = false;
                this.currentSortTarget = null;
                this.updateSortButtonUI();
            }

            this.refreshAllLists();
        }, 400);
    }

    refreshAllLists() {
        const searchInput = this.container.querySelector('#battle-search');
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        this.applySearchHighlight(query);
        this.updateSortingTargetHighlight();
    }

    applySearchHighlight(query) {
        const allItems = this.container.querySelectorAll('.battle-item');
        const q = query;

        allItems.forEach(item => {
            const id = item.dataset.id;
            const m = this.allMembers.find(mem => mem.id === id);
            if (!m) { item.classList.remove('search-match'); return; }

            if (!q) { item.classList.remove('search-match'); return; }

            const basicMatch = 
                m.nickname.toLowerCase().includes(q) || 
                m.id.toLowerCase().includes(q) || 
                (m.rank && m.rank.toLowerCase().includes(q)) ||
                (m.pastNicknames && m.pastNicknames.some(pn => pn.toLowerCase().includes(q)));

            let pinyinMatch = false;
            if (typeof PinyinMatch !== 'undefined') {
                pinyinMatch = PinyinMatch.match(m.nickname, q) || 
                              (m.pastNicknames && m.pastNicknames.some(pn => PinyinMatch.match(pn, q)));
            }

            item.classList.toggle('search-match', basicMatch || pinyinMatch);
        });
    }

    updateSortingTargetHighlight() {
        this.container.querySelectorAll('.battle-item.sorting-target').forEach(el => el.classList.remove('sorting-target'));

        if (!this.isContinuousSorting) return;

        const battleList = this.container.querySelector('#list-battle');
        if (!battleList) return;

        const items = Array.from(battleList.querySelectorAll('.battle-item'));
        const targetIndex = this.currentSortTarget - 1;
        if (targetIndex >= 0 && targetIndex < items.length) {
            items[targetIndex].classList.add('sorting-target');
        }
    }

    applyStateWithAnimation(logicFn) {
        const entities = Array.from(this.container.querySelectorAll('.battle-item'));
        const firstRects = new Map();
        entities.forEach(el => firstRects.set(el.dataset.id, el.getBoundingClientRect()));

        logicFn();

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
                        void el.offsetHeight;
                        el.style.transition = 'transform 300ms cubic-bezier(0.25, 0.8, 0.25, 1)';
                        el.style.transform = 'translate(0, 0)';
                    });
                }
            }
        });

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
            e.preventDefault();
            const list = e.target.closest('.sortable-list');
            
            if (list && draggedItem) {
                list.classList.add('drag-over');
                const afterElement = this.getDragAfterElement(list, e.clientX, e.clientY);
                
                const currentNext = draggedItem.nextElementSibling;
                const currentParent = draggedItem.parentNode;
                
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

        const sortBtn = this.container.querySelector('#btn-battle-sort');
        if (sortBtn) {
            sortBtn.onclick = () => this.toggleSortMode();
        }

        const searchInput = this.container.querySelector('#battle-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.applySearchHighlight(e.target.value.toLowerCase().trim());
            };
        }

        this.container.addEventListener('click', (e) => {
            if (!this.isContinuousSorting) return;

            const entity = e.target.closest('.battle-item');
            if (!entity) return;

            e.stopPropagation();
            this.handleContinuousSortClick(entity);
        });
    }

    save() {
        const timestamp = Date.now();
        const historyUpdates = {};

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
