class TeamAllocationModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
    }

    render(members) {
        // 分离当前分团状态
        const team1 = members.filter(m => m.defaultTeam === 1);
        const team2 = members.filter(m => m.defaultTeam === 2);

        const html = `
            <div class="modal modal-large">
                <div class="modal-header">
                    <h2>配置人员分团 (拖拽调整)</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body allocation-body">
                    <div class="allocation-column" data-team="1">
                        <h3>第一团</h3>
                        <div class="allocation-list" id="list-team-1">
                            ${this.generateListHtml(team1)}
                        </div>
                    </div>
                    <div class="allocation-column" data-team="2">
                        <h3>第二团</h3>
                        <div class="allocation-list" id="list-team-2">
                            ${this.generateListHtml(team2)}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">保存配置</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    generateListHtml(members) {
        return members.map(m => `
            <div class="member-entity rank-${m.rank} allocation-item" draggable="true" data-id="${m.id}">
                <div class="entity-name">${m.nickname}</div>
                <div class="entity-info-index">${m.powerRank || ''}</div>
                <div class="entity-rank">${m.rank}</div>
            </div>
        `).join('');
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();

        const lists = this.container.querySelectorAll('.allocation-list');
        let draggedId = null;

        lists.forEach(list => {
            list.ondragstart = (e) => {
                const item = e.target.closest('.allocation-item');
                if (item) {
                    draggedId = item.dataset.id;
                    item.classList.add('dragging');
                }
            };

            list.ondragover = (e) => e.preventDefault();

            list.ondrop = (e) => {
                e.preventDefault();
                if (!draggedId) return;
                const item = document.querySelector(`.allocation-item.dragging`);
                list.appendChild(item);
                item.classList.remove('dragging');
            };
        });

        this.container.querySelector('[data-action="save"]').onclick = () => {
            const updates = {};
            this.container.querySelectorAll('.allocation-column').forEach(col => {
                const team = parseInt(col.dataset.team);
                col.querySelectorAll('.allocation-item').forEach(item => {
                    updates[item.dataset.id] = team;
                });
            });
            if (this.onSave) this.onSave(updates);
            this.close();
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}