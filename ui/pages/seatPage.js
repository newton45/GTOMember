class SeatPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.container = document.getElementById('page-seats');
        this.modalContainer = modalContainer;
        
        this.selectorModal = new SeatSelectorModal(modalContainer);
        this.levelSelectorModal = new LevelSelectorModal(modalContainer);
        
        this.currentTab = localStorage.getItem('SeatPage_currentTab') || 'bear1';
        this.config = { tileSize: 30, angle: 35.28, renderRadius: 35, showGrid: true };
        this.anchor = { x: 150, y: 150 };

        this.dragState = { seatId: null, hasMoved: false, startPos: null };
        this.uiLocked = false; 
        this.lastMousePos = { x: 0, y: 0 };

        this.initSeatData();
        this.init();
    }

    saveData() {
        try {
            localStorage.setItem('SeatPage_seatData', JSON.stringify(this.dataManager.seatData));
            localStorage.setItem('SeatPage_anchor', JSON.stringify(this.anchor));
        } catch(e) {}
        if (this.dataManager && this.dataManager.save) this.dataManager.save();
    }

    initSeatData() {
        try {
            const sd = localStorage.getItem('SeatPage_seatData');
            if (sd) this.dataManager.seatData = JSON.parse(sd);
            const sa = localStorage.getItem('SeatPage_anchor');
            if (sa) this.anchor = JSON.parse(sa);
        } catch(e) {}

        if (!this.dataManager.seatData) {
            this.dataManager.seatData = { bear1: { seats: [], unseated: [] }, bear2: { seats: [], unseated: [] } };
        }
        
        const allMembers = this.dataManager.members.getAll().filter(m => !m.leftAlliance);
        const assignedIds = new Set();
        ['bear1', 'bear2'].forEach(trap => {
            this.dataManager.seatData[trap].seats.forEach(s => { if(s.memberId) assignedIds.add(s.memberId); });
            this.dataManager.seatData[trap].unseated.forEach(id => assignedIds.add(id));
        });
        allMembers.forEach(m => {
            if (!assignedIds.has(m.id)) this.dataManager.seatData.bear1.unseated.push(m.id);
        });
        this.saveData(); 
    }

    init() {
        this.renderSkeleton(); 
        this.updateUI();       
        this.bindEvents();
        this.initViewportEngine(); 

        window.addEventListener('resize', () => {
            if (this.container.classList.contains('active')) this.centerOnTarget();
        });

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && this.container.classList.contains('active')) {
                    this.centerOnTarget();
                }
            });
        });
        observer.observe(this.container, { attributes: true });

        const modalObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    this.uiLocked = !this.modalContainer.classList.contains('hidden');
                    if (!this.uiLocked) setTimeout(() => this.processHover(this.lastMousePos.x, this.lastMousePos.y, true), 10);
                }
            });
        });
        modalObserver.observe(this.modalContainer, { attributes: true });
    }

    toScreen(dx, dy) {
        const rad = this.config.angle * Math.PI / 180;
        const centerX = 1500, centerY = 1500; 
        return {
            x: centerX + (dx - dy) * this.config.tileSize * Math.cos(rad),
            y: centerY - (dx + dy) * this.config.tileSize * Math.sin(rad)
        };
    }

    toGrid(screenX, screenY) {
        const rad = this.config.angle * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const centerX = 1500, centerY = 1500;
        const px = (screenX - centerX) / (this.config.tileSize * cosA);
        const py = (centerY - screenY) / (this.config.tileSize * sinA);
        return { x: Math.floor((px + py) / 2), y: Math.floor((py - px) / 2) };
    }

    getPolygonPoints(startX, startY, width, height) {
        const pts = [this.toScreen(startX, startY), this.toScreen(startX + width, startY), this.toScreen(startX + width, startY + height), this.toScreen(startX, startY + height)];
        return pts.map(p => `${p.x},${p.y}`).join(' ');
    }

    centerOnTarget() {
        const viewport = this.container.querySelector('#seat-viewport');
        if (!viewport || viewport.clientWidth === 0) return;
        const targetCenter = this.toScreen(1.5, 1.5);
        viewport.scrollLeft = targetCenter.x - (viewport.clientWidth / 2);
        viewport.scrollTop = targetCenter.y - (viewport.clientHeight / 2);
    }

    renderSkeleton() {
        this.container.innerHTML = `
            <div class="activities-layout-vertical page-seats">
                <div class="activity-topbar">
                    <div class="topbar-left">
                        <span class="topbar-label">当前地图：</span>
                        <div class="team-tabs" id="seat-map-tabs">
                            <button class="btn-tab" data-action="switch-tab" data-tab="bear1">熊 1</button>
                            <button class="btn-tab" data-action="switch-tab" data-tab="bear2">熊 2</button>
                        </div>
                    </div>
                </div>
                <div class="seat-map-wrapper">
                    <main class="seat-viewport" id="seat-viewport">
                        <div class="seat-canvas" id="seat-canvas"></div>
                    </main>
                </div>
            </div>
        `;
    }

    updateUI() {
        const tabs = this.container.querySelectorAll('#seat-map-tabs .btn-tab');
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === this.currentTab));
        this.updateMap();
    }

    updateMap() {
        const canvas = this.container.querySelector('#seat-canvas');
        if (!canvas) return;
        
        const bearCenter = this.toScreen(1.5, 1.5);
        const coordCenter = this.toScreen(0.5, 0.5);
        const bearName = this.currentTab === 'bear1' ? '熊 1' : '熊 2';
        const trapData = this.dataManager.seatData[this.currentTab];
        const lvlMap = { 's1': '1', 's2': '2', 's3': '3', 's4': '4' };

        let seatPolygonsHTML = ''; 
        let seatEntitiesHTML = ''; 

        trapData.seats.forEach(seat => {
            const sp = this.getPolygonPoints(seat.x, seat.y, 2, 2);
            const scCenter = this.toScreen(seat.x + 1, seat.y + 1);
            const scLevel = this.toScreen(seat.x + 1.5, seat.y + 1.5);
            const scCoord = this.toScreen(seat.x + 0.5, seat.y + 0.5);
            const themeVar = `var(--seat-${seat.level || 's1'}-color)`;

            seatPolygonsHTML += `<polygon id="poly-${seat.id}" class="seat-poly" points="${sp}" fill="color-mix(in srgb, ${themeVar} var(--seat-bg-opacity, 20%), transparent)" stroke="var(--seat-border-color, rgba(0,0,0,0.8))" stroke-width="2"/>`;
            seatEntitiesHTML += `<div class="text-seat-level" style="left:${scLevel.x}px; top:${scLevel.y}px;">${lvlMap[seat.level] || '1'}</div>`;
            seatEntitiesHTML += `<div class="text-seat-coord" style="left:${scCoord.x}px; top:${scCoord.y}px;">${seat.x + this.anchor.x},${seat.y + this.anchor.y}</div>`;
            
            if (seat.memberId) {
                const memName = this.dataManager.members.findById(seat.memberId)?.nickname;
                seatEntitiesHTML += `<div class="seat-interactive-entity" data-seat-id="${seat.id}" style="left:${scCenter.x}px; top:${scCenter.y}px; border-color: var(--seat-border-color, rgba(0,0,0,0.8)); color: ${themeVar};">${memName}</div>`;
            } else {
                seatEntitiesHTML += `<div class="seat-interactive-entity empty-plus" data-seat-id="${seat.id}" style="left:${scCenter.x}px; top:${scCenter.y}px; border-color: var(--seat-border-color, rgba(0,0,0,0.8));">+</div>`;
            }
        });

        canvas.innerHTML = `
            <svg class="seat-svg-layer" width="3000" height="3000">
                ${this.generateGridSVG()}
                <polygon points="${this.getPolygonPoints(0, 0, 3, 3)}" fill="rgba(239, 68, 68, 0.2)" stroke="var(--danger)" stroke-width="2"/>
                ${seatPolygonsHTML}
                <polygon id="build-preview" points="" fill="var(--preview-safe-fill, rgba(255,255,255,0.5))" stroke="var(--preview-safe-stroke, white)" stroke-width="2" style="display:none;"/>
            </svg>
            <div class="seat-ui-layer">
                ${seatEntitiesHTML}
                <div class="text-trap-center" id="trap-center-text" data-action="edit-coord" title="点击修改中心坐标" style="left:${bearCenter.x}px; top:${bearCenter.y}px;">${bearName}</div>
                <div class="text-trap-coord" style="left:${coordCenter.x}px; top:${coordCenter.y}px;">${this.anchor.x},${this.anchor.y}</div>
            </div>
        `;
    }

    generateGridSVG() {
        let lines = '';
        const r = this.config.renderRadius;
        for (let x = -r; x <= r; x++) {
            const p1 = this.toScreen(x, -r), p2 = this.toScreen(x, r);
            lines += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="var(--map-grid-color, rgba(255,255,255,0.2))" stroke-width="1"/>`;
            const q1 = this.toScreen(-r, x), q2 = this.toScreen(r, x);
            lines += `<line x1="${q1.x}" y1="${q1.y}" x2="${q2.x}" y2="${q2.y}" stroke="var(--map-grid-color, rgba(255,255,255,0.2))" stroke-width="1"/>`;
        }
        return lines;
    }

    checkCollision(dx, dy, ignoreSeatId = null) {
        const trapHit = dx < 3 && dx + 2 > 0 && dy < 3 && dy + 2 > 0;
        let seatHits = [];
        const trapData = this.dataManager.seatData[this.currentTab];
        trapData.seats.forEach((seat) => {
            if (seat.id === ignoreSeatId) return; 
            const hit = dx < seat.x + 2 && dx + 2 > seat.x && dy < seat.y + 2 && dy + 2 > seat.y;
            if (hit) seatHits.push(seat);
        });
        return { trapHit, seatHits };
    }

    processHover(clientX, clientY, force = false) {
        if (!force && (!this.container.classList.contains('active') || this.uiLocked)) return;
        const canvas = this.container.querySelector('#seat-canvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const grid = this.toGrid(clientX - rect.left, clientY - rect.top);
        const preview = this.container.querySelector('#build-preview');
        const trapTextEl = this.container.querySelector('#trap-center-text');

        // 【核心修复】：DOM 防抖！只有当内容真的需要变化时才写入，保护正在被点击的文字节点存活！
        const defaultTrapText = this.currentTab === 'bear1' ? '熊 1' : '熊 2';
        const deleteTrapText = '<span style="color:#ef4444; font-size:16px;">触碰则删除</span>';

        if (this.dragState.seatId) {
            if (preview) {
                preview.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                preview.style.display = 'block';
                const coll = this.checkCollision(grid.x, grid.y, this.dragState.seatId);
                
                if (coll.trapHit) {
                    if (trapTextEl && trapTextEl.innerHTML !== deleteTrapText) trapTextEl.innerHTML = deleteTrapText;
                    preview.style.display = 'none';
                    preview.dataset.valid = 'false';
                } else {
                    if (trapTextEl && trapTextEl.innerHTML !== defaultTrapText) trapTextEl.innerHTML = defaultTrapText;
                    if (coll.seatHits.length > 0) {
                        preview.style.fill = 'var(--preview-danger-fill, rgba(239, 68, 68, 0.4))'; 
                        preview.style.stroke = 'var(--preview-danger-stroke, red)';
                        preview.dataset.valid = 'false';
                    } else {
                        preview.style.fill = 'var(--preview-safe-fill, rgba(255, 255, 255, 0.5))'; 
                        preview.style.stroke = 'var(--preview-safe-stroke, white)';
                        preview.dataset.valid = 'true'; 
                    }
                }
                preview.dataset.gx = grid.x; preview.dataset.gy = grid.y;
            }
        } else {
            if (trapTextEl && trapTextEl.innerHTML !== defaultTrapText) trapTextEl.innerHTML = defaultTrapText;
            
            const onTrap = grid.x >= 0 && grid.x < 3 && grid.y >= 0 && grid.y < 3;
            const trapData = this.dataManager.seatData[this.currentTab];
            const onSeat = trapData.seats.find(s => grid.x >= s.x && grid.x < s.x + 2 && grid.y >= s.y && grid.y < s.y + 2);

            this.container.querySelectorAll('.seat-poly, .seat-interactive-entity').forEach(p => p.classList.remove('highlight'));

            if (onTrap) {
                if (preview) preview.style.display = 'none';
            } else if (onSeat) {
                if (preview) preview.style.display = 'none';
                const poly = this.container.querySelector(`#poly-${onSeat.id}`);
                const entity = this.container.querySelector(`.seat-interactive-entity[data-seat-id="${onSeat.id}"]`);
                if (poly) poly.classList.add('highlight');
                if (entity) entity.classList.add('highlight'); 
            } else {
                if (preview) {
                    preview.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                    preview.style.display = 'block';
                    const coll = this.checkCollision(grid.x, grid.y);
                    if (coll.trapHit || coll.seatHits.length > 0) {
                        preview.style.fill = 'var(--preview-danger-fill, rgba(239, 68, 68, 0.4))'; 
                        preview.style.stroke = 'var(--preview-danger-stroke, red)';
                        preview.dataset.valid = 'false';
                    } else {
                        preview.style.fill = 'var(--preview-safe-fill, rgba(255, 255, 255, 0.5))'; 
                        preview.style.stroke = 'var(--preview-safe-stroke, white)';
                        preview.dataset.valid = 'true';
                    }
                    preview.dataset.gx = grid.x; preview.dataset.gy = grid.y;
                }
            }
        }
    }

    initViewportEngine() {
        this.container.addEventListener('mousedown', (e) => {
            if (this.uiLocked) return; 
            const seatEntity = e.target.closest('.seat-interactive-entity');
            if (seatEntity) {
                this.dragState.seatId = seatEntity.dataset.seatId;
                this.dragState.hasMoved = false;
                this.dragState.startPos = { x: e.clientX, y: e.clientY };
                seatEntity.classList.add('dragging');
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.container.classList.contains('active')) return;
            if (this.uiLocked) return; 
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            
            if (this.dragState.seatId) {
                if (Math.hypot(e.clientX - this.dragState.startPos.x, e.clientY - this.dragState.startPos.y) > 5) this.dragState.hasMoved = true;
            }
            this.processHover(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', (e) => {
            if (!this.container.classList.contains('active') || this.uiLocked) return;

            if (this.dragState.seatId) {
                let treatedAsClick = false;

                if (this.dragState.hasMoved) {
                    const preview = this.container.querySelector('#build-preview');
                    let actualMove = false;
                    
                    if (preview && preview.style.display !== 'none') {
                        const gx = parseInt(preview.dataset.gx);
                        const gy = parseInt(preview.dataset.gy);
                        const trapData = this.dataManager.seatData[this.currentTab];
                        
                        const coll = this.checkCollision(gx, gy, this.dragState.seatId);
                        
                        if (coll.trapHit) {
                            actualMove = true;
                            const seat = trapData.seats.find(s => s.id === this.dragState.seatId);
                            if (seat && seat.memberId) trapData.unseated.push(seat.memberId);
                            trapData.seats = trapData.seats.filter(s => s.id !== this.dragState.seatId);
                            this.saveData();
                        } else if (preview.dataset.valid === 'true') {
                            const seat = trapData.seats.find(s => s.id === this.dragState.seatId);
                            if (seat && (seat.x !== gx || seat.y !== gy)) {
                                actualMove = true;
                                seat.x = gx; seat.y = gy; this.saveData(); 
                            }
                        }
                    }
                    if (!actualMove) treatedAsClick = true;
                } else {
                    treatedAsClick = true;
                }

                if (treatedAsClick) this.openSelectorModal({ type: 'replace', seatId: this.dragState.seatId });
                
                this.dragState.seatId = null;
                this.dragState.hasMoved = false;
                this.updateMap(); 
                return;
            }

            const viewport = e.target.closest('#seat-viewport');
            if (viewport && !this.dragState.hasMoved && !e.target.closest('[data-action]') && !e.target.closest('.seat-interactive-entity')) {
                const preview = this.container.querySelector('#build-preview');
                if (preview && preview.style.display !== 'none' && preview.dataset.valid === 'true') {
                    const gx = parseInt(preview.dataset.gx);
                    const gy = parseInt(preview.dataset.gy);
                    
                    this.levelSelectorModal.onSelect = (selectedLevel) => {
                        const trapData = this.dataManager.seatData[this.currentTab];
                        trapData.seats.push({
                            id: 'seat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                            x: gx, y: gy, level: selectedLevel, memberId: null 
                        });
                        this.saveData();
                        this.updateMap(); 
                    };
                    this.levelSelectorModal.render();
                }
            }
        });
    }

    openSelectorModal(target) {
        const trapData = this.dataManager.seatData[this.currentTab];
        const unseatedIds = new Set(trapData.unseated);
        const unseatedMembers = this.dataManager.members.getAll().filter(m => !m.leftAlliance && unseatedIds.has(m.id));
        const seatedIds = new Set(trapData.seats.map(s => s.memberId).filter(Boolean));
        const seatedMembers = this.dataManager.members.getAll().filter(m => !m.leftAlliance && seatedIds.has(m.id));

        this.selectorModal.onSelect = (selectedMemberId) => {
            trapData.unseated = trapData.unseated.filter(id => id !== selectedMemberId);
            const oldSeat = trapData.seats.find(s => s.memberId === selectedMemberId);
            if (oldSeat) oldSeat.memberId = null;

            if (target.type === 'replace') {
                const targetSeat = trapData.seats.find(s => s.id === target.seatId);
                if (targetSeat) {
                    if (targetSeat.memberId) trapData.unseated.push(targetSeat.memberId);
                    targetSeat.memberId = selectedMemberId;
                }
            }
            this.saveData(); this.updateMap(); 
        };

        this.selectorModal.render(unseatedMembers, seatedMembers);
    }

    bindEvents() {
        // 使用拦截捕获模式，保障最高优先级执行点击
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            if (action === 'switch-tab') {
                this.currentTab = btn.dataset.tab;
                localStorage.setItem('SeatPage_currentTab', this.currentTab);
                this.updateUI(); this.centerOnTarget(); 
            } else if (action === 'edit-coord') {
                e.preventDefault(); 
                e.stopPropagation(); 
                const nx = parseInt(prompt('修改陷阱中心 X 坐标:', this.anchor.x));
                if (isNaN(nx)) return;
                const ny = parseInt(prompt('修改陷阱中心 Y 坐标:', this.anchor.y));
                if (isNaN(ny)) return;
                this.anchor = { x: nx, y: ny };
                this.saveData(); this.updateMap(); this.centerOnTarget();
            }
        }, true);
    }
}