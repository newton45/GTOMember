class Member {
    constructor(data = {}) {
        this.nickname = data.nickname || '';
        this.id = data.id || '';
        this.powerRank = data.powerRank || null;
        this.rank = data.rank || CONSTANTS.DEFAULT_RANK;
        this.accounts = data.accounts || [];
        this.leftAlliance = data.leftAlliance || false;
        this.pastNicknames = data.pastNicknames || [];
    }

    get displayPowerRank() {
        if (this.powerRank === null || this.powerRank === undefined) {
            return CONSTANTS.UNRANKED_DISPLAY;
        }
        return this.powerRank.toString();
    }

    get sortPowerRank() {
        return this.powerRank ?? CONSTANTS.MAX_POWER_RANK + 1;
    }

    toPlain() {
        return {
            nickname: this.nickname,
            id: this.id,
            powerRank: this.powerRank,
            rank: this.rank,
            accounts: this.accounts,
            leftAlliance: this.leftAlliance,
            pastNicknames: this.pastNicknames
        };
    }

    static fromPlain(data) {
        return new Member(data);
    }
}
