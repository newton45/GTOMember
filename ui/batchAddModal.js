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
                        <label>请输入成员信息（格式：昵称+ID，每行一个）</label>
                        <textarea id="batch-input" rows="10" placeholder="示例：\n张三+GameID_001\n李四+A1234"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">解析并批量添加</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="save"]').onclick = () => this.save();
    }

    parseInput() {
        const input = this.container.querySelector('#batch-input').value.trim();
        const lines = input.split('\n').filter(line => line.trim());

        const members = [];
        const errors = [];

        lines.forEach((line, idx) => {
            // 【解绑限制】：以加号为界，左侧为昵称，右侧全部作为 ID 字符串
            const match = line.trim().match(/^([^\+]+)\+(.+)$/);
            
            if (match) {
                const nickname = match[1].trim();
                const id = match[2].trim();
                
                if(!id) {
                    errors.push(`第${idx + 1}行格式错误: ID不能为空`);
                    return;
                }
                
                members.push({ 
                    nickname, 
                    id, 
                    rank: 'R1', 
                    leftAlliance: true, 
                    powerRank: null,
                    pastNicknames: []
                });
            } else {
                errors.push(`第${idx + 1}行格式错误: 请确保包含加号分割 (示例：张三+ID123)`);
            }
        });

        return { members, errors };
    }

    save() {
        const { members, errors } = this.parseInput();

        if (errors.length > 0) {
            const proceed = confirm(`解析时发现 ${errors.length} 处格式错误：\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}\n\n是否跳过错误行，继续添加格式正确的 ${members.length} 条数据？`);
            if (!proceed) return;
        }

        if (members.length === 0) {
            return alert('没有解析到有效的成员数据，请检查输入格式。');
        }

        if (this.onSave) {
            this.onSave(members);
        }
        
        this.close();
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}