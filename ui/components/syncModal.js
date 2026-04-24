/* ui/components/syncModal.js */
class SyncModal {
    constructor(container, dataManager) {
        this.container = container;
        this.dataManager = dataManager;
        
        // 【核心修复】：全局事件委托 (Event Delegation)
        // 挂载在根节点上，彻底解决内部 DOM 重新渲染导致的事件丢失问题
        this.container.addEventListener('click', (e) => {
            // 如果点击的元素本身或其父级带有 data-action="close"
            const closeBtn = e.target.closest('[data-action="close"]');
            // 或者点击到了半透明的黑色遮罩层
            const isOverlay = e.target.classList.contains('modal-overlay');
            
            if (closeBtn || isOverlay) {
                this.close();
            }
        });
    }

    open(mode) {
        this.mode = mode;
        this.container.classList.remove('hidden');

        // 如果是上传，先渲染自定义的密码输入界面
        if (mode === 'upload') {
            this.renderPasswordCheck();
        } else {
            // 下载模式直接进入云端连接
            this.startSync();
        }
    }

    renderPasswordCheck() {
        this.container.innerHTML = `
            <div class="modal-overlay">
                <div class="modal modal-selector" style="width: 320px; text-align: center; padding: 25px;">
                    <h3 style="margin-top:0; margin-bottom: 20px;">🛡️ 权限验证</h3>
                    <p style="font-size: 13px; color: var(--gray-600); margin-bottom: 15px;">请输入上传密码以覆写云端数据</p>
                    <input type="password" id="sync-pwd-input" style="width: 100%; padding: 10px; margin-bottom: 20px; border: 1px solid var(--gray-300); border-radius: 4px; text-align: center; font-size: 16px;" placeholder="密码...">
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button class="btn" data-action="close" style="flex: 1;">取消</button>
                        <button class="btn btn-primary" id="btn-verify-pwd" style="flex: 1;">验证</button>
                    </div>
                    <div id="pwd-error-msg" style="color: var(--danger); font-size: 12px; margin-top: 10px; display: none;">密码错误！</div>
                </div>
            </div>
        `;

        // 绑定特定业务按钮（无需再绑定 close，委托已处理）
        const verifyBtn = this.container.querySelector('#btn-verify-pwd');
        if (verifyBtn) {
            verifyBtn.onclick = () => {
                const pwd = this.container.querySelector('#sync-pwd-input').value;
                if (pwd === "******") {
                    this.startSync();
                } else {
                    const errMsg = this.container.querySelector('#pwd-error-msg');
                    errMsg.style.display = 'block';
                    const modalEl = this.container.querySelector('.modal');
                    modalEl.style.transform = 'translateX(5px)';
                    setTimeout(() => modalEl.style.transform = 'translateX(-5px)', 50);
                    setTimeout(() => modalEl.style.transform = 'translateX(0)', 100);
                }
            };
        }
    }

    async startSync() {
        this.container.innerHTML = `<div class="modal-overlay"><div class="modal-content" style="padding:40px 30px; text-align:center; font-weight:bold; color: var(--primary);">☁️ 正在连接云端引擎，请稍候...</div></div>`;
        
        const remoteData = await CloudSync.fetchRemote();
        if (!remoteData) { 
            this.container.innerHTML = `<div class="modal-overlay"><div class="modal-content" style="padding:30px; text-align:center; color: var(--danger);">❌ 连接云端失败。请检查 API_KEY 或网络。</div></div>`;
            setTimeout(() => this.close(), 2000);
            return; 
        }
        
        const localData = ImportExport.collectFullSnapshot(this.dataManager);
        const sourceData = this.mode === 'upload' ? localData : remoteData;
        const targetData = this.mode === 'upload' ? remoteData : localData;

        this.renderCheckboxes(this.mode, sourceData, targetData);
    }

    renderCheckboxes(mode, sourceData, targetData) {
        const isUp = mode === 'upload';
        const title = isUp ? "☁️ 上传设置到云端" : "📥 从云端下载设置";
        const desc = isUp ? "勾选要更新到云端的模块（未勾选的将保留云端原状）" : "勾选要下载到本地的模块（未勾选的将保留本地原状）";

        const acts = sourceData.activities || [];
        const actCheckboxes = acts.map(a => `
            <label style="display:flex; align-items:center; gap:8px; margin: 12px 0; cursor:pointer;">
                <input type="checkbox" name="sync-item" value="act_${a.id}" checked style="width:16px; height:16px;"> 
                活动记录 - ${a.name}
            </label>
        `).join('');

        const html = `
            <div class="modal-overlay">
                <div class="modal modal-selector" style="width: 420px;">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="modal-close" data-action="close">&times;</button>
                    </div>
                    <div class="modal-body" style="text-align: left;">
                        <p style="font-size:13px; color:var(--gray-600); margin-bottom:15px; border-left: 3px solid var(--primary); padding-left: 10px;">${desc}</p>
                        
                        <div style="background: var(--gray-50); padding: 15px 20px; border-radius: 8px; border: 1px solid var(--gray-200);">
                            <label style="display:flex; align-items:center; gap:8px; margin-bottom: 12px; cursor:pointer; font-weight:bold; color: var(--primary);">
                                <input type="checkbox" name="sync-item" value="members_active" checked style="width:16px; height:16px;"> 
                                [成员] 在盟主力排位数据
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; margin-bottom: 12px; cursor:pointer; color: var(--gray-700);">
                                <input type="checkbox" name="sync-item" value="members_out" checked style="width:16px; height:16px;"> 
                                [成员] 非本盟成员区
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; margin-bottom: 12px; cursor:pointer; color: var(--gray-500);">
                                <input type="checkbox" name="sync-item" value="members_memorial" checked style="width:16px; height:16px;"> 
                                [成员] 纪念区 (已退游)
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; margin-bottom: 12px; cursor:pointer; font-weight:bold; color: var(--primary);">
                                <input type="checkbox" name="sync-item" value="seats" checked style="width:16px; height:16px;"> 
                                空间座位与障碍物地图
                            </label>
                            
                            <div style="border-top: 1px dashed var(--gray-300); margin: 15px 0;"></div>
                            
                            <div style="max-height: 150px; overflow-y: auto;">
                                ${actCheckboxes || '<div style="color:var(--gray-400); font-size:12px; text-align:center; padding: 10px;">暂无活动数据</div>'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="justify-content: flex-end;">
                        <button class="btn" data-action="close">取消</button>
                        <button class="btn btn-primary" id="btn-confirm-sync" style="padding: 8px 20px;">执行${isUp ? '上传' : '下载'}</button>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        
        // 绑定确认按钮业务逻辑
        const confirmBtn = this.container.querySelector('#btn-confirm-sync');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                confirmBtn.innerText = "正在处理..."; confirmBtn.disabled = true;

                const checkboxes = this.container.querySelectorAll('input[name="sync-item"]:checked');
                const selections = Array.from(checkboxes).map(cb => cb.value);

                if (selections.length === 0) {
                    alert("请至少勾选一项内容！");
                    confirmBtn.innerText = `执行${isUp ? '上传' : '下载'}`; confirmBtn.disabled = false;
                    return;
                }

                const mergedData = CloudSync.mergeData(sourceData, targetData, selections);

                if (isUp) {
                    const success = await CloudSync.pushRemote(mergedData);
                    if (success) {
                        alert("✅ 设置已成功上传至云端！");
                        this.close();
                    } else {
                        confirmBtn.innerText = `执行上传`; confirmBtn.disabled = false;
                    }
                } else {
                    ImportExport.applyFullSnapshot(mergedData, this.dataManager);
                    alert("✅ 设置已成功下载并应用！即将刷新页面...");
                    window.location.reload();
                }
            };
        }
    }

    close() {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
    }
}