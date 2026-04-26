/* ui/pages/activitiesPage.js */
class ActivitiesPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.container = document.getElementById('page-activities');
        this.modalContainer = modalContainer;

        this.renameActModal = new RenameActivityModal(modalContainer);
        this.createActModal = new CreateActivityModal(modalContainer);
        this.selectorModal = new MemberSelectorModal(modalContainer);
        this.allocationModal = new TeamAllocationModal(modalContainer);
        this.clearHistoryModal = new ClearHistoryModal(modalContainer);
        this.battleModal = new BattleResultModal(modalContainer);
        
        this.currentActivityId = null;
        this.currentTeamTab = 1;
        this.isAnimating = false;
        this.init();
    }

    init() {
        this.render();
        this.bindGlobalEvents();
        this.initDragAndDrop();
    }

    // 幽灵数据 GC 与排他性分配
    syncActiveMembers(act) {
        if (!act) return;
        
        const allActive = this.dataManager.members.getAll().filter(m => !m.leftAlliance);
        const validActiveIds = new Set(allActive.map(m => m.id));
        const assignedToGroup = new Set();

        [act.team1, act.team2].forEach(team => {
            team.groups.forEach(g => {
                g.memberIds = g.memberIds.filter(id => validActiveIds.has(id));
                g.substituteIds = (g.substituteIds || []).filter(id => validActiveIds.has(id));
                g.memberIds.forEach(id => assignedToGroup.add(id));
                if (g.leaderId && !validActiveIds.has(g.leaderId)) g.leaderId = null;
            });
        });

        [act.team1, act.team2].forEach(team => {
            const cleanPool = team.unassignedIds.filter(id => validActiveIds.has(id) && !assignedToGroup.has(id));
            team.unassignedIds = Array.from(new Set(cleanPool));
        });

        const allAssignedOrPooled = new Set(assignedToGroup);
        act.team1.unassignedIds.forEach(id => allAssignedOrPooled.add(id));
        act.team2.unassignedIds.forEach(id => allAssignedOrPooled.add(id));

        allActive.forEach(m => {
            if (!allAssignedOrPooled.has(m.id)) {
                const lastRecord = m.activityHistory && m.activityHistory[m.activityHistory.length - 1];
                if (lastRecord && lastRecord.team === 2) {
                    act.team2.unassignedIds.push(m.id);
                } else {
                    act.team1.unassignedIds.push(m.id);
                }
            }
        });
    }

    saveAndRefresh() {
        const canvas = this.container.querySelector('.activity-canvas');
        const scrollTop = canvas ? canvas.scrollTop : 0;
        
        this.dataManager.save();
        this.render();
        
        const newCanvas = this.container.querySelector('.activity-canvas');
        if (newCanvas) newCanvas.scrollTop = scrollTop;
    }

    // 核心：FLIP 动画引擎
    applyStateWithAnimation(logicFn, dragData = null) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const canvas = this.container.querySelector('.activity-canvas');
        const scrollTop = canvas ? canvas.scrollTop : 0;

        const entities = Array.from(this.container.querySelectorAll('.member-entity'));
        const firstPositions = new Map();
        
        entities.forEach(el => {
            if (dragData && dragData.draggedId === el.dataset.id) {
                firstPositions.set(el.dataset.id, {
                    left: dragData.dropEvent.clientX - dragData.dragOffset.x,
                    top: dragData.dropEvent.clientY - dragData.dragOffset.y
                });
            } else {
                firstPositions.set(el.dataset.id, el.getBoundingClientRect());
            }
        });

        logicFn();
        this.dataManager.save();
        this.render();
        
        const newCanvas = this.container.querySelector('.activity-canvas');
        if (newCanvas) newCanvas.scrollTop = scrollTop;

        const lastEntities = Array.from(this.container.querySelectorAll('.member-entity'));
        
        lastEntities.forEach(el => {
            const firstPos = firstPositions.get(el.dataset.id);
            if (firstPos) {
                const lastPos = el.getBoundingClientRect();
                const dx = firstPos.left - lastPos.left;
                const dy = firstPos.top - lastPos.top;

                if (dx !== 0 || dy !== 0) {
                    el.style.setProperty('transition', 'none', 'important');
                    el.style.setProperty('transform', `translate(${dx}px, ${dy}px)`, 'important');

                    requestAnimationFrame(() => {
                        void el.offsetHeight;
                        el.style.setProperty('transition', 'transform 400ms cubic-bezier(0.25, 0.8, 0.25, 1)', 'important');
                        el.style.setProperty('transform', 'translate(0, 0)', 'important');
                    });
                }
            } else {
                el.style.setProperty('opacity', '0', 'important');
                requestAnimationFrame(() => {
                    el.style.setProperty('transition', 'opacity 400ms ease', 'important');
                    el.style.setProperty('opacity', '1', 'important');
                });
            }
        });

        setTimeout(() => {
            lastEntities.forEach(el => {
                el.style.removeProperty('transition');
                el.style.removeProperty('transform');
                el.style.removeProperty('opacity');
            });
            this.isAnimating = false;
        }, 450);
    }

    render() {
        const activities = this.dataManager.activities.getAll();
        if (!this.currentActivityId && activities.length > 0) this.currentActivityId = activities[0].id;
        
        const act = this.dataManager.activities.findById(this.currentActivityId);
        if (act) this.syncActiveMembers(act);

        this.container.innerHTML = `
            <div class="activities-layout-vertical page-activities">
                <div class="activity-topbar">
                    <div class="topbar-left">
                        <span class="topbar-label">活动：</span>
                        <select id="activity-selector">
                            ${activities.map(a => `<option value="${a.id}" ${a.id === this.currentActivityId ? 'selected' : ''}>${a.name}</option>`).join('')}
                        </select>
                        <button class="btn-square btn-primary" data-action="add-act" title="新建活动">+</button>
                        ${act ? `<button class="btn-square btn-warning" data-action="rename-act" style="font-size: 14px;" title="重命名活动">R</button>` : ''}
                        ${act ? `<button class="btn-square btn-danger" data-action="delete-act" title="删除活动">&times;</button>` : ''}
                    </div>
                </div>
                <main class="activity-canvas">
                    ${act ? this.renderActivityDetail(act) : '<div class="canvas-placeholder"><p>点击上方 + 号新建一个活动</p></div>'}
                </main>
            </div>
        `;
    }

    renderActivityDetail(act) {
        return `
            <div class="team-content-area">${this.renderTeam(act, this.currentTeamTab)}</div>
            <div class="export-section">
                <button class="btn btn-primary btn-copy" data-action="copy-text">复制</button>
                <textarea id="export-text" class="export-textarea" readonly>${this.generateExportText(act)}</textarea>
            </div>
        `;
    }

    renderTeam(act, teamNum) {
        const team = teamNum === 1 ? act.team1 : act.team2;
        return `
            <div class="team-panel" data-team="${teamNum}">
                <div class="team-sub-header">
                    <div class="team-nav-group">
                        <button class="btn-tab ${this.currentTeamTab === 1 ? 'active' : ''}" data-action="switch-team" data-team="1">团 1</button>
                        <button class="btn-tab ${this.currentTeamTab === 2 ? 'active' : ''}" data-action="switch-team" data-team="2">团 2</button>
                    </div>
                    <input type="text" class="activity-desc-inline" value="${act.description || ''}" data-field="description" placeholder="点击输入活动说明...">
                    <div class="team-ops">
                        <button class="btn btn-primary btn-xs" data-action="add-group">新增活动组</button>
                        <button class="btn btn-warning btn-xs" data-action="team-battle-result">战果录入</button>
                        <button class="btn btn-danger btn-xs" data-action="clear-history">删某人记录</button>
                    </div>
                </div>
                <div class="full-width-groups">
                    ${team.groups.map((g, i) => this.renderGroup(g, i, teamNum)).join('')}
                </div>
                <div class="waiting-pool-box">
                    <h5>团 ${teamNum} 待选池 （ 可拖拽至上方活动组, 点击成员方块右上角可切换团号 ）</h5>
                    <div class="waiting-pool" data-drop-target="pool">
                        ${this.renderMembersInActivity(team.unassignedIds, null, [], 'pool', teamNum, 'pool')}
                    </div>
                </div>
            </div>
        `;
    }

    renderGroup(group, index, teamNum) {
        return `
            <div class="activity-group-full" data-team="${teamNum}" data-group-index="${index}">
                <div class="btn-group-del" data-action="delete-group" title="删除该组">&times;</div>
                <div class="group-title-row">
                    <input type="text" class="group-name-edit" value="${group.name}" placeholder="活动组名" data-action="edit-group-name">
                    <input type="text" class="group-desc-edit" value="${group.description === '无' ? '' : group.description}" placeholder="点击输入小组说明..." data-action="edit-group-desc">
                </div>
                <div class="group-members-row" data-drop-target="group" data-group-index="${index}">
                    <div class="add-member-square" data-action="show-selector" title="多选添加组员"></div>
                    ${this.renderMembersInActivity(group.memberIds, group.leaderId, group.substituteIds || [], 'group', teamNum, index)}
                </div>
            </div>
        `;
    }

    renderMembersInActivity(memberIds, leaderId = null, substituteIds = [], context = 'group', teamNum, groupIdx) {
        const members = memberIds.map(id => this.dataManager.members.findById(id)).filter(Boolean);
        
        // 【核心修复】：三级排序策略 (组长优先 > 替补最后 > 战力排序)
        members.sort((a, b) => {
            // 1. 组长强制第一
            if (a.id === leaderId && b.id !== leaderId) return -1;
            if (b.id === leaderId && a.id !== leaderId) return 1;
            
            // 2. 替补强制最后
            const aIsSub = substituteIds.includes(a.id);
            const bIsSub = substituteIds.includes(b.id);
            if (aIsSub && !bIsSub) return 1;
            if (!aIsSub && bIsSub) return -1;
            
            // 3. 常规成员按战力排
            return (a.powerRank || 999) - (b.powerRank || 999);
        });

        return members.map(m => {
            const isLeader = m.id === leaderId;
            const isSubstitute = substituteIds.includes(m.id);
            
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

            const actionBtn = context === 'pool' 
                ? `<div class="btn-switch-team" data-action="switch-team-pool" title="移至另一团">➔</div>`
                : `<div class="btn-remove-down" data-action="remove-from-group" title="移出活动组">↓</div>`;

            return `
            <div class="member-entity rank-${m.rank} ${isLeader ? 'leader-style' : ''} ${isSubstitute ? 'substitute-style' : ''}" 
                 data-id="${m.id}" draggable="true" data-source-team="${teamNum}" data-source-group="${groupIdx}">
                <div class="leader-badge">组长</div>
                ${isSubstitute ? `<div class="substitute-badge">替补</div>` : ''}
                ${actionBtn}
                <div class="top-left-badge">${avgRank}</div>
                <div class="top-right-badge">${attText}</div>
                <div class="entity-name">${m.nickname}</div>
                <div class="entity-info-index">${m.powerRank || ''}</div>
                <div class="entity-rank">${m.rank}</div>
            </div>
            `;
        }).join('');
    }

    initDragAndDrop() {
        let draggedMemberId = null;
        let dragSource = null;
        let dragOffset = { x: 0, y: 0 }; 

        this.container.addEventListener('dragstart', (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) {
                draggedMemberId = entity.dataset.id;
                dragSource = { team: parseInt(entity.dataset.sourceTeam), groupIndex: entity.dataset.sourceGroup };
                const rect = entity.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                setTimeout(() => entity.classList.add('dragging'), 0);
            }
        });

        this.container.addEventListener('dragend', (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) entity.classList.remove('dragging');
            draggedMemberId = null;
            this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        this.container.addEventListener('dragover', (e) => {
            if (this.isAnimating) return;
            e.preventDefault();
            const targetContainer = e.target.closest('[data-drop-target]');
            if (targetContainer) targetContainer.classList.add('drag-over');
        });

        this.container.addEventListener('dragleave', (e) => {
            const targetContainer = e.target.closest('[data-drop-target]');
            if (targetContainer) targetContainer.classList.remove('drag-over');
        });

        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            if (this.isAnimating) return;
            this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (!draggedMemberId) return;

            const targetContainer = e.target.closest('[data-drop-target]');
            if (!targetContainer) return;

            const act = this.dataManager.activities.findById(this.currentActivityId);
            if (!act) return;

            this.applyStateWithAnimation(() => {
                const sourceTeamObj = dragSource.team === 1 ? act.team1 : act.team2;
                if (dragSource.groupIndex === 'pool') {
                    sourceTeamObj.unassignedIds = sourceTeamObj.unassignedIds.filter(id => id !== draggedMemberId);
                } else {
                    const gIdx = parseInt(dragSource.groupIndex);
                    sourceTeamObj.groups[gIdx].memberIds = sourceTeamObj.groups[gIdx].memberIds.filter(id => id !== draggedMemberId);
                    if (sourceTeamObj.groups[gIdx].leaderId === draggedMemberId) sourceTeamObj.groups[gIdx].leaderId = null;
                    if (sourceTeamObj.groups[gIdx].substituteIds) {
                        sourceTeamObj.groups[gIdx].substituteIds = sourceTeamObj.groups[gIdx].substituteIds.filter(id => id !== draggedMemberId);
                    }
                }

                const targetTeamObj = this.currentTeamTab === 1 ? act.team1 : act.team2;
                if (targetContainer.dataset.dropTarget === 'pool') {
                    if (!targetTeamObj.unassignedIds.includes(draggedMemberId)) targetTeamObj.unassignedIds.push(draggedMemberId);
                } else {
                    const targetGIdx = parseInt(targetContainer.dataset.groupIndex);
                    if (!targetTeamObj.groups[targetGIdx].memberIds.includes(draggedMemberId)) {
                        targetTeamObj.groups[targetGIdx].memberIds.push(draggedMemberId);
                    }
                }
            }, { dropEvent: e, draggedId: draggedMemberId, dragOffset: dragOffset });
        });
    }

    bindGlobalEvents() {
        // 【核心修复】：拦截右键 (扩大屏蔽范围至整个活动组，防止点快了穿透)
        this.container.addEventListener('contextmenu', (e) => {
            const groupCard = e.target.closest('.activity-group-full');
            if (groupCard) {
                e.preventDefault(); // 只要在小组面板内右键，绝对不弹出浏览器系统菜单
                
                const entity = e.target.closest('.member-entity');
                if (entity && !this.isAnimating) {
                    const act = this.dataManager.activities.findById(this.currentActivityId);
                    const group = (groupCard.dataset.team == 1 ? act.team1 : act.team2).groups[groupCard.dataset.groupIndex];
                    
                    this.applyStateWithAnimation(() => {
                        group.substituteIds = group.substituteIds || [];
                        const id = entity.dataset.id;
                        
                        if (group.substituteIds.includes(id)) {
                            // 取消替补
                            group.substituteIds = group.substituteIds.filter(sId => sId !== id);
                        } else {
                            // 设为替补
                            group.substituteIds.push(id);
                            // 【互斥逻辑】：如果已经是组长，撤销组长身份
                            if (group.leaderId === id) group.leaderId = null;
                        }
                    });
                }
            }
        });

        this.container.addEventListener('input', (e) => {
            const act = this.dataManager.activities.findById(this.currentActivityId);
            if (!act) return;

            if (e.target.classList.contains('group-name-edit') || e.target.classList.contains('group-desc-edit')) {
                const card = e.target.closest('.activity-group-full');
                if (card) {
                    const group = (card.dataset.team == 1 ? act.team1 : act.team2).groups[card.dataset.groupIndex];
                    if (e.target.classList.contains('group-name-edit')) group.name = e.target.value;
                    if (e.target.classList.contains('group-desc-edit')) group.description = e.target.value;
                    this.dataManager.save(); 
                }
            } else if (e.target.dataset.field) {
                act[e.target.dataset.field] = e.target.value;
                this.dataManager.save();
            }

            const exportArea = this.container.querySelector('#export-text');
            if (exportArea) exportArea.value = this.generateExportText(act);
        });

        this.container.addEventListener('change', (e) => {
            if (e.target.id === 'activity-selector') {
                this.currentActivityId = e.target.value;
                this.render();
            }
        });

        this.container.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            const act = this.dataManager.activities.findById(this.currentActivityId);
            
            // 左键点击卡片 (设置/取消组长)
            const entity = e.target.closest('.member-entity');
            if (entity && !actionBtn && !this.isAnimating) {
                const groupCard = entity.closest('.activity-group-full');
                if (groupCard) {
                    const group = (groupCard.dataset.team == 1 ? act.team1 : act.team2).groups[groupCard.dataset.groupIndex];
                    this.applyStateWithAnimation(() => {
                        const id = entity.dataset.id;
                        if (group.leaderId === id) {
                            group.leaderId = null;
                        } else {
                            group.leaderId = id;
                            // 【互斥逻辑】：如果已经是替补，撤销替补身份
                            if (group.substituteIds) {
                                group.substituteIds = group.substituteIds.filter(sId => sId !== id);
                            }
                        }
                    });
                    return;
                }
            }

            if (!actionBtn || this.isAnimating) return;
            const action = actionBtn.dataset.action;

            switch (action) {
                case 'switch-team':
                    this.currentTeamTab = parseInt(actionBtn.dataset.team);
                    this.render();
                    break;
                case 'add-group':
                    const team = this.currentTeamTab === 1 ? act.team1 : act.team2;
                    team.groups.push(new ActivityGroup({ name: `组${team.groups.length + 1}` }));
                    this.saveAndRefresh();
                    break;
                case 'delete-group':
                    this.applyStateWithAnimation(() => {
                        const gCard = actionBtn.closest('.activity-group-full');
                        const groupIdx = gCard.dataset.groupIndex;
                        const teamObj = this.currentTeamTab == 1 ? act.team1 : act.team2;
                        teamObj.unassignedIds.push(...teamObj.groups[groupIdx].memberIds);
                        teamObj.groups.splice(groupIdx, 1);
                    });
                    break;
                case 'switch-team-pool':
                    this.applyStateWithAnimation(() => {
                        const mId = entity.dataset.id;
                        if (act.team1.unassignedIds.includes(mId)) {
                            act.team1.unassignedIds = act.team1.unassignedIds.filter(id => id !== mId);
                            act.team2.unassignedIds.push(mId);
                        } else if (act.team2.unassignedIds.includes(mId)) {
                            act.team2.unassignedIds = act.team2.unassignedIds.filter(id => id !== mId);
                            act.team1.unassignedIds.push(mId);
                        }
                    });
                    break;
                case 'remove-from-group':
                    this.applyStateWithAnimation(() => {
                        this.handleRemoveMember(entity.dataset.id);
                    });
                    break;
                case 'team-battle-result':
                    this.handleTeamBattleResult(act);
                    break;
                case 'show-selector':
                    this.handleShowSelector(actionBtn);
                    break;
                case 'add-act':
                    this.createActModal.onSave = (d) => {
                        const newA = new Activity({ name: d.name, hasTeam2: true });
                        this.dataManager.activities.add(newA);
                        this.currentActivityId = newA.id;
                        this.currentTeamTab = 1;
                        this.render();
                    };
                    this.createActModal.render();
                    break;
                case 'delete-act':
                    if (confirm(`确定彻底删除活动“${act.name}”？`)) {
                        this.dataManager.activities.remove(act.id);
                        this.currentActivityId = null;
                        this.render();
                    }
                    break;
                case 'clear-history':
                    this.clearHistoryModal.onConfirm = (ids) => {
                        ids.forEach(id => {
                            const m = this.dataManager.members.findById(id);
                            if(m) m.activityHistory = [];
                        });
                        this.dataManager.save();
                        this.render();
                    };
                    this.clearHistoryModal.render(this.dataManager.members.getAll());
                    break;
                case 'rename-act':
                    if (!act) return;
                    this.renameActModal.onSave = (newName) => {
                        act.name = newName;
                        this.saveAndRefresh();
                    };
                    this.renameActModal.render(act.name);
                    break;
                
                // 【新增】：处理底部的复制按钮与动态提示
                case 'copy-text':
                    const exportArea = this.container.querySelector('#export-text');
                    if (exportArea) {
                        exportArea.select();
                        // 兼容性极佳的复制命令
                        document.execCommand('copy'); 
                        
                        // 按钮状态反馈
                        const originalText = actionBtn.innerText;
                        const originalBg = actionBtn.style.background;
                        
                        actionBtn.innerText = '✅ 已复制';
                        actionBtn.style.background = '#10b981'; // 变绿
                        actionBtn.style.color = '#fff';
                        
                        // 1.5秒后恢复原状
                        setTimeout(() => {
                            actionBtn.innerText = originalText;
                            actionBtn.style.background = originalBg;
                        }, 1500);
                    }
                    break;
            }
        });
    }

    handleShowSelector(btn) {
        const act = this.dataManager.activities.findById(this.currentActivityId);
        const card = btn.closest('.activity-group-full');
        const team = this.currentTeamTab === 1 ? act.team1 : act.team2;
        const group = team.groups[card.dataset.groupIndex];
        
        const available = team.unassignedIds
            .map(id => this.dataManager.members.findById(id))
            .filter(Boolean)
            .sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));
        
        this.selectorModal.onConfirm = (ids) => {
            this.applyStateWithAnimation(() => {
                group.memberIds.push(...ids);
                team.unassignedIds = team.unassignedIds.filter(id => !ids.includes(id));
            });
        };
        this.selectorModal.render(available);
    }

    handleRemoveMember(mId) {
        const act = this.dataManager.activities.findById(this.currentActivityId);
        [act.team1, act.team2].forEach(team => {
            team.groups.forEach(g => {
                if (g.memberIds.includes(mId)) {
                    g.memberIds = g.memberIds.filter(id => id !== mId);
                    if (g.leaderId === mId) g.leaderId = null;
                    if (g.substituteIds) g.substituteIds = g.substituteIds.filter(id => id !== mId);
                    team.unassignedIds.push(mId);
                }
            });
        });
    }

    handleTeamBattleResult(act) {
        const team = this.currentTeamTab === 1 ? act.team1 : act.team2;
        const allIds = team.groups.reduce((acc, g) => acc.concat(g.memberIds), []);
        if (allIds.length === 0) return alert('当前团内没有任何参与人员。');

        this.battleModal.onSave = (updates) => {
            Object.entries(updates).forEach(([id, rec]) => {
                const m = this.dataManager.members.findById(id);
                if (m) m.activityHistory.push(rec);
            });
            this.dataManager.save();
            this.render();
        };
        this.battleModal.render(act, { name: `团${this.currentTeamTab}全员`, memberIds: allIds }, this.dataManager.members.getAll());
    }

    generateExportText(act) {
        if (!act) return "";
        const teamNum = this.currentTeamTab;
        const team = teamNum === 1 ? act.team1 : act.team2;
        
        const headerTitle = `【${act.name}-团${teamNum}】`;
        const actDesc = (act.description && act.description.trim() !== '') ? act.description.trim() : '';
        let text = actDesc ? `${headerTitle}：${actDesc}\n` : `${headerTitle}\n`;

        team.groups.forEach(g => {
            const members = g.memberIds.map(id => this.dataManager.members.findById(id)).filter(Boolean);
            const leader = members.find(m => m.id === g.leaderId);
            const substitutes = members.filter(m => (g.substituteIds || []).includes(m.id) && m.id !== g.leaderId);
            const others = members.filter(m => m.id !== g.leaderId && !(g.substituteIds || []).includes(m.id));
            
            let memberStrs = [];
            // 【核心修复】：调整 push 的顺序为 组长 -> 成员 -> 替补
            if (leader) memberStrs.push(`组长 - ${leader.nickname}`);
            if (others.length > 0) memberStrs.push(`成员 - ${others.map(m => m.nickname).join('、')}`);
            if (substitutes.length > 0) memberStrs.push(`替补 - ${substitutes.map(m => m.nickname).join('、')}`);
            
            const memberText = memberStrs.join('；');

            const gDesc = (g.description && g.description.trim() !== '' && g.description !== '无') ? g.description.trim() : '';
            if (gDesc) {
                text += `【${g.name}】：${gDesc}\n${memberText}\n`;
            } else {
                text += `【${g.name}】：${memberText}\n`;
            }
        });
        
        return text.trim();
    }
}