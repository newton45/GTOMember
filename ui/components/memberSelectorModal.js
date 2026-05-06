/* ui/components/memberSelectorModal.js */
class MemberSelectorModal {
    constructor(container) {
        this.container = container;
        this.onConfirm = null;
        this.selectedIds = new Set();
        this.allMembers = [];
        this.rubberBand = null;
        this.rubberStart = null;
        this.isRubberBanding = false;
        this.mouseDownTarget = null;
    }

    render(members) {
        this.allMembers = members;
        this.selectedIds.clear();
        this.rubberBand = null;
        this.rubberStart = null;
        this.isRubberBanding = false;
        this.mouseDownTarget = null;

        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal modal-selector" style="width: 600px;">
                    <div class="modal-header">
                        <h2>选择成员加入组</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box" style="margin-bottom: 15px;">
                            <input type="text" id="selector-search" placeholder="支持姓名、ID、职级、拼音首字母搜索..." style="width: 100%; padding: 8px; border: 1px solid var(--gray-300); border-radius: 4px;">
                        </div>
                        <div class="selector-grid" id="selector-member-grid" 
                             style="display: grid; 
                                    grid-template-columns: repeat(auto-fill, var(--cell-size)); 
                                    gap: var(--grid-gap); 
                                    justify-content: center;
                                    max-height: 400px; 
                                    overflow-y: auto; 
                                    padding: 10px;
                                    background: var(--gray-100);
                                    border-radius: 8px;
                                    position: relative;
                                    user-select: none;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <span id="selected-count" style="margin-right: auto; color: var(--gray-600); font-size: 13px;">已选择: <b id="count-num">0</b> 人</span>
                        <button class="btn" data-action="close">取消</button>
                        <button class="btn btn-primary" id="btn-selector-confirm">确认添加</button>
                    </div>
                </div>
            </div>
        `;

        this.container.classList.remove('hidden');
        this.updateGrid();
        this.bindEvents();
    }

    updateGrid(query = '') {
        const grid = this.container.querySelector('#selector-member-grid');
        if (!grid) return;

        const q = query.toLowerCase().trim();

        const checkMatch = (m) => {
            if (!q) return false; 
            
            const basicMatch = 
                m.nickname.toLowerCase().includes(q) || 
                m.id.toLowerCase().includes(q) || 
                (m.rank && m.rank.toLowerCase().includes(q)) ||
                (m.pastNicknames && m.pastNicknames.some(pn => pn.toLowerCase().includes(q)));

            let pinyinMatch = false;
            if (typeof PinyinMatch !== 'undefined') {
                pinyinMatch = PinyinMatch.match(m.nickname, q) || 
                              (m.pastNicknames && m.pastNicknames.some(pn => PinyinMatch.match(pn, q)));
            }
            return basicMatch || pinyinMatch;
        };

        grid.innerHTML = this.allMembers.map(m => {
            const isSelected = this.selectedIds.has(m.id);
            const isMatch = checkMatch(m);

            const selectedStyle = isSelected 
                ? 'border: 3px solid #18181b !important; box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important; transform: scale(1.05); z-index: 10;' 
                : 'border: 1px solid transparent;';

            const battleRecords = (m.activityHistory || []).filter(h => h.type === 'battle' && h.rank !== null);
            let avgRank = '-';
            if (battleRecords.length > 0) {
                const recent = battleRecords.slice(-3);
                avgRank = (recent.reduce((a, b) => a + b.rank, 0) / recent.length).toFixed(1);
            }

            const recentHistory = (m.activityHistory || []).filter(h => h.type !== 'unparticipated').slice(-3);
            let missCount = 0;
            recentHistory.forEach(h => { 
                if (h.type === 'absent') missCount += 1;
                else if (h.type === 'leave') missCount += 0.5;
            });
            let attText = "-";
            if (recentHistory.length > 0) {
                if (missCount < 1) attText = "好";
                else if (missCount < 2) attText = "中";
                else if (missCount < 3) attText = "差";
                else attText = "死";
            }

            return `
                <div class="member-entity rank-${m.rank} ${isMatch ? 'search-match' : ''} ${isSelected ? 'selected-target' : ''}" 
                     data-id="${m.id}" 
                     style="cursor: pointer; position: relative; width: var(--cell-size); height: var(--cell-size); transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); ${selectedStyle}">
                    <div class="top-left-badge">${avgRank}</div>
                    <div class="top-right-badge">${attText}</div>
                    <div class="entity-name" style="font-size:10px;">${m.nickname}</div>
                    <div class="entity-info-index">${m.powerRank || ''}</div>
                    <div class="entity-rank">${m.rank}</div>
                </div>
            `;
        }).join('');
    }

    bindEvents() {
        const closeBtn = this.container.querySelector('.modal-close');
        const cancelBtn = this.container.querySelector('[data-action="close"]');
        [closeBtn, cancelBtn].forEach(btn => {
            if (btn) btn.onclick = () => this.close();
        });

        const searchInput = this.container.querySelector('#selector-search');
        if (searchInput) {
            searchInput.oninput = (e) => this.updateGrid(e.target.value);
        }

        const grid = this.container.querySelector('#selector-member-grid');
        if (grid) {
            this.initRubberBand(grid, searchInput);
        }

        const confirmBtn = this.container.querySelector('#btn-selector-confirm');
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                if (this.selectedIds.size === 0) return alert('请至少选择一名成员');
                if (this.onConfirm) this.onConfirm(Array.from(this.selectedIds));
                this.close();
            };
        }
    }

    initRubberBand(grid, searchInput) {
        grid.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            const rect = grid.getBoundingClientRect();
            const startX = e.clientX - rect.left + grid.scrollLeft;
            const startY = e.clientY - rect.top + grid.scrollTop;
            this.rubberStart = { x: startX, y: startY };
            this.isRubberBanding = false;

            const card = e.target.closest('.member-entity');
            this.mouseDownTarget = card ? card.dataset.id : null;

            const band = document.createElement('div');
            band.id = 'rubber-band';
            band.style.cssText = 'position:absolute; border:2px dashed #18181b; background:rgba(24,24,27,0.08); pointer-events:none; z-index:100; display:none;';
            grid.appendChild(band);
            this.rubberBand = band;
        });

        grid.addEventListener('mousemove', (e) => {
            if (!this.rubberBand || !this.rubberStart) return;

            const rect = grid.getBoundingClientRect();
            const currentX = e.clientX - rect.left + grid.scrollLeft;
            const currentY = e.clientY - rect.top + grid.scrollTop;

            const dx = Math.abs(currentX - this.rubberStart.x);
            const dy = Math.abs(currentY - this.rubberStart.y);

            if (!this.isRubberBanding && (dx > 5 || dy > 5)) {
                this.isRubberBanding = true;
            }

            if (!this.isRubberBanding) return;

            const left = Math.min(this.rubberStart.x, currentX);
            const top = Math.min(this.rubberStart.y, currentY);
            const width = Math.abs(currentX - this.rubberStart.x);
            const height = Math.abs(currentY - this.rubberStart.y);

            this.rubberBand.style.display = 'block';
            this.rubberBand.style.left = left + 'px';
            this.rubberBand.style.top = top + 'px';
            this.rubberBand.style.width = width + 'px';
            this.rubberBand.style.height = height + 'px';

            this.highlightInBand(left, top, width, height);
        });

        const finishRubberBand = () => {
            if (!this.rubberBand || !this.rubberStart) return;

            if (this.isRubberBanding) {
                const bandRect = {
                    left: parseFloat(this.rubberBand.style.left),
                    top: parseFloat(this.rubberBand.style.top),
                    width: parseFloat(this.rubberBand.style.width),
                    height: parseFloat(this.rubberBand.style.height)
                };

                this.toggleInBand(bandRect);
            } else if (this.mouseDownTarget) {
                if (this.selectedIds.has(this.mouseDownTarget)) {
                    this.selectedIds.delete(this.mouseDownTarget);
                } else {
                    this.selectedIds.add(this.mouseDownTarget);
                }
            }

            this.updateGrid(searchInput ? searchInput.value : '');
            this.container.querySelector('#count-num').innerText = this.selectedIds.size;

            if (this.rubberBand.parentNode) {
                this.rubberBand.remove();
            }
            this.rubberBand = null;
            this.rubberStart = null;
            this.mouseDownTarget = null;

            setTimeout(() => { this.isRubberBanding = false; }, 50);
        };

        window.addEventListener('mouseup', finishRubberBand);
    }

    highlightInBand(left, top, width, height) {
        const grid = this.container.querySelector('#selector-member-grid');
        if (!grid) return;

        const gridRect = grid.getBoundingClientRect();
        const bandAbs = {
            left: gridRect.left + left - grid.scrollLeft,
            right: gridRect.left + left + width - grid.scrollLeft,
            top: gridRect.top + top - grid.scrollTop,
            bottom: gridRect.top + top + height - grid.scrollTop
        };

        const cards = grid.querySelectorAll('.member-entity');
        cards.forEach(card => {
            const cr = card.getBoundingClientRect();
            const overlap = !(cr.right < bandAbs.left || cr.left > bandAbs.right || cr.bottom < bandAbs.top || cr.top > bandAbs.bottom);
            card.classList.toggle('rubber-hover', overlap);
        });
    }

    toggleInBand(bandRect) {
        const grid = this.container.querySelector('#selector-member-grid');
        if (!grid) return;

        const gridRect = grid.getBoundingClientRect();
        const bandAbs = {
            left: gridRect.left + bandRect.left - grid.scrollLeft,
            right: gridRect.left + bandRect.left + bandRect.width - grid.scrollLeft,
            top: gridRect.top + bandRect.top - grid.scrollTop,
            bottom: gridRect.top + bandRect.top + bandRect.height - grid.scrollTop
        };

        const cards = grid.querySelectorAll('.member-entity');
        cards.forEach(card => {
            const cr = card.getBoundingClientRect();
            const overlap = !(cr.right < bandAbs.left || cr.left > bandAbs.right || cr.bottom < bandAbs.top || cr.top > bandAbs.bottom);
            if (overlap) {
                const id = card.dataset.id;
                if (this.selectedIds.has(id)) {
                    this.selectedIds.delete(id);
                } else {
                    this.selectedIds.add(id);
                }
            }
            card.classList.remove('rubber-hover');
        });
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}
