class CreateActivityModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
    }

    render() {
        const html = `
            <div class="modal" id="modal-create-activity">
                <div class="modal-header">
                    <h2>新建活动</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>活动名称</label>
                        <input type="text" id="new-act-name" value="周三战役" placeholder="请输入活动名称">
                    </div>
                    <div class="form-group" style="margin-top: 15px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="new-act-team2"> 
                            <strong>同时开启副场活动 (团2)</strong>
                        </label>
                        <p style="font-size: 12px; color: var(--gray-400); margin-top: 5px; margin-left: 20px;">
                            勾选后将自动生成团2的沙盘与待选框。
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-primary" data-action="save">确定创建</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        
        // 自动聚焦到输入框并全选文字，方便直接修改
        const nameInput = this.container.querySelector('#new-act-name');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        
        this.container.querySelector('[data-action="save"]').onclick = () => {
            const name = this.container.querySelector('#new-act-name').value.trim();
            const hasTeam2 = this.container.querySelector('#new-act-team2').checked;
            
            if (!name) return alert('活动名称不能为空');
            
            if (this.onSave) {
                this.onSave({ name, hasTeam2 });
            }
            this.close();
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}