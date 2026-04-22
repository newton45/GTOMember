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
                        <label>请输入成员信息（格式：昵称+ID，或仅昵称，每行一个）</label>
                        <textarea id="batch-input" rows="10" placeholder="示例：\n张三+GameID_001\n李四+A1234\n王五"></textarea>
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

    // 修改 parseInput 方法中的解析逻辑
parseInput() {
    const input = this.container.querySelector('#batch-input').value.trim();
    const lines = input.split('\n').filter(line => line.trim());

    const members = [];
    const errors = [];

    lines.forEach((line, idx) => {
        const trimmedLine = line.trim();
        let nickname = '';
        let id = '';

        // 修改正则：使加号及其后的部分变为可选
        // ^([^\+]+) 匹配昵称
        // (?:\+(.*))? 可选地匹配加号及其后的所有内容
        const match = trimmedLine.match(/^([^\+]+)(?:\+(.*))?$/);
        
        if (match) {
            nickname = match[1].trim();
            id = match[2] ? match[2].trim() : '';
            
            if(!nickname) {
                errors.push(`第${idx + 1}行格式错误: 昵称不能为空`);
                return;
            }
            
            // 生成带有“空缺”前缀的 6 位随机序列号
            const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
            const sentinelId = `空缺_${randomSuffix}`;

            members.push({ 
                nickname, 
                // 如果用户没填 ID，则使用哨兵 ID
                id: id || sentinelId, 
                rank: 'R1', 
                leftAlliance: true, 
                powerRank: null,
                pastNicknames: []
            });
        } else {
            errors.push(`第${idx + 1}行格式错误`);
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