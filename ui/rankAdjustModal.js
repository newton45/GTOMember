class RankAdjustModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
        this.history = [];
        this.ranksData = {};

        this.draggedMember = null;
        this.sourceRank = null;
    }

    render(members) {
        this.history = [];
        this.ranksData = {};

        CONSTANTS.RANKS.forEach(rank => {
            this.ranksData[rank] = members.filter(m => m.rank === rank);
        });

        this.history.push(JSON.parse(JSON.stringify(this.ranksData)));

        const html = `
            <div class="modal modal-large" id="modal-rank-adjust">
                <div class="modal-header">
                    <h2>职级调整</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="rank-adjust-container">
                        ${CONSTANTS.RANKS.map(rank => `
                            <div class="rank-column" data-rank="${rank}">
                                <div class="rank-column-header">
                                    <span class="rank-badge rank-${rank}">${rank}</span>
                                    <span class="rank-count">${this.ranksData[rank].length}</span>
                                </div>
                                <div class="rank-column-content" data-rank="${rank}">
                                    ${this.ranksData[rank].map(m => this.renderMemberBlock(m)).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn" data-action="undo">撤销上一步</button>
                    <button class="btn btn-primary" data-action="save">确认</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        this.initDragDrop();
    }

    renderMemberBlock(member) {
        return `
            <div class="rank-member-block" draggable="true" data-id="${member.id}">
                <span class="member-block-nickname">${member.nickname || '未命名'}</span>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelector('.modal-close').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="save"]').onclick = () => this.save();
        this.container.querySelector('[data-action="undo"]').onclick = () => this.undo();
    }

    initDragDrop() {
        const blocks = this.container.querySelectorAll('.rank-member-block');
        const columns = this.container.querySelectorAll('.rank-column-content');

        blocks.forEach(block => {
            block.addEventListener('dragstart', (e) => {
                this.draggedMember = block.dataset.id;
                this.sourceRank = block.closest('.rank-column-content').dataset.rank;
                block.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            block.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                this.draggedMember = null;
                this.sourceRank = null;
            });
        });

        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');

                if (!this.draggedMember) return;

                const targetRank = column.dataset.rank;
                const block = this.container.querySelector(`.rank-member-block[data-id="${this.draggedMember}"]`);

                if (targetRank !== this.sourceRank) {
                    this.saveToHistory();
                    this.moveMember(this.draggedMember, this.sourceRank, targetRank);
                }
            });
        });
    }

    moveMember(memberId, fromRank, toRank) {
        const fromColumn = this.container.querySelector(`.rank-column-content[data-rank="${fromRank}"]`);
        const toColumn = this.container.querySelector(`.rank-column-content[data-rank="${toRank}"]`);
        const block = this.container.querySelector(`.rank-member-block[data-id="${memberId}"]`);

        fromColumn.removeChild(block);
        toColumn.appendChild(block);

        this.updateCounts(fromRank, toRank);
        this.updateRanksData();
    }

    updateCounts(rank1, rank2) {
        this.updateCount(rank1);
        this.updateCount(rank2);
    }

    updateCount(rank) {
        const column = this.container.querySelector(`.rank-column[data-rank="${rank}"]`);
        const countSpan = column.querySelector('.rank-count');
        const content = this.container.querySelector(`.rank-column-content[data-rank="${rank}"]`);
        countSpan.textContent = content.children.length;
    }

    updateRanksData() {
        CONSTANTS.RANKS.forEach(rank => {
            const column = this.container.querySelector(`.rank-column-content[data-rank="${rank}"]`);
            this.ranksData[rank] = [];
            column.querySelectorAll('.rank-member-block').forEach(block => {
                this.ranksData[rank].push({
                    id: block.dataset.id,
                    nickname: block.querySelector('.member-block-nickname').textContent
                });
            });
        });
    }

    saveToHistory() {
        this.history.push(JSON.parse(JSON.stringify(this.ranksData)));
    }

    undo() {
        if (this.history.length <= 1) {
            alert('没有可撤销的操作');
            return;
        }

        this.history.pop();
        this.ranksData = JSON.parse(JSON.stringify(this.history[this.history.length - 1]));

        CONSTANTS.RANKS.forEach(rank => {
            const column = this.container.querySelector(`.rank-column-content[data-rank="${rank}"]`);
            column.innerHTML = this.ranksData[rank].map(m => this.renderMemberBlock(m)).join('');
            this.updateCount(rank);
        });

        this.initDragDrop();
    }

    save() {
        const updates = {};

        CONSTANTS.RANKS.forEach(rank => {
            this.ranksData[rank].forEach(member => {
                updates[member.id] = rank;
            });
        });

        if (this.onSave) {
            this.onSave(updates);
        }
        this.close();
    }

    close() {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
        this.history = [];
        this.ranksData = {};
        this.draggedMember = null;
        this.sourceRank = null;
    }
}
