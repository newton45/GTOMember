document.addEventListener('DOMContentLoaded', () => {
    try {
        // ==========================================
        // 1. 核心节点探测 (排查 HTML 结构误删)
        // ==========================================
        if (!document.getElementById('members-grid')) throw new Error("HTML缺失：找不到 id 为 'members-grid' 的容器！");
        if (!document.getElementById('page-activities')) throw new Error("HTML缺失：找不到 id 为 'page-activities' 的容器！");
        if (!document.getElementById('page-seats')) throw new Error("HTML缺失：找不到 id 为 'page-seats' 的容器！");

        // ==========================================
        // 2. 类文件探测 (排查 JS 脚本引入缺失)
        // ==========================================
        if (typeof DataManager === 'undefined') throw new Error("脚本缺失：找不到 DataManager 类，请检查 dataManager.js 是否正确引入。");
        if (typeof MembersPage === 'undefined') throw new Error("脚本缺失：找不到 MembersPage 类。");
        if (typeof ActivitiesPage === 'undefined') throw new Error("脚本缺失：找不到 ActivitiesPage 类。");
        if (typeof SeatPage === 'undefined') throw new Error("脚本缺失：找不到 SeatPage 类。");
        if (typeof ImportExport === 'undefined') throw new Error("脚本缺失：找不到 ImportExport 对象，请检查 core/importExport.js。");

        // ==========================================
        // 3. 初始化核心数据引擎与页面控制器
        // ==========================================
        const dataManager = new DataManager();
        const modalContainer = document.getElementById('modal-container');

        const membersPage = new MembersPage(dataManager, modalContainer);
        const activitiesPage = new ActivitiesPage(dataManager, modalContainer);
        const seatPage = new SeatPage(dataManager, modalContainer);

        // ==========================================
        // 4. 页面切换逻辑 (Router)
        // ==========================================
        const navButtons = document.querySelectorAll('.nav-btn');
        const pages = document.querySelectorAll('.page');
        
        // 从本地缓存读取上次最后访问的页面
        const lastActivePage = localStorage.getItem('App_lastActivePage') || 'page-members';

        // 【1. 定义状态机守卫】
        // 将其挂载到 window 对象上，使其成为一个具有上帝视角的全局探针
        window.triggerEmptyStateGuard = function(triggerSource = 'init') {
            
            // 核心判定：底层成员数据池彻底为空
            if (dataManager.members.getAll().length === 0) {
                
                // 宏任务延迟：非常关键的防死锁机制。
                // 确保页面的初次渲染，或“清空”操作导致的 DOM 销毁已经彻底完成，再弹出 confirm，避免卡死主线程。
                setTimeout(() => {
                    const promptMsg = triggerSource === 'cleared' 
                        ? "系统底层数据已被全部清空（当前为纯白板状态）。\n\n是否需要打开【云端同步】面板加载默认设置？"
                        : "检测到当前为初始空白系统（未发现任何成员数据）。\n\n是否需要从云端拉取已有数据？";

                    if (confirm(promptMsg)) {
                        // 【低耦合调用】：不去 import 云端逻辑，直接模拟点击顶层导航栏的云端按钮
                        const downloadBtn = document.getElementById('btn-cloud-download');
                        if (downloadBtn) {
                            downloadBtn.click();
                        } else {
                            console.warn("状态守卫：未检测到 DOM 树中存在云端读取按钮");
                        }
                    }
                }, 150); 
            }
        };

        // 【2. 生命周期注入】
        // 系统初始运行到此处时，静默执行一次初始探针
        window.triggerEmptyStateGuard('init');

        navButtons.forEach(btn => {
            const targetId = btn.dataset.target || `page-${btn.dataset.page}`;
            btn.classList.toggle('active', targetId === lastActivePage);
        });
        pages.forEach(p => {
            p.classList.toggle('active', p.id === lastActivePage);
        });

        navButtons.forEach(btn => {
            btn.onclick = () => {
                const targetId = btn.dataset.target || `page-${btn.dataset.page}`;
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                pages.forEach(p => p.classList.toggle('active', p.id === targetId));
                localStorage.setItem('App_lastActivePage', targetId);
            };
        });

        // ==========================================
        // 5. 全局数据控制台 (云端同步 + 本地备份 + 清空)
        // ==========================================
        
        // --- A. 云端同步 (JSONbin) ---
        if (typeof SyncModal !== 'undefined') {
            const syncModal = new SyncModal(modalContainer, dataManager);
            
            const btnUpload = document.getElementById('btn-cloud-upload');
            if (btnUpload) {
                btnUpload.addEventListener('click', () => syncModal.open('upload'));
            }

            const btnDownload = document.getElementById('btn-cloud-download');
            if (btnDownload) {
                btnDownload.addEventListener('click', () => syncModal.open('download'));
            }
        }

        // --- B. 本地 JSON 导出/导入 (作为防止云端失效的本地备份防线) ---
        const btnExport = document.getElementById('btn-export');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                // 兼容调用：优先使用下载实体文件的方法
                if (ImportExport.savePresetToFile) {
                    ImportExport.savePresetToFile(dataManager);
                } else if (ImportExport.exportJSON) {
                    ImportExport.exportJSON(dataManager); 
                }
            });
        }

        const btnImport = document.getElementById('btn-import');
        const fileImport = document.getElementById('file-import');
        if (btnImport && fileImport) {
            btnImport.addEventListener('click', () => fileImport.click());
            fileImport.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const snapshot = JSON.parse(event.target.result);
                        if (confirm('确认从本地文件载入？当前所有页面数据将被覆盖。')) {
                            const success = ImportExport.applyFullSnapshot(snapshot, dataManager);
                            if (success) window.location.reload();
                        }
                    } catch (err) {
                        alert('文件读取失败，请检查格式是否正确。');
                    }
                };
                reader.readAsText(file);
                fileImport.value = ''; // 清空选择，允许重复导入同一文件
            });
        }

        // --- C. 全部清空逻辑 ---
        const btnClearAll = document.getElementById('btn-clear-all');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', () => {
                if (confirm('⚠️ 警告：这将彻底抹除所有成员、活动历史和地图布局！\n操作不可逆，建议先确认云端或本地已有备份。')) {
                    localStorage.clear();
                    dataManager.members.data = [];
                    dataManager.activities.data = [];
                    window.location.reload();

                    // 呼叫全局探针，标记来源为 'cleared'
                    if (typeof window.triggerEmptyStateGuard === 'function') {
                        window.triggerEmptyStateGuard('cleared');
                    }
                }
            });
        }

        // --- D. 导航栏红叉单项清空逻辑 ---
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