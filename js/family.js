FF.Family = {
    // ---------- small helpers ----------
    _clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); },
    _key(s) { return this._clean(s).toLowerCase(); },

    _splitName(full) {
        const clean = this._clean(full);
        const i = clean.indexOf(' ');
        return i === -1
            ? { firstName: clean, lastName: '' }
            : { firstName: clean.slice(0, i), lastName: clean.slice(i + 1) };
    },

    _findByName(state, name) {
        const k = this._key(name);
        return state.people.filter(p =>
            this._key([p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')) === k);
    },

    // ---------- link checks (so nothing is created twice) ----------
    _parentLinkExists(state, parentId, childId) {
        return state.relationships.some(r =>
            r.type === 'parentChild' && r.parent === parentId && r.child === childId);
    },
    _coupleExists(state, a, b) {
        return state.relationships.some(r =>
            ['marriage', 'exMarriage', 'partnership'].includes(r.type) &&
            ((r.personA === a && r.personB === b) || (r.personA === b && r.personB === a)));
    },
    _siblingExists(state, a, b) {
        return state.relationships.some(r =>
            r.type === 'sibling' &&
            ((r.personA === a && r.personB === b) || (r.personA === b && r.personB === a)));
    },

    // ---------- link creators ----------
    _linkParent(state, parent, child) {
        if (!parent || !child || parent.id === child.id) return;
        if (this._parentLinkExists(state, parent.id, child.id)) return;
        state.addRelationship({ type: 'parentChild', parent: parent.id, child: child.id, status: 'biological' });
    },
    _linkCouple(state, a, b, type, status) {
        if (!a || !b || a.id === b.id) return;
        if (this._coupleExists(state, a.id, b.id)) return;
        state.addRelationship({ type: type, personA: a.id, personB: b.id, status: status });
    },
    _linkSibling(state, a, b) {
        if (!a || !b || a.id === b.id) return;
        if (this._siblingExists(state, a.id, b.id)) return;
        state.addRelationship({ type: 'sibling', personA: a.id, personB: b.id });
    },

    // ---------- find an existing person, or create a "not filled in" card ----------
    _resolve(state, opts) {
        if (opts.id) return state.getPerson(opts.id);        // picked from the dropdown
        const name = this._clean(opts.name);
        if (!name) return null;

        const matches = this._findByName(state, name);
        if (matches.length) {
            const label = state.getPersonName(matches[0].id);
            const same = confirm(
                '"' + label + '" is already in your tree.\n\n' +
                'OK = yes, link to that person\nCancel = no, create a new person');
            if (same) return matches[0];
        }

        const person = state.addPerson({
            ...this._splitName(name),
            gender: opts.gender || 'other',
            status: opts.status || 'living',
            dateOfBirth: opts.dateOfBirth || ''
        });
        state.updatePerson(person.id, { detailsAdded: false });  // details can be filled in later
        return person;
    },

    _rows(form, containerId, fields) {
        return [...form.querySelectorAll('#' + containerId + ' .repeat-row')].map(row => {
            const out = {};
            fields.forEach(f => { out[f] = row.querySelector('[name=' + f + ']').value; });
            return out;
        });
    },

    // ---------- the main save ----------
    saveNewPerson(state, data, form) {
        const fullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');

        // 1. Is this person already in the tree?
        let main = null;
        const existing = this._findByName(state, fullName);
        if (existing.length) {
            if (existing[0].detailsAdded === false) {
                const fill = confirm(
                    '"' + fullName + '" is already in your tree (added from another family).\n\n' +
                    'OK = fill in their details now\nCancel = create a separate new person');
                if (fill) main = existing[0];
            } else if (!confirm('"' + fullName + '" is already in your tree. Add another person with the same name?')) {
                return null;
            }
        }

        // 2. Create or update the person
        const age = parseInt(form.age.value, 10);
        const extras = {
            designation: this._clean(form.designation.value),
            company: this._clean(form.company.value),
            maritalStatus: form.maritalStatus.value,
            approxBirthYear: (!data.dateOfBirth && !isNaN(age)) ? new Date().getFullYear() - age : null,
            birthRank: 0,
            detailsAdded: true
        };
        if (main) {
            state.updatePerson(main.id, { ...data, ...extras });
        } else {
            main = state.addPerson(data);
            state.updatePerson(main.id, extras);
        }

        // 3. Parents
        const father = this._resolve(state, { id: form.fatherId.value, name: form.fatherName.value, gender: 'male' });
        const mother = this._resolve(state, { id: form.motherId.value, name: form.motherName.value, gender: 'female' });
        const parents = [father, mother].filter(p => p && p.id !== main.id);
        parents.forEach(p => this._linkParent(state, p, main));
        if (parents.length === 2) this._linkCouple(state, parents[0], parents[1], 'marriage', 'current');

        // 4. Siblings (elder rows count away from the person, nearest first)
        let elder = 0, younger = 0;
        this._rows(form, 'siblingRows', ['siblingName', 'siblingOrder'])
            .filter(r => this._clean(r.siblingName))
            .forEach(r => {
                const sib = this._resolve(state, { name: r.siblingName });
                if (!sib || sib.id === main.id) return;
                const rank = r.siblingOrder === 'elder' ? -(++elder) : ++younger;
                state.updatePerson(sib.id, { birthRank: rank });
                if (parents.length) parents.forEach(p => this._linkParent(state, p, sib));
                else this._linkSibling(state, main, sib);
            });

        // 5. Spouse
        const marital = form.maritalStatus.value;
        let spouse = null;
        if (marital !== 'single' && this._clean(form.spouseName.value)) {
            const g = main.gender === 'male' ? 'female' : main.gender === 'female' ? 'male' : 'other';
            spouse = this._resolve(state, {
                name: form.spouseName.value,
                gender: g,
                status: marital === 'widowed' ? 'deceased' : 'living'
            });
            if (spouse && spouse.id !== main.id) {
                this._linkCouple(state, main, spouse,
                    marital === 'divorced' ? 'exMarriage' : 'marriage',
                    marital === 'divorced' ? 'former' : 'current');
            }
        }

        // 6. Children
        this._rows(form, 'childRows', ['childName', 'childDob'])
            .filter(r => this._clean(r.childName))
            .forEach(r => {
                const child = this._resolve(state, { name: r.childName, dateOfBirth: r.childDob });
                if (!child || child.id === main.id) return;
                this._linkParent(state, main, child);
                if (spouse) this._linkParent(state, spouse, child);
            });

        return main;
    }
};