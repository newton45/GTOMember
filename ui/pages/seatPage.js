class SeatPage {
    constructor(dataManager, modalContainer) {
        this.dataManager = dataManager;
        this.container = document.getElementById('page-seats');
        this.modalContainer = modalContainer;
        
        this.selectorModal = new SeatSelectorModal(modalContainer);
        this.levelSelectorModal = new LevelSelectorModal(modalContainer);
        
        this.config = { tileSize: 30, angle: 35.28, renderRadius: 35, showGrid: true };
        this.anchors = { bear1: { x: 150, y: 150 }, bear2: { x: 150, y: 150 } };
        this.currentTab = localStorage.getItem('SeatPage_currentTab') || 'bear1';

        this.dragState = { seatId: null, hasMoved: false, startPos: null };
        this.uiLocked = false; 
        this.lastMousePos = { x: 0, y: 0 };

        this.currentMode = 'normal'; // 'normal' | 'obstacle'
        this.obstacleDrawState = null;
        
        this.initSeatData();
        this.init();
        
    }

    saveData() {
        try {
            localStorage.setItem('SeatPage_seatData', JSON.stringify(this.dataManager.seatData));
            // 【核心修复】：保存时也使用复数 Key
            localStorage.setItem('SeatPage_anchors', JSON.stringify(this.anchors));
        } catch(e) {}
        if (this.dataManager && this.dataManager.save) this.dataManager.save();
    }

    initSeatData() {
        try {
            const sd = localStorage.getItem('SeatPage_seatData');
            if (sd) this.dataManager.seatData = JSON.parse(sd);
            
            const sa = localStorage.getItem('SeatPage_anchors');
            if (sa) this.anchors = JSON.parse(sa);
        } catch(e) {}

        if (!this.dataManager.seatData) {
            this.dataManager.seatData = { bear1: { seats: [], unseated: [] }, bear2: { seats: [], unseated: [] } };
        }
        
        // ==========================================
        // 【核心修复：幽灵数据 GC (垃圾回收) 机制】
        // 强行清洗已经“退游”、“移出联盟”或被“彻底删除”的成员ID
        // ==========================================
        const validActiveMembers = new Set(
            this.dataManager.members.getAll()
                .filter(m => !m.leftAlliance)
                .map(m => m.id)
        );

        ['bear1', 'bear2'].forEach(trap => {
            const trapData = this.dataManager.seatData[trap];
            // 1. 清洗座位上的幽灵：查无此人的，踢下座位
            trapData.seats.forEach(s => {
                if (s.memberId && !validActiveMembers.has(s.memberId)) {
                    s.memberId = null; 
                }
            });
            // 2. 清洗待选池的幽灵
            trapData.unseated = trapData.unseated.filter(id => validActiveMembers.has(id));
        });
        // ==========================================
        
        // 获取全部有效在盟成员，查漏补缺（把新增的人丢进 bear1 待选池）
        const allMembers = this.dataManager.members.getAll().filter(m => !m.leftAlliance);
        const assignedIds = new Set();
        ['bear1', 'bear2'].forEach(trap => {
            this.dataManager.seatData[trap].seats.forEach(s => { if(s.memberId) assignedIds.add(s.memberId); });
            this.dataManager.seatData[trap].unseated.forEach(id => assignedIds.add(id));
        });
        allMembers.forEach(m => {
            if (!assignedIds.has(m.id)) this.dataManager.seatData.bear1.unseated.push(m.id);
        });
        
        // 保存清洗后的数据
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
        const bearName = this.currentTab === 'bear1' ? '熊 1' : '熊 2';
        this.container.innerHTML = `
            <style>
                .seat-tools-panel { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
                .btn-seat-tool { padding: 8px 12px; border: 1px solid var(--gray-300); background: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; color: var(--gray-700); font-weight: bold; transition: all 0.2s; text-align: center;}
                .btn-seat-tool:hover { background: var(--gray-100); }
                .btn-seat-tool.active { background: var(--primary); color: #fff; border-color: var(--primary); }
            </style>
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
                    
                    <div style="display: flex; gap: 15px; width: 100%; align-items: stretch;">
                        <div class="seat-tools-panel">
                            <button class="btn-seat-tool" data-action="tool-member">成员标记</button>
                            <button class="btn-seat-tool" data-action="tool-auto">自动落座</button>
                            <button class="btn-seat-tool" id="btn-tool-obstacle" data-action="tool-obstacle">障碍标记</button>
                            <button class="btn-seat-tool" id="btn-tool-save" data-action="tool-save">保存${bearName}</button>
                            <button class="btn-seat-tool" id="btn-tool-load" data-action="tool-load">读取${bearName}</button>
                        </div>
                        <div class="seat-instructions" style="font-size: 13px; color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; padding: 10px 15px; border-radius: 6px; flex-grow: 1; line-height: 1.6;">
                            <b>说明：</b><br>
                            点击空白位置可新建空座位。拖动座位可改变其位置。<br>
                            点击中间位置可替换成员。拖动座位至熊陷阱处可删除该座位。<br>
                            使用左侧<b>障碍标记</b>可在空地框选生成/取消障碍物。
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

        const activeAnchor = this.anchors[this.currentTab];
        const lvlMap = { 's1': '1', 's2': '2', 's3': '3', 's4': '4' };
        
        // 获取全局障碍物
        const globalObs = this.dataManager.seatData.globalObstacles || [];

        let seatPolygonsHTML = ''; 
        let seatEntitiesHTML = ''; 
        let obstacleHTML = '';

        // 1. 渲染所有全局障碍物（将世界坐标还原为当前视口的本地坐标）
        globalObs.forEach(key => {
            const [wx, wy] = key.split(',').map(Number);
            const lx = wx - activeAnchor.x; 
            const ly = wy - activeAnchor.y;
            obstacleHTML += `<polygon class="obstacle-poly" points="${this.getPolygonPoints(lx, ly, 1, 1)}" fill="rgba(0,0,0,0.8)" stroke="#111" stroke-width="1"/>`;
        });

        // 2. 遍历渲染两张地图的建筑（先渲染沉睡地图垫底，再渲染激活地图）
        const renderOrder = this.currentTab === 'bear1' ? ['bear2', 'bear1'] : ['bear1', 'bear2'];
        
        renderOrder.forEach(tab => {
            const isInactive = tab !== this.currentTab;
            const tabData = this.dataManager.seatData[tab];
            const anchor = this.anchors[tab];
            
            // 计算相对偏移量
            const dx = anchor.x - activeAnchor.x;
            const dy = anchor.y - activeAnchor.y;

            // 【陷阱渲染】：陷阱不使用虚化，直接叠加在空间中
            const trapPoints = this.getPolygonPoints(dx, dy, 3, 3);
            const bearCenter = this.toScreen(dx + 1.5, dy + 1.5);
            const coordCenter = this.toScreen(dx + 0.5, dy + 0.5);
            const bearName = tab === 'bear1' ? '熊 1' : '熊 2';
            
            obstacleHTML += `<polygon class="trap-zone-poly" points="${trapPoints}" />`;
            
            if (isInactive) {
                seatEntitiesHTML += `<div class="text-trap-center" style="left:${bearCenter.x}px; top:${bearCenter.y}px;">${bearName}</div>`;
                seatEntitiesHTML += `<div class="text-trap-coord" style="left:${coordCenter.x}px; top:${coordCenter.y}px;">${anchor.x},${anchor.y}</div>`;
            } else {
                // 仅激活的地图支持点击修改坐标的交互
                seatEntitiesHTML += `<div class="text-trap-center" id="trap-center-text" data-action="edit-coord" title="点击修改中心坐标" style="left:${bearCenter.x}px; top:${bearCenter.y}px;">${bearName}</div>`;
                seatEntitiesHTML += `<div class="text-trap-coord" style="left:${coordCenter.x}px; top:${coordCenter.y}px;">${anchor.x},${anchor.y}</div>`;
            }

            // 【座位渲染】：仅对非激活图层的座位和成员使用 ghostClass 幽灵态
            const ghostClass = isInactive ? 'inactive-ghost' : '';
            
            tabData.seats.forEach(seat => {
                const sx = seat.x + dx; 
                const sy = seat.y + dy;
                
                const sp = this.getPolygonPoints(sx, sy, 2, 2);
                const scCenter = this.toScreen(sx + 1, sy + 1);
                const scLevel = this.toScreen(sx + 1.5, sy + 1.5);
                const scCoord = this.toScreen(sx + 0.5, sy + 0.5);
                const themeVar = `var(--seat-${seat.level || 's1'}-color)`;
                
                const pointerEvents = isInactive ? 'pointer-events: none;' : '';
                const polyIdAttr = isInactive ? '' : `id="poly-${seat.id}"`;
                const entityDataAttr = isInactive ? '' : `data-seat-id="${seat.id}"`;

                seatPolygonsHTML += `<polygon ${polyIdAttr} class="seat-poly ${ghostClass}" points="${sp}" fill="color-mix(in srgb, ${themeVar} var(--seat-bg-opacity, 20%), transparent)" stroke="var(--seat-border-color, rgba(0,0,0,0.8))" stroke-width="2"/>`;
                seatEntitiesHTML += `<div class="text-seat-level ${ghostClass}" style="left:${scLevel.x}px; top:${scLevel.y}px;">${lvlMap[seat.level] || '1'}</div>`;
                seatEntitiesHTML += `<div class="text-seat-coord ${ghostClass}" style="left:${scCoord.x}px; top:${scCoord.y}px;">${seat.x + anchor.x},${seat.y + anchor.y}</div>`;
                
                // 成员名与状态框渲染
                if (seat.memberId) {
                    const m = this.dataManager.members.findById(seat.memberId);
                    const memName = m ? m.nickname : '未知'; // 在这里定义获取 memName
                    const statusClass = m && !isInactive ? `status-${m.activityStatus || 0}` : '';
                    
                    seatEntitiesHTML += `<div class="seat-interactive-entity ${ghostClass} ${statusClass}" ${entityDataAttr} style="left:${scCenter.x}px; top:${scCenter.y}px; border-color: var(--seat-border-color, rgba(0,0,0,0.8)); color: ${themeVar}; ${pointerEvents}">${memName}</div>`;
                } else {
                    seatEntitiesHTML += `<div class="seat-interactive-entity empty-plus ${ghostClass}" ${entityDataAttr} style="left:${scCenter.x}px; top:${scCenter.y}px; border-color: var(--seat-border-color, rgba(0,0,0,0.8)); ${pointerEvents}">+</div>`;
                }
            });
        });

        // 3. 渲染当前活动的障碍框选拉扯动画
        let obstaclePreviewHTML = '';
        if (this.currentMode === 'obstacle' && this.obstacleDrawState?.active) {
            const start = this.obstacleDrawState.startGrid;
            const end = this.obstacleDrawState.currentGrid;
            const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
            const w = maxX - minX + 1, h = maxY - minY + 1;
            obstaclePreviewHTML = `<polygon points="${this.getPolygonPoints(minX, minY, w, h)}" fill="rgba(0,0,0,0.4)" stroke="#000" stroke-width="2" stroke-dasharray="6"/>`;
        }

        // 4. 统合注入 DOM
        canvas.innerHTML = `
            <svg class="seat-svg-layer" width="3000" height="3000">
                ${this.generateGridSVG()}
                ${obstacleHTML}
                ${obstaclePreviewHTML}
                ${seatPolygonsHTML}
                <polygon id="build-preview" points="" fill="var(--preview-safe-fill, rgba(255,255,255,0.5))" stroke="var(--preview-safe-stroke, white)" stroke-width="2" style="display:none;"/>
            </svg>
            <div class="seat-ui-layer">
                ${seatEntitiesHTML}
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

    checkCollision(gx, gy, ignoreSeatId = null) {
        const res = { trapHit: false, seatHits: [], obstacleHit: false };
        const activeAnchor = this.anchors[this.currentTab];
        
        // 1. 检测全局障碍物
        const globalObs = this.dataManager.seatData.globalObstacles || [];
        const targetWorldGrids = [
            `${gx + activeAnchor.x},${gy + activeAnchor.y}`,
            `${gx+1 + activeAnchor.x},${gy + activeAnchor.y}`,
            `${gx + activeAnchor.x},${gy+1 + activeAnchor.y}`,
            `${gx+1 + activeAnchor.x},${gy+1 + activeAnchor.y}`
        ];
        if (targetWorldGrids.some(g => globalObs.includes(g))) res.obstacleHit = true;

        // 2. 检测双地图座位与陷阱
        ['bear1', 'bear2'].forEach(tab => {
            const isInactive = tab !== this.currentTab;
            const tabData = this.dataManager.seatData[tab];
            const anchor = this.anchors[tab];
            
            // 计算相对偏移
            const dx = anchor.x - activeAnchor.x;
            const dy = anchor.y - activeAnchor.y;

            // 陷阱检测
            if (!(gx + 2 <= dx || gx >= dx + 3 || gy + 2 <= dy || gy >= dy + 3)) {
                if (isInactive) res.obstacleHit = true; // 撞到另一个熊是障碍
                else res.trapHit = true; // 撞到自己的熊是删除
            }

            // 座位检测
            tabData.seats.forEach(seat => {
                if (!isInactive && seat.id === ignoreSeatId) return;
                const sx = seat.x + dx;
                const sy = seat.y + dy;
                if (!(gx + 2 <= sx || gx >= sx + 2 || gy + 2 <= sy || gy >= sy + 2)) {
                    res.seatHits.push(seat.id);
                }
            });
        });

        return res;
    }

    processHover(clientX, clientY, force = false) {
        if (!force && (!this.container.classList.contains('active') || this.uiLocked)) return;
        const preview = this.container.querySelector('#build-preview');
        
        if (this.currentMode === 'obstacle') {
            if (preview) preview.style.display = 'none';
            return;
        }

        const canvas = this.container.querySelector('#seat-canvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const grid = this.toGrid(clientX - rect.left, clientY - rect.top);
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
                    // 仅当触碰当前激活的陷阱时才触发删除警告
                    if (trapTextEl && trapTextEl.innerHTML !== deleteTrapText) trapTextEl.innerHTML = deleteTrapText;
                    if (draggedEntity) {
                        const trapCenter = this.toScreen(1.5, 1.5);
                        draggedEntity.style.left = `${trapCenter.x}px`; draggedEntity.style.top = `${trapCenter.y}px`;
                        draggedEntity.style.opacity = '0.3'; draggedEntity.style.transform = 'translate(-50%, -50%) scale(0.6)';
                        draggedEntity.style.borderColor = 'var(--danger)'; draggedEntity.style.color = 'var(--danger)';
                    }
                    if (draggedPoly) draggedPoly.style.opacity = '0';
                    preview.style.display = 'none'; preview.dataset.valid = 'false'; 
                } else {
                    if (trapTextEl && trapTextEl.innerHTML !== defaultTrapText) trapTextEl.innerHTML = defaultTrapText;
                    
                    // 撞到隔壁地图的座位、隔壁的陷阱、或障碍物均视为报错
                    if (coll.seatHits.length > 0 || coll.obstacleHit) {
                        if (draggedEntity) {
                            const origCenter = this.toScreen(seatData.x + 1, seatData.y + 1);
                            draggedEntity.style.left = `${origCenter.x}px`; draggedEntity.style.top = `${origCenter.y}px`;
                            draggedEntity.style.opacity = '1'; draggedEntity.style.transform = 'translate(-50%, -50%) scale(1)'; 
                            draggedEntity.style.borderColor = ''; draggedEntity.style.color = '';
                        }
                        if (draggedPoly) {
                            draggedPoly.setAttribute('points', this.getPolygonPoints(seatData.x, seatData.y, 2, 2));
                            draggedPoly.style.opacity = '1';
                        }
                        
                        preview.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                        preview.style.display = 'block';
                        preview.style.fill = 'var(--preview-danger-fill, rgba(239, 68, 68, 0.4))'; 
                        preview.style.stroke = 'var(--preview-danger-stroke, red)';
                        preview.dataset.valid = 'false';
                    } else {
                        if (draggedEntity) {
                            const newCenter = this.toScreen(grid.x + 1, grid.y + 1);
                            draggedEntity.style.left = `${newCenter.x}px`; draggedEntity.style.top = `${newCenter.y}px`;
                            draggedEntity.style.opacity = '0.85'; draggedEntity.style.transform = 'translate(-50%, -50%) scale(1.1)'; 
                            draggedEntity.style.borderColor = ''; draggedEntity.style.color = '';
                        }
                        if (draggedPoly) {
                            draggedPoly.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                            draggedPoly.style.opacity = '0.5';
                        }
                        preview.style.display = 'none'; preview.dataset.valid = 'true';
                    }
                }
            }
        } else {
            if (trapTextEl && trapTextEl.innerHTML !== defaultTrapText) trapTextEl.innerHTML = defaultTrapText;
            
            // 剥离单点高亮逻辑：只对当前激活层产生鼠标响应
            const activeData = this.dataManager.seatData[this.currentTab];
            const onActiveTrap = grid.x >= 0 && grid.x < 3 && grid.y >= 0 && grid.y < 3;
            const onActiveSeat = activeData.seats.find(s => grid.x >= s.x && grid.x < s.x + 2 && grid.y >= s.y && grid.y < s.y + 2);

            this.container.querySelectorAll('.seat-poly, .seat-interactive-entity').forEach(p => p.classList.remove('highlight'));

            if (onActiveTrap) {
                if (preview) preview.style.display = 'none';
            } else if (onActiveSeat) {
                if (preview) preview.style.display = 'none';
                const poly = this.container.querySelector(`#poly-${onActiveSeat.id}`);
                const entity = this.container.querySelector(`.seat-interactive-entity[data-seat-id="${onActiveSeat.id}"]`);
                if (poly) poly.classList.add('highlight');
                if (entity) entity.classList.add('highlight'); 
            } else {
                if (preview) {
                    preview.setAttribute('points', this.getPolygonPoints(grid.x, grid.y, 2, 2));
                    preview.style.display = 'block';
                    
                    const coll = this.checkCollision(grid.x, grid.y);
                    if (coll.trapHit || coll.seatHits.length > 0 || coll.obstacleHit) {
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
            
            // 【新增】：如果是障碍物模式，直接接管鼠标按下事件作为画笔起点，禁止拖动城堡
            if (this.currentMode === 'obstacle') {
                const canvas = this.container.querySelector('#seat-canvas');
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const grid = this.toGrid(e.clientX - rect.left, e.clientY - rect.top);
                this.obstacleDrawState = { active: true, startGrid: grid, currentGrid: grid };
                return; 
            }

            const seatEntity = e.target.closest('.seat-interactive-entity');
            if (seatEntity) {
                this.dragState.seatId = seatEntity.dataset.seatId;
                this.dragState.hasMoved = false;
                this.dragState.startPos = { x: e.clientX, y: e.clientY };
                seatEntity.classList.add('dragging');
                
                const poly = this.container.querySelector(`#poly-${this.dragState.seatId}`);
                seatEntity.style.transition = '';
                if (poly) poly.style.transition = '';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.container.classList.contains('active')) return;
            if (this.uiLocked) return; 
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            
            // 【新增】：障碍物画笔矩形框拉伸渲染
            if (this.currentMode === 'obstacle' && this.obstacleDrawState?.active) {
                const canvas = this.container.querySelector('#seat-canvas');
                const rect = canvas.getBoundingClientRect();
                this.obstacleDrawState.currentGrid = this.toGrid(e.clientX - rect.left, e.clientY - rect.top);
                this.updateMap(); 
                return;
            }

            if (this.dragState.seatId) {
                if (Math.hypot(e.clientX - this.dragState.startPos.x, e.clientY - this.dragState.startPos.y) > 5) {
                    this.dragState.hasMoved = true;
                }
            }
            this.processHover(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', (e) => {
            if (!this.container.classList.contains('active') || this.uiLocked) return;

            // 【新增】：障碍物画笔释放，进行区块逻辑翻转 (XOR)
            if (this.currentMode === 'obstacle' && this.obstacleDrawState?.active) {
                const start = this.obstacleDrawState.startGrid;
                const end = this.obstacleDrawState.currentGrid;
                const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
                const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
                
                // 获取全局障碍物数组（建议存在 seatData 根下或同步到两张表）
                if (!this.dataManager.seatData.globalObstacles) this.dataManager.seatData.globalObstacles = [];
                const globalObs = this.dataManager.seatData.globalObstacles;
                const currentAnchor = this.anchors[this.currentTab];

                for(let x = minX; x <= maxX; x++) {
                    for(let y = minY; y <= maxY; y++) {
                        // 计算世界坐标：本地坐标 + 当前锚点坐标
                        const wx = x + currentAnchor.x;
                        const wy = y + currentAnchor.y;
                        const key = `${wx},${wy}`;
                        
                        const idx = globalObs.indexOf(key);
                        if (idx > -1) globalObs.splice(idx, 1); // 反选取消
                        else globalObs.push(key); // 设定障碍
                    }
                }
                
                this.saveData();
                this.obstacleDrawState = null;
                this.updateMap();
                return;
            }

            if (this.dragState.seatId) {
                let treatedAsClick = false;
                let needsImmediateUpdate = true; 

                // 【核心修复】：在清空全局 dragState 之前，先捕获当前拖拽的 ID
                const targetId = this.dragState.seatId;

                if (this.dragState.hasMoved) {
                    const canvas = this.container.querySelector('#seat-canvas');
                    const rect = canvas.getBoundingClientRect();
                    const grid = this.toGrid(e.clientX - rect.left, e.clientY - rect.top);
                    const trapData = this.dataManager.seatData[this.currentTab];
                    const coll = this.checkCollision(grid.x, grid.y, targetId);
                    const draggedEntity = this.container.querySelector(`.seat-interactive-entity[data-seat-id="${targetId}"]`);

                    if (coll.trapHit) {
                        // 播放动画
                        if (draggedEntity) {
                            draggedEntity.style.transform = 'translate(-50%, -50%) scale(0)';
                            draggedEntity.style.opacity = '0';
                        }
                        needsImmediateUpdate = false;
                        
                        // 【核心修复】：使用捕获到的 targetId
                        setTimeout(() => {
                            const seat = trapData.seats.find(s => s.id === targetId);
                            if (seat && seat.memberId) trapData.unseated.push(seat.memberId);
                            trapData.seats = trapData.seats.filter(s => s.id !== targetId);
                            this.saveData();
                            this.updateMap();
                        }, 250); 
                        
                    } else if (coll.seatHits.length === 0 && !coll.obstacleHit) {
                        const seat = trapData.seats.find(s => s.id === targetId);
                        if (seat && (seat.x !== grid.x || seat.y !== grid.y)) {
                            seat.x = grid.x; seat.y = grid.y; 
                            this.saveData(); 
                        }
                    } else {
                        needsImmediateUpdate = false;
                        setTimeout(() => { this.updateMap(); }, 250);
                    }
                } else {
                    treatedAsClick = true;
                }

                if (treatedAsClick) this.openSelectorModal({ type: 'replace', seatId: targetId });
                
                this.dragState.seatId = null;
                this.dragState.hasMoved = false;
                
                if (needsImmediateUpdate) this.updateMap(); 
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
                        this.saveData(); this.updateMap(); 
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
                
                const inputX = this.container.querySelector('#input-anchor-x');
                const inputY = this.container.querySelector('#input-anchor-y');
                if (inputX && inputY) {
                    inputX.value = this.anchors[this.currentTab].x;
                    inputY.value = this.anchors[this.currentTab].y;
                }
                
                // 动态更新保存/读取按钮文字
                const bearName = this.currentTab === 'bear1' ? '熊 1' : '熊 2';
                this.container.querySelector('#btn-tool-save').innerText = `保存${bearName}`;
                this.container.querySelector('#btn-tool-load').innerText = `读取${bearName}`;
                
                this.currentMode = 'normal'; // 切换标签重置模式
                this.updateUI(); this.centerOnTarget(); 

            } else if (action === 'edit-coord') {
                e.preventDefault(); e.stopPropagation(); 
                const inputX = this.container.querySelector('#input-anchor-x');
                if (inputX) inputX.focus();
                
            } else if (action === 'tool-save') {
                // 将当前数据深拷贝保存为快照
                const trapData = this.dataManager.seatData[this.currentTab];
                localStorage.setItem(`SeatArchive_${this.currentTab}`, JSON.stringify(trapData));
                alert(`${this.currentTab === 'bear1' ? '熊 1' : '熊 2'} 的布局已设为存档点！`);
                
            } else if (action === 'tool-load') {
                const archive = localStorage.getItem(`SeatArchive_${this.currentTab}`);
                if (archive) {
                    if (confirm(`确定要读取存档吗？当前未保存的 ${this.currentTab === 'bear1' ? '熊 1' : '熊 2'} 布局将被覆盖。`)) {
                        this.dataManager.seatData[this.currentTab] = JSON.parse(archive);
                        this.saveData();
                        this.updateMap();
                    }
                } else {
                    alert('未找到该地图的存档点。');
                }
                
            } else if (action === 'tool-obstacle') {
                this.currentMode = this.currentMode === 'obstacle' ? 'normal' : 'obstacle';
                const obsBtn = this.container.querySelector('#btn-tool-obstacle');
                if (this.currentMode === 'obstacle') {
                    obsBtn.classList.add('active');
                    this.container.querySelector('.seat-viewport').style.cursor = 'crosshair';
                } else {
                    obsBtn.classList.remove('active');
                    this.container.querySelector('.seat-viewport').style.cursor = 'default';
                }
                this.updateMap();
            } else if (action === 'tool-member') {
                // 实例化弹窗，并在更新后重绘主页面
                const markerModal = new MemberMarkerModal(this.modalContainer, this.dataManager, () => {
                    this.updateMap();
                });
                markerModal.render();
            } else if (action === 'tool-auto') {
                this.autoSeat();
            } else if (action === 'tool-save-preset') {
                const snapshot = ImportExport.collectFullSnapshot(this.dataManager);
                localStorage.setItem('GTO_Global_Preset', JSON.stringify(snapshot));
                alert('系统预设已存入浏览器实体缓存！下次点击“载入预设”即可一键恢复。');

            } else if (action === 'tool-load-preset') {
                const preset = localStorage.getItem('GTO_Global_Preset');
                if (preset && confirm('确认载入预设？这将覆盖当前所有成员、活动和地图设置。')) {
                    ImportExport.applyFullSnapshot(JSON.parse(preset), this.dataManager);
                    window.location.reload(); // 重新加载以确保所有页面状态刷新
                } else if (!preset) {
                    alert('未检测到预设文件。');
                }

            } else if (action === 'tool-clear-all') {
                if (confirm('⚠️ 警告：这将清空【所有页面】的所有设置，包括成员、活动历史和地图布局。此操作不可逆！')) {
                    localStorage.clear();
                    window.location.reload();
                }

            } else if (action === 'tool-export') {
                ImportExport.exportJSON(this.dataManager);
            }
            
        }, true);

        this.container.addEventListener('input', (e) => {
            if (e.target.id === 'input-anchor-x' || e.target.id === 'input-anchor-y') {
                const nx = parseInt(this.container.querySelector('#input-anchor-x').value);
                const ny = parseInt(this.container.querySelector('#input-anchor-y').value);
                if (!isNaN(nx) && !isNaN(ny)) {
                    this.anchors[this.currentTab].x = nx;
                    this.anchors[this.currentTab].y = ny;
                    this.saveData(); 
                    this.updateMap(); 
                }
            }
        });
    }

    autoSeat() {
        const trapData = this.dataManager.seatData[this.currentTab];
        const allTargetMembers = [];

        // 1. 获取所有参赛选手 (当前地图已落座的 + 待选池的)
        const seatedIds = trapData.seats.map(s => s.memberId).filter(Boolean);
        const poolIds = trapData.unseated;
        [...seatedIds, ...poolIds].forEach(id => {
            const m = this.dataManager.members.findById(id);
            if (m && !m.leftAlliance && m.participation !== 'none') {
                allTargetMembers.push(m);
            }
        });

        // 2. 统计当前地图内各等级座位的实际数量
        const caps = { s1: 0, s2: 0, s3: 0, s4: 0 };
        trapData.seats.forEach(s => { if (caps[s.level] !== undefined) caps[s.level]++; });

        // 3. 按照纯战力初始排序
        allTargetMembers.sort((a, b) => (a.powerRank || 999) - (b.powerRank || 999));

        // 4. 计算 BaseLevel (如果在大家都是满活跃的情况下，他纯靠战力该坐哪)
        const levelNames = ['s1', 's2', 's3', 's4'];
        let currentLvlIdx = 0;
        let remainingCap = caps[levelNames[0]];

        allTargetMembers.forEach(m => {
            while (remainingCap <= 0 && currentLvlIdx < 3) {
                currentLvlIdx++;
                remainingCap = caps[levelNames[currentLvlIdx]];
            }
            if (remainingCap > 0) {
                m._baseLevelVal = currentLvlIdx + 1; // 1代表S1, 2代表S2...
                remainingCap--;
            } else {
                m._baseLevelVal = 5; // 连S4都没位置了
            }
            // 结合活跃度扣除（状态0/1/2），算出最终期待前往的等级
            m._targetLevelVal = Math.min(4, m._baseLevelVal + (m.activityStatus || 0));
        });

        // 5. 逐级决选机制 (竞争 S1 -> S4)
        let unassignedToNext = []; // 被上一级淘汰下来的人
        const finalPlacements = []; // 最终名单

        for (let L = 1; L <= 4; L++) {
            const levelName = levelNames[L-1];
            const seatsForLevel = caps[levelName];

            // 争夺本级座位的人 = 本来目标是这级的人 + 被上一级淘汰挤下来的人
            let candidates = allTargetMembers.filter(m => m._targetLevelVal === L).concat(unassignedToNext);

            // 核心排序：优先看谁是被惩罚降级掉下来的(即BaseLevel更小)，同情况再比战力
            candidates.sort((a, b) => {
                if (a._baseLevelVal !== b._baseLevelVal) return a._baseLevelVal - b._baseLevelVal;
                return (a.powerRank || 999) - (b.powerRank || 999);
            });

            // 录取与淘汰
            const accepted = candidates.slice(0, seatsForLevel);
            const rejected = candidates.slice(seatsForLevel);

            accepted.forEach(m => finalPlacements.push({ member: m, targetLevelName: levelName }));
            unassignedToNext = rejected; // 淘汰者滚入下一级的资源池
        }

        const newUnseated = allTargetMembers.filter(m => m._baseLevelVal === 5).concat(unassignedToNext);

        // 6. 物理座位映射（应用"减少搬家损耗"逻辑：同级别尽量保持原位）
        const newSeatAssignments = {}; // { seatId: memberId }
        for (let L = 1; L <= 4; L++) {
            const levelName = levelNames[L-1];
            const levelSeats = trapData.seats.filter(s => s.level === levelName);
            const levelPlacements = finalPlacements.filter(p => p.targetLevelName === levelName).map(p => p.member);

            const remainingSeats = [];
            levelSeats.forEach(seat => {
                const oldMemberIdx = levelPlacements.findIndex(m => m.id === seat.memberId);
                if (oldMemberIdx !== -1) {
                    // 他原本就在这级，而且新分配也在这级，锁死原座位！
                    newSeatAssignments[seat.id] = seat.memberId;
                    levelPlacements.splice(oldMemberIdx, 1);
                } else {
                    remainingSeats.push(seat);
                }
            });

            // 剩下的空座位随便分给该级别剩下的人
            levelPlacements.forEach(m => {
                if (remainingSeats.length > 0) {
                    const seat = remainingSeats.shift();
                    newSeatAssignments[seat.id] = m.id;
                }
            });
        }

        // 7. 生成变更总结文本
        const changes = [];
        const oldLocations = {};
        trapData.seats.forEach(s => { if(s.memberId) oldLocations[s.memberId] = s.level; });
        trapData.unseated.forEach(id => { oldLocations[id] = 'unseated'; });

        const newLocations = {};
        Object.entries(newSeatAssignments).forEach(([seatId, mId]) => {
            const lvl = trapData.seats.find(s => s.id === seatId).level;
            newLocations[mId] = lvl;
        });

        allTargetMembers.forEach(m => {
            const oldL = oldLocations[m.id];
            const newL = newLocations[m.id];
            
            if (oldL && newL && oldL !== newL && newL !== 'unseated' && oldL !== 'unseated') {
                changes.push(`- ${m.nickname}：${oldL.toUpperCase()} ➔ ${newL.toUpperCase()}`);
            } else if (oldL !== 'unseated' && (!newL || newL === 'unseated')) {
                changes.push(`- ${m.nickname}：${oldL.toUpperCase()} ➔ 移出座位`);
            } else if (oldL === 'unseated' && newL && newL !== 'unseated') {
                changes.push(`- ${m.nickname}：未落座 ➔ ${newL.toUpperCase()}`);
            }
        });

        if (changes.length === 0) {
            alert("自动落座计算完毕。当前已是最优解，无成员需要变更位置。");
            return;
        }

        if (confirm(`自动落座计算完毕，变动如下 (已忽略原位不动的成员)：\n\n${changes.join('\n')}\n\n是否确认应用变动？`)) {
            // 执行最终写入
            trapData.seats.forEach(s => { s.memberId = newSeatAssignments[s.id] || null; });
            trapData.unseated = newUnseated.map(m => m.id);
            this.saveData();
            this.updateMap();
        }
    }

}