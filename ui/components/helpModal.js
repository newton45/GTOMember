/* ui/components/helpModal.js */
class HelpModal {
    constructor(container) {
        this.container = container;
        this.docs = {
            members: {
                title: "成员管理",
                content: `<div style="line-height: 1.6; color: var(--gray-700); font-size: 14px;">
                    <p style="margin-bottom: 12px;">拖动在盟成员顺序即可战力排序。也可点击连续排序，输入开始排序的序号后，连续点击不同成员即可依次将成员排序。</p>
                    <li><strong>连续排序举例：</strong>点击按钮输入“4”后，依次点击A、B、C成员，则A、B、C战力分别排至4、5、6名次。</li>
                        
                </div>`
            },
            activities: {
                title: "活动管理",
                content: `<div style="line-height: 1.6; color: var(--gray-700); font-size: 14px;">
                    <p style="margin-bottom: 12px;">单个活动有“活动组”、“活动战果”构成。</p>
                    <ul style="padding-left: 20px;">
                        <li><strong>活动组：</strong>添加人员后，左键成员设为组长，右键成员设为替补</li>
                        <li><strong>战果录入：</strong>记录后会同步影响成员卡片上的近三场平均排名及出勤率。</li>
                    </ul>
                </div>`
            },
            seats: {
                title: "座位管理",
                content: `<div style="line-height: 1.6; color: var(--gray-700); font-size: 14px;">
                    <p style="margin-bottom: 12px;">设置成员座位，可同时参考战力以及打熊活跃度，按战力自动排序</p>
                    <ul style="padding-left: 20px;">
                        <li><strong>打熊活跃度：</strong>在“成员标记”界面中，点右键可切换其至半活跃（橙框）、不活跃（红框）状态。</li>
                        <li><strong>空间隔离：</strong>保存、读取和清除仅对当前地图和其视野内的障碍物生效。</li>
                    </ul>
                </div>`
            }
        };
    }

    render(pageKey) {
        const doc = this.docs[pageKey];
        if (!doc) return;
        this.container.innerHTML = `
            <div class="modal-overlay" style="z-index: 9999;">
                <div class="modal" style="width: 400px;">
                    <div class="modal-header" style="border-bottom: 2px solid var(--success, #10b981);">
                        <h2>💡 ${doc.title}</h2>
                        <button class="modal-close" data-action="close-help">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 20px;">${doc.content}</div>
                </div>
            </div>
        `;
        this.container.classList.remove('hidden');
        this.container.querySelector('[data-action="close-help"]').onclick = () => {
            this.container.classList.add('hidden');
            this.container.innerHTML = '';
        };
    }
}