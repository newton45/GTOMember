class MemberMarkerModal {
    constructor(container, dataManager, onUpdate) {
        this.container = container; 
        this.dataManager = dataManager;
        this.onUpdate = onUpdate;
    }

    render() {
        const html = `
            <div class="modal-overlay" id="marker-overlay">
                <div class="modal modal-large" id="modal-member-marker" style="width: 850px; max-width: 95vw;">
                    <div class="modal-header">
                        <h2>成员参与标记</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body" style="display: flex; flex-direction: column; gap: 20px;">
                        <p style="font-size:13px; color:var(--gray-600); margin:0;">
                            交互说明：<b>点击卡片主体</b>切换活跃状态 | <b>拖拽卡片</b>调整分组 | <b>不参与者</b>将被强制撤离座位。
                        </p>
                        <div style="display: flex; gap: 20px;">
                            <div class="marker-column" id="zone-bear1" data-state="bear1" style="flex:1; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 15px;">
                                <h4 style="margin-top:0; margin-bottom: 10px; text-align: center;">熊 1 阵营</h4>
                                <div class="group-members-row" id="list-bear1" style="min-height: 80px; border:none;"></div>
                            </div>
                            <div class="marker-column" id="zone-bear2" data-state="bear2" style="flex:1; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 15px;">
                                <h4 style="margin-top:0; margin-bottom: 10px; text-align: center;">熊 2 阵营</h4>
                                <div class="group-members-row" id="list-bear2" style="min-height: 80px; border:none;"></div>
                            </div>
                        </div>
                        <div class="marker-column" id="zone-none" data-state="none" style="background: #fff1f2; border: 1px dashed #fecaca; border-radius: 8px; padding: 15px;">
                            <h4 style="margin-top:0; margin-bottom: 10px; color: #be123c;">🚫 不参与打熊</h4>
                            <div class="group-members-row" id="list-none" style="min-height: 80px; border:none;"></div>
                        </div>
                    </div>
                    </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        this.renderLists();
    }

    renderLists() {
        const lists = {
            bear1: this.container.querySelector('#list-bear1'),
            bear2: this.container.querySelector('#list-bear2'),
            none: this.container.querySelector('#list-none')
        };
        if (!lists.bear1) return; 
        Object.values(lists).forEach(l => l.innerHTML = '');

        const members = this.dataManager.members.getAll()
            .filter(m => !m.leftAlliance)
            .sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));

        members.forEach(m => {
            const state = m.participation || 'bear1';
            const isNone = state === 'none';
            const opacityStyle = isNone ? 'opacity: 0.5; filter: grayscale(1);' : '';
            
            const card = `
                <div class="member-entity rank-${m.rank} status-${m.activityStatus || 0}" 
                     data-id="${m.id}" draggable="true" 
                     style="position:relative; margin:0; cursor:pointer; ${opacityStyle}">
                    <div class="entity-name">${m.nickname}</div>
                    <div class="entity-info-index">${m.powerRank || ''}</div>
                </div>
            `;
            if (lists[state]) lists[state].insertAdjacentHTML('beforeend', card);
        });
    }

    updateParticipation(memberId, newState) {
        const member = this.dataManager.members.findById(memberId);
        if (!member) return;

        member.participation = newState;

        if (newState === 'none') {
            ['bear1', 'bear2'].forEach(tab => {
                const trapData = this.dataManager.seatData[tab];
                const seat = trapData.seats.find(s => s.memberId === memberId);
                if (seat) seat.memberId = null;
                trapData.unseated = trapData.unseated.filter(id => id !== memberId);
            });
        } else {
            const trapData = this.dataManager.seatData[newState];
            const isSeated = trapData.seats.some(s => s.memberId === memberId);
            if (!isSeated && !trapData.unseated.includes(memberId)) {
                trapData.unseated.push(memberId);
            }
        }

        this.dataManager.save();
        this.renderLists();
    }

    bindEvents() {
        // 绑定右上角 X 关闭按钮
        const xBtn = this.container.querySelector('.modal-close');
        if (xBtn) {
            xBtn.onclick = () => {
                this.container.classList.add('hidden');
                this.container.innerHTML = '';
                if (this.onUpdate) this.onUpdate(); 
            };
        }

        this.container.onclick = (e) => {
            const card = e.target.closest('.member-entity');
            if (card && !card.classList.contains('dragging')) {
                const mid = card.dataset.id;
                const m = this.dataManager.members.findById(mid);
                if (m) {
                    m.activityStatus = (m.activityStatus + 1) % 3;
                    this.dataManager.save();
                    this.renderLists(); 
                }
            }
        };

        let draggedId = null;
        this.container.addEventListener('dragstart', (e) => {
            const card = e.target.closest('.member-entity');
            if (card) { draggedId = card.dataset.id; card.classList.add('dragging'); }
        });

        this.container.addEventListener('dragover', e => e.preventDefault());

        this.container.addEventListener('drop', (e) => {
            const col = e.target.closest('.marker-column');
            if (col && draggedId) {
                this.updateParticipation(draggedId, col.dataset.state);
                draggedId = null;
            }
        });
    }
}