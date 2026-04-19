class MembersPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.grid = document.getElementById('members-grid');
        this.modal = new MemberModal(modalContainer);
        this.batchModal = new BatchAddModal(modalContainer);
        this.rankModal = new RankAdjustModal(modalContainer);
        this.powerModal = new PowerAdjustModal(modalContainer);
        this.renderer = new MemberRenderer(this.grid);

        this.bindEvents();
        this.render();
    }

    bindEvents() {
        document.getElementById('btn-add-member').onclick = () => {
            this.modal.onSave = (data, existing) => this.handleSave(data, existing);
            this.modal.render();
        };

        document.getElementById('btn-batch-add').onclick = () => {
            this.batchModal.onSave = (members) => this.handleBatchAdd(members);
            this.batchModal.render();
        };

        document.getElementById('btn-rank-adjust').onclick = () => {
            const allMembers = this.dataManager.members.getAll();
            this.rankModal.onSave = (updates) => this.handleRankAdjust(updates);
            this.rankModal.render(allMembers);
        };

        document.getElementById('btn-power-adjust').onclick = () => {
            const allMembers = this.dataManager.members.getAll();
            this.powerModal.onSave = (updates) => this.handlePowerAdjust(updates);
            this.powerModal.render(allMembers);
        };

        document.getElementById('search-member').oninput = (e) => {
            this.render(e.target.value);
        };

        document.getElementById('filter-rank').onchange = () => this.render();
        document.getElementById('filter-status').onchange = () => this.render();

        this.grid.onclick = (e) => {
            const action = e.target.dataset.action;
            const id = e.target.dataset.id;

            if (action === 'edit') {
                const member = this.dataManager.members.findById(id);
                if (member) {
                    this.modal.onSave = (data, existing) => this.handleSave(data, existing);
                    this.modal.render(member);
                }
            } else if (action === 'delete') {
                if (confirm('确定要删除该成员吗？')) {
                    this.dataManager.members.remove(id);
                    this.saveAndRender();
                }
            }
        };
    }

    handleSave(data, existing) {
        if (existing) {
            this.dataManager.members.update(existing.id, data);
        } else {
            const member = new Member(data);
            this.dataManager.members.add(member);
        }
        this.saveAndRender();
    }

    handleBatchAdd(members) {
        let successCount = 0;
        const errors = [];

        members.forEach(memberData => {
            try {
                const member = new Member(memberData);
                this.dataManager.members.add(member);
                successCount++;
            } catch (error) {
                errors.push(`ID ${memberData.id}: ${error.message}`);
            }
        });

        this.saveAndRender();

        if (errors.length > 0) {
            alert(`成功添加 ${successCount} 人，失败 ${errors.length} 人\n\n错误详情：\n${errors.join('\n')}`);
        } else {
            alert(`成功添加 ${successCount} 人`);
        }
    }

    handleRankAdjust(updates) {
        Object.entries(updates).forEach(([id, newRank]) => {
            this.dataManager.members.update(id, { rank: newRank });
        });
        this.saveAndRender();
    }

    handlePowerAdjust(updates) {
        Object.entries(updates).forEach(([id, data]) => {
            this.dataManager.members.update(id, data);
        });
        this.saveAndRender();
    }

    getFilteredMembers(searchQuery = '') {
        let members = this.dataManager.members.getAll();

        const rankFilter = document.getElementById('filter-rank').value;
        const statusFilter = document.getElementById('filter-status').value;

        if (searchQuery) {
            members = this.dataManager.members.search(searchQuery);
        }

        if (rankFilter) {
            members = members.filter(m => m.rank === rankFilter);
        }

        if (statusFilter) {
            members = members.filter(m => m.leftAlliance === (statusFilter === 'true'));
        }

        return members;
    }

    render(searchQuery = '') {
        const members = this.getFilteredMembers(searchQuery);
        this.renderer.render(members);
    }

    saveAndRender() {
        this.dataManager.save();
        this.render(document.getElementById('search-member').value);
    }
}
