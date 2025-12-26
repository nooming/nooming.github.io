// localStorage 操作

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

