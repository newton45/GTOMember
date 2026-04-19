class App {
    constructor() {
        this.dataManager = new DataManager();
        this.modalContainer = document.getElementById('modal-container');
        this.membersPage = null;
        this.activitiesPage = null;

        this.init();
    }

    init() {
        this.bindNavigation();
        this.bindDataControls();

        this.membersPage = new MembersPage(this.dataManager, this.modalContainer);
        this.activitiesPage = new ActivitiesPage(this.dataManager);
    }

    bindNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        const pages = document.querySelectorAll('.page');

        navBtns.forEach(btn => {
            btn.onclick = () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const targetPage = btn.dataset.page;
                pages.forEach(p => {
                    p.classList.toggle('active', p.id === `page-${targetPage}`);
                });

                if (targetPage === 'activities') {
                    this.activitiesPage.init();
                }
            };
        });
    }

    bindDataControls() {
        document.getElementById('btn-export').onclick = () => {
            const filename = `gto_members_${new Date().toISOString().slice(0,10)}.json`;
            this.dataManager.export(filename);
        };

        const fileInput = document.getElementById('file-import');
        document.getElementById('btn-import').onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                if (confirm('导入将覆盖现有数据，确定继续？')) {
                    this.dataManager.import(file)
                        .then(() => {
                            this.membersPage.saveAndRender();
                            alert('导入成功');
                        })
                        .catch(err => {
                            alert('导入失败: ' + err.message);
                        });
                }
            }
            e.target.value = '';
        };

        document.getElementById('btn-clear').onclick = () => {
            if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
                this.dataManager.clear();
                this.membersPage.saveAndRender();
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
