class BatchAddModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
    }

    render() {
        const html = `
            <div class="modal" id="modal-batch-add">
                <div class="modal-header">
                    <h2>批量新增成员</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>请输入成员信息（每行格式：昵称-ID）</label>
                        <textarea id="batch-input" rows="10" placeholder="例如：
张三-12345678
李四-87654321
王五-11223344"></textarea>
                    </div>
                    <div class="batch-options">
                        <label>默认职级：
                            <select id="batch-default-rank">
                                ${CONSTANTS.RANKS.map(r =>
                                    `<option value="${r}" ${r === CONSTANTS.DEFAULT_RANK ? 'selected' : ''}>${r}</option>`
                                ).join('')}
                            </select>
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">批量添加</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('.modal-close').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="save"]').onclick = () => this.save();
    }

    parseInput() {
        const input = this.container.querySelector('#batch-input').value.trim();
        const lines = input.split('\n').filter(line => line.trim());

        const members = [];
        const errors = [];

        lines.forEach((line, idx) => {
            const match = line.trim().match(/^(.+)-(\d{8})$/);
            if (match) {
                const nickname = match[1].trim();
                const id = match[2];
                members.push({ nickname, id });
            } else {
                errors.push(`第${idx + 1}行格式错误: ${line}`);
            }
        });

        return { members, errors };
    }

    save() {
        const defaultRank = this.container.querySelector('#batch-default-rank').value;
        const { members, errors } = this.parseInput();

        if (errors.length > 0) {
            alert('输入格式错误:\n' + errors.join('\n'));
            return;
        }

        if (members.length === 0) {
            alert('请输入至少一名成员');
            return;
        }

        const result = members.map(m => ({
            ...m,
            rank: defaultRank,
            powerRank: null,
            accounts: [],
            leftAlliance: false,
            pastNicknames: []
        }));

        if (this.onSave) {
            this.onSave(result);
        }
        this.close();
    }

    close() {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
    }
}
