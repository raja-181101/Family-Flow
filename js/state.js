FF.RelationshipTypes = {
    MARRIAGE: 'marriage',
    EX_MARRIAGE: 'exMarriage',
    PARTNERSHIP: 'partnership',
    SIBLING: 'sibling',
    PARENT_CHILD: 'parentChild',
    ADOPTION: 'adoption',
    STEP_PARENT: 'stepParent',
    STEP_CHILD: 'stepChild',
    OTHER: 'other',
    FLOWCHART_LINK: 'flowchartLink'
};

FF.RelationshipColors = {
    marriage: { color: '#a855f7', dash: '', label: 'Current Marriage' },
    exMarriage: { color: '#a855f7', dash: '8,4', label: 'Ex Marriage' },
    partnership: { color: '#c084fc', dash: '4,4', label: 'Partnership' },
    parentChild: { color: '#3b82f6', dash: '', label: 'Parent / Child' },
    sibling: { color: '#22c55e', dash: '', label: 'Sibling' },
    adoption: { color: '#f97316', dash: '6,3', label: 'Adoption' },
    stepParent: { color: '#ec4899', dash: '4,4', label: 'Step Relationship' },
    stepChild: { color: '#ec4899', dash: '4,4', label: 'Step Relationship' },
    other: { color: '#94a3b8', dash: '2,2', label: 'Other' },
    flowchartLink: { color: '#e2e8f0', dash: '8,4', label: 'Flow Chart Link' }
};

FF.State = class {
    constructor() {
        this.people = [];
        this.relationships = [];
        this.boards = [];
        this.notes = [];
        this.currentBoardId = null;
        this.settings = {
            snapToGrid: true,
            gridSize: 20,
            showGrid: true,
            showLabels: true,
            showLegend: true,
            theme: 'dark'
        };
        this.selectedPersonIds = [];
        this.selectedRelationshipId = null;
        this.selectedNoteId = null;
        this.selectedTool = 'select';
    }

    init() {
        const saved = FF.Storage.load();
        if (saved) {
            this.people = saved.people || [];
            this.relationships = saved.relationships || [];
            this.boards = saved.boards || [];
            this.notes = saved.notes || [];
            this.settings = { ...this.settings, ...(saved.settings || {}) };
            this.currentBoardId = saved.currentBoardId || (this.boards.length > 0 ? this.boards[0].id : null);
            this._syncCounters();
        } else {
            this.addBoard({ name: 'Main Family' });
            this.currentBoardId = this.boards[0].id;
        }
    }

    _syncCounters() {
        this.people.forEach(p => FF.Utils.ensureCounter('person', p.id));
        this.relationships.forEach(r => FF.Utils.ensureCounter('relationship', r.id));
        this.boards.forEach(b => FF.Utils.ensureCounter('board', b.id));
        this.notes.forEach(n => FF.Utils.ensureCounter('note', n.id));
    }

    getCurrentBoard() {
        return this.boards.find(b => b.id === this.currentBoardId) || this.boards[0];
    }

    switchBoard(boardId) {
        this.currentBoardId = boardId;
        this.selectedPersonIds = [];
        this.selectedRelationshipId = null;
        this.selectedNoteId = null;
    }

    addPerson(data) {
        const person = {
            id: FF.Utils.genId('person'),
            firstName: data.firstName || '',
            middleName: data.middleName || '',
            lastName: data.lastName || '',
            gender: data.gender || 'other',
            dateOfBirth: data.dateOfBirth || '',
            dateOfDeath: data.dateOfDeath || '',
            status: data.status || 'living',
            photo: data.photo || null,
            location: data.location || '',
            occupation: data.occupation || '',
            notes: data.notes || '',
            adoptionInfo: data.adoptionInfo || ''
        };
        this.people.push(person);
        const board = this.getCurrentBoard();
        if (board) {
            const idx = board.positions.length;
            const cols = 4;
            board.positions.push({
                personId: person.id,
                x: 100 + (idx % cols) * 250,
                y: 100 + Math.floor(idx / cols) * 220,
                cardWidth: 180,
                cardHeight: 140
            });
        }
        return person;
    }

    updatePerson(id, data) {
        const person = this.people.find(p => p.id === id);
        if (person) {
            Object.assign(person, data);
        }
        return person;
    }

    deletePerson(id) {
        this.people = this.people.filter(p => p.id !== id);
        this.relationships = this.relationships.filter(r =>
            r.personA !== id && r.personB !== id && r.parent !== id && r.child !== id
        );
        const board = this.getCurrentBoard();
        if (board) {
            board.positions = board.positions.filter(p => p.personId !== id);
        }
        this.notes = this.notes.filter(n => n.targetPersonId !== id);
        this.selectedPersonIds = this.selectedPersonIds.filter(pid => pid !== id);
    }

    getPerson(id) {
        return this.people.find(p => p.id === id);
    }

    getPersonName(id) {
        const p = this.getPerson(id);
        if (!p) return 'Unknown';
        const parts = [p.firstName, p.middleName, p.lastName].filter(Boolean);
        return parts.join(' ') || 'Unnamed';
    }

    addRelationship(data) {
        const rel = {
            id: FF.Utils.genId('relationship'),
            type: data.type,
            personA: data.personA || null,
            personB: data.personB || null,
            parent: data.parent || null,
            child: data.child || null,
            status: data.status || '',
            label: data.label || '',
            targetBoardId: data.targetBoardId || null,
            targetPersonId: data.targetPersonId || null
        };
        this.relationships.push(rel);
        return rel;
    }

    updateRelationship(id, data) {
        const rel = this.relationships.find(r => r.id === id);
        if (rel) Object.assign(rel, data);
        return rel;
    }

    deleteRelationship(id) {
        this.relationships = this.relationships.filter(r => r.id !== id);
        if (this.selectedRelationshipId === id) this.selectedRelationshipId = null;
    }

    validateRelationship(data) {
        if (data.type === 'parentChild' || data.type === 'adoption' || data.type === 'stepParent' || data.type === 'stepChild') {
            if (data.parent === data.child) return 'Cannot create self-relationship';
            if (!data.parent || !data.child) return 'Both parent and child are required';
            if (!this.getPerson(data.parent) || !this.getPerson(data.child)) return 'Person not found';
        } else if (data.type === 'flowchartLink') {
            if (!data.targetBoardId) return 'Target flow chart is required';
        } else {
            if (data.personA === data.personB) return 'Cannot create self-relationship';
            if (!data.personA || !data.personB) return 'Both persons are required';
            if (!this.getPerson(data.personA) || !this.getPerson(data.personB)) return 'Person not found';
        }
        const existing = this.relationships.find(r => {
            if (r.type !== data.type) return false;
            if (data.type === 'parentChild' || data.type === 'adoption' || data.type === 'stepParent' || data.type === 'stepChild') {
                return r.parent === data.parent && r.child === data.child;
            }
            if (data.type === 'flowchartLink') {
                return r.targetBoardId === data.targetBoardId;
            }
            return r.personA === data.personA && r.personB === data.personB && r.type === data.type;
        });
        if (existing) return 'This relationship already exists';
        return null;
    }

    addNote(data) {
        const note = {
            id: FF.Utils.genId('note'),
            text: data.text || '',
            x: data.x || 100,
            y: data.y || 100,
            width: data.width || 200,
            height: data.height || 100,
            color: data.color || '#fbbf24',
            targetPersonId: data.targetPersonId || null
        };
        this.notes.push(note);
        return note;
    }

    updateNote(id, data) {
        const note = this.notes.find(n => n.id === id);
        if (note) Object.assign(note, data);
        return note;
    }

    deleteNote(id) {
        this.notes = this.notes.filter(n => n.id !== id);
        if (this.selectedNoteId === id) this.selectedNoteId = null;
    }

    addBoard(data) {
        const board = {
            id: FF.Utils.genId('board'),
            name: data.name || 'New Flow Chart',
            positions: [],
            zoom: 1,
            panX: 0,
            panY: 0,
            linkedFrom: data.linkedFrom || null
        };
        this.boards.push(board);
        return board;
    }

    updateBoard(id, data) {
        const board = this.boards.find(b => b.id === id);
        if (board) Object.assign(board, data);
        return board;
    }

    deleteBoard(id) {
        if (this.boards.length <= 1) return false;
        this.boards = this.boards.filter(b => b.id !== id);
        this.relationships = this.relationships.filter(r => r.targetBoardId !== id);
        if (this.currentBoardId === id) {
            this.currentBoardId = this.boards[0].id;
        }
        return true;
    }

    duplicateBoard(id) {
        const src = this.boards.find(b => b.id === id);
        if (!src) return null;
        const board = this.addBoard({ name: src.name + ' (Copy)' });
        board.positions = FF.Utils.deepClone(src.positions);
        board.zoom = src.zoom;
        board.panX = src.panX;
        board.panY = src.panY;
        return board;
    }

    getPosition(personId) {
        const board = this.getCurrentBoard();
        if (!board) return null;
        return board.positions.find(p => p.personId === personId);
    }

    setPosition(personId, x, y) {
        const board = this.getCurrentBoard();
        if (!board) return;
        const pos = board.positions.find(p => p.personId === personId);
        if (pos) {
            pos.x = x;
            pos.y = y;
        }
    }

    setPersonPosition(personId, x, y) {
        const board = this.getCurrentBoard();
        if (!board) return;
        let pos = board.positions.find(p => p.personId === personId);
        if (pos) {
            pos.x = x;
            pos.y = y;
        } else {
            board.positions.push({
                personId,
                x, y,
                cardWidth: 180,
                cardHeight: 140
            });
        }
    }

    getPersonRelationships(personId) {
        return this.relationships.filter(r => {
            if (r.type === 'parentChild' || r.type === 'adoption' || r.type === 'stepParent' || r.type === 'stepChild') {
                return r.parent === personId || r.child === personId;
            }
            if (r.type === 'flowchartLink') return false;
            return r.personA === personId || r.personB === personId;
        });
    }

    getRelationshipLabel(rel) {
        const info = FF.RelationshipColors[rel.type];
        if (!info) return '';
        let label = info.label;
        if (rel.status) {
            label += ' (' + rel.status.charAt(0).toUpperCase() + rel.status.slice(1) + ')';
        }
        return label;
    }

    getSnapshot() {
        return JSON.stringify({
            people: this.people,
            relationships: this.relationships,
            boards: this.boards,
            notes: this.notes,
            currentBoardId: this.currentBoardId,
            settings: this.settings
        });
    }

    restoreSnapshot(json) {
        const data = JSON.parse(json);
        this.people = data.people || [];
        this.relationships = data.relationships || [];
        this.boards = data.boards || [];
        this.notes = data.notes || [];
        this.currentBoardId = data.currentBoardId;
        this.settings = { ...this.settings, ...(data.settings || {}) };
        this.selectedPersonIds = [];
        this.selectedRelationshipId = null;
        this.selectedNoteId = null;
        this._syncCounters();
    }

    _createDemoData() {
        const mainBoard = this.addBoard({ name: 'Main Family' });
        const john = this.addPerson({ firstName: 'John', lastName: 'Smith', gender: 'male', dateOfBirth: '1950-03-15', dateOfDeath: '2020-11-02', status: 'deceased', occupation: 'Engineer', location: 'New York' });
        const sarah = this.addPerson({ firstName: 'Sarah', lastName: 'Smith', gender: 'female', dateOfBirth: '1952-07-20', status: 'living', occupation: 'Teacher', location: 'New York' });
        const mary = this.addPerson({ firstName: 'Mary', lastName: 'Smith', gender: 'female', dateOfBirth: '1958-01-10', status: 'living', occupation: 'Doctor', location: 'Boston' });
        const lisa = this.addPerson({ firstName: 'Lisa', lastName: 'Smith', gender: 'female', dateOfBirth: '1962-09-05', status: 'living', occupation: 'Lawyer', location: 'Chicago' });
        const childA = this.addPerson({ firstName: 'James', lastName: 'Smith', gender: 'male', dateOfBirth: '1975-04-12', status: 'living', occupation: 'Software Developer', location: 'San Francisco' });
        const childB = this.addPerson({ firstName: 'Emily', lastName: 'Smith', gender: 'female', dateOfBirth: '1982-06-30', status: 'living', occupation: 'Architect', location: 'Boston' });
        const childC = this.addPerson({ firstName: 'Alex', lastName: 'Smith', gender: 'male', dateOfBirth: '1985-12-01', status: 'living', occupation: 'Artist', location: 'Los Angeles' });
        const childD = this.addPerson({ firstName: 'Sophie', lastName: 'Smith', gender: 'female', dateOfBirth: '1990-08-22', status: 'living', occupation: 'Nurse', location: 'Chicago' });

        this.addRelationship({ type: 'exMarriage', personA: john.id, personB: sarah.id, status: 'former' });
        this.addRelationship({ type: 'marriage', personA: john.id, personB: mary.id, status: 'current' });
        this.addRelationship({ type: 'marriage', personA: john.id, personB: lisa.id, status: 'current' });
        this.addRelationship({ type: 'parentChild', parent: john.id, child: childA.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: sarah.id, child: childA.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: john.id, child: childB.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: mary.id, child: childB.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: john.id, child: childC.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: mary.id, child: childC.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: john.id, child: childD.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: lisa.id, child: childD.id, status: 'biological' });

        const adoptiveMother = this.addPerson({ firstName: 'Patricia', lastName: 'Johnson', gender: 'female', dateOfBirth: '1960-03-18', status: 'living', occupation: 'Nurse', location: 'Los Angeles' });
        const adoptiveFather = this.addPerson({ firstName: 'Robert', lastName: 'Johnson', gender: 'male', dateOfBirth: '1958-07-22', status: 'living', occupation: 'Accountant', location: 'Los Angeles' });
        this.addRelationship({ type: 'adoption', parent: adoptiveMother.id, child: childC.id, status: 'adoptive' });
        this.addRelationship({ type: 'adoption', parent: adoptiveFather.id, child: childC.id, status: 'adoptive' });

        const board = mainBoard;

        function place(person, x, y) {
            const pos = board.positions.find(p => p.personId === person.id);
            if (pos) {
                pos.x = x;
                pos.y = y;
            }
        }

        place(john, 480, 60);
        place(sarah, 140, 60);
        place(mary, 800, 60);
        place(lisa, 1120, 60);
        place(childA, 200, 420);
        place(childB, 700, 420);
        place(childC, 960, 420);
        place(childD, 1220, 420);
        place(adoptiveMother, 1440, 420);
        place(adoptiveFather, 1680, 420);

        const board2 = this.addBoard({ name: "Father's Side" });
        const grandpa = this.addPerson({ firstName: 'Robert', lastName: 'Smith Sr.', gender: 'male', dateOfBirth: '1920-02-10', dateOfDeath: '1995-06-15', status: 'deceased', occupation: 'Farmer', location: 'Vermont' });
        const grandma = this.addPerson({ firstName: 'Margaret', lastName: 'Smith', gender: 'female', dateOfBirth: '1925-08-03', dateOfDeath: '2000-12-20', status: 'deceased', occupation: 'Homemaker', location: 'Vermont' });
        mainBoard.positions = mainBoard.positions.filter(p => p.personId !== grandpa.id && p.personId !== grandma.id);
        board2.positions.push(
            { personId: grandpa.id, x: 200, y: 100, cardWidth: 180, cardHeight: 140 },
            { personId: grandma.id, x: 450, y: 100, cardWidth: 180, cardHeight: 140 }
        );
        this.addRelationship({ type: 'marriage', personA: grandpa.id, personB: grandma.id, status: 'current' });
        this.addRelationship({ type: 'parentChild', parent: grandpa.id, child: john.id, status: 'biological' });
        this.addRelationship({ type: 'parentChild', parent: grandma.id, child: john.id, status: 'biological' });

        this.addRelationship({ type: 'flowchartLink', targetBoardId: board2.id });
    }
};
