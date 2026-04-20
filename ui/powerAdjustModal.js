class PowerAdjustModal {
    constructor(container) {
        this.container = container;
        this.onSave = null;
        this.history = [];
        this.powerSlots = {};
        this.membersByRank = {};
        this.unassignedMembers = [];
        this.isAnimating = false;

        this.draggedMember = null;
        this.sourcePower = null;
        this.targetPower = null;
    }

    render(members) {
        this.history = [];
        this.membersByRank = {};
        this.powerSlots = {};

        const allMembers = Array.isArray(members) ? members : members.getAll();
        CONSTANTS.RANKS.forEach(rank => {
            this.membersByRank[rank] = allMembers.filter(m => m.rank === rank && !m.leftAlliance);
        });

        this.initializePowerSlots();
        
        // 【关键逻辑 1】：初始化时存入初始快照 S0
        this.history = [JSON.parse(JSON.stringify(this.powerSlots))];

        const html = `
            <div class="modal modal-power" id="modal-power-adjust">
                <div class="modal-header">
                    <h2>战力调整</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="power-grid">
                        ${Array.from({ length: 100 }, (_, i) => {
                            const power = i + 1;
                            return this.renderPowerSlot(power, this.powerSlots[power] || null);
                        }).join('')}
                    </div>
                    <div class="unassigned-members">
                        <h3>未分配排名</h3>
                        <div class="unassigned-list" id="unassigned-list"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" data-action="cancel">取消</button>
                    <button class="btn" data-action="undo">撤销上一步</button>
                    <button class="btn btn-primary" data-action="save">确认</button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        this.container.classList.remove('hidden');
        this.bindEvents();
        this.renderUnassignedMembers();
    }

    // 将 FLIP 动画封装为通用管线
    applyStateWithAnimation(updateLogicFn) {
        this.isAnimating = true;

        // F: First - 记录位置
        const blocks = Array.from(this.container.querySelectorAll('.power-member-block'));
        const firstRects = new Map();
        blocks.forEach(block => firstRects.set(block.dataset.id, block.getBoundingClientRect()));

        // 执行具体的数据更改逻辑
        updateLogicFn();

        // L: Last - 渲染新位置
        this.renderPowerGrid();
        this.renderUnassignedMembers();

        // I & P: Invert & Play
        const newBlocks = Array.from(this.container.querySelectorAll('.power-member-block'));
        newBlocks.forEach(block => {
            const oldRect = firstRects.get(block.dataset.id);
            if (oldRect) {
                const newRect = block.getBoundingClientRect();
                const dx = oldRect.left - newRect.left;
                const dy = oldRect.top - newRect.top;
                if (dx !== 0 || dy !== 0) {
                    block.style.transition = 'none';
                    block.style.transform = `translate(${dx}px, ${dy}px)`;
                    requestAnimationFrame(() => {
                        void block.offsetHeight;
                        block.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0, 1)';
                        block.style.transform = 'translate(0, 0)';
                    });
                }
            }
        });

        setTimeout(() => {
            this.isAnimating = false;
        }, 350);
    }

    renderPowerSlot(power, member) {
        return `
            <div class="power-slot" data-power="${power}">
                <div class="power-number">${power}</div>
                ${member ? this.renderMemberBlock(member, power) : ''}
            </div>
        `;
    }

    renderMemberBlock(member, power) {
        return `
            <div class="power-member-block" draggable="true" data-id="${member.id}" data-power="${power}">
                <span class="member-block-nickname">${member.nickname || '未命名'}</span>
            </div>
        `;
    }

    renderUnassignedMembers() {
        const unassignedArea = this.container.querySelector('#unassigned-list');
        if (!unassignedArea) return;

        this.unassignedMembers = [];
        CONSTANTS.RANKS.forEach(rank => {
            this.unassignedMembers.push(...this.membersByRank[rank].filter(m => {
                return !Object.values(this.powerSlots).some(slot => slot?.id === m.id);
            }));
        });

        unassignedArea.innerHTML = this.unassignedMembers.map(m => this.renderMemberBlock(m, 'unassigned')).join('');
    }

    initializePowerSlots() {
        Object.values(this.membersByRank).flat().forEach(member => {
            if (member.powerRank && member.powerRank >= 1 && member.powerRank <= 100) {
                this.powerSlots[member.powerRank] = member;
            }
        });
    }

    bindEvents() {
        this.container.querySelector('.modal-close').onclick = () => this.close();
        this.container.querySelector('[data-action="cancel"]').onclick = () => this.close();
        this.container.querySelector('[data-action="save"]').onclick = () => this.save();
        this.container.querySelector('[data-action="undo"]').onclick = () => this.undo();

        // 采用“事件委托(Event Delegation)”机制，确保 DOM 重绘后依然有效，修复第二次无法拖动的问题
        this.container.ondragstart = (e) => {
            const block = e.target.closest('.power-member-block');
            if (block) {
                this.draggedMember = block.dataset.id;
                this.sourcePower = block.dataset.power === 'unassigned' ? null : parseInt(block.dataset.power);
                setTimeout(() => block.classList.add('dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
            }
        };

        this.container.ondragend = (e) => {
            const block = e.target.closest('.power-member-block');
            if (block) {
                block.classList.remove('dragging');
                this.draggedMember = null;
                this.sourcePower = null;
                this.targetPower = null;
                this.container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            }
        };

        this.container.ondragover = (e) => {
            const slot = e.target.closest('.power-slot');
            if (slot && !this.isAnimating) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            }
        };

        this.container.ondragleave = (e) => {
            const slot = e.target.closest('.power-slot');
            if (slot && !slot.contains(e.relatedTarget)) {
                slot.classList.remove('drag-over');
            }
        };

        this.container.ondrop = (e) => {
            const slot = e.target.closest('.power-slot');
            if (slot && !this.isAnimating) {
                e.preventDefault();
                slot.classList.remove('drag-over');

                if (!this.draggedMember) return;

                const targetPower = parseInt(slot.dataset.power);
                if (this.sourcePower === targetPower) return;

                this.targetPower = targetPower;
                this.handleDrop();
            }
        };
    }

    handleDrop() {
        const member = Object.values(this.membersByRank).flat().find(m => m.id === this.draggedMember);
        if (!member) return;

        this.applyStateWithAnimation(() => {
            this.updateDataModel(member);
            // 【关键逻辑 2】：变动完成后，存入新状态快照 Sn
            this.history.push(JSON.parse(JSON.stringify(this.powerSlots)));
        });
    }

    // 处理核心数据的移位计算
    updateDataModel(draggedMember) {
        // 自动消除空白位置的逻辑增强：
        // 逻辑本质是一个“区间平移”，不需要关心中间是否有空格，只要遍历区间并重新落位即可
        if (this.sourcePower === null) {
            // 插入模式
            for (let i = 100; i > this.targetPower; i--) {
                this.powerSlots[i] = this.powerSlots[i - 1];
                if(this.powerSlots[i]) this.powerSlots[i].powerRank = i;
            }
        } else {
            const step = this.sourcePower < this.targetPower ? 1 : -1;
            for (let i = this.sourcePower; i !== this.targetPower; i += step) {
                const next = i + step;
                this.powerSlots[i] = this.powerSlots[next];
                if(this.powerSlots[i]) this.powerSlots[i].powerRank = i;
            }
        }
        this.powerSlots[this.targetPower] = draggedMember;
        draggedMember.powerRank = this.targetPower;
        
        // 清理由于循环位移可能在原位置留下的残余数据
        if (this.sourcePower !== null && this.sourcePower !== this.targetPower) {
            // 在上面的循环中，原位置 sourcePower 已经被 i+step 覆盖了，
            // 只有当 targetPower 覆盖完之后，逻辑才是完整的
        }
    }

    renderPowerGrid() {
        const grid = this.container.querySelector('.power-grid');
        grid.innerHTML = Array.from({ length: 100 }, (_, i) => {
            const power = i + 1;
            return this.renderPowerSlot(power, this.powerSlots[power] || null);
        }).join('');
    }

    saveToHistory() {
        this.history.push({
            powerSlots: JSON.parse(JSON.stringify(this.powerSlots))
        });
    }

    undo() {
        if (this.isAnimating || this.history.length <= 1) {
            if (this.history.length <= 1) alert('已回退至初始状态');
            return;
        }

        // 【关键逻辑 3】：弹出当前态 Sn，应用栈顶的 Sn-1
        this.history.pop(); 
        const prevState = JSON.parse(JSON.stringify(this.history[this.history.length - 1]));

        this.applyStateWithAnimation(() => {
            this.powerSlots = prevState;
            // 必须同步更新成员对象内部的 powerRank 引用
            const allMembers = Object.values(this.membersByRank).flat();
            allMembers.forEach(m => m.powerRank = null); // 先重置
            Object.entries(this.powerSlots).forEach(([power, mData]) => {
                const m = allMembers.find(mem => mem.id === mData.id);
                if (m) m.powerRank = parseInt(power);
            });
        });
    }

    save() {
        const updates = {};
        Object.entries(this.powerSlots).forEach(([power, member]) => {
            if (member) {
                updates[member.id] = {
                    powerRank: parseInt(power)
                };
            }
        });

        if (this.onSave) {
            this.onSave(updates);
        }
        this.close();
    }

    close() {
        this.container.innerHTML = '';
        this.container.classList.add('hidden');
        this.history = [];
        this.powerSlots = {};
        this.draggedMember = null;
        this.sourcePower = null;
        this.targetPower = null;
        this.isAnimating = false;
    }
}