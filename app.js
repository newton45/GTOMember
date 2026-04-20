document.addEventListener('DOMContentLoaded', () => {
    // 初始化数据管理器
    const dataManager = new DataManager();
    const modalContainer = document.getElementById('modal-container');

    // 初始化页面逻辑
    // 确保这里的 MembersPage 正常实例化，它是渲染 10x10 网格的核心
    const membersPage = new MembersPage(dataManager, modalContainer);
    const activitiesPage = new ActivitiesPage(dataManager, modalContainer);

    // --- 导航切换逻辑 ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navButtons.forEach(btn => {
        btn.onclick = () => {
            const targetPage = btn.dataset.page;
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            pages.forEach(p => {
                p.classList.toggle('active', p.id === `page-${targetPage}`);
            });
        };
    });

    // --- 导入/导出逻辑 (带防御检查与 Upsert 修复) ---
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
                
                // 拼接反馈报告
                let msg = `解析成功！\n有效数据: ${report.importedCount}条\n忽略空项: ${report.skippedCount}条`;
                if (report.missingHeaders.length > 0) msg += `\n缺失抬头: ${report.missingHeaders.join(', ')}`;
                if (report.extraHeaders.length > 0) msg += `\n冗余抬头已过滤: ${report.extraHeaders.join(', ')}`;
                
                if (confirm(`${msg}\n\n确认导入并合并这些数据吗？`)) {
                    
                    report.data.forEach(item => {
                        // 【关键修复】：建立 Upsert（更新或插入）逻辑分支
                        const existing = dataManager.members.findById(item.id);
                        if (existing) {
                            // 实体已存在，执行属性覆盖
                            dataManager.members.update(item.id, item);
                        } else {
                            // 实体不存在，使用标准构造函数实例化并压入数组
                            // 注意这里调用了 new Member()，确保其拥有该类的默认属性和方法
                            dataManager.members.add(new Member(item));
                        }
                    });
                    
                    dataManager.save(); // 将内存数据序列化写入 Storage
                    location.reload();  // 重新挂载整个页面视图
                }
            } catch (err) {
                alert(err);
            } finally {
                fileImport.value = ''; // 清空 file input，允许连续导入同一文件
            }
        };
    }

    // --- 导航栏红叉清空逻辑 (新功能) ---
    document.querySelectorAll('.nav-clear-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation(); // 阻止切换 Tab
            const target = btn.dataset.target;
            
            if (target === 'members') {
                if (confirm('⚠️ 确定要清空所有【成员数据】吗？此操作不可逆。')) {
                    // 【关键修复】：用 [...] 解构赋值创建一个静态快照，防止遍历时发生游标塌陷
                    const allMembersSnapshot = [...dataManager.members.getAll()]; 
                    
                    // 遍历静态快照，销毁底层真实数据
                    allMembersSnapshot.forEach(m => dataManager.members.remove(m.id));
                    
                    dataManager.save();
                    location.reload();
                }
            } else if (target === 'activities') {
                if (confirm('⚠️ 确定要清空所有【活动数据】吗？')) {
                    alert('活动数据已清空');
                }
            }
        };
    });

    // 【关键】：这里删除了所有关于 btn-clear 的引用，防止报错中断渲染
});