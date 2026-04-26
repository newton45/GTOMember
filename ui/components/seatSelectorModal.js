/* ui/components/seatSelectorModal.js */
class SeatSelectorModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
        
        // 【核心修复】：为弹窗初始化内存集合，避免点击时崩溃
        this.selectedIds = new Set(); 
        this.allMembers = [];
    }

    render(members) {
        // 【核心修复】：按战力 (powerRank) 自动排序，前高后低
        this.allMembers = [...members].sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));
        this.selectedIds.clear();

        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal modal-selector" style="width: 600px;">
                    <div class="modal-header">
                        <h2>选择成员落座</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box" style="margin-bottom: 15px;">
                            <input type="text" id="selector-search" placeholder="支持姓名、ID、职级、拼音首字母搜索..." 
                                   style="width: 100%; padding: 8px; border: 1px solid var(--gray-300); border-radius: 4px;">
                        </div>
                        <div class="selector-grid" id="selector-member-grid" 
                             style="display: grid; 
                                    grid-template-columns: repeat(auto-fill, var(--cell-size)); 
                                    gap: var(--grid-gap); 
                                    justify-content: center;
                                    max-height: 400px; 
                                    overflow-y: auto; 
                                    padding: 10px;
                                    background: var(--gray-100);
                                    border-radius: 8px;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <span id="selected-count" style="margin-right: auto; color: var(--gray-600); font-size: 13px;">已选择: <b id="count-num">0</b> 人</span>
                        <button class="btn" data-action="close">取消</button>
                        <button class="btn btn-primary" id="btn-selector-confirm">确认落座</button>
                    </div>
                </div>
            </div>
        `;

        this.container.classList.remove('hidden');
        this.updateGrid(); 
        this.bindEvents();
    }

    updateGrid(query = '') {
        const grid = this.container.querySelector('#selector-member-grid');
        if (!grid) return;
        
        const q = query.toLowerCase().trim();

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

        grid.innerHTML = this.allMembers.map(m => {
            const isSelected = this.selectedIds.has(m.id);
            const isMatch = checkMatch(m);

            // 黑色粗框与紫框共存
            const selectedStyle = isSelected 
                ? 'border: 3px solid #18181b !important; box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important; z-index: 10; transform: scale(1.05);' 
                : 'border: 1px solid transparent;';

            return `
                <div class="member-entity rank-${m.rank} ${isMatch ? 'search-match' : ''}" 
                     data-id="${m.id}" 
                     style="cursor: pointer; position: relative; width: var(--cell-size); height: var(--cell-size); transition: all 0.2s; ${selectedStyle}">
                    <div class="entity-name" style="font-size:10px;">${m.nickname}</div>
                    <div class="entity-info-index">${m.powerRank || ''}</div>
                    <div class="entity-rank">${m.rank}</div>
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        const searchInput = this.container.querySelector('#selector-search');
        if (searchInput) {
            searchInput.oninput = (e) => this.updateGrid(e.target.value);
        }

        const grid = this.container.querySelector('#selector-member-grid');
        grid.onclick = (e) => {
            const card = e.target.closest('.member-entity');
            if (!card) return;

            const id = card.dataset.id;
            
            // 【特殊优化】：由于座位只能坐一个人，这里实现“排他单选”
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
            } else {
                this.selectedIds.clear(); // 清空之前选中的人
                this.selectedIds.add(id);
            }
            
            this.updateGrid(searchInput ? searchInput.value : '');
            this.container.querySelector('#count-num').innerText = this.selectedIds.size;
        };

        this.container.querySelector('#btn-selector-confirm').onclick = () => {
            if (this.selectedIds.size === 0) return alert('请至少选择一名成员落座');
            // 回传 ID 数组
            if (this.onConfirm) this.onConfirm(Array.from(this.selectedIds));
            this.close();
        };

        this.container.querySelectorAll('[data-action="close"]').forEach(btn => {
            btn.onclick = () => this.close();
        });
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}