/* ui/components/memberMarkerModal.js */
class MemberMarkerModal {
    constructor(container, dataManager, onUpdate) {
        this.container = container;
        this.dataManager = dataManager;
        this.onUpdate = onUpdate;
        this.searchQuery = '';
    }

    render() {
        // 使用 95vw 确保横向占满，样式对齐活动管理页面
        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal" style="width: 95vw; max-width: 1600px; height: 90vh; display: flex; flex-direction: column; padding: 10px;">
                    <div class="modal-header">
                        <h2>成员状态标记与跨团调度</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body" style="display: flex; flex-direction: column; overflow: hidden; padding: 15px; background: var(--gray-50); gap: 15px;">
                        
                        <div class="search-box">
                            <input type="text" id="marker-search" placeholder="支持姓名、ID、职级、拼音首字母搜索..." 
                                   style="width: 100%; padding: 12px; border: 1px solid var(--gray-300); border-radius: 6px; font-size: 14px;">
                        </div>
                        
                        <div class="marker-columns" style="display: flex; gap: 20px; flex: 1; overflow: hidden;">
                            <div class="marker-column-box" style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                                <h3 style="text-align: center; margin-bottom: 10px; color: var(--primary); font-size: 16px;">熊 1 (Team 1)</h3>
                                <div class="marker-drop-zone" id="zone-bear1" data-trap="bear1" 
                                     style="flex: 1; border: 2px dashed var(--gray-300); border-radius: 8px; overflow-y: auto; padding: 15px; background: #fff;
                                            display: grid; grid-template-columns: repeat(auto-fill, var(--cell-size)); grid-auto-rows: var(--cell-size); gap: var(--grid-gap); justify-content: center;">
                                </div>
                            </div>
                            
                            <div class="marker-column-box" style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
                                <h3 style="text-align: center; margin-bottom: 10px; color: var(--secondary); font-size: 16px;">熊 2 (Team 2)</h3>
                                <div class="marker-drop-zone" id="zone-bear2" data-trap="bear2" 
                                     style="flex: 1; border: 2px dashed var(--gray-300); border-radius: 8px; overflow-y: auto; padding: 15px; background: #fff;
                                            display: grid; grid-template-columns: repeat(auto-fill, var(--cell-size)); grid-auto-rows: var(--cell-size); gap: var(--grid-gap); justify-content: center;">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="justify-content: space-between;">
                        <div style="font-size: 12px; color: var(--gray-500); background: #fff; padding: 5px 10px; border-radius: 4px; border: 1px solid var(--gray-200);">
                             💡 操作说明：右键切换活跃状态 | 点击右上角箭头或拖拽执行跨团调度
                        </div>
                        <button class="btn btn-primary" data-action="close" style="padding: 10px 30px;">完成并同步地图</button>
                    </div>
                </div>
            </div>
            <style>
                /* 【核心修复】：完全对齐活动管理页面的按钮样式 */
                .marker-drop-zone .member-entity {
                    overflow: visible !important; /* 防止箭头被裁切 */
                }
                .btn-switch-team {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    width: 18px;
                    height: 18px;
                    background: #18181b;
                    color: #fff;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    cursor: pointer;
                    z-index: 10;
                    opacity: 0;
                    transition: opacity 0.2s, transform 0.2s;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .member-entity:hover .btn-switch-team {
                    opacity: 1;
                    transform: scale(1.1);
                }
                /* 熊2特殊处理：箭头改为向左，位置依然在右上角以保持一致性 */
                .btn-switch-team.to-left {
                    /* 如果你希望熊2的箭头在左上角，可以取消注释下面两行 */
                    /* right: auto; left: -5px; */
                }
            </style>
        `;

        this.container.classList.remove('hidden');
        this.updateGrids();
        this.bindEvents();
    }

    updateGrids() {
        const q = this.searchQuery.toLowerCase().trim();
        
        // 【核心提取】：将搜索算法抽离为一个独立函数，供渲染时判断状态
        const checkMatch = (m) => {
            if (!q) return false; // 如果没输入内容，就不算匹配
            const basicMatch = m.nickname.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
            let pinyinMatch = false;
            if (typeof PinyinMatch !== 'undefined') {
                pinyinMatch = PinyinMatch.match(m.nickname, q);
            }
            return basicMatch || pinyinMatch;
        };

        const getTrapMembers = (trapKey) => {
            const trapData = this.dataManager.seatData[trapKey];
            const seatedIds = trapData.seats.map(s => s.memberId).filter(Boolean);
            const poolIds = trapData.unseated || [];
            const uniqueIds = Array.from(new Set([...seatedIds, ...poolIds]));

            return uniqueIds.map(id => this.dataManager.members.findById(id))
                            .filter(Boolean)
                            // 【核心修复】：删除了这里的 .filter() 筛选逻辑，保留所有人在网格里
                            .sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));
        };

        // 将匹配算法作为参数传递给渲染器
        this.renderZone('zone-bear1', getTrapMembers('bear1'), 'bear1', checkMatch);
        this.renderZone('zone-bear2', getTrapMembers('bear2'), 'bear2', checkMatch);
    }

    // 2. 替换 renderZone：接收匹配算法，注入高亮类名
    renderZone(containerId, members, trapKey, checkMatch) {
        const zone = this.container.querySelector(`#${containerId}`);
        const arrow = trapKey === 'bear1' 
            ? `<div class="btn-switch-team" data-action="switch-trap" title="移至熊2">➔</div>`
            : `<div class="btn-switch-team to-left" data-action="switch-trap" title="移至熊1">←</div>`;

        zone.innerHTML = members.map(m => {
            // 【核心修复】：判断当前成员是否命中搜索
            const isMatch = checkMatch(m);
            
            return `
            <div class="member-entity rank-${m.rank} status-${m.activityStatus || 0} ${isMatch ? 'search-match' : ''}" 
                 data-id="${m.id}" data-from="${trapKey}" draggable="true"
                 style="position: relative; width: var(--cell-size); height: var(--cell-size); cursor: grab; transition: all 0.2s ease;">
                ${arrow}
                <div class="entity-name" style="font-size:10px;">${m.nickname}</div>
                <div class="entity-info-index">${m.powerRank || ''}</div>
                <div class="entity-rank">${m.rank}</div>
            </div>
            `;
        }).join('');
    }

    bindEvents() {
        const searchInput = this.container.querySelector('#marker-search');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value;
                this.updateGrids();
            };
        }

        this.container.onclick = (e) => {
            const actionBtn = e.target.closest('[data-action]');
            if (!actionBtn) return;

            const action = actionBtn.dataset.action;

            if (action === 'close') {
                this.container.classList.add('hidden');
                if (this.onUpdate) this.onUpdate();
                return;
            }

            // 【核心修复】：点击箭头执行切换
            if (action === 'switch-trap') {
                e.stopPropagation();
                const entity = actionBtn.closest('.member-entity');
                if (entity) {
                    this.moveMember(entity.dataset.id, entity.dataset.from);
                }
            }
        };

        this.container.oncontextmenu = (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) {
                e.preventDefault();
                const member = this.dataManager.members.findById(entity.dataset.id);
                if (member) {
                    member.activityStatus = ((member.activityStatus || 0) + 1) % 3;
                    this.dataManager.save();
                    this.updateGrids();
                }
            }
        };

        // 拖拽逻辑保持不变...
        this.container.addEventListener('dragstart', (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) {
                e.dataTransfer.setData('text/plain', entity.dataset.id);
                e.dataTransfer.setData('from-trap', entity.dataset.from);
                entity.style.opacity = '0.4';
            }
        });

        this.container.addEventListener('dragend', (e) => {
            const entity = e.target.closest('.member-entity');
            if (entity) entity.style.opacity = '1';
        });

        this.container.querySelectorAll('.marker-drop-zone').forEach(zone => {
            zone.addEventListener('dragover', (e) => e.preventDefault());
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                const fromTrap = e.dataTransfer.getData('from-trap');
                const toTrap = zone.dataset.trap;
                if (fromTrap && toTrap && fromTrap !== toTrap) this.moveMember(id, fromTrap);
            });
        });
    }

    moveMember(mId, fromTrap) {
        const toTrap = fromTrap === 'bear1' ? 'bear2' : 'bear1';
        const fromData = this.dataManager.seatData[fromTrap];
        const toData = this.dataManager.seatData[toTrap];

        // 1. 【核心逻辑】：如果成员已在原地图安排位置，强制将其从坑位撤离
        // 这样可以防止同一个成员 ID 出现在两张地图的冲突
        const seat = fromData.seats.find(s => s.memberId === mId);
        if (seat) {
            seat.memberId = null; // 撤离原位
        }

        // 2. 清理原地图待选池（去重处理）
        fromData.unseated = (fromData.unseated || []).filter(id => id !== mId);
        
        // 3. 移入目标陷阱的待选池
        if (!toData.unseated) toData.unseated = [];
        if (!toData.unseated.includes(mId)) {
            toData.unseated.push(mId);
        }

        // 4. 【自动保存】：调用 DataManager 写入 LocalStorage
        this.dataManager.save();
        
        // 5. 实时刷新预览网格
        this.updateGrids();
        
        // 提示：由于 MemberMarkerModal 关闭时会触发 SeatPage 的 onUpdate()，
        // 此时地图上的人员撤离效果会立即生效。
    }
}