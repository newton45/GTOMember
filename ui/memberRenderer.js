class MemberRenderer {
    constructor(container) {
        this.container = container;
    }

    render(members, onEdit, onDelete) {
        if (members.length === 0) {
            this.container.innerHTML = '<div class="placeholder">暂无成员</div>';
            return;
        }

        const sortedMembers = [...members].sort((a, b) => {
            if (a.leftAlliance !== b.leftAlliance) {
                return a.leftAlliance ? 1 : -1;
            }
            return a.sortPowerRank - b.sortPowerRank;
        });

        this.container.innerHTML = sortedMembers.map(member => this.renderCard(member, onEdit, onDelete)).join('');
    }

    renderCard(member, onEdit, onDelete) {
        const leftClass = member.leftAlliance ? 'left-alliance' : '';
        const rankClass = `rank-${member.rank}`;

        const accountsHtml = member.accounts.length > 0
            ? `<div class="member-accounts">分账号: ${member.accounts.map(a => a.nickname).join(', ')}</div>`
            : '';

        return `
            <div class="member-card ${leftClass}" data-id="${member.id}">
                <div class="member-card-header">
                    <div>
                        <div class="member-name">${member.nickname || '未命名'}</div>
                        <div class="member-power-rank">${member.displayPowerRank}</div>
                    </div>
                    <span class="member-rank-badge ${rankClass}">${member.rank}</span>
                </div>
                ${accountsHtml}
                <div class="member-card-actions">
                    <button class="btn btn-primary" data-action="edit" data-id="${member.id}">编辑</button>
                    <button class="btn btn-danger" data-action="delete" data-id="${member.id}">删除</button>
                </div>
            </div>
        `;
    }
}
