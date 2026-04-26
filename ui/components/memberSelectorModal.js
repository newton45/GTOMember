/* ui/components/memberSelectorModal.js */
class MemberSelectorModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
        this.selectedIds = new Set();
        this.allMembers = []; // 内存缓冲区
    }

    render(members) {
        this.allMembers = members;
        this.selectedIds.clear();

        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal modal-selector" style="width: 600px;">
                    <div class="modal-header">
                        <h2>选择成员加入组</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box" style="margin-bottom: 15px;">
                            <input type="text" id="selector-search" placeholder="支持姓名、ID、职级、拼音首字母搜索..." style="width: 100%; padding: 8px; border: 1px solid var(--gray-300); border-radius: 4px;">
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
                        <button class="btn btn-primary" id="btn-selector-confirm">确认添加</button>
                    </div>
                </div>
            </div>
        `;

        this.container.classList.remove('hidden');
        this.updateGrid(); // 渲染成员卡片
        this.bindEvents(); // 绑定交互事件
    }

    // 核心渲染逻辑：处理搜索过滤与状态显示
    updateGrid(query = '') {
        const grid = this.container.querySelector('#selector-member-grid');
        if (!grid) return;

        const q = query.toLowerCase().trim();

        // 拼音与多维度检索算法
        const checkMatch = (m) => {
            // 【核心修复 1】：如果没有输入搜索词，则不产生任何高亮
            if (!q) return false; 
            
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
            return basicMatch || pinyinMatch;
        };

        // 【核心修复 2】：不再执行 filter 过滤，而是全量渲染所有成员
        grid.innerHTML = this.allMembers.map(m => {
            const isSelected = this.selectedIds.has(m.id);
            const isMatch = checkMatch(m);

            // 【核心修复 3】：斩断 CSS 优先级污染，直接用强内联样式注入 3px 黑框与阴影
            const selectedStyle = isSelected 
                ? 'border: 3px solid #18181b !important; box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important; transform: scale(1.05); z-index: 10;' 
                : 'border: 1px solid transparent;';

            // isMatch 添加 search-match 类，调用原有紫框样式 (outline)
            // 这样紫框 (outline) 和选中黑框 (border) 可以在同时满足时完美叠加
            return `
                <div class="member-entity rank-${m.rank} ${isMatch ? 'search-match' : ''} ${isSelected ? 'selected-target' : ''}" 
                     data-id="${m.id}" 
                     style="cursor: pointer; position: relative; width: var(--cell-size); height: var(--cell-size); transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); ${selectedStyle}">
                    <div class="entity-name" style="font-size:10px;">${m.nickname}</div>
                    <div class="entity-info-index">${m.powerRank || ''}</div>
                    <div class="entity-rank">${m.rank}</div>
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        // 1. 关闭/取消事件
        const closeBtn = this.container.querySelector('.modal-close');
        const cancelBtn = this.container.querySelector('[data-action="close"]');
        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) btn.onclick = () => this.close();
        });

        // 2. 搜索框输入事件 - 实时触发 updateGrid
        const searchInput = this.container.querySelector('#selector-search');
        if (searchInput) {
            searchInput.oninput = (e) => this.updateGrid(e.target.value);
        }

        // 3. 成员点击选中事件 (使用事件委托提高性能)
        const grid = this.container.querySelector('#selector-member-grid');
        if (grid) {
            grid.onclick = (e) => {
                const card = e.target.closest('.member-entity');
                if (!card) return;

                const id = card.dataset.id;
                if (this.selectedIds.has(id)) {
                    this.selectedIds.delete(id);
                } else {
                    this.selectedIds.add(id);
                }
                
                // 更新 UI：重新渲染当前搜索状态下的网格
                this.updateGrid(searchInput ? searchInput.value : '');
                this.container.querySelector('#count-num').innerText = this.selectedIds.size;
            };
        }

        // 4. 确认提交事件
        const confirmBtn = this.container.querySelector('#btn-selector-confirm');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                if (this.selectedIds.size === 0) return alert('请至少选择一名成员');
                if (this.onConfirm) this.onConfirm(Array.from(this.selectedIds));
                this.close();
            };
        }
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}