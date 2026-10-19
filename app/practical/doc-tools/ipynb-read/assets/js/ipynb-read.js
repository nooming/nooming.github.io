import { setStatus } from "../../../assets/js/common.js";

const fileInput = document.getElementById("ipynb-file");
const fileNameEl = document.getElementById("file-name");
const statusEl = document.getElementById("status");
const cellsEl = document.getElementById("cells");

/**
 * @param {unknown} source
 */
function cellSourceText(source) {
    if (typeof source === "string") return source;
    if (Array.isArray(source)) return source.join("");
    return "";
}

fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    cellsEl.innerHTML = "";
    if (!file) {
        fileNameEl.textContent = "未选择文件";
        setStatus(statusEl, "请选择笔记本");
        return;
    }
    if (!file.name.toLowerCase().endsWith(".ipynb")) {
        fileNameEl.textContent = file.name;
        setStatus(statusEl, "请选择 .ipynb 文件", "error");
        return;
    }

    fileNameEl.textContent = file.name;
    setStatus(statusEl, "正在解析…");

    try {
        const text = await file.text();
        const nb = JSON.parse(text);
        const cells = Array.isArray(nb.cells) ? nb.cells : [];
        if (!cells.length) {
            setStatus(statusEl, "笔记本里没有单元");
            return;
        }

        for (const cell of cells) {
            const type = cell.cell_type || "unknown";
            const raw = cellSourceText(cell.source);
            const wrap = document.createElement("article");
            wrap.className = `ipynb-cell ipynb-cell--${type}`;

            const label = document.createElement("div");
            label.className = "ipynb-cell-type";
            label.textContent = type;
            wrap.appendChild(label);

            if (type === "markdown" && window.marked) {
                const body = document.createElement("div");
                body.className = "ipynb-cell--markdown";
                body.innerHTML = window.marked.parse(raw || "", { async: false });
                wrap.appendChild(body);
            } else if (type === "code") {
                const pre = document.createElement("pre");
                const code = document.createElement("code");
                code.textContent = raw;
                pre.appendChild(code);
                wrap.appendChild(pre);
                if (Array.isArray(cell.outputs) && cell.outputs.length) {
                    const outLabel = document.createElement("div");
                    outLabel.className = "ipynb-cell-type";
                    outLabel.textContent = "output (static)";
                    wrap.appendChild(outLabel);
                    const outPre = document.createElement("pre");
                    outPre.textContent = JSON.stringify(cell.outputs, null, 2).slice(0, 8000);
                    wrap.appendChild(outPre);
                }
            } else {
                const pre = document.createElement("pre");
                pre.textContent = raw || `(空 ${type} 单元)`;
                wrap.appendChild(pre);
            }

            cellsEl.appendChild(wrap);
        }

        setStatus(statusEl, `已加载 ${cells.length} 个单元`);
    } catch (err) {
        console.error(err);
        setStatus(statusEl, "无法解析该 ipynb", "error");
    }
});
