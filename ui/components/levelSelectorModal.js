class LevelSelectorModal {
    constructor(container) {
        this.container = container;
        this.onSelect = null;
    }

    render() {
        const html = `
            <div class="modal modal-selector" id="modal-level-selector" style="max-width: 300px;">
                <div class="modal-header">
                    <h2>设置座位等级</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body" style="display:flex; flex-direction:column; gap:10px;">
                    <button class="btn" style="background:#dbeafe; color:#1e40af; font-weight:bold; padding:12px; font-size:14px;" data-action="select-level" data-level="s1">S1 级座位</button>
                    <button class="btn" style="background:#e0e7ff; color:#3730a3; font-weight:bold; padding:12px; font-size:14px;" data-action="select-level" data-level="s2">S2 级座位</button>
                    <button class="btn" style="background:#f3e8ff; color:#6b21a8; font-weight:bold; padding:12px; font-size:14px;" data-action="select-level" data-level="s3">S3 级座位</button>
                    <button class="btn" style="background:#fae8ff; color:#86198f; font-weight:bold; padding:12px; font-size:14px;" data-action="select-level" data-level="s4">S4 级座位</button>
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
        // 单次绑定，防止事件污染
        this.container.onclick = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            if (btn.dataset.action === 'close') {
                this.close();
            } else if (btn.dataset.action === 'select-level') {
                if (this.onSelect) this.onSelect(btn.dataset.level);
                this.close();
            }
        };
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
        this.container.onclick = null; 
    }
}