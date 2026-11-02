# -*- coding: utf-8 -*-
"""将 .ipynb 拖到本脚本/exe 上，自动打开 Jupyter Notebook。

支持拖放、命令行多文件，或无参数时弹出文件选择框。
优先复用本机已在运行的 Jupyter / Notebook 服务；没有合适服务时再启动新进程。
"""

from __future__ import annotations

import glob
import json
import os
import shutil
import socket
import subprocess
import sys
import urllib.parse
import webbrowser
from pathlib import Path


# ---------------------------------------------------------------------------
# Windows 进程创建标志：让 Notebook 服务脱离本工具进程
# ---------------------------------------------------------------------------
CREATE_NEW_PROCESS_GROUP = 0x00000200
DETACHED_PROCESS = 0x00000008
CREATE_BREAKAWAY_FROM_JOB = 0x01000000
CREATE_NEW_CONSOLE = 0x00000010

# 优先：完全脱离；若 DETACHED 导致浏览器无法弹出，可改用 CREATE_NEW_CONSOLE
_DETACH_FLAGS = CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS | CREATE_BREAKAWAY_FROM_JOB
_CONSOLE_FLAGS = CREATE_NEW_PROCESS_GROUP | CREATE_NEW_CONSOLE | CREATE_BREAKAWAY_FROM_JOB


def app_dir() -> Path:
    """exe 或脚本所在目录（用于读取 jupyter.txt）。"""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def pick_ipynb_with_dialog(title: str = "选择要打开的 Jupyter 笔记本") -> list[Path]:
    """无命令行参数时，用 tkinter 选择一个或多个 .ipynb。"""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError:
        print("未安装 tkinter，且未通过命令行传入笔记本路径。")
        print("用法: 将 .ipynb 拖到本程序上，或运行:")
        print('  nbopen.exe "文件.ipynb"')
        return []

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    paths = filedialog.askopenfilenames(
        title=title,
        filetypes=[("Jupyter 笔记本", "*.ipynb"), ("所有文件", "*.*")],
    )
    root.destroy()
    return [Path(p) for p in paths]


def collect_ipynb_args(argv: list[str]) -> list[Path]:
    """从命令行/拖放参数收集 .ipynb 路径；.ipy 等非笔记本给出中文提示并跳过。"""
    paths: list[Path] = []
    for arg in argv:
        if arg.lower() in ("-h", "--help"):
            continue
        p = Path(arg).expanduser()
        try:
            p = p.resolve()
        except OSError:
            print(f"跳过无效路径: {arg}")
            continue

        if not p.is_file():
            print(f"跳过无效路径: {arg}")
            continue

        suffix = p.suffix.lower()
        if suffix == ".ipynb":
            paths.append(p)
        elif suffix == ".ipy":
            print(f"跳过: {p.name} 是 .ipy（IPython 脚本），不是 Jupyter 笔记本（.ipynb）。")
        else:
            print(f"跳过非 .ipynb 文件: {p}")
    return paths


# ---------------------------------------------------------------------------
# 查找 jupyter.exe
# ---------------------------------------------------------------------------

def _which_jupyter_on_path() -> Path | None:
    """当前进程 PATH 上的 jupyter。"""
    found = shutil.which("jupyter")
    if found:
        return Path(found)
    # Windows 有时只有 jupyter.exe
    found = shutil.which("jupyter.exe")
    if found:
        return Path(found)
    return None


def _read_registry_path_entries() -> list[str]:
    """从 HKLM / HKCU 的永久 Path 读取目录列表。"""
    if sys.platform != "win32":
        return []
    try:
        import winreg
    except ImportError:
        return []

    entries: list[str] = []
    keys = [
        (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
        (winreg.HKEY_CURRENT_USER, r"Environment"),
    ]
    for hive, subkey in keys:
        try:
            with winreg.OpenKey(hive, subkey) as key:
                value, _ = winreg.QueryValueEx(key, "Path")
        except OSError:
            continue
        if not isinstance(value, str):
            continue
        for part in value.split(os.pathsep):
            part = part.strip().strip('"')
            if not part:
                continue
            expanded = os.path.expandvars(part)
            if expanded and expanded not in entries:
                entries.append(expanded)
    return entries


def _jupyter_in_dir(directory: str | Path) -> Path | None:
    d = Path(directory)
    for name in ("jupyter.exe", "jupyter"):
        candidate = d / name
        if candidate.is_file():
            return candidate
    return None


def _from_permanent_path() -> Path | None:
    for directory in _read_registry_path_entries():
        found = _jupyter_in_dir(directory)
        if found:
            return found
    return None


def _from_conda_environments_txt() -> Path | None:
    env_txt = Path(os.path.expandvars(r"%USERPROFILE%\.conda\environments.txt"))
    if not env_txt.is_file():
        return None
    try:
        lines = env_txt.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return None
    for line in lines:
        root = line.strip()
        if not root:
            continue
        env_root = Path(os.path.expandvars(root))
        for scripts in (env_root / "Scripts", env_root / "bin", env_root):
            found = _jupyter_in_dir(scripts)
            if found:
                return found
    return None


def _from_common_locations() -> Path | None:
    home = Path(os.path.expanduser("~"))
    local = Path(os.path.expandvars(r"%LOCALAPPDATA%"))
    candidates: list[Path] = []

    for name in ("anaconda3", "miniconda3", "Anaconda3", "Miniconda3"):
        candidates.append(home / name / "Scripts")
        candidates.append(home / name / "bin")
        # 有时装在用户 LocalAppData
        candidates.append(local / name / "Scripts")

    # %LOCALAPPDATA%\Programs\Python\Python*\Scripts
    py_glob = local / "Programs" / "Python" / "Python*" / "Scripts"
    candidates.extend(Path(p) for p in sorted(glob.glob(str(py_glob)), reverse=True))

    for d in candidates:
        found = _jupyter_in_dir(d)
        if found:
            return found
    return None


def _from_jupyter_txt() -> Path | None:
    """exe/脚本目录下的 jupyter.txt，第一行是 jupyter.exe 完整路径。"""
    txt = app_dir() / "jupyter.txt"
    if not txt.is_file():
        return None
    try:
        first = txt.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return None
    if not first:
        return None
    path = Path(os.path.expandvars(first[0].strip().strip('"')))
    if path.is_file():
        return path
    return None


def find_jupyter() -> Path | None:
    """按约定顺序查找 jupyter 可执行文件。"""
    for finder in (
        _which_jupyter_on_path,
        _from_permanent_path,
        _from_conda_environments_txt,
        _from_common_locations,
        _from_jupyter_txt,
    ):
        try:
            found = finder()
        except Exception:
            found = None
        if found is not None:
            return found.resolve()
    return None


def print_jupyter_not_found_help() -> None:
    txt = app_dir() / "jupyter.txt"
    print("未找到 jupyter。请任选一种方式配置：")
    print("  1) 把 Anaconda/Miniconda 的 Scripts 目录加入系统 PATH，并确保其中有 jupyter.exe")
    print("  2) 在本程序同目录创建 jupyter.txt，第一行写 jupyter.exe 的完整路径，例如：")
    print(r'       C:\Users\你的用户名\anaconda3\Scripts\jupyter.exe')
    print(f"     当前期望位置: {txt}")
    print("  3) 安装 Python 启动器后，也可使用: py -m notebook")
    print("不要把 Jupyter 打进本 exe；本工具只负责启动本机已安装的 Jupyter。")


# ---------------------------------------------------------------------------
# 已运行的 Jupyter / Notebook 服务
# ---------------------------------------------------------------------------

def get_runtime_dir() -> Path | None:
    """jupyter --runtime-dir，失败则用常规位置 / jupyter_core。"""
    jupyter = find_jupyter()
    if jupyter is not None:
        try:
            r = subprocess.run(
                [str(jupyter), "--runtime-dir"],
                capture_output=True,
                text=True,
                timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
            if r.returncode == 0:
                line = (r.stdout or "").strip().splitlines()
                if line:
                    p = Path(line[0].strip())
                    if p.is_dir():
                        return p
        except Exception:
            pass

    try:
        from jupyter_core.paths import jupyter_runtime_dir

        p = Path(jupyter_runtime_dir())
        if p.is_dir():
            return p
    except Exception:
        pass

    appdata = os.environ.get("APPDATA")
    if appdata:
        p = Path(appdata) / "jupyter" / "runtime"
        if p.is_dir():
            return p
    return None


def _server_root_dir(info: dict) -> Path | None:
    for key in ("root_dir", "notebook_dir", "contents_root"):
        val = info.get(key)
        if isinstance(val, str) and val.strip():
            try:
                return Path(val).expanduser().resolve()
            except OSError:
                continue
    return None


def _load_server_infos(runtime_dir: Path) -> list[dict]:
    patterns = ("jpserver-*.json", "nbserver-*.json")
    infos: list[dict] = []
    seen: set[str] = set()
    for pattern in patterns:
        for path in sorted(runtime_dir.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True):
            key = str(path.resolve())
            if key in seen:
                continue
            seen.add(key)
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if isinstance(data, dict):
                infos.append(data)
    return infos


def _port_is_reachable(host: str, port: int, timeout: float = 0.8) -> bool:
    """真正尝试 TCP 连接，确认端口上有进程在监听。"""
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return True
    except OSError:
        return False


def find_matching_server(notebook: Path) -> dict | None:
    """若笔记本在某运行中服务的根目录下，且有 token/端口，则返回该服务信息。

    runtime 里的 jpserver-*.json 在 Jupyter 异常退出后常会残留。
    复用前必须确认 127.0.0.1:port 能连通，否则忽略该陈旧记录。
    """
    runtime_dir = get_runtime_dir()
    if runtime_dir is None:
        return None

    notebook = notebook.resolve()
    for info in _load_server_infos(runtime_dir):
        port = info.get("port")
        token = info.get("token")
        if not port or not token:
            # token 缺失则不使用该服务
            continue
        root = _server_root_dir(info)
        if root is None:
            continue
        try:
            notebook.relative_to(root)
        except ValueError:
            # 根目录对不上
            continue
        # 过期 runtime 文件常见：端口/token 都在，但进程已退出、无人监听
        if not _port_is_reachable("127.0.0.1", int(port)):
            continue
        return {
            "port": int(port),
            "token": str(token),
            "root": root,
            "url": info.get("url") or f"http://127.0.0.1:{port}/",
        }
    return None


def open_in_existing_server(notebook: Path, server: dict) -> str:
    """用浏览器打开已有服务上的笔记本，返回打开的 URL。"""
    rel = notebook.resolve().relative_to(server["root"])
    # 反斜杠改为正斜杠，并对路径段做 URL 编码
    parts = [urllib.parse.quote(part) for part in rel.parts]
    rel_url = "/".join(parts)
    url = f"http://127.0.0.1:{server['port']}/notebooks/{rel_url}?token={urllib.parse.quote(server['token'])}"
    webbrowser.open(url)
    return url


# ---------------------------------------------------------------------------
# 启动新的 Notebook 服务（脱离本进程）
# ---------------------------------------------------------------------------

def _popen_detached(cmd: list[str], cwd: Path, *, use_console: bool = False) -> subprocess.Popen:
    """启动子进程且不因关闭本工具而结束。"""
    kwargs: dict = {
        "cwd": str(cwd),
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }
    if sys.platform == "win32":
        flags = _CONSOLE_FLAGS if use_console else _DETACH_FLAGS
        kwargs["creationflags"] = flags
        # 不 wait；立即返回
        return subprocess.Popen(cmd, **kwargs)

    # 非 Windows：尽力脱离
    kwargs["start_new_session"] = True
    return subprocess.Popen(cmd, **kwargs)


def start_jupyter_notebook(notebook: Path, jupyter: Path | None) -> None:
    """启动 jupyter notebook 打开该文件；工作目录为文件所在目录。"""
    cwd = notebook.parent.resolve()
    nb_name = notebook.name

    if jupyter is not None:
        cmd = [str(jupyter), "notebook", nb_name]
        print(f"  启动命令: {jupyter.name} notebook {nb_name}")
        print(f"  工作目录: {cwd}")
        try:
            _popen_detached(cmd, cwd, use_console=False)
        except OSError:
            # DETACHED 偶发问题：改用新控制台且不等待
            print("  DETACHED 启动异常，改用 CREATE_NEW_CONSOLE …")
            _popen_detached(cmd, cwd, use_console=True)
        return

    # 回退：py -m notebook
    print("  未找到 jupyter.exe，尝试: py -m notebook …")
    cmd = ["py", "-m", "notebook", nb_name]
    print(f"  工作目录: {cwd}")
    try:
        _popen_detached(cmd, cwd, use_console=False)
    except OSError:
        print("  DETACHED 启动异常，改用 CREATE_NEW_CONSOLE …")
        _popen_detached(cmd, cwd, use_console=True)


def open_one_notebook(notebook: Path, jupyter: Path | None) -> bool:
    """打开单个笔记本。成功返回 True。"""
    print(f"\n正在打开: {notebook}")
    print(f"  工作目录: {notebook.parent}")

    server = find_matching_server(notebook)
    if server is not None:
        print(f"  发现已运行的 Jupyter 服务 (端口 {server['port']})，复用中…")
        url = open_in_existing_server(notebook, server)
        print(f"  已在浏览器打开:\n    {url}")
        return True

    print("  未找到可复用的服务，正在启动新的 Notebook …")
    if jupyter is None and shutil.which("py") is None:
        print_jupyter_not_found_help()
        return False

    try:
        start_jupyter_notebook(notebook, jupyter)
    except FileNotFoundError:
        print_jupyter_not_found_help()
        return False
    except Exception as e:
        print(f"  启动失败: {e}")
        return False

    print("  已在后台启动 Jupyter Notebook（关闭本窗口不会结束 Notebook 服务）。")
    print("  浏览器应会自动打开；若未打开，请查看新弹出的 Notebook 控制台窗口中的地址。")
    return True


def main() -> int:
    args = sys.argv[1:]
    if any(a.lower() in ("-h", "--help") for a in args):
        print("用法:")
        print('  python nbopen/open_ipynb.py "文件.ipynb" ...')
        print('  nbopen.exe "文件.ipynb" ...')
        print("也可将 .ipynb 拖到本程序上，或无参数时弹出选择框。")
        return 0

    print("Jupyter 笔记本打开工具 (nbopen)")
    print("-" * 40)

    notebooks = collect_ipynb_args(args) if args else pick_ipynb_with_dialog()

    if not notebooks:
        print("没有可打开的 .ipynb 文件。")
        print("用法: 将一个或多个 .ipynb 拖到本程序上即可。")
        return 1

    print("正在查找本机 jupyter …")
    jupyter = find_jupyter()
    if jupyter is not None:
        print(f"  找到: {jupyter}")
    else:
        print("  未在 PATH / conda / 常见位置 / jupyter.txt 中找到 jupyter.exe")
        print("  若需要启动新服务，将尝试 py -m notebook")

    ok, fail = 0, 0
    for nb in notebooks:
        try:
            if open_one_notebook(nb, jupyter):
                ok += 1
            else:
                fail += 1
        except Exception as e:
            # 不堆栈溯源，只给简短中文说明
            print(f"打开失败: {e}")
            fail += 1

    print("\n" + "-" * 40)
    print(f"完成：成功 {ok} 个，失败 {fail} 个。")
    return 0 if fail == 0 else 2


def _run_with_pause() -> None:
    exit_code = 1
    try:
        exit_code = main()
    except Exception as e:
        print(f"发生错误: {e}")
        exit_code = 1
    finally:
        if sys.platform == "win32":
            try:
                input("\n按回车退出...")
            except EOFError:
                pass
    sys.exit(exit_code)


if __name__ == "__main__":
    _run_with_pause()
