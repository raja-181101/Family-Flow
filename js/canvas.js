FF.Canvas = class {
    constructor(app) {
        this.app = app;
        this.container = null;
        this.canvasEl = null;
        this.svgEl = null;
        this.cardsLayer = null;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.isDragging = false;
        this.dragPersonId = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartPanX = 0;
        this.panStartPanY = 0;
        this.selectionBox = null;
        this.selStartX = 0;
        this.selStartY = 0;
        this.isSelecting = false;
        this._resizeObserver = null;
        this.notesDragging = null;
        this.notesDragOffset = { x: 0, y: 0 };
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        this.canvasEl = document.getElementById('canvasInner');
        this.svgEl = document.getElementById('connectionsSvg');
        this.cardsLayer = document.getElementById('cardsLayer');

        const board = this.app.state.getCurrentBoard();
        if (board) {
            this.zoom = board.zoom || 1;
            this.panX = board.panX || 0;
            this.panY = board.panY || 0;
        }

        this._bindEvents();
        this._resizeObserver = new ResizeObserver(() => this.render());
        this._resizeObserver.observe(this.container);
    }

    _bindEvents() {
        const el = this.container;

        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const oldZoom = this.zoom;
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.zoom = FF.Utils.clamp(this.zoom * factor, 0.1, 5);
            const scale = this.zoom / oldZoom;
            this.panX = mx - (mx - this.panX) * scale;
            this.panY = my - (my - this.panY) * scale;
            this._saveView();
            this.app.save(true);
            this._updateTransform();
            this._updateZoomDisplay();
        }, { passive: false });

        el.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                e.preventDefault();
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.panStartPanX = this.panX;
                this.panStartPanY = this.panY;
                el.style.cursor = 'grabbing';
                return;
            }
            if (e.button === 0 && (e.target === el || e.target === this.canvasEl)) {
                const tool = this.app.state.selectedTool;
                if (tool === 'select') {
                    this.isSelecting = true;
                    const rect = el.getBoundingClientRect();
                    this.selStartX = (e.clientX - rect.left - this.panX) / this.zoom;
                    this.selStartY = (e.clientY - rect.top - this.panY) / this.zoom;
                    this._createSelectionBox();
                } else if (tool === 'addNote') {
                    const rect = el.getBoundingClientRect();
                    const x = (e.clientX - rect.left - this.panX) / this.zoom;
                    const y = (e.clientY - rect.top - this.panY) / this.zoom;
                    this.app.history.push(this.app.state.getSnapshot());
                    this.app.state.addNote({ text: 'New Note', x, y });
                    this.app.save(true);
                    this.render();
                    this.app.state.selectedTool = 'select';
                    this.app._updateToolButtons();
                }
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = this.panStartPanX + (e.clientX - this.panStartX);
                this.panY = this.panStartPanY + (e.clientY - this.panStartY);
                this._updateTransform();
                return;
            }
            if (this.isDragging && this.dragPersonId) {
                const rect = el.getBoundingClientRect();
                const mx = (e.clientX - rect.left - this.panX) / this.zoom;
                const my = (e.clientY - rect.top - this.panY) / this.zoom;
                const dx = mx - this.dragOffsetX - this.dragStartX;
                const dy = my - this.dragOffsetY - this.dragStartY;
                let finalDx = dx;
                let finalDy = dy;
                if (this.app.state.settings.snapToGrid) {
                    const gs = this.app.state.settings.gridSize;
                    finalDx = Math.round(dx / gs) * gs;
                    finalDy = Math.round(dy / gs) * gs;
                }
                Object.keys(this.dragGroupStart).forEach(id => {
                    const start = this.dragGroupStart[id];
                    this.app.state.setPosition(id, start.x + finalDx, start.y + finalDy);
                    const cardEl = this.cardsLayer.querySelector(`.person-card[data-person-id="${id}"], .flowchart-link-card[data-link-id="${id.replace('__link_', '')}"]`);
                    if (cardEl) {
                        const newPos = this.app.state.getPosition(id);
                        cardEl.style.left = newPos.x + 'px';
                        cardEl.style.top = newPos.y + 'px';
                    }
                });
                this._renderConnections();
                return;
            }
            if (this.isSelecting) {
                const rect = el.getBoundingClientRect();
                const cx = (e.clientX - rect.left - this.panX) / this.zoom;
                const cy = (e.clientY - rect.top - this.panY) / this.zoom;
                this._updateSelectionBox(this.selStartX, this.selStartY, cx, cy);
            }
            if (this.notesDragging) {
                const rect = el.getBoundingClientRect();
                const x = (e.clientX - rect.left - this.panX) / this.zoom - this.notesDragOffset.x;
                const y = (e.clientY - rect.top - this.panY) / this.zoom - this.notesDragOffset.y;
                this.app.state.updateNote(this.notesDragging, { x, y });
                this._renderNotes();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                el.style.cursor = '';
                this._saveView();
                this.app.save(true);
            }
            if (this.isDragging) {
                this.isDragging = false;
                this.dragPersonId = null;
                this._saveView();
                this.app.save(true);
            }
            if (this.isSelecting) {
                this.isSelecting = false;
                this._finishSelection();
                this._removeSelectionBox();
            }
            if (this.notesDragging) {
                this.notesDragging = null;
                this.app.save(true);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                this._deleteSelected();
            }
            if (e.key === 'Escape') {
                this.app.state.selectedPersonIds = [];
                this.app.state.selectedRelationshipId = null;
                this.app.state.selectedNoteId = null;
                document.getElementById('personDetails').classList.remove('active');
                this.render();
            }
        });
    }

    _createSelectionBox() {
        const box = document.createElement('div');
        box.id = 'selectionBox';
        box.className = 'selection-box';
        this.cardsLayer.appendChild(box);
    }

    _updateSelectionBox(x1, y1, x2, y2) {
        const box = document.getElementById('selectionBox');
        if (!box) return;
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.width = width + 'px';
        box.style.height = height + 'px';
    }

    _finishSelection() {
        const box = document.getElementById('selectionBox');
        if (!box) return;
        const rect = {
            x: parseFloat(box.style.left),
            y: parseFloat(box.style.top),
            w: parseFloat(box.style.width),
            h: parseFloat(box.style.height)
        };
        if (rect.w < 5 && rect.h < 5) {
            this.app.state.selectedPersonIds = [];
            return;
        }
        const selected = [];
        const board = this.app.state.getCurrentBoard();
        if (!board) return;
        board.positions.forEach(pos => {
            const cardRect = { x: pos.x, y: pos.y, w: pos.cardWidth || 180, h: pos.cardHeight || 140 };
            if (FF.Utils.rectsOverlap(rect, cardRect)) {
                selected.push(pos.personId);
            }
        });
        this.app.state.selectedPersonIds = selected;
        this.render();
    }

    _removeSelectionBox() {
        const box = document.getElementById('selectionBox');
        if (box) box.remove();
    }

    _handleRelToolClick(personId) {
        if (!this.relToolSelection) {
            this.relToolSelection = [personId];
        } else {
            this.relToolSelection.push(personId);
        }
        this.app.state.selectedPersonIds = [...this.relToolSelection];
        this.render();

        if (this.relToolSelection.length >= 2) {
            const [personA, personB] = this.relToolSelection;
            this.relToolSelection = null;
            this.app.state.selectedTool = 'select';
            this.app._updateToolButtons();
            this.render();
            this.app.relsUI.showAddModalWithPair(personA, personB);
        }
    }

    _deleteSelected() {
        const state = this.app.state;
        if (state.selectedPersonIds.length > 0) {
            if (confirm(`Delete ${state.selectedPersonIds.length} selected person(s)?`)) {
                this.app.history.push(state.getSnapshot());
                [...state.selectedPersonIds].forEach(id => state.deletePerson(id));
                state.selectedPersonIds = [];
                document.getElementById('personDetails').classList.remove('active');
                this.app.save(true);
                this.render();
                this.app.peopleUI.updateMembersList();
            }
        } else if (state.selectedRelationshipId) {
            this.app.history.push(state.getSnapshot());
            state.deleteRelationship(state.selectedRelationshipId);
            this.app.save(true);
            this.render();
        } else if (state.selectedNoteId) {
            this.app.history.push(state.getSnapshot());
            state.deleteNote(state.selectedNoteId);
            this.app.save(true);
            this.render();
        }
    }

    _saveView() {
        const board = this.app.state.getCurrentBoard();
        if (board) {
            board.zoom = this.zoom;
            board.panX = this.panX;
            board.panY = this.panY;
        }
    }

    _updateTransform() {
        if (this.canvasEl) {
            this.canvasEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        }
    }

    _updateZoomDisplay() {
        const el = document.getElementById('zoomLevel');
        if (el) el.textContent = Math.round(this.zoom * 100) + '%';
    }

    zoomIn() {
        const rect = this.container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const oldZoom = this.zoom;
        this.zoom = FF.Utils.clamp(this.zoom * 1.2, 0.1, 5);
        const scale = this.zoom / oldZoom;
        this.panX = cx - (cx - this.panX) * scale;
        this.panY = cy - (cy - this.panY) * scale;
        this._saveView();
        this.app.save(true);
        this._updateTransform();
        this._updateZoomDisplay();
    }

    zoomOut() {
        const rect = this.container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const oldZoom = this.zoom;
        this.zoom = FF.Utils.clamp(this.zoom * 0.8, 0.1, 5);
        const scale = this.zoom / oldZoom;
        this.panX = cx - (cx - this.panX) * scale;
        this.panY = cy - (cy - this.panY) * scale;
        this._saveView();
        this.app.save(true);
        this._updateTransform();
        this._updateZoomDisplay();
    }

    fitToScreen() {
        const board = this.app.state.getCurrentBoard();
        if (!board || board.positions.length === 0) {
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this._saveView();
            this.app.save(true);
            this._updateTransform();
            this._updateZoomDisplay();
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        board.positions.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + (p.cardWidth || 180));
            maxY = Math.max(maxY, p.y + (p.cardHeight || 140));
        });
        const padding = 80;
        const contentW = maxX - minX + padding * 2;
        const contentH = maxY - minY + padding * 2;
        const rect = this.container.getBoundingClientRect();
        const scaleX = rect.width / contentW;
        const scaleY = rect.height / contentH;
        this.zoom = FF.Utils.clamp(Math.min(scaleX, scaleY), 0.1, 2);
        this.panX = (rect.width - contentW * this.zoom) / 2 - (minX - padding) * this.zoom;
        this.panY = (rect.height - contentH * this.zoom) / 2 - (minY - padding) * this.zoom;
        this._saveView();
        this.app.save(true);
        this._updateTransform();
        this._updateZoomDisplay();
    }

    centerOn(x, y) {
        const rect = this.container.getBoundingClientRect();
        this.panX = rect.width / 2 - x * this.zoom;
        this.panY = rect.height / 2 - y * this.zoom;
        this._saveView();
        this._updateTransform();
    }

    autoArrange() {
        const board = this.app.state.getCurrentBoard();
        if (!board) return;
        this.app.history.push(this.app.state.getSnapshot());

        const people = this.app.state.people;
        const rels = this.app.state.relationships;
        if (people.length === 0) return;

        const childToParents = {};
        const parentToChildren = {};
        rels.forEach(r => {
            if (r.type === 'parentChild' || r.type === 'adoption' || r.type === 'stepParent') {
                if (!childToParents[r.child]) childToParents[r.child] = new Set();
                childToParents[r.child].add(r.parent);
                if (!parentToChildren[r.parent]) parentToChildren[r.parent] = new Set();
                parentToChildren[r.parent].add(r.child);
            }
        });

        const roots = people.filter(p => !childToParents[p.id] || childToParents[p.id].size === 0);
        const visited = new Set();
        const generations = [];

        function assignGeneration(personId, gen) {
            if (visited.has(personId)) return;
            visited.add(personId);
            if (!generations[gen]) generations[gen] = new Set();
            generations[gen].add(personId);
            const kids = parentToChildren[personId];
            if (kids) {
                kids.forEach(kid => assignGeneration(kid, gen + 1));
            }
        }

        roots.forEach(p => assignGeneration(p.id, 0));
        people.forEach(p => {
            if (!visited.has(p.id)) {
                const gen = generations.length;
                if (!generations[gen]) generations[gen] = new Set();
                generations[gen].add(p.id);
                visited.add(p.id);
            }
        });

        const cardW = 200;
        const gapX = 60;
        const gapY = 120;
        const startY = 60;

        function orderWithSpouses(ids) {
            const ordered = [];
            const remaining = ids.slice();
            const spouseMap = {};
            rels.forEach(r => {
                if ((r.type === 'marriage' || r.type === 'exMarriage' || r.type === 'partnership') && r.personA && r.personB) {
                    if (!spouseMap[r.personA]) spouseMap[r.personA] = [];
                    spouseMap[r.personA].push(r.personB);
                    if (!spouseMap[r.personB]) spouseMap[r.personB] = [];
                    spouseMap[r.personB].push(r.personA);
                }
            });
            while (remaining.length > 0) {
                const current = remaining.shift();
                ordered.push(current);
                const spouses = (spouseMap[current] || []).filter(s => remaining.includes(s) && !ordered.includes(s));
                spouses.forEach(s => {
                    ordered.push(s);
                    const idx = remaining.indexOf(s);
                    if (idx >= 0) remaining.splice(idx, 1);
                });
            }
            return ordered;
        }

        let currentY = startY;
        generations.forEach((genPeople) => {
            const raw = Array.from(genPeople);
            const arr = orderWithSpouses(raw);
            const totalWidth = arr.length * cardW + (arr.length - 1) * gapX;
            let startX = Math.max(60, 600 - totalWidth / 2);
            arr.forEach((pid, i) => {
                board.positions = board.positions.filter(p => p.personId !== pid);
                board.positions.push({
                    personId: pid,
                    x: startX + i * (cardW + gapX),
                    y: currentY,
                    cardWidth: 180,
                    cardHeight: 140
                });
            });
            currentY += 140 + gapY;
        });

        this.app.save(true);
        this.fitToScreen();
        this.render();
    }

    render() {
        if (!this.cardsLayer || !this.svgEl) return;
        const board = this.app.state.getCurrentBoard();
        if (!board) return;

        this._updateTransform();
        this._updateZoomDisplay();
        this._renderGrid();
        this._renderConnections();
        this._renderCards();
        this._renderNotes();
        this._renderFlowchartLinks();
    }

    _renderGrid() {
        this.container.classList.toggle('no-grid', !this.app.state.settings.showGrid);
        this.container.style.backgroundSize = `${20 * this.zoom}px ${20 * this.zoom}px, ${100 * this.zoom}px ${100 * this.zoom}px`;
        this.container.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    }

    _renderCards() {
        const board = this.app.state.getCurrentBoard();
        if (!board) return;
        this.cardsLayer.innerHTML = '';

        board.positions.forEach(pos => {
            const person = this.app.state.getPerson(pos.personId);
            if (!person) return;

            const card = document.createElement('div');
            card.className = 'person-card' + (person.status === 'deceased' ? ' deceased' : '') + (person.detailsAdded === false ? ' incomplete' : '');
            card.dataset.personId = person.id;

            if (this.app.state.selectedPersonIds.includes(person.id)) {
                card.classList.add('selected');
            }

            const fullName = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');
            const birthYear = person.dateOfBirth ? FF.Utils.formatDate(person.dateOfBirth) : '';
            const deathYear = person.dateOfDeath ? FF.Utils.formatDate(person.dateOfDeath) : '';
            const yearsText = deathYear ? `${birthYear} – ${deathYear}` : birthYear ? `b. ${birthYear}` : '';

            card.style.left = pos.x + 'px';
            card.style.top = pos.y + 'px';
            card.style.width = (pos.cardWidth || 180) + 'px';

            let photoHtml;
            if (person.photo) {
                photoHtml = `<div class="card-photo"><img src="${person.photo}" alt=""></div>`;
            } else {
                const initials = ((person.firstName || '')[0] || '') + ((person.lastName || '')[0] || '');
                photoHtml = `<div class="card-photo-placeholder">${initials.toUpperCase() || '?'}</div>`;
            }

            const rels = this.app.state.getPersonRelationships(person.id);
            const hasMarriage = rels.some(r => r.type === 'marriage' && r.status === 'current');
            const hasEx = rels.some(r => r.type === 'exMarriage');

            card.innerHTML = `
                ${photoHtml}
                <div class="card-info">
                    <div class="card-name">${FF.Utils.escapeHtml(fullName || 'Unnamed')}</div>
                    ${yearsText ? `<div class="card-years">${yearsText}</div>` : ''}
                    <div class="card-badges">
                        ${hasMarriage ? '<span class="badge badge-married">Married</span>' : ''}
                         ${person.detailsAdded === false ? '<span class="badge badge-incomplete">Details needed</span>' : ''}
                    </div>
                </div>
            `;

            card.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                const tool = this.app.state.selectedTool;
                if (tool === 'addRelationship') {
                    this._handleRelToolClick(person.id);
                    return;
                }
                if (tool === 'connectFlowchart') return;

                this.isDragging = true;
                this.dragPersonId = person.id;
                const rect = this.container.getBoundingClientRect();
                const mx = (e.clientX - rect.left - this.panX) / this.zoom;
                const my = (e.clientY - rect.top - this.panY) / this.zoom;
                this.dragOffsetX = mx - pos.x;
                this.dragOffsetY = my - pos.y;
                this.dragStartX = pos.x;
                this.dragStartY = pos.y;

                if (!e.shiftKey && !this.app.state.selectedPersonIds.includes(person.id)) {
                    this.app.state.selectedPersonIds = [person.id];
                } else if (e.shiftKey) {
                    const idx = this.app.state.selectedPersonIds.indexOf(person.id);
                    if (idx >= 0) {
                        this.app.state.selectedPersonIds.splice(idx, 1);
                    } else {
                        this.app.state.selectedPersonIds.push(person.id);
                    }
                }

                this.dragGroupStart = {};
                this.app.state.selectedPersonIds.forEach(id => {
                    const p = this.app.state.getPosition(id);
                    if (p) {
                        this.dragGroupStart[id] = { x: p.x, y: p.y };
                    }
                });

                this.app.peopleUI.showDetails(person.id);
                this.render();
            });

            card.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.app.peopleUI.showAddModal(person);
            });

            this.cardsLayer.appendChild(card);
        });
    }

    _renderConnections() {
        const board = this.app.state.getCurrentBoard();
        if (!board) return;

        let svgContent = '';
        const defs = `
            <defs>
                <marker id="arrowBlue" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                </marker>
                <marker id="arrowOrange" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
                </marker>
                <marker id="arrowPink" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ec4899" />
                </marker>
                <marker id="diamondMarker" markerWidth="12" markerHeight="12" refX="6" refY="6" orient="auto">
                    <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="#a855f7" />
                </marker>
            </defs>
        `;
        svgContent += defs;

        this.app.state.relationships.forEach(rel => {
            if (rel.type === 'flowchartLink') return;
            let type = rel.type;
            if (type === 'marriage' && rel.status === 'former') type = 'exMarriage';
            const info = FF.RelationshipColors[type] || { color: '#94a3b8', dash: '' };

            let x1, y1, x2, y2;

            if (rel.type === 'parentChild' || rel.type === 'adoption' || rel.type === 'stepParent' || rel.type === 'stepChild') {
                const parentPos = board.positions.find(p => p.personId === rel.parent);
                const childPos = board.positions.find(p => p.personId === rel.child);
                if (!parentPos || !childPos) return;
                const pc = FF.Utils.getCardCenter(parentPos);
                const cc = FF.Utils.getCardCenter(childPos);
                const from = FF.Utils.getEdgePointFromCenter(pc.x, pc.y, parentPos.cardWidth || 180, parentPos.cardHeight || 140, cc.x, cc.y);
                const to = FF.Utils.getEdgePointFromCenter(cc.x, cc.y, childPos.cardWidth || 180, childPos.cardHeight || 140, pc.x, pc.y);
                x1 = from.x; y1 = from.y; x2 = to.x; y2 = to.y;

                let markerEnd = '';
                if (rel.type === 'parentChild') markerEnd = 'marker-end="url(#arrowBlue)"';
                else if (rel.type === 'adoption') markerEnd = 'marker-end="url(#arrowOrange)"';
                else markerEnd = 'marker-end="url(#arrowPink)"';

                const path = FF.Utils.getStraightPath(x1, y1, x2, y2);
                svgContent += `<path d="${path}" stroke="${info.color}" stroke-width="2.5" fill="none" stroke-dasharray="${info.dash}" opacity="${info.dash ? '0.6' : '1'}" ${markerEnd} class="rel-line" data-rel-id="${rel.id}" />`;

                if (this.app.state.settings.showLabels) {
                    const mx = (x1 + x2) / 2;
                    const my = (y1 + y2) / 2;
                    const lbl = rel.status ? rel.status.toUpperCase() : info.label.toUpperCase();
                    svgContent += `<text x="${mx + 6}" y="${my - 6}" fill="${info.color}" font-size="10" font-weight="600" class="rel-label" data-rel-id="${rel.id}">${lbl}</text>`;
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

                let markerEnd = '';
                if (type === 'marriage') markerEnd = 'marker-end="url(#diamondMarker)"';

                const curvature = 0.15;
                const path = FF.Utils.getCurvePath(x1, y1, x2, y2, curvature);
                svgContent += `<path d="${path}" stroke="${info.color}" stroke-width="2.5" fill="none" stroke-dasharray="${info.dash}" opacity="${info.dash ? '0.6' : '1'}" ${markerEnd} class="rel-line" data-rel-id="${rel.id}" />`;

                if (this.app.state.settings.showLabels) {
                    const mx = (x1 + x2) / 2;
                    const my = (y1 + y2) / 2;
                    let lbl = rel.status ? rel.status.toUpperCase() : '';
                    if (type === 'exMarriage') lbl = 'EX';
                    if (type === 'partnership') lbl = 'PARTNER';
                    if (lbl) {
                        svgContent += `<text x="${mx}" y="${my - 8}" fill="${info.color}" font-size="10" font-weight="600" text-anchor="middle" class="rel-label" data-rel-id="${rel.id}">${lbl}</text>`;
                    }
                }
            }
        });

        this.svgEl.innerHTML = svgContent;

        this.svgEl.querySelectorAll('.rel-line, .rel-label').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const relId = el.dataset.relId;
                this.app.relsUI.showRelDetails(relId);
            });
        });
    }

    _renderNotes() {
        const board = this.app.state.getCurrentBoard();
        if (!board) return;

        this.cardsLayer.querySelectorAll('.note-card').forEach(el => el.remove());

        this.app.state.notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-card';
            div.dataset.noteId = note.id;
            div.style.left = note.x + 'px';
            div.style.top = note.y + 'px';
            div.style.width = (note.width || 200) + 'px';
            div.style.borderLeftColor = note.color || '#fbbf24';

            div.innerHTML = `
                <div class="note-header">
                    <span class="note-drag-handle">⋮⋮</span>
                    <button class="note-close-btn" title="Delete">&times;</button>
                </div>
                <div class="note-content" contenteditable="true">${FF.Utils.escapeHtml(note.text)}</div>
            `;

            const handle = div.querySelector('.note-drag-handle');
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.notesDragging = note.id;
                const rect = this.container.getBoundingClientRect();
                const mx = (e.clientX - rect.left - this.panX) / this.zoom;
                const my = (e.clientY - rect.top - this.panY) / this.zoom;
                this.notesDragOffset.x = mx - note.x;
                this.notesDragOffset.y = my - note.y;
                this.app.state.selectedNoteId = note.id;
            });

            div.querySelector('.note-close-btn').onclick = (e) => {
                e.stopPropagation();
                this.app.history.push(this.app.state.getSnapshot());
                this.app.state.deleteNote(note.id);
                this.app.save(true);
                this.render();
            };

            div.querySelector('.note-content').addEventListener('input', (e) => {
                this.app.state.updateNote(note.id, { text: e.target.textContent });
                this.app.save(true);
            });

            div.querySelector('.note-content').addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            this.cardsLayer.appendChild(div);
        });
    }

    _renderFlowchartLinks() {
        const board = this.app.state.getCurrentBoard();
        if (!board) return;

        this.cardsLayer.querySelectorAll('.flowchart-link-card').forEach(el => el.remove());

        this.app.state.relationships.filter(r => r.type === 'flowchartLink').forEach(rel => {
            let pos = board.positions.find(p => p.personId === '__link_' + rel.id);
            if (!pos) {
                pos = { personId: '__link_' + rel.id, x: 100, y: 100, cardWidth: 180, cardHeight: 80 };
                board.positions.push(pos);
            }

            const targetBoard = this.app.state.boards.find(b => b.id === rel.targetBoardId);
            const targetName = targetBoard ? targetBoard.name : 'Unknown';

            const div = document.createElement('div');
            div.className = 'flowchart-link-card';
            div.dataset.linkId = rel.id;
            div.style.left = pos.x + 'px';
            div.style.top = pos.y + 'px';

            div.innerHTML = `
                <div class="link-icon">→</div>
                <div class="link-name">${FF.Utils.escapeHtml(targetName)}</div>
                <div class="link-sub">Open Flow Chart</div>
            `;

            div.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                this.isDragging = true;
                this.dragPersonId = '__link_' + rel.id;
                const rect = this.container.getBoundingClientRect();
                const mx = (e.clientX - rect.left - this.panX) / this.zoom;
                const my = (e.clientY - rect.top - this.panY) / this.zoom;
                this.dragOffsetX = mx - pos.x;
                this.dragOffsetY = my - pos.y;
                this.dragGroupStart = {};
                this.dragGroupStart[this.dragPersonId] = { x: pos.x, y: pos.y };
                pos.x = mx - this.dragOffsetX;
                pos.y = my - this.dragOffsetY;
            });

            div.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (targetBoard) {
                    this.app.boardsUI.switchBoard(targetBoard.id);
                }
            });

            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm('Remove this flow chart link?')) {
                    this.app.history.push(this.app.state.getSnapshot());
                    this.app.state.deleteRelationship(rel.id);
                    board.positions = board.positions.filter(p => p.personId !== '__link_' + rel.id);
                    this.app.save(true);
                    this.render();
                }
            });

            this.cardsLayer.appendChild(div);
        });
    }

    getCanvasCoords(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.panX) / this.zoom,
            y: (clientY - rect.top - this.panY) / this.zoom
        };
    }
};
