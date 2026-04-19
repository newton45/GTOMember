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
        this.initDragDrop();
        this.renderUnassignedMembers();
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

        unassignedArea.innerHTML = this.unassignedMembers.map(m => this.renderMemberBlock(m)).join('');
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
    }

    initDragDrop() {
        const slots = this.container.querySelectorAll('.power-slot');
        const blocks = this.container.querySelectorAll('.power-member-block');
        const unassignedBlocks = this.container.querySelectorAll('#unassigned-list .power-member-block');

        slots.forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                slot.classList.add('drag-over');
            });

            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drag-over');
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');

                if (!this.draggedMember || this.isAnimating) return;

                const targetPower = parseInt(slot.dataset.power);
                if (this.sourcePower === targetPower) return;

                this.targetPower = targetPower;
                this.handleDrop();
            });
        });

        [...blocks, ...unassignedBlocks].forEach(block => {
            block.addEventListener('dragstart', (e) => {
                this.draggedMember = block.dataset.id;
                this.sourcePower = parseInt(block.dataset.power) || null;
                block.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            block.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                this.draggedMember = null;
                this.sourcePower = null;
                this.targetPower = null;
            });
        });
    }

    handleDrop() {
        const member = Object.values(this.membersByRank).flat().find(m => m.id === this.draggedMember);
        if (!member) return;

        this.isAnimating = true;

        if (this.sourcePower < this.targetPower) {
            this.handleDownwardMove(member);
        } else if (this.sourcePower > this.targetPower) {
            this.handleUpwardMove(member);
        } else {
            this.isAnimating = false;
        }
    }

    handleDownwardMove(member) {
        const membersToMove = [];
        const targetMember = this.powerSlots[this.targetPower];

        if (targetMember && targetMember.id !== member.id) {
            for (let i = this.sourcePower + 1; i <= this.targetPower; i++) {
                if (this.powerSlots[i] && this.powerSlots[i].id !== member.id) {
                    membersToMove.push(this.powerSlots[i]);
                }
            }

            this.animateSequenceMove(membersToMove, -1, member, this.targetPower, () => {
                this.saveToHistory();
                this.renderPowerGrid();
                this.renderUnassignedMembers();
                this.isAnimating = false;
            });
        } else {
            this.isAnimating = false;
        }
    }

    handleUpwardMove(member) {
        const membersToMove = [];
        const sourceMember = this.powerSlots[this.targetPower];

        if (!sourceMember || sourceMember.id === member.id) {
            for (let i = this.targetPower; i < this.sourcePower; i++) {
                if (this.powerSlots[i]) {
                    membersToMove.push(this.powerSlots[i]);
                }
            }

            this.animateSequenceMove(membersToMove, 1, member, this.targetPower, () => {
                this.saveToHistory();
                this.renderPowerGrid();
                this.renderUnassignedMembers();
                this.isAnimating = false;
            });
        } else {
            this.isAnimating = false;
        }
    }

    animateSequenceMove(members, direction, draggedMember, targetPower, callback) {
        const duration = 1000;
        const perMemberDuration = duration / (members.length + 1);
        let delay = 0;

        members.forEach((member, index) => {
            setTimeout(() => {
                const block = this.container.querySelector(`.power-member-block[data-id="${member.id}"]`);
                if (block) {
                    block.style.transition = `opacity ${perMemberDuration * 0.3}s ease-in-out`;
                    block.style.opacity = '0.3';

                    setTimeout(() => {
                        const newPower = member.powerRank + direction;
                        if (newPower >= 1 && newPower <= 100) {
                            this.powerSlots[newPower] = member;
                            delete this.powerSlots[member.powerRank];
                            member.powerRank = newPower;

                            const newSlot = this.container.querySelector(`.power-slot[data-power="${newPower}"]`);
                            if (newSlot) {
                                const numberElement = newSlot.querySelector('.power-number');
                                const newBlock = this.renderMemberBlock(member, newPower);
                                newSlot.innerHTML = numberElement.outerHTML + newBlock;
                            }
                        }
                    }, perMemberDuration * 0.3);
                }
            }, delay);
            delay += perMemberDuration;
        });

        setTimeout(() => {
            this.powerSlots[targetPower] = draggedMember;
            delete this.powerSlots[this.sourcePower];
            draggedMember.powerRank = targetPower;

            const targetSlot = this.container.querySelector(`.power-slot[data-power="${targetPower}"]`);
            if (targetSlot) {
                const numberElement = targetSlot.querySelector('.power-number');
                targetSlot.innerHTML = numberElement.outerHTML + this.renderMemberBlock(draggedMember, targetPower);
            }

            callback();
        }, delay);
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
        if (this.history.length === 0) {
            alert('没有可撤销的操作');
            return;
        }

        const previousState = this.history.pop();
        this.powerSlots = previousState.powerSlots;

        Object.values(this.powerSlots).forEach(member => {
            if (member) {
                const power = Object.keys(this.powerSlots).find(k => this.powerSlots[k] === member);
                member.powerRank = power ? parseInt(power) : null;
            }
        });

        this.renderPowerGrid();
        this.renderUnassignedMembers();
        this.initDragDrop();
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