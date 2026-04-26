/* ui/components/clearMapModal.js */
class ClearMapModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
    }

    render(bearName) {
        const html = `
            <div class="modal-overlay">
                <div class="modal modal-selector" style="width: 320px;">
                    <div class="modal-header">
                        <h2>清除确认 - ${bearName}</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 15px 10px;">
                        <p style="font-size: 12px; color: var(--gray-500); margin-bottom: 15px;">请勾选需要执行的清除操作：</p>
                        
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
                                <input type="checkbox" id="chk-clear-personnel" checked style="width: 18px; height: 18px;">
                                <span>清除人员 (移回待选池)</span>
                            </label>
                            
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
                                <input type="checkbox" id="chk-clear-seats" style="width: 18px; height: 18px;">
                                <span>清除座位 (彻底删除)</span>
                            </label>
                            
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px;">
                                <input type="checkbox" id="chk-clear-obstacles" style="width: 18px; height: 18px;">
                                <span>清除障碍物 (当前视野)</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer" style="margin-top: 20px;">
                        <button class="btn" data-action="close">取消</button>
                        <button class="btn btn-danger" id="btn-do-clear" style="padding: 8px 20px;">确认清除</button>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        this.container.querySelector('[data-action="close"]').onclick = () => this.close();

        this.container.querySelector('#btn-do-clear').onclick = () => {
            const options = {
                personnel: this.container.querySelector('#chk-clear-personnel').checked,
                seats: this.container.querySelector('#chk-clear-seats').checked,
                obstacles: this.container.querySelector('#chk-clear-obstacles').checked
            };
            
            if (!options.personnel && !options.seats && !options.obstacles) {
                alert('请至少勾选一项！');
                return;
            }

            if (this.onConfirm) this.onConfirm(options);
            this.close();
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}