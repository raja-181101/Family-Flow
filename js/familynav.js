FF.FamilyNav = {
    _boardFor(state, fam) {
        return state.boards.find(b => b.auto && b.familyKey === fam.key);
    },

    // go to a chart and keep the person selected
    open(app, fam, personId) {
        const board = this._boardFor(app.state, fam);
        if (!board) return;
        if (board.id !== app.state.currentBoardId) app.boardsUI.switchBoard(board.id);
        app.state.selectedPersonIds = [personId];
        app.render();
        app.canvas.fitToScreen();
        app.peopleUI.showDetails(personId);
    },

    // clicking a name in the left list: show their parents' flow
    showPerson(app, personId) {
        const families = FF.Family.computeFamilies(app.state);
        const fam = families.find(f => f.children.includes(personId))
                 || families.find(f => !f.solo && f.parents.includes(personId))
                 || families.find(f => f.members.includes(personId));
        if (fam) this.open(app, fam, personId);
        else {
            app.state.selectedPersonIds = [personId];
            app.render();
            app.peopleUI.showDetails(personId);
        }
    },

    // adds the family buttons to the details panel
    decoratePanel(app, personId, panel) {
        const state = app.state;
        const person = state.getPerson(personId);
        const actions = panel.querySelector('.details-actions');
        if (!person || !actions) return;

        const families = FF.Family.computeFamilies(state);
        const ownFam = families.find(f => !f.solo && f.parents.includes(personId));
        const parentFam = families.find(f => f.children.includes(personId));
        const incomplete = person.detailsAdded === false;
        if (!ownFam && !parentFam && !incomplete) return;

        const word = person.gender === 'male' ? 'His' : person.gender === 'female' ? 'Her' : 'Their';
        const box = document.createElement('div');
        box.className = 'family-nav';
        box.innerHTML =
            (incomplete ? '<div class="family-nav-note">Details not added yet</div>' +
                '<button type="button" class="btn btn-primary" data-act="fill">Add details</button>' : '') +
            (ownFam ? '<button type="button" class="btn btn-secondary" data-act="own">' + word + ' family</button>' : '') +
            (parentFam ? '<button type="button" class="btn btn-secondary" data-act="parents">Parents\u2019 family</button>' : '');

        box.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.act === 'fill') app.peopleUI.showAddModal(person);
            if (btn.dataset.act === 'own') this.open(app, ownFam, personId);
            if (btn.dataset.act === 'parents') this.open(app, parentFam, personId);
        });
        actions.parentNode.insertBefore(box, actions);
    }
};

// long-press (touch or mouse) on a card opens the form
(function () {
    let timer = null, startX = 0, startY = 0;
    const cancel = () => { clearTimeout(timer); timer = null; };

    document.addEventListener('pointerdown', (e) => {
        const card = e.target.closest && e.target.closest('.person-card');
        if (!card || e.button > 0) return;
        const id = card.dataset.personId;
        startX = e.clientX; startY = e.clientY;
        cancel();
        timer = setTimeout(() => {
            timer = null;
            const app = window.familyFlowApp;
            const person = app && app.state.getPerson(id);
            if (person) app.peopleUI.showAddModal(person);
        }, 600);
    });
    document.addEventListener('pointermove', (e) => {
        if (timer && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) cancel();
    });
    document.addEventListener('pointerup', cancel);
    document.addEventListener('pointercancel', cancel);
})();