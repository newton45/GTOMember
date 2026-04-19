class MemberManager {
    constructor() {
        this.members = [];
    }

    add(member) {
        if (!this.isIdUnique(member.id)) {
            throw new Error('ID已存在');
        }
        this.members.push(member);
        return member;
    }

    update(id, updates) {
        const index = this.findIndexById(id);
        if (index === -1) return null;

        const member = this.members[index];

        if (updates.nickname && updates.nickname !== member.nickname) {
            member.pastNicknames.push(member.nickname);
        }

        if (updates.powerRank !== undefined && updates.powerRank !== member.powerRank) {
            this.adjustPowerRanksForMember(id, updates.powerRank);
        }

        Object.assign(member, updates);
        return member;
    }

    adjustPowerRanksForMember(memberId, newRank) {
        const member = this.findById(memberId);
        if (!member) return;

        const oldRank = member.powerRank;

        if (oldRank === newRank) return;

        if (newRank === null) {
            this.adjustRanksAfterRemoval(oldRank);
            return;
        }

        const activeMembers = this.members.filter(m =>
            !m.leftAlliance && m.id !== memberId && m.powerRank !== null
        );

        if (oldRank !== null && oldRank !== undefined) {
            if (newRank < oldRank) {
                activeMembers.forEach(m => {
                    if (m.powerRank >= newRank && m.powerRank < oldRank) {
                        m.powerRank = m.powerRank + 1;
                    }
                });
            } else {
                activeMembers.forEach(m => {
                    if (m.powerRank > oldRank && m.powerRank <= newRank) {
                        m.powerRank = m.powerRank - 1;
                    }
                });
            }
        } else {
            activeMembers.forEach(m => {
                if (m.powerRank >= newRank) {
                    m.powerRank = m.powerRank + 1;
                }
            });
        }
    }

    adjustRanksAfterRemoval(removedRank) {
        if (removedRank === null || removedRank === undefined) return;

        const activeMembers = this.members.filter(m =>
            !m.leftAlliance && m.powerRank !== null && m.powerRank > removedRank
        );

        activeMembers.forEach(m => {
            m.powerRank = m.powerRank - 1;
        });
    }

    remove(id) {
        const index = this.findIndexById(id);
        if (index === -1) return false;

        this.members.splice(index, 1);
        return true;
    }

    findById(id) {
        return this.members.find(m => m.id === id);
    }

    findIndexById(id) {
        return this.members.findIndex(m => m.id === id);
    }

    isIdUnique(id) {
        return !this.members.some(m => m.id === id);
    }

    search(query) {
        const q = query.toLowerCase();
        return this.members.filter(m =>
            m.nickname.toLowerCase().includes(q) ||
            m.id.includes(q)
        );
    }

    filterByRank(rank) {
        if (!rank) return this.members;
        return this.members.filter(m => m.rank === rank);
    }

    filterByStatus(leftAlliance) {
        if (leftAlliance === null || leftAlliance === undefined) return this.members;
        return this.members.filter(m => m.leftAlliance === leftAlliance);
    }

    getAll() {
        return this.members;
    }

    clear() {
        this.members = [];
    }

    toArray() {
        return this.members.map(m => m.toPlain());
    }

    fromArray(arr) {
        this.members = arr.map(data => Member.fromPlain(data));
    }
}
