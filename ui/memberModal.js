class MemberModal {
    constructor(container) {
        this.container = container;
        this.currentMember = null;
        this.tempAccounts = [];
        this.tempPastNicknames = [];
    }

    render(member = null) {
        this.currentMember = member;
        this.tempAccounts = member ? [...member.accounts] : [];
        this.tempPastNicknames = member ? [...(member.pastNicknames || [])] : [];

        const isEdit = !!member;
        const title = isEdit ? '编辑成员' : '新建成员';

        const html = `
            <div class="modal" id="modal-member">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>昵称</label>
                        <input type="text" id="field-nickname" value="${member?.nickname || ''}" placeholder="请输入昵称">
                    </div>
                    <div class="form-group">
                        <label>曾用昵称</label>
                        <div class="past-nicknames-list" id="past-nicknames-list"></div>
                    </div>
                    <div class="form-group">
                        <label>ID</label>
                        <input type="text" id="field-id" value="${member?.id || ''}" placeholder="8位数字ID" maxlength="8">
                    </div>
                    <div class="form-group">
                        <label>战力排名</label>
                        <input type="number" id="field-power" value="${member?.powerRank ?? ''}" min="1" max="100" placeholder="1-100">
                    </div>
                    <div class="form-group">
                        <label>职级</label>
                        <select id="field-rank">
                            ${CONSTANTS.RANKS.map(r =>
                                `<option value="${r}" ${member?.rank === r ? 'selected' : ''}>${r}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>分账号</label>
                        <div class="accounts-list" id="accounts-list"></div>
                        <div class="add-account-row">
                            <input type="text" id="new-account-nickname" placeholder="分账号昵称">
                            <input type="text" id="new-account-id" placeholder="分账号ID" maxlength="8">
                            <button class="btn btn-primary" id="btn-add-account">添加</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="field-left" ${member?.leftAlliance ? 'checked' : ''}>
                            是否离盟
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">保存</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        this.renderAccounts();
        this.renderPastNicknames();
    }

    renderAccounts() {
        const list = this.container.querySelector('#accounts-list');
        if (this.tempAccounts.length === 0) {
            list.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem;">暂无分账号</p>';
            return;
        }
        list.innerHTML = this.tempAccounts.map((acc, idx) => `
            <div class="accounts-list-item">
                <span>${acc.nickname} (${acc.id})</span>
                <button class="btn btn-danger" data-action="remove-account" data-index="${idx}">删除</button>
            </div>
        `).join('');
    }

    renderPastNicknames() {
        const list = this.container.querySelector('#past-nicknames-list');
        if (this.tempPastNicknames.length === 0) {
            list.innerHTML = '<p style="color: #6b7280; font-size: 0.875rem;">暂无曾用昵称</p>';
            return;
        }
        list.innerHTML = this.tempPastNicknames.map((nick, idx) => `
            <div class="past-nickname-item" data-index="${idx}">
                <span>${nick}</span>
                <button class="past-nickname-remove" data-index="${idx}">&times;</button>
            </div>
        `).join('');
    }

    bindEvents() {
        this.container.querySelector('.modal-close').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();

        this.container.querySelector('[data-action="save"]').onclick = () => this.save();
        this.container.querySelector('#btn-add-account').onclick = () => this.addAccount();

        this.container.onclick = (e) => {
            if (e.target.dataset.action === 'remove-account') {
                this.removeAccount(parseInt(e.target.dataset.index));
            }
            if (e.target.classList.contains('past-nickname-remove')) {
                this.removePastNickname(parseInt(e.target.dataset.index));
            }
        };
    }

    addAccount() {
        const nickname = this.container.querySelector('#new-account-nickname').value.trim();
        const id = this.container.querySelector('#new-account-id').value.trim();

        if (!nickname || !id) {
            alert('请输入分账号昵称和ID');
            return;
        }

        this.tempAccounts.push({ nickname, id });
        this.container.querySelector('#new-account-nickname').value = '';
        this.container.querySelector('#new-account-id').value = '';
        this.renderAccounts();
    }

    removeAccount(index) {
        this.tempAccounts.splice(index, 1);
        this.renderAccounts();
    }

    removePastNickname(index) {
        this.tempPastNicknames.splice(index, 1);
        this.renderPastNicknames();
    }

    save() {
        const nickname = this.container.querySelector('#field-nickname').value.trim();
        const id = this.container.querySelector('#field-id').value.trim();
        const powerRank = this.container.querySelector('#field-power').value;
        const rank = this.container.querySelector('#field-rank').value;
        const leftAlliance = this.container.querySelector('#field-left').checked;

        if (!id) {
            alert('请输入ID');
            return;
        }

        if (!/^\d{8}$/.test(id)) {
            alert('ID必须是8位数字');
            return;
        }

        if (powerRank && (powerRank < 1 || powerRank > 100)) {
            alert('战力排名必须在1-100之间');
            return;
        }

        const memberData = {
            nickname,
            id,
            powerRank: powerRank ? parseInt(powerRank) : null,
            rank,
            accounts: this.tempAccounts,
            leftAlliance,
            pastNicknames: this.tempPastNicknames
        };

        if (this.onSave) {
            this.onSave(memberData, this.currentMember);
        }
        this.close();
    }

    close() {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
        this.currentMember = null;
        this.tempAccounts = [];
        this.tempPastNicknames = [];
    }
}
