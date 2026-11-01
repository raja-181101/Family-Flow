FF.BoardsUI = class {
    constructor(app) {
        this.app = app;
    }

    updateBoardsList() {
        const list = document.getElementById('boardsList');
        if (!list) return;
        list.innerHTML = '';
        this.app.state.boards.forEach(board => {
            const div = document.createElement('div');
            div.className = 'board-item' + (board.id === this.app.state.currentBoardId ? ' active' : '');
            div.innerHTML = `
                <span class="board-name">${FF.Utils.escapeHtml(board.name)}</span>
                <div class="board-actions">
                    <button class="icon-btn-sm board-menu-btn" title="Board options">⋮</button>
                </div>
            `;
            div.onclick = (e) => {
                if (e.target.closest('.board-menu-btn')) return;
                this.switchBoard(board.id);
            };
            div.querySelector('.board-menu-btn').onclick = (e) => {
                e.stopPropagation();
                this.showBoardMenu(board.id, e);
            };
            list.appendChild(div);
        });
    }

    switchBoard(boardId) {
        this.app.state.switchBoard(boardId);
        this.app.state.selectedPersonIds = [];
        this.app.state.selectedRelationshipId = null;
        this.app.state.selectedNoteId = null;
        this.app.render();
        this.updateBoardsList();
        this.app.peopleUI.updateMembersList();
        this.app.relsUI.updateRelationshipsList();
    }

    showBoardMenu(boardId, event) {
        const existing = document.querySelector('.board-context-menu');
        if (existing) existing.remove();

        const board = this.app.state.boards.find(b => b.id === boardId);
        if (!board) return;

        const menu = document.createElement('div');
        menu.className = 'board-context-menu';
        menu.innerHTML = `
            <button data-action="rename">Rename</button>
            <button data-action="duplicate">Duplicate</button>
            <button data-action="delete">Delete</button>
        `;
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.zIndex = '10000';

        menu.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                menu.remove();
                const action = btn.dataset.action;
                if (action === 'rename') {
                    this.renameBoard(boardId);
                } else if (action === 'duplicate') {
                    this.duplicateBoard(boardId);
                } else if (action === 'delete') {
                    this.deleteBoard(boardId);
                }
            };
        });

        document.body.appendChild(menu);
        setTimeout(() => {
            document.addEventListener('click', function handler() {
                menu.remove();
                document.removeEventListener('click', handler);
            }, { once: true });
        }, 10);
    }

    createBoard() {
        const name = prompt('Enter flow chart name:', 'New Flow Chart');
        if (!name) return;
        this.app.history.push(this.app.state.getSnapshot());
        const board = this.app.state.addBoard({ name });
        this.switchBoard(board.id);
        this.app.save(true);
    }

    renameBoard(boardId) {
        const board = this.app.state.boards.find(b => b.id === boardId);
        if (!board) return;
        const name = prompt('Rename flow chart:', board.name);
        if (!name) return;
        this.app.history.push(this.app.state.getSnapshot());
        this.app.state.updateBoard(boardId, { name });
        this.updateBoardsList();
        this.app.save(true);
    }

    duplicateBoard(boardId) {
        this.app.history.push(this.app.state.getSnapshot());
        const board = this.app.state.duplicateBoard(boardId);
        if (board) {
            this.switchBoard(board.id);
            this.app.save(true);
        }
    }

    deleteBoard(boardId) {
        if (this.app.state.boards.length <= 1) {
            alert('Cannot delete the last flow chart.');
            return;
        }
        if (confirm('Delete this flow chart and all its layout data?')) {
            this.app.history.push(this.app.state.getSnapshot());
            this.app.state.deleteBoard(boardId);
            this.updateBoardsList();
            this.app.render();
            this.app.save(true);
        }
    }
};
