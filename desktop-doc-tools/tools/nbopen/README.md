# nbopen — 拖放打开 Jupyter 笔记本

Windows 小工具：把 `.ipynb` 拖到脚本或 `nbopen.exe` 上，自动打开 Jupyter Notebook 并打开该文件。

本工具**独立于**仓库里的 PDF/PPT 转换工具，不参与 `build_all.bat`。

## 怎么用

1. **拖放**：选一个或多个 `.ipynb`，拖到 `open_ipynb.py` 或 `nbopen.exe` 上。
2. **双击 / 无参数运行**：会弹出文件选择框（可多选）。
3. **命令行**：
   ```bat
   python tools\nbopen\open_ipynb.py "C:\path\to\note.ipynb"
   nbopen.exe "C:\path\to\a.ipynb" "C:\path\to\b.ipynb"
   ```

只接受 `.ipynb`。`.ipy` 是 IPython 脚本，不是笔记本，会提示并跳过。

每个文件会把工作目录设为该笔记本所在文件夹。

## 行为说明

- **优先复用**本机已在运行的 Jupyter / Notebook 服务（读取 runtime 目录里的 `jpserver-*.json` / `nbserver-*.json`）。若笔记本在该服务根目录下、有 token，且 `127.0.0.1:端口` 真正能连通，则用浏览器直接打开，不再起新服务。陈旧 runtime 记录（进程已退出但文件还在）会被跳过。
- **没有合适服务时**，后台启动 `jupyter notebook 该文件.ipynb`。进程与本工具脱离：**关掉本工具的黑窗口不会结束 Notebook 服务**。
- 控制台有中文进度；结束后按回车关闭（双击运行不会闪退）。

## 找不到 jupyter 时

本工具**不会**把 Jupyter 打进 exe，需要本机已安装。查找顺序大致为：当前 PATH → 注册表永久 PATH → conda `environments.txt` → Anaconda/Miniconda/官方 Python 常见位置 → 同目录 `jupyter.txt` → `py -m notebook`。

若仍找不到，在 **exe 或脚本同目录** 创建 `jupyter.txt`，**第一行**写 `jupyter.exe` 的完整路径，例如：

```text
C:\Users\你的用户名\anaconda3\Scripts\jupyter.exe
```

## 怎么打包成 exe

需要本机已安装 PyInstaller。在 **`desktop-doc-tools/`** 目录执行：

```bat
packaging\build_nbopen.bat
```

或：

```bat
pyinstaller --onefile --console packaging\nbopen.spec
```

产物一般为：`dist\nbopen.exe`（`--onefile --console`）。可将 `jupyter.txt` 放在 exe 同目录。

## 直接运行脚本（不打包）

```bat
python tools\nbopen\open_ipynb.py
```
