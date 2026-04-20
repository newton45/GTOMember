class MemberModal {
    constructor(container) {
        this.container = container;
        this.currentMember = null;
        this.tempPastNicknames = []; 
    }

    render(member = null) {
        this.currentMember = member;
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
                        <label>当前昵称</label>
                        <input type="text" id="field-nickname" value="${member?.nickname || ''}" placeholder="输入新昵称">
                    </div>
                    
                    <div class="form-group">
                        <label>曾用名 (点击删除，或回车添加)</label>
                        <div class="past-nicknames-container">
                            <div class="tags-wrapper" id="past-nicknames-tags"></div>
                            <input type="text" id="add-past-nickname" class="tag-input" placeholder="+ 添加...">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>ID (唯一标识)</label>
                        <input type="text" id="field-id" value="${member?.id || ''}" placeholder="输入成员ID (支持字母/数字)">
                    </div>
                    
                    <div class="form-group">
                        <label>职级</label>
                        <select id="field-rank">
                            ${CONSTANTS.RANKS.map(r => `<option value="${r}" ${member?.rank === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">同步并保存</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.renderTags();
        this.bindEvents();
    }

    renderTags() {
        const wrapper = this.container.querySelector('#past-nicknames-tags');
        wrapper.innerHTML = this.tempPastNicknames.map((name, idx) => `
            <span class="nickname-tag" data-index="${idx}">${name} <i class="tag-del">×</i></span>
        `).join('');
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="save"]').onclick = () => this.save();

        const tagInput = this.container.querySelector('#add-past-nickname');
        tagInput.onkeydown = (e) => {
            if (e.key === 'Enter' && tagInput.value.trim()) {
                this.tempPastNicknames.push(tagInput.value.trim());
                tagInput.value = '';
                this.renderTags();
            }
        };

        this.container.querySelector('#past-nicknames-tags').onclick = (e) => {
            const tag = e.target.closest('.nickname-tag');
            if (tag) {
                const idx = parseInt(tag.dataset.index);
                this.tempPastNicknames.splice(idx, 1);
                this.renderTags();
            }
        };
    }

    save() {
        const newNickname = this.container.querySelector('#field-nickname').value.trim();
        const newId = this.container.querySelector('#field-id').value.trim();
        const rank = this.container.querySelector('#field-rank').value;

        // 【解绑限制】：将验证逻辑放宽，只要存在非空字符即可，不再要求必须为 8 位数字
        if (!newId) return alert('ID不能为空');

        if (this.currentMember && this.currentMember.nickname !== newNickname) {
            if (this.currentMember.nickname) {
                this.tempPastNicknames.push(this.currentMember.nickname);
            }
        }

        const memberData = {
            nickname: newNickname,
            id: newId, 
            rank,
            pastNicknames: [...new Set(this.tempPastNicknames)],
            leftAlliance: this.currentMember?.leftAlliance || false
        };

        if (this.onSave) this.onSave(memberData, this.currentMember);
        this.close();
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}