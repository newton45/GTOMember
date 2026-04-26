/* ui/components/seatSelectorModal.js */
class SeatSelectorModal {
    constructor(container, dataManager) {
        this.container = container;
        this.dataManager = dataManager;
        this.onConfirm = null;
        
        this.selectedIds = new Set();
        this.allUnseated = [];
        this.currentTrap = 'bear1'; // 记录是为哪个熊选择成员
        this.searchQuery = '';
    }

    /**
     * @param {string} targetTrap 当前正在操作的地图 ('bear1' 或 'bear2')
     */
    render(targetTrap = 'bear1') {
        this.currentTrap = targetTrap;
        this.selectedIds.clear();
        this.searchQuery = '';

        // 获取所有在盟且未落座的成员
        const seatedIds = new Set();
        ['bear1', 'bear2'].forEach(t => {
            this.dataManager.seatData[t].seats.forEach(s => { if(s.memberId) seatedIds.add(s.memberId); });
        });
        
        this.allUnseated = this.dataManager.members.getAll()
            .filter(m => !m.leftAlliance && !seatedIds.has(m.id));

        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal" style="width: 95vw; max-width: 1200px; height: 85vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h2>成员选择落座 <span style="font-size:14px; color:var(--gray-500);">(正在为 ${targetTrap === 'bear1' ? '熊 1' : '熊 2'} 选人)</span></h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body" style="background: var(--gray-50); display: flex; flex-direction: column; gap: 15px; overflow: hidden;">
                        <div class="search-box">
                            <input type="text" id="selector-search" placeholder="全局搜索：姓名、ID、职级、拼音..." 
                                   style="width: 100%; padding: 12px; border: 1px solid var(--gray-300); border-radius: 6px;">
                        </div>
                        
                        <div class="selector-columns" style="display: flex; gap: 20px; flex: 1; overflow: hidden;">
                            <div class="marker-column-box" style="flex: 1; display: flex; flex-direction: column;">
                                <h3 style="text-align: center; margin-bottom: 10px; font-size: 14px;">属于 熊 1 的成员</h3>
                                <div class="selector-grid" id="grid-bear1" data-trap="bear1"></div>
                            </div>
                            
                            <div class="marker-column-box" style="flex: 1; display: flex; flex-direction: column;">
                                <h3 style="text-align: center; margin-bottom: 10px; font-size: 14px;">属于 熊 2 的成员</h3>
                                <div class="selector-grid" id="grid-bear2" data-trap="bear2"></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" data-action="close">取消</button>
                        <button class="btn btn-primary" id="btn-selector-confirm" style="padding: 10px 40px;">确认落座</button>
                    </div>
                </div>
            </div>
        `;

        this.container.classList.remove('hidden');
        this.updateGrids();
        this.bindEvents();
    }

    // 执行模拟自动落座排序逻辑
    calculateDynamicSort(members, trapKey) {
        const trapData = this.dataManager.seatData[trapKey];
        // 1. 统计该地图当前空闲的各级座位数量
        const caps = { s1: 0, s2: 0, s3: 0, s4: 0 };
        trapData.seats.forEach(s => {
            if (!s.memberId && caps[s.level] !== undefined) caps[s.level]++;
        });

        // 2. 基础排序：战力
        const list = [...members].sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));
        
        // 3. 计算惩罚位移后的目标等级
        const levelNames = ['s1', 's2', 's3', 's4'];
        let currentLvlIdx = 0;
        let remainingCap = caps[levelNames[0]];

        list.forEach(m => {
            while (remainingCap <= 0 && currentLvlIdx < 3) {
                currentLvlIdx++;
                remainingCap = caps[levelNames[currentLvlIdx]];
            }
            const baseLvl = currentLvlIdx + 1;
            // 存储一个临时排序权重：基础等级 + 活跃度惩罚
            m._tempSortWeight = Math.min(5, baseLvl + (m.activityStatus || 0));
            remainingCap--;
        });

        // 4. 最终排序：权重第一，战力第二
        return list.sort((a, b) => {
            if (a._tempSortWeight !== b._tempSortWeight) return a._tempSortWeight - b._tempSortWeight;
            return (a.powerRank || 999) - (b.powerRank || 999);
        });
    }

    updateGrids() {
        const q = this.searchQuery.toLowerCase().trim();
        const checkMatch = (m) => {
            if (!q) return false;
            return m.nickname.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || 
                   (typeof PinyinMatch !== 'undefined' && PinyinMatch.match(m.nickname, q));
        };

        ['bear1', 'bear2'].forEach(trapKey => {
            const grid = this.container.querySelector(`#grid-${trapKey}`);
            // 筛选属于该陷阱的成员
            let members = this.allUnseated.filter(m => (m.targetBear || 'bear1') === trapKey);
            
            // 执行动态排序
            members = this.calculateDynamicSort(members, trapKey);

            const isOtherBear = trapKey !== this.currentTrap;

            grid.innerHTML = members.map(m => {
                const isSelected = this.selectedIds.has(m.id);
                const isMatch = checkMatch(m);
                
                // 样式控制：
                // 1. 活跃度色彩框 (status-0/1/2)
                // 2. 搜索高亮 (search-match)
                // 3. 选中态 (selected-target)
                // 4. 跨团调度透明度 (other-bear-opacity)
                const classStr = `member-entity rank-${m.rank} status-${m.activityStatus || 0} 
                                 ${isMatch ? 'search-match' : ''} 
                                 ${isSelected ? 'selected-target' : ''} 
                                 ${isOtherBear ? 'other-bear-dim' : ''}`;

                return `
                    <div class="${classStr}" data-id="${m.id}" data-trap="${trapKey}"
                         style="cursor: pointer; position: relative; width: var(--cell-size); height: var(--cell-size);">
                        <div class="entity-name" style="font-size:10px;">${m.nickname}</div>
                        <div class="entity-info-index">${m.powerRank || ''}</div>
                        <div class="entity-rank">${m.rank}</div>
                    </div>
                `;
            }).join('');
        });
    }

    bindEvents() {
        const searchInput = this.container.querySelector('#selector-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value;
                this.updateGrids();
            };
        }

        this.container.onclick = (e) => {
            const card = e.target.closest('.member-entity');
            if (card) {
                const id = card.dataset.id;
                const m = this.allUnseated.find(mem => mem.id === id);
                if (!m) return;

                // 排他性单选
                this.selectedIds.clear();
                this.selectedIds.add(id);

                // 【核心逻辑】：跨团点击自动修正陷阱编号并同步数据池
                if (card.dataset.trap !== this.currentTrap) {
                    const oldTrap = m.targetBear || 'bear1';
                    m.targetBear = this.currentTrap;

                    // 1. 同步 seatData 内部的待选池
                    const seatData = this.dataManager.seatData;
                    if (seatData && seatData[oldTrap]) {
                        // 从旧陷阱池移除
                        seatData[oldTrap].unseated = (seatData[oldTrap].unseated || []).filter(mid => mid !== id);
                    }
                    if (seatData && seatData[this.currentTrap]) {
                        // 加入新陷阱池（确保不重复）
                        if (!seatData[this.currentTrap].unseated.includes(id)) {
                            seatData[this.currentTrap].unseated.push(id);
                        }
                    }

                    // 2. 核心持久化：必须手动保存地图数据 Key，否则刷新后标记页面会回滚
                    localStorage.setItem('SeatPage_seatData', JSON.stringify(seatData));
                    
                    // 由于改变了归属，重新分拣并刷新排序
                    this.updateGrids();
                } else {
                    this.updateGrids();
                }
                return;
            }

            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn && actionBtn.dataset.action === 'close') this.close();
        };

        this.container.querySelector('#btn-selector-confirm').onclick = () => {
            if (this.selectedIds.size === 0) return alert('请选择成员');
            const selectedId = Array.from(this.selectedIds)[0];
            
            // 确保成员属性（targetBear等）已保存
            this.dataManager.save(); 
            
            if (this.onConfirm) this.onConfirm([selectedId]);
            this.close();
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}