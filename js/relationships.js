FF.RelationshipsUI = class {
    constructor(app) {
        this.app = app;
    }

    showAddModal() {
        this._populateSelects();
        const form = document.getElementById('relForm');
        form.type.value = 'marriage';
        this._updateRelFields(form);
        document.getElementById('relationshipModal').classList.add('active');
    }

    showAddModalWithPair(personA, personB) {
        this._populateSelects();
        const form = document.getElementById('relForm');

        const existing = this.app.state.relationships.find(r =>
            (r.personA === personA && r.personB === personB) ||
            (r.personA === personB && r.personB === personA) ||
            (r.parent === personA && r.child === personB) ||
            (r.parent === personB && r.child === personA)
        );

        form.type.value = existing ? existing.type : 'marriage';
        this._updateRelFields(form);
        form.querySelector('#relPerson1').value = personA;
        form.querySelector('#relPerson2').value = personB;
        form.querySelector('#relParent').value = personA;
        form.querySelector('#relChild').value = personB;
        document.getElementById('relationshipModal').classList.add('active');
    }

    _populateSelects() {
        const form = document.getElementById('relForm');
        const personASelect = form.querySelector('#relPerson1');
        const personBSelect = form.querySelector('#relPerson2');
        const parentSelect = form.querySelector('#relParent');
        const childSelect = form.querySelector('#relChild');

        const people = this.app.state.people;
        let optionsHtml = '<option value="">Select person...</option>';
        people.forEach(p => {
            const name = FF.Utils.escapeHtml(this.app.state.getPersonName(p.id));
            optionsHtml += `<option value="${p.id}">${name}</option>`;
        });

        personASelect.innerHTML = optionsHtml;
        personBSelect.innerHTML = optionsHtml;
        parentSelect.innerHTML = optionsHtml;
        childSelect.innerHTML = optionsHtml;
    }

    hideModal() {
        document.getElementById('relationshipModal').classList.remove('active');
    }

    _updateRelFields(form) {
        const type = form.type.value;
        const marriageGroup = form.querySelector('#marriageFields');
        const parentChildGroup = form.querySelector('#parentChildFields');
        const coupleGroup = form.querySelector('#coupleFields');
        const linkGroup = form.querySelector('#flowchartLinkFields');
        const targetSelect = form.querySelector('#relTargetBoard');

        marriageGroup.style.display = 'none';
        parentChildGroup.style.display = 'none';
        coupleGroup.style.display = 'none';
        linkGroup.style.display = 'none';

        if (type === 'marriage' || type === 'exMarriage' || type === 'partnership') {
            coupleGroup.style.display = 'block';
            marriageGroup.style.display = 'block';
        } else if (type === 'parentChild' || type === 'adoption' || type === 'stepParent' || type === 'stepChild') {
            parentChildGroup.style.display = 'block';
        } else if (type === 'flowchartLink') {
            linkGroup.style.display = 'block';
            let opts = '<option value="">Select flow chart...</option>';
            this.app.state.boards.forEach(b => {
                if (b.id !== this.app.state.currentBoardId) {
                    opts += `<option value="${b.id}">${FF.Utils.escapeHtml(b.name)}</option>`;
                }
            });
            targetSelect.innerHTML = opts;
        } else {
            coupleGroup.style.display = 'block';
        }
    }

    saveRelationship() {
        const form = document.getElementById('relForm');
        const type = form.type.value;
        const data = { type };

        if (type === 'marriage' || type === 'exMarriage' || type === 'partnership') {
            data.personA = form.querySelector('#relPerson1').value;
            data.personB = form.querySelector('#relPerson2').value;
            data.status = form.querySelector('#relStatus') ? form.querySelector('#relStatus').value : '';
            if (type === 'exMarriage') data.status = 'former';
            if (type === 'marriage' && !data.status) data.status = 'current';
        } else if (type === 'parentChild' || type === 'adoption' || type === 'stepParent' || type === 'stepChild') {
            data.parent = form.querySelector('#relParent').value;
            data.child = form.querySelector('#relChild').value;
            data.status = form.querySelector('#relSubStatus') ? form.querySelector('#relSubStatus').value : '';
        } else if (type === 'flowchartLink') {
            data.targetBoardId = form.querySelector('#relTargetBoard').value;
            data.personA = null;
            data.personB = null;
        } else {
            data.personA = form.querySelector('#relPerson1') ? form.querySelector('#relPerson1').value : '';
            data.personB = form.querySelector('#relPerson2') ? form.querySelector('#relPerson2').value : '';
            data.status = '';
        }

        const error = this.app.state.validateRelationship(data);
        if (error) {
            alert(error);
            return;
        }

        this.app.history.push(this.app.state.getSnapshot());
        this.app.state.addRelationship(data);
        this.hideModal();
        if (this.app.state.selectedTool === 'addRelationship' || this.app.state.selectedTool === 'connectFlowchart') {
            this.app.state.selectedTool = 'select';
            this.app._updateToolButtons();
        }
        this.app.save(true);
        this.app.render();
    }

    showRelDetails(relId) {
        const rel = this.app.state.relationships.find(r => r.id === relId);
        if (!rel) return;
        this.app.state.selectedRelationshipId = relId;

        const panel = document.getElementById('personDetails');
        const typeInfo = FF.RelationshipColors[rel.type] || { label: rel.type, color: '#94a3b8' };

        let details = '';
        if (rel.type === 'parentChild' || rel.type === 'adoption' || rel.type === 'stepParent' || rel.type === 'stepChild') {
            const parentName = this.app.state.getPersonName(rel.parent);
            const childName = this.app.state.getPersonName(rel.child);
            details = `
                <p class="detail-field"><span class="detail-label">Type:</span> ${typeInfo.label}</p>
                <p class="detail-field"><span class="detail-label">Parent:</span> ${FF.Utils.escapeHtml(parentName)}</p>
                <p class="detail-field"><span class="detail-label">Child:</span> ${FF.Utils.escapeHtml(childName)}</p>
                ${rel.status ? `<p class="detail-field"><span class="detail-label">Status:</span> ${rel.status}</p>` : ''}
            `;
        } else if (rel.type === 'flowchartLink') {
            const board = this.app.state.boards.find(b => b.id === rel.targetBoardId);
            details = `
                <p class="detail-field"><span class="detail-label">Type:</span> Flow Chart Link</p>
                <p class="detail-field"><span class="detail-label">Target:</span> ${board ? FF.Utils.escapeHtml(board.name) : 'Unknown'}</p>
            `;
        } else {
            const nameA = this.app.state.getPersonName(rel.personA);
            const nameB = this.app.state.getPersonName(rel.personB);
            details = `
                <p class="detail-field"><span class="detail-label">Type:</span> ${typeInfo.label}</p>
                <p class="detail-field"><span class="detail-label">Person 1:</span> ${FF.Utils.escapeHtml(nameA)}</p>
                <p class="detail-field"><span class="detail-label">Person 2:</span> ${FF.Utils.escapeHtml(nameB)}</p>
                ${rel.status ? `<p class="detail-field"><span class="detail-label">Status:</span> ${rel.status}</p>` : ''}
            `;
        }

        panel.innerHTML = `
            <div class="details-header">
                <h3>Relationship Details</h3>
                <button class="icon-btn" id="closeDetailsBtn">&times;</button>
            </div>
            <div class="details-body">
                <div class="rel-color-bar" style="background:${typeInfo.color}"></div>
                ${details}
                <div class="details-actions">
                    <button class="btn btn-danger" id="deleteRelBtn">Delete Relationship</button>
                </div>
            </div>
        `;
        panel.classList.add('active');

        document.getElementById('closeDetailsBtn').onclick = () => {
            panel.classList.remove('active');
            this.app.state.selectedRelationshipId = null;
            this.app.render();
        };
        document.getElementById('deleteRelBtn').onclick = () => {
            if (confirm('Delete this relationship?')) {
                this.app.history.push(this.app.state.getSnapshot());
                this.app.state.deleteRelationship(relId);
                panel.classList.remove('active');
                this.app.save(true);
                this.app.render();
            }
        };
    }

    updateRelationshipsList() {
        const list = document.getElementById('relationshipsList');
        if (!list) return;
        const rels = this.app.state.relationships.filter(r => r.type !== 'flowchartLink');
        list.innerHTML = '';
        rels.forEach(r => {
            const info = FF.RelationshipColors[r.type] || { label: r.type, color: '#94a3b8' };
            const div = document.createElement('div');
            div.className = 'rel-list-item';
            let desc = '';
            if (r.type === 'parentChild' || r.type === 'adoption' || r.type === 'stepParent' || r.type === 'stepChild') {
                desc = `${this.app.state.getPersonName(r.parent)} → ${this.app.state.getPersonName(r.child)}`;
            } else {
                desc = `${this.app.state.getPersonName(r.personA)} ↔ ${this.app.state.getPersonName(r.personB)}`;
            }
            div.innerHTML = `
                <span class="rel-list-color" style="background:${info.color}"></span>
                <span class="rel-list-label">${FF.Utils.escapeHtml(desc)}</span>
            `;
            div.onclick = () => this.showRelDetails(r.id);
            list.appendChild(div);
        });
    }
};
