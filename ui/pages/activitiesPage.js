class ActivitiesPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.container = document.getElementById('page-activities');
        this.modalContainer = modalContainer;

        // 初始化所有弹窗组件
        this.createActModal = new CreateActivityModal(modalContainer); // 新增新建活动弹窗
        this.selectorModal = new MemberSelectorModal(modalContainer);
        this.allocationModal = new TeamAllocationModal(modalContainer);
        this.clearHistoryModal = new ClearHistoryModal(modalContainer);
        this.battleModal = new BattleResultModal(modalContainer);

        this.currentActivityId = null;
        this.init();
    }

    init() {
        this.render();
        this.bindGlobalEvents(); 
    }

    isActivityEmpty(act) {
        if (!act) return true;
        let hasMembers = false;
        const check = (team) => {
            if (!team || !team.groups) return;
            team.groups.forEach(g => {
                if (g.memberIds && g.memberIds.length > 0) hasMembers = true;
            });
        };
        check(act.team1);
        if (act.hasTeam2) check(act.team2);
        return !hasMembers;
    }

    render() {
        const activities = this.dataManager.activities.getAll();
        
        if (!this.currentActivityId && activities.length > 0) {
            this.currentActivityId = activities[0].id;
        }
        
        let currentActivity = this.dataManager.activities.findById(this.currentActivityId);
        const isEmpty = this.isActivityEmpty(currentActivity);

        this.container.innerHTML = `
            <div class="activities-layout-vertical page-activities">
                <div class="activity-topbar">
                    <div class="topbar-left">
                        <span class="topbar-label">活动：</span>
                        <select id="activity-selector">
                            ${activities.length === 0 ? '<option value="" disabled selected>暂无活动</option>' : ''}
                            ${activities.map(act => `
                                <option value="${act.id}" ${act.id === this.currentActivityId ? 'selected' : ''}>${act.name}</option>
                            `).join('')}
                        </select>
                        
                        <button class="btn-square btn-primary" data-action="add-act" title="新建活动">+</button>
                        ${currentActivity ? `
                            <button class="btn-square btn-danger" data-action="delete-act" title="删除当前活动">&times;</button>
                        ` : ''}
                    </div>
                    
                    <div class="topbar-right">
                        ${currentActivity && !isEmpty ? `
                            <button class="btn btn-warning" data-action="clear-act-data">🧹 清空人员</button>
                        ` : ''}
                    </div>
                </div>

                <main class="activity-canvas">
                    ${currentActivity ? this.renderActivityDetail(currentActivity) : `
                        <div class="canvas-placeholder" style="text-align:center; padding: 50px; color: #888;">
                            <p>目前没有活动。请点击上方蓝色的 “+” 号新建一个活动。</p>
                        </div>
                    `}
                </main>
            </div>
        `;
    }

    bindGlobalEvents() {
        // 1. 下拉框变动：仅负责切换
        this.container.addEventListener('change', (e) => {
            if (e.target.id === 'activity-selector') {
                this.currentActivityId = e.target.value;
                this.render();
                return;
            }
            
            if (e.target.dataset.field) {
                const act = this.dataManager.activities.findById(this.currentActivityId);
                if(act) {
                    act[e.target.dataset.field] = e.target.value;
                    this.dataManager.save();
                }
            }
            
            if (e.target.id === 'toggle-team2') {
                const act = this.dataManager.activities.findById(this.currentActivityId);
                act.hasTeam2 = e.target.checked;
                if (act.hasTeam2) this.rebalanceActivity(act);
                this.saveAndRefresh();
            }
        });

        // 2. 按钮点击分发
        this.container.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('[data-action]');
            const act = this.dataManager.activities.findById(this.currentActivityId);
            
            const entity = e.target.closest('.member-entity');
            if (entity && !actionBtn) {
                const groupCard = entity.closest('.activity-group-card');
                if (groupCard) {
                    const tNum = groupCard.dataset.team;
                    const gIdx = groupCard.dataset.groupIndex;
                    const group = tNum == 1 ? act.team1.groups[gIdx] : act.team2.groups[gIdx];
                    const mId = entity.dataset.id;
                    group.leaderId = (group.leaderId === mId) ? null : mId;
                    this.saveAndRefresh();
                    return;
                }
            }

            if (!actionBtn) return;
            const action = actionBtn.dataset.action;

            switch (action) {
                case 'add-act':
                    // 呼出自定义的模态框，彻底代替原生 prompt
                    this.createActModal.onSave = (data) => {
                        const newAct = new Activity({ 
                            name: data.name, 
                            hasTeam2: data.hasTeam2 
                        });
                        this.rebalanceActivity(newAct);
                        this.dataManager.activities.add(newAct);
                        this.currentActivityId = newAct.id; // 将焦点切换到新活动
                        this.render(); // 刷新界面
                    };
                    this.createActModal.render();
                    break;
                case 'delete-act':
                    if (confirm(`确定要彻底删除活动“${act.name}”吗？`)) {
                        this.dataManager.activities.remove(act.id);
                        this.currentActivityId = null;
                        this.render();
                    }
                    break;
                case 'clear-act-data':
                    if (confirm('确定要将该活动所有组员移回待选池吗？')) {
                        const reset = (team) => { team.groups.forEach(g => { g.memberIds = []; g.leaderId = null; }); };
                        reset(act.team1); if(act.hasTeam2) reset(act.team2);
                        this.rebalanceActivity(act);
                        this.saveAndRefresh();
                    }
                    break;
                case 'add-group':
                    const tNum = actionBtn.closest('.team-panel').dataset.team;
                    const targetTeam = tNum == 1 ? act.team1 : act.team2;
                    targetTeam.groups.push(new ActivityGroup());
                    this.saveAndRefresh();
                    break;
                case 'delete-group':
                    const gCard = actionBtn.closest('.activity-group-card');
                    const teamNum = gCard.dataset.team;
                    const groupIdx = gCard.dataset.groupIndex;
                    const teamObj = teamNum == 1 ? act.team1 : act.team2;
                    teamObj.unassignedIds.push(...teamObj.groups[groupIdx].memberIds);
                    teamObj.groups.splice(groupIdx, 1);
                    this.saveAndRefresh();
                    break;
                case 'show-selector':
                    this.handleShowSelector(actionBtn);
                    break;
                case 'remove-from-group':
                    this.handleRemoveMember(actionBtn.closest('.member-entity').dataset.id);
                    break;
                case 'config-allocation':
                    this.handleAllocation();
                    break;
                case 'battle-result':
                    this.handleBattleResult(actionBtn);
                    break;
                case 'copy-text':
                    navigator.clipboard.writeText(document.getElementById('export-text').value);
                    alert('文案已复制！');
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
            }
        });
    }

    renderActivityDetail(act) {
        return `
            <div class="canvas-header">
                <div class="header-main">
                    <input type="text" class="act-name-input" value="${act.name}" data-field="name">
                    <textarea class="act-desc-input" data-field="description" placeholder="点击编辑活动说明...">${act.description}</textarea>
                </div>
                <div class="header-controls">
                    <label class="toggle-control">
                        <input type="checkbox" id="toggle-team2" ${act.hasTeam2 ? 'checked' : ''}> 副场活动 (团2)
                    </label>
                    <button class="btn btn-warning btn-sm" data-action="clear-history">清空成员历史数据</button>
                </div>
            </div>
            <div class="teams-container">${this.renderTeam(act, 1)}${act.hasTeam2 ? this.renderTeam(act, 2) : ''}</div>
            <div class="export-section">
                <h3>文案预览</h3>
                <textarea id="export-text" readonly>${this.generateExportText(act)}</textarea>
                <button class="btn btn-primary" data-action="copy-text">复制文本</button>
            </div>
        `;
    }

    renderTeam(act, teamNum) {
        const team = teamNum === 1 ? act.team1 : act.team2;
        return `
            <div class="team-panel" data-team="${teamNum}">
                <div class="team-header">
                    <h4>团 ${teamNum}</h4>
                    <div class="team-btns">
                        <button class="btn btn-primary btn-sm" data-action="add-group">新增活动组</button>
                    </div>
                </div>
                <div class="groups-list">${team.groups.map((group, gIdx) => this.renderGroup(group, gIdx, teamNum)).join('')}</div>
                <div class="waiting-pool-container">
                    <h5>团 ${teamNum} 待选池</h5>
                    <button class="btn btn-sm btn-outline" data-action="config-allocation">配置人员分团</button>
                    <div class="waiting-pool">${this.renderMembersInActivity(team.unassignedIds)}</div>
                </div>
            </div>
        `;
    }

    renderGroup(group, index, teamNum) {
        return `
            <div class="activity-group-card" data-team="${teamNum}" data-group-index="${index}">
                <div class="group-header">
                    <input type="text" class="group-name-input" value="${group.name}" placeholder="组名" data-action="edit-group-name">
                    <button class="btn-add-member-trigger" data-action="show-selector">添加组员</button>
                    <button class="btn-text-del" data-action="delete-group">&times;</button>
                </div>
                <div class="group-members-box">${this.renderMembersInActivity(group.memberIds, group.leaderId)}</div>
                <button class="btn-battle-trigger" data-action="battle-result">战果结算</button>
            </div>
        `;
    }

    renderMembersInActivity(memberIds, leaderId = null) {
        const members = memberIds.map(id => this.dataManager.members.findById(id)).filter(Boolean);
        members.sort((a, b) => {
            if (a.id === leaderId) return -1;
            if (b.id === leaderId) return 1;
            return (a.powerRank || 999) - (b.powerRank || 999);
        });
        return members.map(m => {
            const att = m.getRecentAttendanceStats();
            return `
                <div class="member-entity rank-${m.rank} ${m.id === leaderId ? 'leader-style' : ''}" 
                     data-id="${m.id}" title="替补:${att.sub}, 请假:${att.leave}, 缺席:${att.absent}">
                    <div class="btn-remove-circle" data-action="remove-from-group">×</div>
                    <div class="entity-name">${m.nickname}</div>
                    <div class="entity-info-index">${m.getRecentAverageRank()}</div>
                    <div class="entity-rank">${att.rate}</div>
                </div>
            `;
        }).join('');
    }

    rebalanceActivity(act) {
        const assigned = new Set();
        [...act.team1.groups, ...act.team2.groups].forEach(g => g.memberIds.forEach(id => assigned.add(id)));
        const unassigned = this.dataManager.members.getAll().filter(m => !m.leftAlliance && !assigned.has(m.id));
        act.team1.unassignedIds = unassigned.filter(m => m.defaultTeam === 1).map(m => m.id);
        act.team2.unassignedIds = unassigned.filter(m => m.defaultTeam === 2).map(m => m.id);
    }

    handleShowSelector(btn) {
        const act = this.dataManager.activities.findById(this.currentActivityId);
        const card = btn.closest('.activity-group-card');
        const teamNum = card.dataset.team;
        const group = (teamNum == 1 ? act.team1 : act.team2).groups[card.dataset.groupIndex];
        const poolIds = teamNum == 1 ? act.team1.unassignedIds : act.team2.unassignedIds;
        const available = poolIds.map(id => this.dataManager.members.findById(id)).filter(Boolean);
        this.selectorModal.onConfirm = (ids) => {
            group.memberIds.push(...ids);
            const team = teamNum == 1 ? act.team1 : act.team2;
            team.unassignedIds = team.unassignedIds.filter(id => !ids.includes(id));
            this.saveAndRefresh();
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
                    team.unassignedIds.push(mId);
                }
            });
        });
        this.saveAndRefresh();
    }

    handleAllocation() {
        this.allocationModal.onSave = (updates) => {
            Object.entries(updates).forEach(([id, val]) => this.dataManager.members.update(id, { defaultTeam: val }));
            this.dataManager.save();
            this.rebalanceActivity(this.dataManager.activities.findById(this.currentActivityId));
            this.render();
        };
        this.allocationModal.render(this.dataManager.members.getAll());
    }

    handleBattleResult(btn) {
        const act = this.dataManager.activities.findById(this.currentActivityId);
        const card = btn.closest('.activity-group-card');
        const group = (card.dataset.team == 1 ? act.team1 : act.team2).groups[card.dataset.groupIndex];
        this.battleModal.onSave = (updates) => {
            Object.entries(updates).forEach(([id, rec]) => {
                const m = this.dataManager.members.findById(id);
                if(m) m.activityHistory.push(rec);
            });
            this.dataManager.save();
            this.render();
        };
        this.battleModal.render(act, group, this.dataManager.members.getAll());
    }

    generateExportText(act) {
        let t = `${act.name}：${act.description}\n`;
        const proc = (team, n) => {
            t += `\n【团 ${n}】\n`;
            team.groups.forEach(g => {
                const ms = g.memberIds.map(id => this.dataManager.members.findById(id)).filter(Boolean);
                const l = ms.find(m => m.id === g.leaderId);
                const os = ms.filter(m => m.id !== g.leaderId).map(m => m.nickname).join('、');
                t += `${g.name}：${l ? `(组长:${l.nickname}) ` : ''}${os}\n`;
            });
        };
        proc(act.team1, 1); if(act.hasTeam2) proc(act.team2, 2);
        return t;
    }

    saveAndRefresh() { this.dataManager.save(); this.render(); }
}