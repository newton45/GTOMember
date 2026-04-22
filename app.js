document.addEventListener('DOMContentLoaded', () => {
    try {
        // --- 核心节点探测 (排查 HTML 结构误删) ---
        if (!document.getElementById('members-grid')) {
            throw new Error("HTML缺失：找不到 id 为 'members-grid' 的容器！请检查 index.html 中成员管理部分是否被误删。");
        }
        if (!document.getElementById('page-activities')) {
            throw new Error("HTML缺失：找不到 id 为 'page-activities' 的容器！");
        }
        // 【新增探针】：座位管理容器探测
        if (!document.getElementById('page-seats')) {
            throw new Error("HTML缺失：找不到 id 为 'page-seats' 的容器！");
        }

        // --- 类文件探测 (排查 JS 脚本引入缺失) ---
        if (typeof DataManager === 'undefined') throw new Error("脚本缺失：找不到 DataManager 类，请检查 dataManager.js 是否正确引入。");
        if (typeof MembersPage === 'undefined') throw new Error("脚本缺失：找不到 MembersPage 类。");
        if (typeof ActivitiesPage === 'undefined') throw new Error("脚本缺失：找不到 ActivitiesPage 类，请检查 activitiesPage.js 是否引入。");
        // 【新增探针】：座位管理脚本探测
        if (typeof SeatPage === 'undefined') throw new Error("脚本缺失：找不到 SeatPage 类，请检查 seatPage.js 是否引入。");

        // 1. 初始化核心数据引擎
        const dataManager = new DataManager();
        const modalContainer = document.getElementById('modal-container');

        // 2. 挂载页面控制器 (Controller)
        const membersPage = new MembersPage(dataManager, modalContainer);
        const activitiesPage = new ActivitiesPage(dataManager, modalContainer);
        const seatPage = new SeatPage(dataManager, modalContainer);

        // 3. 页面切换逻辑 (Router)
        const navButtons = document.querySelectorAll('.nav-btn');
        const pages = document.querySelectorAll('.page');

        // 【新增】：从本地缓存读取上次最后访问的页面，如果没有则默认停留 'page-members'
        const lastActivePage = localStorage.getItem('App_lastActivePage') || 'page-members';

        // 初始化：根据缓存状态，点亮对应的按钮和显示对应的页面
        navButtons.forEach(btn => {
            const targetId = btn.dataset.target || `page-${btn.dataset.page}`;
            btn.classList.toggle('active', targetId === lastActivePage);
        });
        pages.forEach(p => {
            p.classList.toggle('active', p.id === lastActivePage);
        });

        // 绑定点击事件，并在每次点击时存档
        navButtons.forEach(btn => {
            btn.onclick = () => {
                // 兼容旧版的 data-page 和新版的 data-target
                const targetId = btn.dataset.target || `page-${btn.dataset.page}`;
                
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                pages.forEach(p => {
                    p.classList.toggle('active', p.id === targetId);
                });

                // 【新增】：将当前页面的 ID 存入本地缓存
                localStorage.setItem('App_lastActivePage', targetId);
            };
        });

        // 4. 导入/导出逻辑 (带防御性检查)
        const btnExport = document.getElementById('btn-export');
        if (btnExport) {
            btnExport.onclick = () => ImportExport.exportJSON(dataManager);
        }

        const btnImport = document.getElementById('btn-import');
        const fileImport = document.getElementById('file-import');
        if (btnImport && fileImport) {
            btnImport.onclick = () => fileImport.click();
            fileImport.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const report = await ImportExport.importJSON(file);
                    if (confirm(`解析成功！有效数据: ${report.importedCount}条。确认导入并合并吗？`)) {
                        report.data.forEach(item => {
                            const existing = dataManager.members.findById(item.id);
                            if (existing) {
                                dataManager.members.update(item.id, item);
                            } else {
                                dataManager.members.add(new Member(item));
                            }
                        });
                        dataManager.save();
                        location.reload(); 
                    }
                } catch (err) { alert(err); }
            };
        }

        // 5. 导航栏红叉清空逻辑 (快照隔离修复版)
        document.querySelectorAll('.nav-clear-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); 
                const target = btn.dataset.target;
                
                if (target === 'members') {
                    if (confirm('⚠️ 确定要清空所有【成员数据】吗？')) {
                        const allSnapshot = [...dataManager.members.getAll()]; 
                        allSnapshot.forEach(m => dataManager.members.remove(m.id));
                        dataManager.save();
                        location.reload();
                    }
                } else if (target === 'activities') {
                    if (confirm('⚠️ 确定要清空所有【活动数据】吗？')) {
                        dataManager.activities.clear();
                        dataManager.save();
                        location.reload();
                    }
                }
            };
        });

    } catch (error) {
        console.error("Initialization Crash:", error);
        alert("🚨 系统初始化崩溃！\n\n中断原因：\n" + error.message + "\n\n(进阶排查：按 F12 打开浏览器开发者工具，在 Console 控制台中查看详细红色报错信息。)");
    }
});