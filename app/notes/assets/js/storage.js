// ========== 手写笔记 · localStorage ==========

// 加载数据
function loadState() {
    try {
        const saved = localStorage.getItem('handwrite-note-data');
        if (saved) {
            const loaded = JSON.parse(saved);
            
            // 兼容旧数据：从notebooks结构迁移到pages结构
            if (loaded.notebooks && !loaded.pages) {
                state.pages = [];
                loaded.notebooks.forEach(notebook => {
                    const notebookType = notebook.type || 'draw';
                    if (notebook.pages) {
                        notebook.pages.forEach(page => {
                            const newPage = {
                                id: page.id,
                                title: page.title || '新页面',
                                type: notebookType,
                                createdAt: page.createdAt || Date.now(),
                                updatedAt: page.updatedAt || Date.now()
                            };
                            
                            if (notebookType === 'text') {
                                newPage.content = page.content || '';
                            } else {
                                newPage.strokes = page.strokes || [];
                                newPage.imageData = page.imageData || null;
                            }
                            
                            state.pages.push(newPage);
                        });
                    }
                });
                // 迁移活动页面ID
                if (loaded.activeNotebookId && loaded.activePageId) {
                    state.activePageId = loaded.activePageId;
                }
            } else {
                // 新数据结构
                state.pages = loaded.pages || [];
                state.activePageId = loaded.activePageId || null;
                
                // 确保每个页面都有type属性
                state.pages.forEach(page => {
                    if (!page.type) {
                        page.type = page.content !== undefined ? 'text' : 'draw';
                    }
                    if (page.type === 'text' && page.content === undefined) {
                        page.content = '';
                    }
                    if (page.type === 'draw' && !page.strokes) {
                        page.strokes = [];
                        page.imageData = page.imageData || null;
                    }
                });
            }
        }
    } catch (err) {
        console.error('加载数据失败:', err);
        state.pages = [];
        state.activePageId = null;
    }
}

// 保存数据
function saveState() {
    try {
        localStorage.setItem('handwrite-note-data', JSON.stringify(state));
    } catch (err) {
        console.error('保存数据失败:', err);
    }
}

// 导出笔记（下载 JSON，不上传）
function exportNotesData() {
    try {
        const payload = JSON.stringify(state, null, 2);
        const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.href = url;
        a.download = `handwrite-note-data-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof showToast === 'function') {
            showToast('已导出备份文件', 'success');
        }
    } catch (err) {
        console.error('导出失败:', err);
        alert('导出失败，请重试。');
    }
}

// 触发导入文件选择
function triggerImportNotes() {
    const input = document.getElementById('notesImportInput');
    if (input) {
        input.value = '';
        input.click();
    }
}

// 从 JSON 文件导入（覆盖前确认；只写本机 localStorage）
function importNotesData(file) {
    if (!file) return;
    if (!confirm('导入将覆盖当前本机笔记，确定继续？')) {
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const loaded = JSON.parse(String(reader.result || ''));
            if (!loaded || typeof loaded !== 'object') {
                throw new Error('格式无效');
            }
            // 先清空再按 loadState 同逻辑灌入
            state.pages = [];
            state.activePageId = null;
            localStorage.setItem('handwrite-note-data', JSON.stringify(loaded));
            loadState();
            saveState();
            if (typeof multiSelectMode !== 'undefined') {
                multiSelectMode = false;
                selectedPageIds = [];
            }
            render();
            if (typeof showToast === 'function') {
                showToast('导入成功', 'success');
            }
        } catch (err) {
            console.error('导入失败:', err);
            alert('导入失败：文件不是有效的笔记备份。');
        }
    };
    reader.onerror = function () {
        alert('读取文件失败，请重试。');
    };
    reader.readAsText(file, 'utf-8');
}

