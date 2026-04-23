class SeatPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.container = document.getElementById('page-seats');
        this.modalContainer = modalContainer;
        
        this.selectorModal = new SeatSelectorModal(modalContainer);
        this.levelSelectorModal = new LevelSelectorModal(modalContainer);
        
        this.currentTab = localStorage.getItem('SeatPage_currentTab') || 'bear1';
        this.config = { tileSize: 30, angle: 35.28, renderRadius: 35, showGrid: true };
        this.anchors = { 
            bear1: { x: 760, y: 610 }, 
            bear2: { x: 748, y: 616 } 
        };

        this.dragState = { seatId: null, hasMoved: false, startPos: null };
        this.uiLocked = false; 
        this.lastMousePos = { x: 0, y: 0 };

        this.initSeatData();
        this.init();
    }

    saveData() {
        try {
            localStorage.setItem('SeatPage_seatData', JSON.stringify(this.dataManager.seatData));
            // 修改点：保存整个 anchors 对象
            localStorage.setItem('SeatPage_anchors', JSON.stringify(this.anchors));
        } catch(e) {}
        if (this.dataManager && this.dataManager.save) this.dataManager.save();
    }

    initSeatData() {
        try {
            const sd = localStorage.getItem('SeatPage_seatData');
            if (sd) this.dataManager.seatData = JSON.parse(sd);
            
            // 修改点：尝试读取复数形式的 anchors
            const sa = localStorage.getItem('SeatPage_anchors');
            if (sa) {
                this.anchors = JSON.parse(sa);
            }
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
                <div class="activity-topbar" style="flex-direction: column; align-items: flex-start; gap: 15px; height: auto;">
                    <div class="topbar-left" style="display: flex; align-items: center; gap: 30px; width: 100%; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="topbar-label">当前地图：</span>
                            <div class="team-tabs" id="seat-map-tabs">
                                <button class="btn-tab" data-action="switch-tab" data-tab="bear1">熊 1</button>
                                <button class="btn-tab" data-action="switch-tab" data-tab="bear2">熊 2</button>
                            </div>
                        </div>
                        <div class="trap-coord-inputs" style="display: flex; align-items: center; gap: 10px; font-weight: bold; color: var(--gray-700);">
                            <span>当前陷阱位置：</span>
                            <span>x=<input type="number" id="input-anchor-x" value="${this.anchors[this.currentTab].x}" style="width: 70px; padding: 4px 6px; margin-left: 4px; border: 1px solid var(--gray-300); border-radius: 4px; outline: none;"></span>
                            <span>y=<input type="number" id="input-anchor-y" value="${this.anchors[this.currentTab].y}" style="width: 70px; padding: 4px 6px; margin-left: 4px; border: 1px solid var(--gray-300); border-radius: 4px; outline: none;"></span>
                        </div>
                    </div>
                    <div class="seat-instructions" style="font-size: 13px; color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px 15px; border-radius: 6px; width: 100%; line-height: 1.6;">
                        <b>说明：</b><br>
                        点击空白位置可新建空座位。<br>
                        拖动座位可改变其位置。<br>
                        点击中间位置可替换成员。<br>
                        拖动座位至熊陷阱处可删除该座位。
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

        // 【关键】：获取当前标签页对应的坐标锚点
        const currentAnchor = this.anchors[this.currentTab];

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
            
            // 【排错修复】：使用 currentAnchor.x，确保不报错
            seatEntitiesHTML += `<div class="text-seat-coord" style="left:${scCoord.x}px; top:${scCoord.y}px;">${seat.x + currentAnchor.x},${seat.y + currentAnchor.y}</div>`;
            
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
                
                <div class="text-trap-coord" style="left:${coordCenter.x}px; top:${coordCenter.y}px;">${currentAnchor.x},${currentAnchor.y}</div>
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

        const defaultTrapText = this.currentTab === 'bear1' ? '熊 1' : '熊 2';
        const deleteTrapText = '<span style="color:#ef4444; font-size:16px;">触碰则删除</span>';

        if (this.dragState.seatId) {
            const trapData = this.dataManager.seatData[this.currentTab];
            const seatData = trapData.seats.find(s => s.id === this.dragState.seatId);
            const draggedEntity = this.container.querySelector(`.seat-interactive-entity[data-seat-id="${this.dragState.seatId}"]`);
            const draggedPoly = this.container.querySelector(`#poly-${this.dragState.seatId}`);

            if (preview && seatData) {
                const coll = this.checkCollision(grid.x, grid.y, this.dragState.seatId);
                preview.dataset.gx = grid.x; 
                preview.dataset.gy = grid.y;

                if (coll.trapHit) {
                    // 1. 触碰陷阱：吸附到陷阱中心，变红并缩小透明，暗示将被吞噬
                    if (trapTextEl && trapTextEl.innerHTML !== deleteTrapText) trapTextEl.innerHTML = deleteTrapText;
                    if (draggedEntity) {
                        const trapCenter = this.toScreen(1.5, 1.5);
                        draggedEntity.style.left = `${trapCenter.x}px`;
                        draggedEntity.style.top = `${trapCenter.y}px`;
                        draggedEntity.style.opacity = '0.3';
                        draggedEntity.style.transform = 'translate(-50%, -50%) scale(0.6)';
                        draggedEntity.style.borderColor = 'var(--danger)';
                        draggedEntity.style.color = 'var(--danger)';
                    }
                    if (draggedPoly) draggedPoly.style.opacity = '0';
                    preview.style.display = 'none';
                    preview.dataset.valid = 'false'; 
                } else {
                    if (trapTextEl && trapTextEl.innerHTML !== defaultTrapText) trapTextEl.innerHTML = defaultTrapText;
                    
                    if (coll.seatHits.length > 0) {
                        // 2. 位置不可行（重叠）：城堡自动飞回原位，且红框随鼠标显示
                        if (draggedEntity) {
                            const origCenter = this.toScreen(seatData.x + 1, seatData.y + 1);
                            draggedEntity.style.left = `${origCenter.x}px`;
                            draggedEntity.style.top = `${origCenter.y}px`;
                            draggedEntity.style.opacity = '1';
                            draggedEntity.style.transform = 'translate(-50%, -50%) scale(1)'; 
                            draggedEntity.style.borderColor = ''; // 清除内联变色
                            draggedEntity.style.color = '';
                        }
                        if (draggedPoly) {
                            draggedPoly.setAttribute('points', this.getPolygonPoints(seatData.x, seatData.y, 2, 2));
                            draggedPoly.style.opacity = '1';
                        }
                        
                        // 开启红色预览框
                        preview.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                        preview.style.display = 'block';
                        preview.style.fill = 'var(--preview-danger-fill, rgba(239, 68, 68, 0.4))'; 
                        preview.style.stroke = 'var(--preview-danger-stroke, red)';
                        preview.dataset.valid = 'false';
                    } else {
                        // 3. 位置可行：城堡实体平滑吸附到新网格
                        if (draggedEntity) {
                            const newCenter = this.toScreen(grid.x + 1, grid.y + 1);
                            draggedEntity.style.left = `${newCenter.x}px`;
                            draggedEntity.style.top = `${newCenter.y}px`;
                            draggedEntity.style.opacity = '0.85';
                            draggedEntity.style.transform = 'translate(-50%, -50%) scale(1.1)'; // 拖拽时稍微放大
                            draggedEntity.style.borderColor = '';
                            draggedEntity.style.color = '';
                        }
                        if (draggedPoly) {
                            draggedPoly.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                            draggedPoly.style.opacity = '0.5';
                        }
                        
                        preview.style.display = 'none';
                        preview.dataset.valid = 'true';
                    }
                }
            }
        } else {
            // ----- 非拖拽状态 -----
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
                
                // 【核心修复】：移除上一版强加的 transition='none'，
                // 让 CSS 引擎重新接管插值计算，实现网格间的平滑滑动。
                const poly = this.container.querySelector(`#poly-${this.dragState.seatId}`);
                seatEntity.style.transition = '';
                if (poly) poly.style.transition = '';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.container.classList.contains('active')) return;
            if (this.uiLocked) return; 
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            
            if (this.dragState.seatId) {
                if (Math.hypot(e.clientX - this.dragState.startPos.x, e.clientY - this.dragState.startPos.y) > 5) {
                    this.dragState.hasMoved = true;
                }
            }
            this.processHover(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', (e) => {
            if (!this.container.classList.contains('active') || this.uiLocked) return;

            if (this.dragState.seatId) {
                let treatedAsClick = false;
                let needsImmediateUpdate = true; // 控制是否立即重绘画布（销毁DOM）

                if (this.dragState.hasMoved) {
                    const canvas = this.container.querySelector('#seat-canvas');
                    const rect = canvas.getBoundingClientRect();
                    const grid = this.toGrid(e.clientX - rect.left, e.clientY - rect.top);
                    const trapData = this.dataManager.seatData[this.currentTab];
                    const coll = this.checkCollision(grid.x, grid.y, this.dragState.seatId);
                    const draggedEntity = this.container.querySelector(`.seat-interactive-entity[data-seat-id="${this.dragState.seatId}"]`);

                    if (coll.trapHit) {
                        // 1. 落入陷阱：播放缩放消失的终端动画，延迟 250ms 后执行真实的数据销毁
                        if (draggedEntity) {
                            draggedEntity.style.transform = 'translate(-50%, -50%) scale(0)';
                            draggedEntity.style.opacity = '0';
                        }
                        needsImmediateUpdate = false;
                        
                        setTimeout(() => {
                            const seat = trapData.seats.find(s => s.id === this.dragState.seatId);
                            if (seat && seat.memberId) trapData.unseated.push(seat.memberId);
                            trapData.seats = trapData.seats.filter(s => s.id !== this.dragState.seatId);
                            this.saveData();
                            this.updateMap();
                        }, 250); 
                        
                    } else if (coll.seatHits.length === 0) {
                        // 2. 正常落入空地
                        const seat = trapData.seats.find(s => s.id === this.dragState.seatId);
                        if (seat && (seat.x !== grid.x || seat.y !== grid.y)) {
                            seat.x = grid.x; seat.y = grid.y; 
                            this.saveData(); 
                        }
                    } else {
                        // 3. 落点无效（重叠）：暂停重绘，给它 250ms 时间飞回原位
                        needsImmediateUpdate = false;
                        setTimeout(() => {
                            this.updateMap();
                        }, 250);
                    }
                } else {
                    treatedAsClick = true;
                }

                if (treatedAsClick) this.openSelectorModal({ type: 'replace', seatId: this.dragState.seatId });
                
                const currentDraggedId = this.dragState.seatId;
                this.dragState.seatId = null;
                this.dragState.hasMoved = false;
                
                if (needsImmediateUpdate) {
                    this.updateMap(); 
                } else {
                    // 如果不立即重绘（处于动画期），提前移除 dragging 类让卡片恢复颜色，显得更自然
                    const entity = this.container.querySelector(`.seat-interactive-entity[data-seat-id="${currentDraggedId}"]`);
                    if (entity) entity.classList.remove('dragging');
                }
                return;
            }

            // 处理空白区域创建新城堡的逻辑
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

    // 修改 bindEvents 方法
    bindEvents() {
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            
            const action = btn.dataset.action;
            if (action === 'switch-tab') {
                this.currentTab = btn.dataset.tab;
                localStorage.setItem('SeatPage_currentTab', this.currentTab);
                
                // 切换标签时，同步更新上方输入框内的坐标
                const inputX = this.container.querySelector('#input-anchor-x');
                const inputY = this.container.querySelector('#input-anchor-y');
                if (inputX && inputY) {
                    // 【排错修复】：这里必须是 this.anchors[this.currentTab].x
                    inputX.value = this.anchors[this.currentTab].x;
                    inputY.value = this.anchors[this.currentTab].y;
                }
                
                this.updateUI(); this.centerOnTarget(); 
            } else if (action === 'edit-coord') {
                e.preventDefault(); 
                e.stopPropagation(); 
                const inputX = this.container.querySelector('#input-anchor-x');
                if (inputX) inputX.focus();
            }
        }, true);

        this.container.addEventListener('input', (e) => {
            if (e.target.id === 'input-anchor-x' || e.target.id === 'input-anchor-y') {
                const nx = parseInt(this.container.querySelector('#input-anchor-x').value);
                const ny = parseInt(this.container.querySelector('#input-anchor-y').value);
                
                if (!isNaN(nx) && !isNaN(ny)) {
                    // 【排错修复】：仅写入当前 Tab 下的 x 和 y
                    this.anchors[this.currentTab].x = nx;
                    this.anchors[this.currentTab].y = ny;
                    this.saveData(); 
                    this.updateMap(); 
                }
            }
        });
    }
}