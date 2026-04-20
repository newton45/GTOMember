class MembersPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.gridContainer = document.getElementById('members-grid');
        this.modal = new MemberModal(modalContainer);
        // 【补回缺失的实例】
        this.batchModal = new BatchAddModal(modalContainer); 
        this.isAnimating = false;
        
        this.bindToolbarEvents();
        this.initLayout();
        this.render();
    }

    handleBatchAdd(members) {
        let successCount = 0;
        const errors = [];
        members.forEach(memberData => {
            try {
                const member = new Member(memberData);
                this.dataManager.members.add(member);
                successCount++;
            } catch (error) {
                errors.push(`ID ${memberData.id}: ${error.message}`);
            }
        });
        
        this.dataManager.save();
        this.render(document.getElementById('search-member')?.value);
        
        if (errors.length > 0) {
            alert(`成功添加 ${successCount} 人，失败 ${errors.length} 人\n\n错误详情：\n${errors.join('\n')}`);
        } else {
            // 新增成员会自动被 packActiveMembers 逻辑检测到，并自动补入前排空位
            alert(`成功批量添加 ${successCount} 名成员！`);
        }
    }

    bindToolbarEvents() {
        const batchBtn = document.getElementById('btn-batch-add-tiny');
        if(batchBtn) {
            batchBtn.onclick = () => {
                this.batchModal.onSave = (members) => this.handleBatchAdd(members);
                this.batchModal.render();
            };
        }
        
        const searchInput = document.getElementById('search-member');
        if(searchInput) {
            searchInput.oninput = (e) => this.render(e.target.value);
        }
    }

    // 修改 initLayout 内部的标题
    initLayout() {
        this.gridContainer.innerHTML = `
            <div class="compact-board">
                <div class="board-main">
                    <h3>在盟成员排位 (按战力前后排序)</h3>
                    <div class="grid-10x10" id="compact-grid"></div>
                </div>
                <div class="board-pool" id="pool-area">
                    <h3>非本盟成员区</h3>
                    <div class="out-pool" id="compact-pool"></div>
                </div>
            </div>
        `;
        this.bindGridEvents();
    }

    // 核心数据规整逻辑：过滤出在盟成员，排序，并强制重新分配 1~N 的战力连续序号
    packActiveMembers() {
        const all = this.dataManager.members.getAll();
        const active = all.filter(m => !m.leftAlliance)
                          .sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));
        
        active.forEach((m, idx) => {
            if (m.powerRank !== idx + 1) {
                this.dataManager.members.update(m.id, { powerRank: idx + 1 });
            }
        });
        return active;
    }

    getPoolMembers() {
        return this.dataManager.members.getAll().filter(m => m.leftAlliance);
    }

    render(searchQuery = '') {
        const grid = document.getElementById('compact-grid');
        const pool = document.getElementById('compact-pool');
        
        const activeMembers = this.packActiveMembers();
        const poolMembers = this.getPoolMembers();
        
        const q = searchQuery.toLowerCase().trim();

        // 核心辅助函数：多维属性穿透匹配
        const checkMatch = (m) => {
            if (!q) return false;
            return m.nickname.toLowerCase().includes(q) || 
                   m.id.includes(q) || 
                   (m.pastNicknames && m.pastNicknames.some(n => n.toLowerCase().includes(q))) ||
                   m.rank.toLowerCase().includes(q); // 【新增】：将职级(R1~R5)也纳入检索维度
        };

        // 渲染主网格
        grid.innerHTML = Array.from({ length: 100 }, (_, i) => {
            const member = activeMembers[i];
            const isMatch = member ? checkMatch(member) : false;
            
            // 【关键修复】：补回 ${member ? 'occupied' : 'empty'} 状态标识
            return `
                <div class="compact-cell ${member ? 'occupied' : 'empty'}" data-power="${i + 1}">
                    ${member ? this.renderMemberContent(member, false, isMatch) : ''}
                </div>
            `;
        }).join('');

        // 渲染池子
        pool.innerHTML = poolMembers.map(m => {
            const isMatch = checkMatch(m);
            return `
                <div class="pool-item">
                    ${this.renderMemberContent(m, true, isMatch)}
                </div>
            `;
        }).join('');
    }

    // 修改成员框的九宫格渲染逻辑
    renderMemberContent(member, isPool = false, isMatch = false) {
        const powerIdx = member.powerRank || '';
        // 【修改点】：如果匹配，增加 search-match 类
        return `
            <div class="member-entity rank-${member.rank} ${isMatch ? 'search-match' : ''}" 
                 draggable="true" data-id="${member.id}" data-ispool="${isPool}">
                <div class="entity-action-grid">
                    <button class="grid-btn btn-green" data-action="edit"></button>
                    <button class="grid-btn btn-yellow" data-action="out"></button>
                    <button class="grid-btn btn-red" data-action="delete"></button>
                </div>
                <div class="entity-name">${member.nickname || '未命名'}</div>
                <div class="entity-info-index">${!isPool ? powerIdx : ''}</div>
                <div class="entity-rank" data-action="rank">${member.rank}</div>
            </div>
        `;
    }

    bindGridEvents() {
        const container = this.gridContainer;

        // 委托点击事件：编辑、移出、删除、职级修改
        container.onclick = (e) => {
            // 1. 优先级最高：判断是否点击了功能按钮（编辑、移出、删除、职级）
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.stopPropagation(); // 阻止事件进一步传播
                const entity = actionBtn.closest('.member-entity');
                if (!entity) return;

                const id = entity.dataset.id;
                const action = actionBtn.dataset.action;

                if (action === 'edit') {
                    const m = this.dataManager.members.findById(id);
                    this.modal.onSave = (data) => this.handleSave(data, m);
                    this.modal.render(m);
                } else if (action === 'out') {
                    if(confirm('确定将该成员移出联盟吗？')) {
                        this.applyStateWithAnimation(() => {
                            this.dataManager.members.update(id, { leftAlliance: true, powerRank: null });
                        });
                    }
                } else if (action === 'delete') {
                    if (confirm('确定要删除该成员吗？')) {
                        this.applyStateWithAnimation(() => {
                            this.dataManager.members.remove(id);
                        });
                    }
                } else if (action === 'rank') {
                    this.showInlineRankSelector(e, id);
                }
                return; // 处理完按钮逻辑后直接跳出
            }

            // 2. 优先级次之：判断是否点击了空白格用于新增
            const emptyCell = e.target.closest('.compact-cell.empty');
            if (emptyCell) {
                this.modal.onSave = (data) => this.handleSave(data);
                this.modal.render();
                return;
            }
        };

        // 拖拽事件（FLIP动画支持）
        let draggedId = null;
        let isFromPool = false;

        container.ondragstart = (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) {
                draggedId = entity.dataset.id;
                isFromPool = entity.dataset.ispool === 'true';
                setTimeout(() => entity.classList.add('dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
            }
        };

        container.ondragend = (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) {
                entity.classList.remove('dragging');
                draggedId = null;
                container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            }
        };

        container.ondragover = (e) => {
            if (this.isAnimating) return;
            e.preventDefault();
            const targetCell = e.target.closest('.compact-cell');
            const targetPool = e.target.closest('.out-pool');
            
            container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            
            if (targetCell) targetCell.classList.add('drag-over');
            if (targetPool && !isFromPool) targetPool.classList.add('drag-over');
        };

        container.ondrop = (e) => {
            e.preventDefault();
            if (!draggedId || this.isAnimating) return;
            
            const targetCell = e.target.closest('.compact-cell');
            const targetPool = e.target.closest('.out-pool');

            if (targetCell) {
                // 拖入网格（重排或从池中加入）
                const targetPower = parseInt(targetCell.dataset.power);
                this.handleGridDrop(draggedId, targetPower, isFromPool);
            } else if (targetPool && !isFromPool) {
                // 从网格拖入池中
                this.applyStateWithAnimation(() => {
                    this.dataManager.members.update(draggedId, { leftAlliance: true, powerRank: null });
                });
            }
        };
    }

    handleGridDrop(id, targetPower, fromPool) {
        const activeMembers = this.packActiveMembers();
        const member = this.dataManager.members.findById(id);
        
        this.applyStateWithAnimation(() => {
            if (fromPool) {
                // 从池中移入：改变状态
                member.leftAlliance = false;
                // 智能吸附：不允许中间出现空洞
                const finalPower = Math.min(targetPower, activeMembers.length + 1);
                activeMembers.splice(finalPower - 1, 0, member);
            } else {
                // 内部位移
                const currentIndex = activeMembers.findIndex(m => m.id === id);
                if(currentIndex === -1) return;
                
                activeMembers.splice(currentIndex, 1); // 移除旧位置
                // 吸附到有效队列末尾
                const finalPower = Math.min(targetPower, activeMembers.length + 1);
                activeMembers.splice(finalPower - 1, 0, member); // 插入新位置
            }

            // 更新底层数据
            activeMembers.forEach((m, idx) => {
                this.dataManager.members.update(m.id, { powerRank: idx + 1, leftAlliance: false });
            });
        });
    }

    // 内联职级选择器
    showInlineRankSelector(e, memberId) {
        const existing = document.querySelector('.inline-rank-menu');
        if (existing) existing.remove();

        const btnRect = e.target.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.className = 'inline-rank-menu';
        menu.style.top = `${btnRect.bottom + window.scrollY}px`;
        menu.style.left = `${btnRect.left + window.scrollX - 20}px`;

        menu.innerHTML = CONSTANTS.RANKS.map(r => 
            `<div class="rank-item rank-${r}" data-val="${r}">${r}</div>`
        ).join('');

        document.body.appendChild(menu);

        const closeMenu = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('mousedown', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);

        menu.onclick = (ev) => {
            const item = ev.target.closest('.rank-item');
            if (item) {
                const newRank = item.dataset.val;
                this.dataManager.members.update(memberId, { rank: newRank });
                this.dataManager.save();
                this.render(); // 职级颜色仅变动局部，直接重绘即可，不需要FLIP
                menu.remove();
            }
        };
    }

    handleSave(data, existing) {
    if (existing) {
        // 如果 ID 被修改了
        if (existing.id !== data.id) {
            this.dataManager.members.remove(existing.id); // 移除旧 ID
        }
        this.dataManager.members.update(data.id, data); // 写入新 ID 数据
    } else {
        const member = new Member(data);
        this.dataManager.members.add(member);
    }
    this.dataManager.save();
    this.render(document.getElementById('search-member')?.value);
}

    // FLIP 动画管线
    applyStateWithAnimation(logicFn) {
        this.isAnimating = true;
        
        // F: 记录所有实体的当前坐标
        const entities = Array.from(this.gridContainer.querySelectorAll('.member-entity'));
        const firstRects = new Map();
        entities.forEach(el => firstRects.set(el.dataset.id, el.getBoundingClientRect()));

        // 执行逻辑并重绘DOM
        logicFn();
        this.dataManager.save();
        this.render(document.getElementById('search-member')?.value);

        // L: 获取新坐标
        const newEntities = Array.from(this.gridContainer.querySelectorAll('.member-entity'));
        
        // I & P: 反向偏移并执行动画
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
            } else {
                // 如果是全新出现的元素（例如新建），可以用淡入
                el.style.animation = 'fadeIn 300ms ease';
            }
        });

        setTimeout(() => {
            newEntities.forEach(el => { el.style.transition = ''; el.style.transform = ''; });
            this.isAnimating = false;
        }, 350);
    }
}