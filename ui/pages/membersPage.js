class MembersPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.gridContainer = document.getElementById('members-grid');
        this.modal = new MemberModal(modalContainer);
        this.batchModal = new BatchAddModal(modalContainer); 
        this.helpModal = new HelpModal(modalContainer); // 【新增】实例化帮助组件       
        this.isAnimating = false;
        
        this.bindToolbarEvents();
        this.initLayout();

        // 【持久化修复 1：读取缓存状态】
        this.isContinuousSorting = localStorage.getItem('MembersPage_isContinuousSorting') === 'true';
        const savedSortTarget = localStorage.getItem('MembersPage_currentSortTarget');
        this.currentSortTarget = savedSortTarget ? parseInt(savedSortTarget, 10) : null;

        document.addEventListener('member-delete', (e) => { this.dataManager.members.remove(e.detail.id); this.dataManager.save(); this.render(); });

        this.render();
        // 初始化完毕后，强制同步一次按钮和界面的样式
        this.updateSortButtonUI(); 
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

        // 【新增】绑定成员页的帮助按钮
        const helpBtn = document.getElementById('btn-help-members');
        if (helpBtn) {
            helpBtn.onclick = () => this.helpModal.render('members');
        }
    }

    // 修改 initLayout 内部的标题
    initLayout() {
        this.gridContainer.innerHTML = `
            <div class="compact-board" style="display: flex; gap: 20px; align-items: flex-start;">
                <div class="board-main" style="flex-shrink: 0;">
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                        <h3 style="margin: 0;">在盟成员排位 (按战力前后排序)</h3>
                        <button id="btn-continuous-sort" class="btn" style="background: #18181b; color: white; border: none; padding: 6px 14px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer;">⚡ 开始连续排序</button>
                    </div>

                    <div class="grid-10x10" id="compact-grid"></div>
                </div>
                
                <div class="board-pool-container" style="flex: 1; display: flex; flex-direction: column; gap: 20px;">
                    <div class="board-pool" id="pool-area">
                        <h3>非本盟成员区</h3>
                        <div class="out-pool" id="compact-pool" style="min-height: 150px; background: rgba(0,0,0,0.02); border: 2px dashed var(--gray-200); border-radius: 8px;"></div>
                    </div>
                    
                    <div class="board-pool" id="memorial-area">
                        <h3>纪念区 (不玩了)</h3>
                        <div class="out-pool" id="memorial-pool" style="min-height: 150px; background: rgba(0,0,0,0.02); border: 2px dashed var(--gray-200); border-radius: 8px;"></div>
                    </div>
                </div>
            </div>
        `;
        
        // 【新增】：绑定连续排序按钮
        document.getElementById('btn-continuous-sort').onclick = () => this.toggleSortMode();
        
        this.bindGridEvents();
    }

    // 控制排序模式的开关
    toggleSortMode() {
        if (this.isContinuousSorting) {
            this.isContinuousSorting = false;
            this.currentSortTarget = null;
            localStorage.removeItem('MembersPage_isContinuousSorting');
            localStorage.removeItem('MembersPage_currentSortTarget');
            this.updateSortButtonUI();
            this.render();
        } else {
            // 1. 激活并清空全局弹窗容器 (确保它在 HTML 中是固定定位的)
            const modalRoot = document.getElementById('modal-container');
            if (!modalRoot) return;

            modalRoot.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal modal-selector" style="width: 320px; text-align: center; padding: 25px; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                        <h3 style="margin-top:0; margin-bottom: 15px;">⚡ 连续排序</h3>
                        <p style="font-size: 13px; color: var(--gray-600); margin-bottom: 15px;">请输入起始排位编号 (1-100):</p>
                        <input type="number" id="sort-start-input" min="1" max="100" value="1" 
                               style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid var(--gray-300); border-radius: 4px; text-align: center; font-size: 16px;">
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button class="btn" id="btn-sort-cancel" style="flex: 1;">取消</button>
                            <button class="btn btn-primary" id="btn-sort-confirm" style="flex: 1;">锁定起跑线</button>
                        </div>
                    </div>
                </div>
            `;
            modalRoot.classList.remove('hidden');

            // 自动聚焦
            const input = modalRoot.querySelector('#sort-start-input');
            setTimeout(() => input.focus(), 50);

            // 关闭弹窗的函数
            const closeModal = () => {
                modalRoot.classList.add('hidden');
                modalRoot.innerHTML = '';
            };

            // 绑定事件
            modalRoot.querySelector('#btn-sort-cancel').onclick = closeModal;
            
            modalRoot.querySelector('#btn-sort-confirm').onclick = () => {
                let startPos = parseInt(input.value, 10);
                if (isNaN(startPos) || startPos < 1 || startPos > 100) {
                    alert('⚠️ 请输入 1 到 100 之间的有效数字！');
                    return;
                }
                
                this.isContinuousSorting = true;
                this.currentSortTarget = startPos;
                
                // 状态持久化
                localStorage.setItem('MembersPage_isContinuousSorting', 'true');
                localStorage.setItem('MembersPage_currentSortTarget', startPos.toString());
                
                this.updateSortButtonUI();
                this.render();
                closeModal();
            };

            // 支持回车确认
            input.onkeydown = (e) => {
                if (e.key === 'Enter') modalRoot.querySelector('#btn-sort-confirm').click();
            };
        }
    }

    // 同步按钮样式和容器类名
    updateSortButtonUI() {
        const btn = document.getElementById('btn-continuous-sort');
        if (!btn) return;
        
        if (this.isContinuousSorting) {
            btn.innerText = "🛑 结束连续排序";
            btn.style.background = "#ef4444";
            this.gridContainer.classList.add('sorting-mode');
        } else {
            btn.innerText = "⚡ 开始连续排序";
            btn.style.background = "#18181b";
            this.gridContainer.classList.remove('sorting-mode');
        }
    }


    // 核心数据规整逻辑：过滤出在盟成员，排序，并强制重新分配 1~N 的战力连续序号
    packActiveMembers() {
        const all = this.dataManager.members.getAll();
        const active = all.filter(m => !m.leftAlliance)
                          .sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));
        
        let hasChanged = false;
        active.forEach((m, idx) => {
            if (m.powerRank !== idx + 1) {
                m.powerRank = idx + 1;
                m.isMemorial = false; // 【修复】：顺手清洗状态
                hasChanged = true;
            }
        });
        
        if (hasChanged) this.dataManager.save(); // 【核心修复】：变动即存盘
        return active;
    }

    getPoolMembers() {
        return this.dataManager.members.getAll().filter(m => m.leftAlliance);
    }

    packPoolMembers(isMemorial = false) {
        const all = this.dataManager.members.getAll();
        const filtered = all.filter(m => m.leftAlliance && (isMemorial ? m.isMemorial : !m.isMemorial))
                            .sort((a, b) => (a.poolRank || 9999) - (b.poolRank || 9999));
        
        let hasChanged = false;
        filtered.forEach((m, idx) => {
            if (m.poolRank !== idx + 1) {
                m.poolRank = idx + 1;
                hasChanged = true;
            }
        });
        
        if (hasChanged) this.dataManager.save(); // 【核心修复】：变动即存盘
        return filtered;
    }

    render(searchQuery = '') {
        const grid = document.getElementById('compact-grid');
        const pool = document.getElementById('compact-pool');
        const memorialPool = document.getElementById('memorial-pool');
        
        const activeMembers = this.packActiveMembers();
        const outMembers = this.packPoolMembers(false);
        const memorialMembers = this.packPoolMembers(true);
        
        const q = searchQuery.toLowerCase().trim();

        // 【已修复】：还原拼音与多维度搜索算法
        const checkMatch = (m) => {
            if (!q) return false;
            const basicMatch = m.nickname.toLowerCase().includes(q) || 
                               m.id.toLowerCase().includes(q) || 
                               m.rank.toLowerCase().includes(q);
            let pinyinMatch = false;
            if (typeof PinyinMatch !== 'undefined') {
                pinyinMatch = PinyinMatch.match(m.nickname, q) || 
                              (m.pastNicknames && m.pastNicknames.some(pn => PinyinMatch.match(pn, q)));
            }
            return basicMatch || pinyinMatch;
        };

        grid.innerHTML = Array.from({ length: 100 }, (_, i) => {
            const member = activeMembers[i];
            const isMatch = member ? checkMatch(member) : false;
            const isTarget = this.isContinuousSorting && (i + 1) === this.currentSortTarget;
            return `
                <div class="compact-cell ${member ? 'occupied' : 'empty'} ${isTarget ? 'sorting-target' : ''}" data-power="${i + 1}">
                    ${member ? this.renderMemberContent(member, 'active', isMatch) : ''}
                </div>
            `;
        }).join('');

        const poolStyle = 'opacity: 0.75; filter: grayscale(40%);';
        pool.innerHTML = outMembers.map(m => `
            <div class="pool-item" style="${poolStyle}" data-id="${m.id}">${this.renderMemberContent(m, 'out', checkMatch(m))}</div>
        `).join('');
        memorialPool.innerHTML = memorialMembers.map(m => `
            <div class="pool-item" style="${poolStyle}" data-id="${m.id}">${this.renderMemberContent(m, 'memorial', checkMatch(m))}</div>
        `).join('');
    }

    // 修改成员框的九宫格渲染逻辑
    renderMemberContent(member, poolType = 'active', isMatch = false) {
        const powerIdx = member.powerRank || '';
        let actionButtons = '';

        if (poolType === 'active') {
            actionButtons = `
                <button class="grid-btn btn-green" data-action="edit" title="编辑"></button>
                <button class="grid-btn btn-yellow" data-action="out" title="移出联盟"></button>
            `;
        } else if (poolType === 'out') {
            actionButtons = `
                <button class="grid-btn btn-green" data-action="edit" title="编辑"></button>
                <button class="grid-btn btn-red" data-action="memorial" title="移至纪念区"></button>
            `;
        } else if (poolType === 'memorial') {
            actionButtons = `
                <button class="grid-btn btn-green" data-action="edit" title="编辑"></button>
                <button class="grid-btn btn-black" data-action="delete" title="彻底删除"></button>
            `;
        }

        return `
            <div class="member-entity rank-${member.rank} ${isMatch ? 'search-match' : ''}" 
                draggable="true" data-id="${member.id}" data-pool="${poolType}">
                <div class="entity-action-grid">${actionButtons}</div>
                <div class="entity-name">${member.nickname || '未命名'}</div>
                <div class="entity-info-index">${poolType === 'active' ? powerIdx : ''}</div>
                <div class="entity-rank" data-action="rank">${member.rank}</div>
            </div>
        `;
    }

    bindGridEvents() {
        const container = this.gridContainer;

        // 委托点击事件：编辑、移出、删除、职级修改
        container.onclick = (e) => {
            
            // ==================================================
            // 【核心拦截】：连续排序模式的最高级拦截
            // ==================================================
            if (this.isContinuousSorting) {
                e.stopPropagation();
                const entity = e.target.closest('.member-entity');
                
                if (entity && !this.isAnimating) {
                    const id = entity.dataset.id;
                    const isFromPool = entity.dataset.pool !== 'active';
                    const targetCellPower = this.currentSortTarget;
                    
                    // 1. 先触发成员移动动画 (350ms)
                    this.handleGridDrop(id, targetCellPower, isFromPool);
                    
                    // 2. 延迟执行：等待成员“落地”后再移动黑框
                    setTimeout(() => {
                        if (!this.isContinuousSorting) return;
                        this.currentSortTarget++;
                        localStorage.setItem('MembersPage_currentSortTarget', this.currentSortTarget.toString());
                        
                        if (this.currentSortTarget > 100) {
                            alert('🏁 连续排序自动结束。');
                            this.toggleSortMode();
                        }
                        // 重新渲染，带上当前的搜索词，确保搜索高亮和黑框位置同步
                        this.render(document.getElementById('search-member')?.value);
                    }, 400); // 略长于 350ms 的位移动画，确保视觉稳定
                }
                return;
            }
            // ==================================================
            
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
                            this.dataManager.members.update(id, { leftAlliance: true, isMemorial: false, powerRank: null });
                        });
                    }
                } else if (action === 'memorial') {
                    this.applyStateWithAnimation(() => {
                        this.dataManager.members.update(id, { leftAlliance: true, isMemorial: true, powerRank: null });
                    });
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
                
                // 【核心修复】：将旧的 ispool 判断，升级为基于 data-pool 的三态判断
                // 只要不是 'active' (在盟)，就统统视为从池子中拖出的
                isFromPool = entity.dataset.pool !== 'active'; 
                
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
            const targetOutPool = e.target.closest('#compact-pool');
            const targetMemorialPool = e.target.closest('#memorial-pool');
            
            container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            
            // 悬停在主网格时高亮
            if (targetCell) targetCell.classList.add('drag-over');
            
            // 悬停在两个池子时高亮 (前提是当前抓起的不是池子里的同一个元素)
            if (targetOutPool && entity.dataset?.pool !== 'out') targetOutPool.classList.add('drag-over');
            if (targetMemorialPool && entity.dataset?.pool !== 'memorial') targetMemorialPool.classList.add('drag-over');
        };

        container.ondrop = (e) => {
            e.preventDefault();
            if (!draggedId || this.isAnimating) return;
            
            const targetCell = e.target.closest('.compact-cell');
            const targetItem = e.target.closest('.pool-item'); // 【新增】：感应是否掉在某个成员身上
            const targetOutPool = e.target.closest('#compact-pool');
            const targetMemorialPool = e.target.closest('#memorial-pool');

            if (targetCell) {
                // 逻辑不变：拖入主力网格
                const targetPower = parseInt(targetCell.dataset.power);
                this.handleGridDrop(draggedId, targetPower, isFromPool);
            } else if (targetOutPool || targetMemorialPool) {
                // 【核心升级】：处理池子内部排序或跨区拖入
                const isMemorial = !!targetMemorialPool;
                const targetMemberId = targetItem ? targetItem.dataset.id : null;
                
                this.handlePoolSort(draggedId, targetMemberId, isMemorial);
            }
        };
    }
    // 补充 ui/pages/membersPage.js 中的 handleGridDrop 方法
    handleGridDrop(id, targetPower, fromPool) {
        const activeMembers = this.packActiveMembers();
        const member = this.dataManager.members.findById(id);
        
        if (!member) return; // 容错防御
        
        this.applyStateWithAnimation(() => {
            // 1. 状态清洗：只要进入主网格，强制洗掉非本盟和纪念状态
            member.leftAlliance = false;
            member.isMemorial = false; 
            member.poolRank = null;    

            // 2. 数组穿插重组逻辑
            if (fromPool) {
                const finalPower = Math.min(targetPower, activeMembers.length + 1);
                activeMembers.splice(finalPower - 1, 0, member);
            } else {
                const currentIndex = activeMembers.findIndex(m => m.id === id);
                if(currentIndex !== -1) activeMembers.splice(currentIndex, 1);
                const finalPower = Math.min(targetPower, activeMembers.length + 1);
                activeMembers.splice(finalPower - 1, 0, member);
            }

            // 3. 全量重写 powerRank 坐标
            activeMembers.forEach((m, idx) => {
                this.dataManager.members.update(m.id, { 
                    powerRank: idx + 1, 
                    leftAlliance: false,
                    isMemorial: false 
                });
            });
        });
    }

    handlePoolSort(draggedId, targetMemberId, toMemorial) {
        this.applyStateWithAnimation(() => {
            // 1. 获取目标池子的当前排序列表
            const poolMembers = this.packPoolMembers(toMemorial);
            const member = this.dataManager.members.findById(draggedId);
            
            // 2. 如果是从主力网格进来的，先清除其主力排名
            if (!member.leftAlliance) {
                member.powerRank = null;
            }

            // 3. 更新基础状态
            member.leftAlliance = true;
            member.isMemorial = toMemorial;

            // 4. 计算插入位置
            // 先从当前池子移除自己（如果是内部排序）
            const filteredPool = poolMembers.filter(m => m.id !== draggedId);
            
            if (targetMemberId) {
                // 如果掉在某个成员身上，插在他前面
                const targetIdx = filteredPool.findIndex(m => m.id === targetMemberId);
                filteredPool.splice(targetIdx, 0, member);
            } else {
                // 如果掉在空白处，直接排在最后
                filteredPool.push(member);
            }

            // 5. 统一刷新该池子的 poolRank
            filteredPool.forEach((m, idx) => {
                this.dataManager.members.update(m.id, { 
                    poolRank: idx + 1, 
                    leftAlliance: true, 
                    isMemorial: toMemorial,
                    powerRank: null 
                });
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

    // 修改 ui/pages/membersPage.js 中的 handleSave 方法
    handleSave(data, existing) {
        // 查找是否存在相同 ID 的成员（排除正在编辑的自己）
        const duplicateMember = this.dataManager.members.findById(data.id);

        if (duplicateMember && !existing) {
            // 【核心合并逻辑】：ID 碰撞
            // 1. 处理昵称：若昵称不同，则老昵称变曾用名
            if (duplicateMember.nickname !== data.nickname) {
                duplicateMember.pastNicknames = duplicateMember.pastNicknames || [];
                duplicateMember.pastNicknames.push(duplicateMember.nickname);
                duplicateMember.nickname = data.nickname;
            }

            // 2. 强制设为在本盟，并更新职级
            duplicateMember.leftAlliance = false;
            duplicateMember.rank = data.rank;

            // 3. 位置移动：将其 powerRank 设置为当前点击的网格位
            if (data.powerRank) {
                duplicateMember.powerRank = data.powerRank;
            }

            this.dataManager.members.update(duplicateMember.id, duplicateMember);
            alert(`ID 重复检测：已将成员 ${data.nickname} 从原排位移动至当前网格，曾用名已记录。`);
            
        } else if (existing) {
            // 正常的编辑保存
            this.dataManager.members.update(data.id, data);
        } else {
            // 纯粹的新增
            const member = new Member(data);
            this.dataManager.members.add(member);
        }

        this.dataManager.save();
        this.packActiveMembers(); // 重新整理连续排位
        this.render();
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