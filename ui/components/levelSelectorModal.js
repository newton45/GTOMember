class LevelSelectorModal {
    constructor(container) {
        this.container = container;
        this.onSelect = null;
    }

    render() {
        // 核心修复：把 data-action="select-level" 和 data-action="close" 补回去了
        const html = `
            <div class="modal modal-selector" id="modal-level-selector" style="max-width: 300px;">
                <div class="modal-header">
                    <h2>选择座位等级</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
                    <button class="btn" data-action="select-level" data-level="s1" style="background-color: var(--seat-s1-color); color:#fff; font-weight:bold; padding:12px; font-size:14px; border:none; border-radius:6px;">S1 级座位</button>
                    <button class="btn" data-action="select-level" data-level="s2" style="background-color: var(--seat-s2-color); color:#fff; font-weight:bold; padding:12px; font-size:14px; border:none; border-radius:6px;">S2 级座位</button>
                    <button class="btn" data-action="select-level" data-level="s3" style="background-color: var(--seat-s3-color); color:#fff; font-weight:bold; padding:12px; font-size:14px; border:none; border-radius:6px;">S3 级座位</button>
                    <button class="btn" data-action="select-level" data-level="s4" style="background-color: var(--seat-s4-color); color:#fff; font-weight:bold; padding:12px; font-size:14px; border:none; border-radius:6px;">S4 级座位</button>
                </div>
                <div style="margin-top:20px; text-align:right;">
                    <button class="btn-cancel" data-action="close" style="padding:8px 16px; border: 1px solid var(--gray-300); background: #fff; border-radius: 4px; cursor:pointer;">取消</button>
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
    }

    bindEvents() {
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