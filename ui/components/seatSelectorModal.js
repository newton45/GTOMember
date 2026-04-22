class SeatSelectorModal {
    constructor(container) {
        this.container = container;
        this.onSelect = null;
    }

    render(unseatedMembers, seatedMembers) {
        // 按照战力排序（从小到大，没有战力的排在最后）
        const sortFn = (a, b) => (a.powerRank || 999) - (b.powerRank || 999);
        unseatedMembers.sort(sortFn);
        seatedMembers.sort(sortFn);

        const renderCards = (members) => members.map(m => `
            <div class="member-entity rank-${m.rank} selector-card" data-id="${m.id}" style="width:var(--cell-size); height:var(--cell-size); position:relative; cursor:pointer; flex-shrink:0; margin:0;" title="${m.nickname}">
                <div class="entity-name" style="font-size:10px; font-weight:bold; display:flex; align-items:center; justify-content:center; height:100%;">${m.nickname}</div>
                <div class="entity-info-index" style="position:absolute; bottom:2px; left:2px; font-size:8px; opacity:0.5;">${m.powerRank || ''}</div>
                <div class="entity-rank" style="position:absolute; bottom:2px; right:2px; font-size:8px; font-weight:bold;">${m.rank}</div>
            </div>
        `).join('');

        const html = `
            <div class="modal modal-selector" id="modal-seat-selector">
                <div class="modal-header">
                    <h2>安排入座</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:13px; color:var(--gray-700); margin-bottom:15px;">
                        请选择一位在盟成员入座。
                    </p>
                    
                    <h4 style="margin-bottom: 8px; border-left: 3px solid var(--primary); padding-left: 8px;">未落座成员</h4>
                    <div class="group-members-row" style="background: var(--gray-100); padding: 10px; border-radius: 8px; margin-bottom: 20px; min-height: 65px; display: flex; flex-wrap: wrap; gap: 8px;">
                        ${unseatedMembers.length > 0 ? renderCards(unseatedMembers) : '<div style="color:var(--gray-400); font-size:12px; padding:10px;">暂无</div>'}
                    </div>

                    <h4 style="margin-bottom: 8px; border-left: 3px solid var(--warning); padding-left: 8px;">已落座成员 (选择将导致其转移座位)</h4>
                    <div class="group-members-row" style="background: var(--gray-100); padding: 10px; border-radius: 8px; min-height: 65px; display: flex; flex-wrap: wrap; gap: 8px;">
                        ${seatedMembers.length > 0 ? renderCards(seatedMembers) : '<div style="color:var(--gray-400); font-size:12px; padding:10px;">暂无</div>'}
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        
        this.container.querySelectorAll('.selector-card').forEach(item => {
            item.onclick = () => {
                if (this.onSelect) this.onSelect(item.dataset.id);
                this.close();
            };
        });
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}