class ClearHistoryModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
    }

    render(allMembers) {
        // 【过滤逻辑】：在盟 (leftAlliance === false) 且 有历史记录 (length > 0)
        const eligibleMembers = allMembers.filter(m => !m.leftAlliance && m.activityHistory && m.activityHistory.length > 0);

        const html = `
            <div class="modal modal-selector" id="modal-clear-history">
                <div class="modal-header">
                    <h2>删某人记录</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:13px; color:var(--gray-700); margin-bottom:15px;">
                        勾选需要清空历史记录（战果、出勤等）的成员。清空后，成员在下次活动中将默认回到团1待选池。
                    </p>
                    <div class="selector-grid" id="clear-member-grid" style="max-height: 400px; overflow-y: auto;">
                        ${eligibleMembers.length > 0 ? eligibleMembers.map(m => `
                            <div class="selector-option-item" style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid var(--gray-100);">
                                <input type="checkbox" class="clear-checkbox" data-id="${m.id}" id="chk-${m.id}" style="width:18px; height:18px; cursor:pointer;">
                                <label for="chk-${m.id}" style="cursor:pointer; flex:1;">${m.nickname} (记录数: ${m.activityHistory.length})</label>
                            </div>
                        `).join('') : '<div class="placeholder">当前没有符合条件的成员（在盟且有记录）</div>'}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" data-action="select-all" style="margin-right:auto;">全选</button>
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn btn-danger" data-action="confirm">确定删除记录</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        // 修复取消与关闭
        const closeBtn = this.container.querySelector('[data-action="close"]');
        const cancelBtn = this.container.querySelector('[data-action="cancel"]');
        const selectAllBtn = this.container.querySelector('[data-action="select-all"]');
        const confirmBtn = this.container.querySelector('[data-action="confirm"]');

        if (closeBtn) closeBtn.onclick = () => this.close();
        if (cancelBtn) cancelBtn.onclick = () => this.close();

        // 全选功能
        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                const checkboxes = this.container.querySelectorAll('.clear-checkbox');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
                selectAllBtn.innerText = allChecked ? "全选" : "取消全选";
            };
        }

        // 确定删除
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                const selectedIds = Array.from(this.container.querySelectorAll('.clear-checkbox:checked'))
                                         .map(cb => cb.dataset.id);
                if (selectedIds.length === 0) return alert('请至少选择一名成员');
                if (confirm(`确定要清空这 ${selectedIds.length} 名成员的所有历史记录吗？此操作不可撤销。`)) {
                    if (this.onConfirm) this.onConfirm(selectedIds);
                    this.close();
                }
            };
        }
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}