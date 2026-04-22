class MemberSelectorModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
        this.selectedIds = new Set();
    }

    render(availableMembers) {
        this.selectedIds.clear();
        
        const html = `
            <div class="modal modal-selector modal-large">
                <div class="modal-header">
                    <h2>选择成员入组</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="selector-search">
                        <input type="text" id="selector-search-input" placeholder="搜索成员或职级...">
                    </div>
                    <div class="selector-grid" id="selector-member-grid">
                        ${this.generateGridHtml(availableMembers)}
                    </div>
                </div>
                <div class="modal-footer">
                    <span class="selected-count">已选: <b id="count-num">0</b> 人</span>
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="confirm">确定添加</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents(availableMembers);
    }

    generateGridHtml(members) {
        if (members.length === 0) return '<div class="placeholder" style="width:100%;">该团暂无可分配成员</div>';
        
        return members.map(m => `
            <div class="member-entity rank-${m.rank} selector-item" data-id="${m.id}" style="position: relative; width: var(--cell-size); height: var(--cell-size);">
                <div class="entity-name">${m.nickname}</div>
                <div class="entity-info-index">${m.powerRank || ''}</div>
                <div class="entity-rank">${m.rank}</div>
            </div>
        `).join('');
    }

    bindEvents(members) {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        
        const grid = this.container.querySelector('#selector-member-grid');
        grid.onclick = (e) => {
            const item = e.target.closest('.selector-item');
            if (!item) return;

            const id = item.dataset.id;
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
                item.classList.remove('search-match'); 
            } else {
                this.selectedIds.add(id);
                item.classList.add('search-match');
            }
            this.container.querySelector('#count-num').innerText = this.selectedIds.size;
        };

        const searchInput = this.container.querySelector('#selector-search-input');
        searchInput.oninput = (e) => {
            const q = e.target.value.toLowerCase();
            const items = grid.querySelectorAll('.selector-item');
            items.forEach(item => {
                const m = members.find(mem => mem.id === item.dataset.id);
                const isMatch = m.nickname.toLowerCase().includes(q) || m.rank.toLowerCase().includes(q) || m.id.includes(q);
                item.style.display = isMatch ? 'grid' : 'none';
            });
        };

        this.container.querySelector('[data-action="confirm"]').onclick = () => {
            if (this.onConfirm) this.onConfirm(Array.from(this.selectedIds));
            this.close();
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}