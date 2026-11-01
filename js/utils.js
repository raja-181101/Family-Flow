const FF = window.FFamily || {};
window.FFamily = FF;

FF.Utils = {
    _counters: { person: 0, relationship: 0, board: 0, note: 0, flowchartLink: 0 },

    genId(prefix) {
        this._counters[prefix] = (this._counters[prefix] || 0) + 1;
        return `${prefix}_${String(this._counters[prefix]).padStart(4, '0')}`;
    },

    ensureCounter(prefix, id) {
        const num = parseInt(id.split('_')[1], 10);
        if (num > (this._counters[prefix] || 0)) {
            this._counters[prefix] = num;
        }
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.getFullYear().toString();
    },

    debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    dist(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    rectContains(rect, px, py) {
        return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
    },

    rectsOverlap(a, b) {
        return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    },

    getCardCenter(pos) {
        return { x: pos.x + (pos.cardWidth || 180) / 2, y: pos.y + (pos.cardHeight || 140) / 2 };
    },

    getCardEdgePoint(pos, targetX, targetY) {
        const cx = pos.x + (pos.cardWidth || 180) / 2;
        const cy = pos.y + (pos.cardHeight || 140) / 2;
        const w = (pos.cardWidth || 180) / 2;
        const h = (pos.cardHeight || 140) / 2;
        const dx = targetX - cx;
        const dy = targetY - cy;
        if (dx === 0 && dy === 0) return { x: cx, y: cy };
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let px, py;
        if (absDx / w > absDy / h) {
            px = cx + (dx > 0 ? w : -w);
            py = cy + dy * (w / absDx);
        } else {
            px = cx + dx * (h / absDy);
            py = cy + (dy > 0 ? h : -h);
        }
        return { x: px, y: py };
    },

    getEdgePointFromCenter(cx, cy, w, h, targetX, targetY) {
        const dx = targetX - cx;
        const dy = targetY - cy;
        if (dx === 0 && dy === 0) return { x: cx, y: cy };
        const hw = w / 2;
        const hh = h / 2;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let px, py;
        if (absDx / hw > absDy / hh) {
            px = cx + (dx > 0 ? hw : -hw);
            py = cy + dy * (hw / absDx);
        } else {
            px = cx + dx * (hh / absDy);
            py = cy + (dy > 0 ? hh : -hh);
        }
        return { x: px, y: py };
    },

    getCurvePath(x1, y1, x2, y2, curvature = 0.4) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const cx1 = x1 + dx * curvature;
        const cy1 = y1;
        const cx2 = x2 - dx * curvature;
        const cy2 = y2;
        return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    },

    getStraightPath(x1, y1, x2, y2) {
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    },

    getOrthPath(x1, y1, x2, y2) {
        const mx = (x1 + x2) / 2;
        return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
    },

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
