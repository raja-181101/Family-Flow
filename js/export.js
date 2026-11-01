FF.ExportUI = class {
    constructor(app) {
        this.app = app;
    }

    showMenu() {
        const menu = document.getElementById('exportMenu');
        menu.classList.toggle('active');
    }

    hideMenu() {
        document.getElementById('exportMenu').classList.remove('active');
    }

    _getContentBounds() {
        const state = this.app.state;
        const board = state.getCurrentBoard();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        board.positions.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + (p.cardWidth || 180));
            maxY = Math.max(maxY, p.y + (p.cardHeight || 140));
        });
        state.notes.forEach(n => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + (n.width || 200));
            maxY = Math.max(maxY, n.y + (n.height || 100));
        });
        return { minX, minY, maxX, maxY };
    }

    buildExportSVG() {
        const state = this.app.state;
        const board = state.getCurrentBoard();
        if (!board) return null;

        const bounds = this._getContentBounds();
        if (!isFinite(bounds.minX)) return null;

        const padding = 60;
        const W = bounds.maxX - bounds.minX + padding * 2;
        const H = bounds.maxY - bounds.minY + padding * 2;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX - padding} ${bounds.minY - padding} ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">
            <rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" width="${W}" height="${H}" fill="#12121f"/>
        `;

        // Connection lines
        state.relationships.forEach(rel => {
            if (rel.type === 'flowchartLink') return;
            let type = rel.type;
            if (type === 'marriage' && rel.status === 'former') type = 'exMarriage';
            const info = FF.RelationshipColors[type] || { color: '#94a3b8', dash: '' };

            const color = info.color;
            const dash = info.dash;

            let x1, y1, x2, y2, marker = '', label = '';

            if (rel.type === 'parentChild' || rel.type === 'adoption' || rel.type === 'stepParent' || rel.type === 'stepChild') {
                const parentPos = board.positions.find(p => p.personId === rel.parent);
                const childPos = board.positions.find(p => p.personId === rel.child);
                if (!parentPos || !childPos) return;
                const pc = FF.Utils.getCardCenter(parentPos);
                const cc = FF.Utils.getCardCenter(childPos);
                const from = FF.Utils.getEdgePointFromCenter(pc.x, pc.y, parentPos.cardWidth || 180, parentPos.cardHeight || 140, cc.x, cc.y);
                const to = FF.Utils.getEdgePointFromCenter(cc.x, cc.y, childPos.cardWidth || 180, childPos.cardHeight || 140, pc.x, pc.y);
                x1 = from.x; y1 = from.y; x2 = to.x; y2 = to.y;
                marker = rel.type === 'adoption' ? '<marker id="mOrange" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><path d="M0 0 L10 3.5 L0 7 Z" fill="#f97316"/></marker><path d="M0 0 L10 3.5 L0 7 Z" fill="none"/>' : '';
                label = rel.status ? rel.status : '';
                svg += `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${color}" stroke-width="2.5" fill="none" stroke-dasharray="${dash}" opacity="${dash ? 0.6 : 1}"/>`;
                svg += `<polygon points="${x2 - ((x2 - x1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1))) * 10},${y2 - ((y2 - y1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1))) * 7} ${x2},${y2} ${x2 - ((x2 - x1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1))) * 10},${y2 + ((y2 - y1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1))) * 7}" fill="${color}"/>`;
                if (label) {
                    svg += `<text x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 - 6}" fill="${color}" font-size="10" font-weight="600">${this._esc(label.toUpperCase())}</text>`;
                }
            } else {
                const posA = board.positions.find(p => p.personId === rel.personA);
                const posB = board.positions.find(p => p.personId === rel.personB);
                if (!posA || !posB) return;
                const ca = FF.Utils.getCardCenter(posA);
                const cb = FF.Utils.getCardCenter(posB);
                const from = FF.Utils.getEdgePointFromCenter(ca.x, ca.y, posA.cardWidth || 180, posA.cardHeight || 140, cb.x, cb.y);
                const to = FF.Utils.getEdgePointFromCenter(cb.x, cb.y, posB.cardWidth || 180, posB.cardHeight || 140, ca.x, ca.y);
                x1 = from.x; y1 = from.y; x2 = to.x; y2 = to.y;
                const dx = x2 - x1;
                const path = FF.Utils.getCurvePath(x1, y1, x2, y2, 0.15);
                svg += `<path d="${path}" stroke="${color}" stroke-width="2.5" fill="none" stroke-dasharray="${dash}" opacity="${dash ? 0.6 : 1}"/>`;
                if (type === 'marriage') {
                    const mx = (x1 + x2) / 2;
                    const my = (y1 + y2) / 2;
                    svg += `<path d="M ${mx} ${my - 5} L ${mx + 5} ${my} L ${mx} ${my + 5} L ${mx - 5} ${my} Z" fill="${color}"/>`;
                }
                if (type === 'exMarriage') {
                    svg += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" fill="${color}" font-size="10" font-weight="600" text-anchor="middle">EX</text>`;
                }
            }
        });

        // Person cards
        board.positions.forEach(pos => {
            const person = state.getPerson(pos.personId);
            if (!person) return;
            const cx = pos.x;
            const cy = pos.y;
            const w = pos.cardWidth || 180;
            const h = pos.cardHeight || 140;
            const deceased = person.status === 'deceased';
            const headH = 64;
            const textY = cy + headH;

            const bgColor = deceased ? '#1c1c2e' : '#1e1e38';
            const borderColor = deceased ? '#2a2a40' : '#2d2d52';

            svg += `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>`;
            if (deceased) {
                svg += `<rect x="${cx + 1}" y="${cy + 1}" width="${w - 2}" height="${headH - 1}" rx="9" fill="#17172a"/>`;
            } else {
                svg += `<rect x="${cx + 1}" y="${cy + 1}" width="${w - 2}" height="${headH - 1}" rx="9" fill="#232342"/>`;
            }

            const fullName = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ') || 'Unnamed';
            if (person.photo) {
                svg += `<clipPath id="cp_${person.id}"><rect x="${cx + 1}" y="${cy + 1}" width="${w - 2}" height="${headH - 1}" rx="9"/></clipPath>`;
                svg += `<image href="${person.photo}" x="${cx + 1}" y="${cy + 1}" width="${w - 2}" height="${headH - 1}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cp_${person.id})"/>`;
            } else {
                const initials = ((person.firstName || '')[0] || '') + ((person.lastName || '')[0] || '');
                svg += `<text x="${cx + w / 2}" y="${cy + headH / 2 + 7}" text-anchor="middle" font-size="20" font-weight="700" fill="${deceased ? '#6868a0' : '#7c5cfc'}">${this._esc((initials || '?').toUpperCase())}</text>`;
            }

            svg += `<text x="${cx + 10}" y="${textY + 20}" font-size="12" font-weight="600" fill="#e8e8f0">${this._esc(fullName)}</text>`;
            const birthYear = person.dateOfBirth ? FF.Utils.formatDate(person.dateOfBirth) : '';
            const deathYear = person.dateOfDeath ? FF.Utils.formatDate(person.dateOfDeath) : '';
            const yearsText = deathYear ? `${birthYear} – ${deathYear}` : birthYear ? `b. ${birthYear}` : '';
            if (yearsText) {
                svg += `<text x="${cx + 10}" y="${textY + 36}" font-size="10" fill="#6868a0">${this._esc(yearsText)}</text>`;
            }
        });

        // Notes
        state.notes.forEach(note => {
            svg += `<rect x="${note.x}" y="${note.y}" width="${note.width || 200}" height="${note.height || 100}" rx="6" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.2)"/>`;
            svg += `<rect x="${note.x}" y="${note.y}" width="3" height="${note.height || 100}" fill="#f59e0b"/>`;
            const words = (note.text || '').split(' ');
            let line = '';
            let lh = 0;
            words.forEach(word => {
                if ((line + ' ' + word).length * 5.5 > (note.width || 200) - 16) {
                    svg += `<text x="${note.x + 10}" y="${note.y + 22 + lh * 14}" font-size="11" fill="#9898b8">${this._esc(line)}</text>`;
                    line = word;
                    lh++;
                } else {
                    line = line ? line + ' ' + word : word;
                }
            });
            if (line) {
                svg += `<text x="${note.x + 10}" y="${note.y + 22 + lh * 14}" font-size="11" fill="#9898b8">${this._esc(line)}</text>`;
            }
        });

        svg += '</svg>';
        return svg;
    }

    _esc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    exportPNG() {
        this.hideMenu();
        const svgStr = this.buildExportSVG();
        if (!svgStr) {
            alert('Nothing to export.');
            return;
        }
        const board = this.app.state.getCurrentBoard();

        const img = new Image();
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            const bounds = this._getContentBounds();
            const padding = 60;
            const W = bounds.maxX - bounds.minX + padding * 2;
            const H = bounds.maxY - bounds.minY + padding * 2;
            const canvas = document.createElement('canvas');
            canvas.width = W * 2;
            canvas.height = H * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, W, H);
            URL.revokeObjectURL(url);
            const link = document.createElement('a');
            link.download = (board ? board.name : 'familyflow') + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            alert('Could not generate PNG export.');
        };
        img.src = url;
    }

    exportBoardJSON() {
        this.hideMenu();
        const board = this.app.state.getCurrentBoard();
        if (!board) return;

        const boardPeople = board.positions.map(p => this.app.state.getPerson(p.personId)).filter(Boolean);
        const personIds = new Set(boardPeople.map(p => p.id));
        const boardRels = this.app.state.relationships.filter(r => {
            if (r.type === 'parentChild' || r.type === 'adoption' || r.type === 'stepParent' || r.type === 'stepChild') {
                return personIds.has(r.parent) || personIds.has(r.child);
            }
            return personIds.has(r.personA) || personIds.has(r.personB);
        });

        const data = {
            board: { ...board },
            people: boardPeople,
            relationships: boardRels
        };

        FF.Utils.downloadFile(JSON.stringify(data, null, 2), (board.name || 'flowchart') + '.json', 'application/json');
    }

    exportFullJSON() {
        this.hideMenu();
        const json = FF.Storage.exportFull(this.app.state);
        FF.Utils.downloadFile(json, 'familyflow_backup.json', 'application/json');
    }

    importJSON() {
        this.hideMenu();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await FF.Utils.readFileAsText(file);
            const result = FF.Storage.importFull(text);
            if (!result.success) {
                alert('Import failed: ' + result.error);
                return;
            }
            if (confirm('This will replace ALL current data. Continue?')) {
                this.app.history.push(this.app.state.getSnapshot());
                this.app.state.people = result.data.people || [];
                this.app.state.relationships = result.data.relationships || [];
                this.app.state.boards = result.data.boards || [];
                this.app.state.notes = result.data.notes || [];
                this.app.state.settings = { ...this.app.state.settings, ...(result.data.settings || {}) };
                this.app.state.currentBoardId = this.app.state.boards.length > 0 ? this.app.state.boards[0].id : null;
                this.app.state._syncCounters();
                this.app.save(true);
                this.app.render();
                this.app.peopleUI.updateMembersList();
                this.app.boardsUI.updateBoardsList();
                this.app.relsUI.updateRelationshipsList();
            }
        };
        input.click();
    }
};