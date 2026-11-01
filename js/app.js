FF.App = class {
    constructor() {
        this.state = new FF.State();
        this.history = new FF.History(50);
        this.canvas = new FF.Canvas(this);
        this.peopleUI = new FF.PeopleUI(this);
        this.relsUI = new FF.RelationshipsUI(this);
        this.boardsUI = new FF.BoardsUI(this);
        this.exportUI = new FF.ExportUI(this);
        this._saveTimer = null;
        this._unsaved = false;
    }

    init() {
        this.state.init();
        this.canvas.init('canvasContainer');
        this.history.push(this.state.getSnapshot());
        this._bindUI();
        this.render();
        this.peopleUI.updateMembersList();
        this.boardsUI.updateBoardsList();
        this.relsUI.updateRelationshipsList();
        setTimeout(() => this.canvas.fitToScreen(), 200);
    }

    _bindUI() {
        document.getElementById('toolSelect').onclick = () => this._setTool('select');
        document.getElementById('toolAddPerson').onclick = () => {
            this._setTool('select');
            this.peopleUI.showAddModal();
        };
        document.getElementById('toolAddRelationship').onclick = () => {
            this._setTool('addRelationship');
        };
        document.getElementById('toolAddNote').onclick = () => {
            this._setTool('addNote');
        };
        document.getElementById('toolConnectFlowchart').onclick = () => {
            this._setTool('connectFlowchart');
            this.relsUI.showAddModal();
            document.getElementById('relType').value = 'flowchartLink';
            this.relsUI._updateRelFields(document.getElementById('relForm'));
        };

        document.getElementById('personForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.peopleUI.savePerson();
        });
        document.getElementById('personCancelBtn').onclick = () => this.peopleUI.hideModal();
        document.getElementById('personModal').addEventListener('click', (e) => {
            if (e.target.id === 'personModal') this.peopleUI.hideModal();
        });

        document.getElementById('photoUpload').addEventListener('change', (e) => {
            this.peopleUI.handlePhotoUpload(e.target);
        });

        document.getElementById('relForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.relsUI.saveRelationship();
        });
        document.getElementById('relCancelBtn').onclick = () => this.relsUI.hideModal();
        document.getElementById('relCloseBtn').onclick = () => this.relsUI.hideModal();
        document.getElementById('relationshipModal').addEventListener('click', (e) => {
            if (e.target.id === 'relationshipModal') this.relsUI.hideModal();
        });

        document.getElementById('relType').addEventListener('change', (e) => {
            const form = document.getElementById('relForm');
            this.relsUI._updateRelFields(form);
        });

        document.getElementById('undoBtn').onclick = () => this.undo();
        document.getElementById('redoBtn').onclick = () => this.redo();
        document.getElementById('zoomInBtn').onclick = () => this.canvas.zoomIn();
        document.getElementById('zoomOutBtn').onclick = () => this.canvas.zoomOut();
        document.getElementById('fitScreenBtn').onclick = () => this.canvas.fitToScreen();
        document.getElementById('autoArrangeBtn').onclick = () => this.canvas.autoArrange();

        document.getElementById('exportBtn').onclick = (e) => {
            e.stopPropagation();
            this.exportUI.showMenu();
        };
        document.getElementById('exportPNGBtn').onclick = () => this.exportUI.exportPNG();
        document.getElementById('exportBoardJSON').onclick = () => this.exportUI.exportBoardJSON();
        document.getElementById('exportFullJSON').onclick = () => this.exportUI.exportFullJSON();
        document.getElementById('importJSONBtn').onclick = () => this.exportUI.importJSON();

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-dropdown')) {
                this.exportUI.hideMenu();
            }
        });

        document.getElementById('createBoardBtn').onclick = () => this.boardsUI.createBoard();

        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.onclick = () => {
                const sidebar = document.getElementById('leftSidebar');
                const backdrop = document.getElementById('sidebarBackdrop');
                sidebar.classList.toggle('open');
                backdrop.classList.toggle('active', sidebar.classList.contains('open'));
            };
        }
        const backdropEl = document.getElementById('sidebarBackdrop');
        if (backdropEl) {
            backdropEl.onclick = () => {
                document.getElementById('leftSidebar').classList.remove('open');
                backdropEl.classList.remove('active');
            };
        }
        document.getElementById('boardNameEl').onclick = () => {
            const board = this.state.getCurrentBoard();
            if (!board) return;
            const name = prompt('Rename flow chart:', board.name);
            if (name) {
                this.history.push(this.state.getSnapshot());
                this.state.updateBoard(board.id, { name });
                this.save(true);
                this.boardsUI.updateBoardsList();
            }
        };

        document.getElementById('settingsBtn').onclick = () => this._showSettings();
        document.getElementById('closeSettingsBtn').onclick = () => this._hideSettings();
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') this._hideSettings();
        });

        document.getElementById('snapGridToggle').addEventListener('change', (e) => {
            this.state.settings.snapToGrid = e.target.checked;
            this.save(true);
        });
        document.getElementById('showGridToggle').addEventListener('change', (e) => {
            this.state.settings.showGrid = e.target.checked;
            this.canvas.render();
            this.save(true);
        });
        document.getElementById('showLabelsToggle').addEventListener('change', (e) => {
            this.state.settings.showLabels = e.target.checked;
            this.canvas.render();
            this.save(true);
        });
        document.getElementById('showLegendToggle').addEventListener('change', (e) => {
            this.state.settings.showLegend = e.target.checked;
            this._toggleLegend();
            this.save(true);
        });

        document.getElementById('legendToggle').onclick = () => {
            const el = document.getElementById('relationshipLegend');
            el.classList.toggle('collapsed');
        };

        document.getElementById('searchInput').addEventListener('input', FF.Utils.debounce((e) => {
            this._search(e.target.value);
        }, 200));

        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); this.save(); }
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
        });

        this._initSettingsToggles();
    }

    _initSettingsToggles() {
        document.getElementById('snapGridToggle').checked = this.state.settings.snapToGrid;
        document.getElementById('showGridToggle').checked = this.state.settings.showGrid;
        document.getElementById('showLabelsToggle').checked = this.state.settings.showLabels;
        document.getElementById('showLegendToggle').checked = this.state.settings.showLegend;
        this._toggleLegend();
    }

    _toggleLegend() {
        const legend = document.getElementById('relationshipLegend');
        if (legend) {
            legend.style.display = this.state.settings.showLegend ? '' : 'none';
        }
    }

    _setTool(tool) {
        this.state.selectedTool = tool;
        this._updateToolButtons();
    }

    _updateToolButtons() {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const tool = this.state.selectedTool;
        const btnId = 'tool' + tool.charAt(0).toUpperCase() + tool.slice(1);
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.add('active');
    }

    _showSettings() {
        this._initSettingsToggles();
        document.getElementById('settingsModal').classList.add('active');
    }

    _hideSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    _search(query) {
        if (!query.trim()) {
            this.canvas.render();
            return;
        }
        const q = query.toLowerCase();
        const found = this.state.people.filter(p => {
            const fullName = [p.firstName, p.middleName, p.lastName].join(' ').toLowerCase();
            return fullName.includes(q) ||
                (p.location && p.location.toLowerCase().includes(q)) ||
                (p.occupation && p.occupation.toLowerCase().includes(q)) ||
                (p.dateOfBirth && p.dateOfBirth.includes(q));
        });
        if (found.length > 0) {
            this.state.selectedPersonIds = found.map(p => p.id);
            const pos = this.state.getPosition(found[0].id);
            if (pos) {
                this.canvas.centerOn(pos.x + 90, pos.y + 70);
            }
            this.canvas.render();
            this.peopleUI.showDetails(found[0].id);
        }
    }

    undo() {
        const snapshot = this.history.undo();
        if (snapshot) {
            this.state.restoreSnapshot(snapshot);
            this.save(true);
            this.render();
            this.peopleUI.updateMembersList();
            this.boardsUI.updateBoardsList();
            this.relsUI.updateRelationshipsList();
        }
    }

    redo() {
        const snapshot = this.history.redo();
        if (snapshot) {
            this.state.restoreSnapshot(snapshot);
            this.save(true);
            this.render();
            this.peopleUI.updateMembersList();
            this.boardsUI.updateBoardsList();
            this.relsUI.updateRelationshipsList();
        }
    }

    save(dontPushHistory) {
        this._unsaved = true;
        this._updateSaveStatus('saving');
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            FF.Storage.save(this.state);
            this._unsaved = false;
            this._updateSaveStatus('saved');
        }, 300);
        if (!dontPushHistory) {
            this.history.push(this.state.getSnapshot());
        }
    }

    _updateSaveStatus(status) {
        const el = document.getElementById('saveStatus');
        if (!el) return;
        if (status === 'saving') {
            el.textContent = 'Saving...';
            el.className = 'save-status saving';
        } else if (status === 'saved') {
            el.textContent = 'Saved';
            el.className = 'save-status saved';
        }
    }

    render() {
        const board = this.state.getCurrentBoard();
        if (board) {
            document.getElementById('boardNameEl').textContent = board.name;
            this.canvas.zoom = board.zoom || 1;
            this.canvas.panX = board.panX || 0;
            this.canvas.panY = board.panY || 0;
        }
        this.canvas.render();
        this.boardsUI.updateBoardsList();
        this.peopleUI.updateMembersList();
        this.relsUI.updateRelationshipsList();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const app = new FF.App();
    app.init();
    window.familyFlowApp = app;
});
