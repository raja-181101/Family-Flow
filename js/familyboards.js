Object.assign(FF.Family, {
    PARENT_TYPES: ['parentChild', 'adoption'],
    COUPLE_TYPES: ['marriage', 'exMarriage', 'partnership'],
    CARD_W: 180,
    CARD_H: 140,

    // ---------- work out every family from the links ----------
    computeFamilies(state) {
        const map = {};
        const familyFor = (ids) => {
            const parents = [...new Set(ids)].filter(id => state.getPerson(id)).sort();
            if (!parents.length) return null;
            const key = 'f:' + parents.join('+');
            if (!map[key]) map[key] = { key: key, parents: parents, children: [] };
            return map[key];
        };

        // which parents does each child have?
        const parentsOf = {};
        state.relationships.forEach(r => {
            if (this.PARENT_TYPES.includes(r.type) && state.getPerson(r.child) && state.getPerson(r.parent)) {
                (parentsOf[r.child] = parentsOf[r.child] || []).push(r.parent);
            }
        });
        Object.keys(parentsOf).forEach(childId => {
            const fam = familyFor(parentsOf[childId]);
            if (fam) fam.children.push(childId);
        });

        // couples without children still get a chart
        state.relationships.forEach(r => {
            if (this.COUPLE_TYPES.includes(r.type)) familyFor([r.personA, r.personB]);
        });

        const families = Object.values(map);

        // people who belong to no family get their own single-card chart
        const used = new Set();
        families.forEach(f => f.parents.concat(f.children).forEach(id => used.add(id)));
        state.people.forEach(p => {
            if (!used.has(p.id)) families.push({ key: 's:' + p.id, parents: [p.id], children: [], solo: true });
        });

        families.forEach(f => {
            f.members = f.parents.concat(f.children);
            f.memberKey = f.members.slice().sort().join(',');
        });
        return families;
    },

    // ---------- ordering ----------
    _orderedParents(state, fam) {
        const list = fam.parents.map(id => state.getPerson(id));
        return list.sort((a, b) => (b.gender === 'male') - (a.gender === 'male'));  // father first
    },

    _birthKey(p) {
        if (p.dateOfBirth) return p.dateOfBirth;
        if (p.approxBirthYear) return p.approxBirthYear + '-06-30';
        return null;
    },

    _sortChildren(state, ids) {
        return ids.map(id => state.getPerson(id)).sort((a, b) => {
            const ka = this._birthKey(a), kb = this._birthKey(b);
            if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
            const ra = a.birthRank || 0, rb = b.birthRank || 0;
            if (ra !== rb) return ra - rb;
            return a.id < b.id ? -1 : 1;
        });
    },

    // ---------- layout: parents on top, children below ----------
    _layout(state, fam) {
        const W = this.CARD_W, H = this.CARD_H, GX = 70, GY = 120;
        const parents = this._orderedParents(state, fam);
        const kids = this._sortChildren(state, fam.children);
        const rowW = (n) => (n > 0 ? n * W + (n - 1) * GX : 0);
        const cx = 100 + Math.max(rowW(parents.length), rowW(kids.length)) / 2;
        const out = [];
        const place = (list, y) => {
            const startX = cx - rowW(list.length) / 2;
            list.forEach((p, i) => out.push({
                personId: p.id,
                x: Math.round(startX + i * (W + GX)),
                y: y,
                cardWidth: W,
                cardHeight: H
            }));
        };
        place(parents, 100);
        place(kids, 100 + H + GY);
        return out;
    },

    _boardName(state, fam) {
        const head = this._orderedParents(state, fam)[0];
        const name = state.getPersonName(head.id);
        return fam.solo ? name : name + "'s family";
    },

    // ---------- keep the charts in sync with the links ----------
    rebuildBoards(state) {
        const families = this.computeFamilies(state);
        const byKey = {};
        families.forEach(f => { byKey[f.key] = f; });

        // drop charts for families that no longer exist, and the empty starter chart
        state.boards = state.boards.filter(b => {
            if (b.auto) return !!byKey[b.familyKey];
            if (b.starter) return families.length === 0;
            return true;
        });

        families.forEach(fam => {
            let board = state.boards.find(b => b.auto && b.familyKey === fam.key);
            if (!board) {
                board = state.addBoard({ name: '' });
                board.auto = true;
                board.familyKey = fam.key;
            }
            board.name = this._boardName(state, fam);

            if (board.memberKey !== fam.memberKey) {
                board.positions = this._layout(state, fam);   // members changed: lay out again
                board.memberKey = fam.memberKey;
            } else {
                const ok = new Set(fam.members);              // keep any cards you dragged
                board.positions = board.positions.filter(p => ok.has(p.personId));
            }
        });

        if (state.boards.length === 0) {
            const b = state.addBoard({ name: 'Main Family' });
            b.starter = true;
        }
        if (!state.boards.find(b => b.id === state.currentBoardId)) {
            state.currentBoardId = state.boards[0].id;
        }
    },

    // ---------- which chart to open for a person ----------
    // their own family if they are a parent, otherwise their parents' family
    boardForPerson(state, personId) {
        const families = this.computeFamilies(state);
        const fam = families.find(f => !f.solo && f.parents.includes(personId))
                 || families.find(f => f.children.includes(personId))
                 || families.find(f => f.members.includes(personId));
        if (!fam) return null;
        const board = state.boards.find(b => b.auto && b.familyKey === fam.key);
        return board ? board.id : null;
    }
});