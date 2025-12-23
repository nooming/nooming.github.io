// 等待DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // ========== 获取DOM元素 ==========
    const inputBase = document.getElementById('inputBase');
    const inputNumber = document.getElementById('inputNumber');
    const convertBtn = document.getElementById('convertBtn');
    const clearBtn = document.getElementById('clearBtn');
    const errorTip = document.getElementById('errorTip');
    const binaryResult = document.getElementById('binaryResult');
    const octalResult = document.getElementById('octalResult');
    const decimalResult = document.getElementById('decimalResult');
    const hexResult = document.getElementById('hexResult');
    const copyBtns = document.querySelectorAll('.copy-btn');

    // ========== 绑定事件 ==========
    convertBtn.addEventListener('click', convertNumber);
    clearBtn.addEventListener('click', clearInputAndResult);
    inputNumber.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') convertNumber();
    });
    
    // 实时转换功能（防抖处理，输入后500ms自动转换）
    const debouncedConvert = debounce(convertNumber, 500);
    inputNumber.addEventListener('input', function() {
        const number = this.value.trim();
        if (number) {
            debouncedConvert();
        } else {
            clearInputAndResult();
        }
    });
    inputBase.addEventListener('change', function() {
        const number = inputNumber.value.trim();
        if (number) {
            convertNumber();
        }
    });
    
    // 绑定所有复制按钮的事件
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const text = document.getElementById(targetId).textContent;
            if (text === '——') return; // 跳过默认值
            copyToClipboard(text);
        });
    });

    // ========== 核心函数：进制转换 ==========
    function convertNumber() {
        const base = parseInt(inputBase.value);
        const number = inputNumber.value.trim();

        // 校验空输入
        if (!number) {
            showError('请输入要转换的数字！');
            return;
        }

        // 校验输入合法性并转换为十进制
        let decimalNum;
        try {
            decimalNum = parseInt(number, base);
            // 补充正则校验：防止parseInt忽略非有效字符
            const validRegex = getValidRegex(base);
            if (!validRegex.test(number) || isNaN(decimalNum)) {
                throw new Error('格式错误');
            }
        } catch (err) {
            showError('输入格式错误，请检查对应进制的规则！');
            return;
        }

        // 隐藏错误提示，展示转换结果
        hideError();
        binaryResult.textContent = decimalNum.toString(2);
        octalResult.textContent = decimalNum.toString(8);
        decimalResult.textContent = decimalNum.toString(10);
        hexResult.textContent = decimalNum.toString(16).toUpperCase();
    }

    // ========== 辅助函数：获取进制合法输入的正则 ==========
    function getValidRegex(base) {
        switch (base) {
            case 2:
                return /^[01]+$/; // 二进制：仅0和1
            case 8:
                return /^[0-7]+$/; // 八进制：0-7
            case 10:
                return /^[0-9]+$/; // 十进制：0-9
            case 16:
                return /^[0-9a-fA-F]+$/; // 十六进制：0-9，a-f，A-F
            default:
                return /^.+$/;
        }
    }

    // ========== 辅助函数：清空输入和结果 ==========
    function clearInputAndResult() {
        inputNumber.value = '';
        binaryResult.textContent = '——';
        octalResult.textContent = '——';
        decimalResult.textContent = '——';
        hexResult.textContent = '——';
        hideError();
    }

    // ========== 辅助函数：显示错误提示 ==========
    function showError(msg) {
        errorTip.textContent = msg;
        errorTip.style.display = 'block';
    }

    // ========== 辅助函数：隐藏错误提示 ==========
    function hideError() {
        errorTip.style.display = 'none';
    }

});