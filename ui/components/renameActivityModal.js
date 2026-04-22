class RenameActivityModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
    }

    render(currentName) {
        const html = `
            <div class="modal" id="modal-rename-activity">
                <div class="modal-header">
                    <h2>重命名活动</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>新活动名称</label>
                        <input type="text" id="rename-act-name" value="${currentName}" placeholder="请输入新活动名称">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">确定修改</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        
        const nameInput = this.container.querySelector('#rename-act-name');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        
        this.container.querySelector('[data-action="save"]').onclick = () => {
            const name = this.container.querySelector('#rename-act-name').value.trim();
            if (!name) return alert('活动名称不能为空');
            
            if (this.onSave) {
                this.onSave(name);
            }
            this.close();
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}