class ClearHistoryModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
        this.selectedIds = new Set();
    }

    render(members) {
        this.selectedIds.clear();
        const html = `
            <div class="modal">
                <div class="modal-header">
                    <h2>清空历史战果数据</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="warning-text">选择成员以清空其过往的所有战果排名及出勤记录：</p>
                    <div class="selector-grid">
                        ${members.map(m => `
                            <div class="member-entity rank-${m.rank} clear-item" data-id="${m.id}">
                                <div class="entity-name">${m.nickname}</div>
                                <div class="entity-info-index">${m.powerRank || ''}</div>
                                <div class="entity-rank">${m.rank}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-danger" data-action="confirm">立即清空所选</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('.selector-grid').onclick = (e) => {
            const item = e.target.closest('.clear-item');
            if (!item) return;
            const id = item.dataset.id;
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
                item.classList.remove('search-match');
            } else {
                this.selectedIds.add(id);
                item.classList.add('search-match');
            }
        };

        this.container.querySelector('[data-action="confirm"]').onclick = () => {
            if (this.selectedIds.size === 0) return alert('请至少选择一名成员');
            if (confirm(`确定要清空这 ${this.selectedIds.size} 名成员的历史记录吗？此操作不可逆。`)) {
                if (this.onConfirm) this.onConfirm(Array.from(this.selectedIds));
                this.close();
            }
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}