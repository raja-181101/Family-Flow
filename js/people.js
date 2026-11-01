FF.PeopleUI = class {
    constructor(app) {
        this.app = app;
    }

    showAddModal(editData) {
        const isEdit = !!editData;
        const modal = document.getElementById('personModal');
        const form = document.getElementById('personForm');
        const title = modal.querySelector('.modal-title');
        title.textContent = isEdit ? 'Edit Person' : 'Add Person';

        const saveBtn = document.getElementById('personSaveBtn');
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Person';

        form.dataset.personId = isEdit ? editData.id : '';
        form.firstName.value = isEdit ? editData.firstName : '';
        form.middleName.value = isEdit ? editData.middleName : '';
        form.lastName.value = isEdit ? editData.lastName : '';
        form.gender.value = isEdit ? editData.gender : 'other';
        form.dateOfBirth.value = isEdit ? editData.dateOfBirth : '';
        form.dateOfDeath.value = isEdit ? editData.dateOfDeath : '';
        form.status.value = isEdit ? editData.status : 'living';
        form.location.value = isEdit ? editData.location : '';
        form.occupation.value = isEdit ? editData.occupation : '';
        form.notes.value = isEdit ? editData.notes : '';

        const photoPreview = document.getElementById('photoPreview');
        if (isEdit && editData.photo) {
            photoPreview.src = editData.photo;
            photoPreview.style.display = 'block';
        } else {
            photoPreview.src = '';
            photoPreview.style.display = 'none';
        }

        modal.classList.add('active');
        setTimeout(() => form.firstName.focus(), 100);
    }

    hideModal() {
        document.getElementById('personModal').classList.remove('active');
    }

    handlePhotoUpload(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('Photo must be under 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('photoPreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }

    savePerson() {
        const form = document.getElementById('personForm');
        const photoPreview = document.getElementById('photoPreview');
        const data = {
            firstName: form.firstName.value.trim(),
            middleName: form.middleName.value.trim(),
            lastName: form.lastName.value.trim(),
            gender: form.gender.value,
            dateOfBirth: form.dateOfBirth.value,
            dateOfDeath: form.dateOfDeath.value,
            status: form.status.value,
            photo: photoPreview.src && photoPreview.style.display !== 'none' ? photoPreview.src : null,
            location: form.location.value.trim(),
            occupation: form.occupation.value.trim(),
            notes: form.notes.value.trim()
        };

        if (!data.firstName && !data.lastName) {
            alert('Please enter at least a first or last name.');
            return;
        }

        const app = this.app;
        const isEdit = form.dataset.personId;

        if (isEdit) {
            app.history.push(app.state.getSnapshot());
            app.state.updatePerson(isEdit, data);
        } else {
            const before = app.state.getSnapshot();
            const person = FF.Family.saveNewPerson(app.state, data, form);
            if (!person) return;               // you chose to cancel
            app.history.push(before);
            app.state.selectedPersonIds = [person.id];
        }

        this.hideModal();
        app.save(true);
        app.render();
    }

    showDetails(personId) {
        const person = this.app.state.getPerson(personId);
        if (!person) return;

        const panel = document.getElementById('personDetails');
        const rels = this.app.state.getPersonRelationships(personId);

        let relationshipsHtml = '';
        rels.forEach(r => {
            let otherId, relation;
            if (r.type === 'parentChild' || r.type === 'adoption' || r.type === 'stepParent' || r.type === 'stepChild') {
                if (r.parent === personId) {
                    otherId = r.child;
                    relation = r.type === 'parentChild' ? 'Child' : r.type === 'adoption' ? 'Adopted Child' : 'Step Child';
                } else {
                    otherId = r.parent;
                    relation = r.type === 'parentChild' ? 'Parent' : r.type === 'adoption' ? 'Adoptive Parent' : 'Step Parent';
                }
            } else {
                otherId = r.personA === personId ? r.personB : r.personA;
                const info = FF.RelationshipColors[r.type];
                relation = info ? info.label : r.type;
            }
            const otherName = this.app.state.getPersonName(otherId);
            const statusText = r.status ? ` (${r.status})` : '';
            relationshipsHtml += `<div class="detail-rel-item"><span class="detail-rel-type">${FF.Utils.escapeHtml(relation)}</span><span class="detail-rel-name">${FF.Utils.escapeHtml(otherName)}${statusText}</span></div>`;
        });

        const fullName = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(' ');
        const birthYear = person.dateOfBirth ? FF.Utils.formatDate(person.dateOfBirth) : 'Unknown';
        const deathYear = person.dateOfDeath ? FF.Utils.formatDate(person.dateOfDeath) : '';
        const years = deathYear ? `${birthYear} – ${deathYear}` : person.status === 'living' ? `b. ${birthYear}` : birthYear;

        panel.innerHTML = `
            <div class="details-header">
                <h3>Person Details</h3>
                <button class="icon-btn" id="closeDetailsBtn" title="Close">&times;</button>
            </div>
            <div class="details-photo-section">
                ${person.photo ? `<img src="${person.photo}" alt="${FF.Utils.escapeHtml(fullName)}" class="details-photo">` : `<div class="details-photo-placeholder">${(person.firstName || '?')[0].toUpperCase()}</div>`}
            </div>
            <div class="details-body">
                <h4 class="details-name">${FF.Utils.escapeHtml(fullName)}</h4>
                <p class="details-years">${years}</p>
                ${person.status === 'deceased' ? '<span class="deceased-badge">Deceased</span>' : ''}
                ${person.gender !== 'other' ? `<p class="detail-field"><span class="detail-label">Gender:</span> ${person.gender.charAt(0).toUpperCase() + person.gender.slice(1)}</p>` : ''}
                ${person.location ? `<p class="detail-field"><span class="detail-label">Location:</span> ${FF.Utils.escapeHtml(person.location)}</p>` : ''}
                ${person.occupation ? `<p class="detail-field"><span class="detail-label">Occupation:</span> ${FF.Utils.escapeHtml(person.occupation)}</p>` : ''}
                ${person.notes ? `<p class="detail-field"><span class="detail-label">Notes:</span> ${FF.Utils.escapeHtml(person.notes)}</p>` : ''}
                ${relationshipsHtml ? `
                    <div class="detail-relations-section">
                        <h5>Relationships</h5>
                        ${relationshipsHtml}
                    </div>
                ` : ''}
                <div class="details-actions">
                    <button class="btn btn-primary" id="editPersonBtn">Edit Person</button>
                    <button class="btn btn-danger" id="deletePersonBtn">Delete Person</button>
                </div>
            </div>
        `;

        panel.classList.add('active');

        document.getElementById('closeDetailsBtn').onclick = () => this.hideDetails();
        document.getElementById('editPersonBtn').onclick = () => {
            this.showAddModal(person);
        };
        document.getElementById('deletePersonBtn').onclick = () => {
            if (confirm(`Delete ${FF.Utils.escapeHtml(fullName)}? This will also remove all their relationships.`)) {
                this.app.history.push(this.app.state.getSnapshot());
                this.app.state.deletePerson(personId);
                this.hideDetails();
                this.app.save(true);
                this.app.render();
            }
        };
    }

    hideDetails() {
        document.getElementById('personDetails').classList.remove('active');
        this.app.state.selectedPersonIds = [];
        this.app.render();
    }

    updateMembersList() {
        const list = document.getElementById('membersList');
        const people = this.app.state.people;
        list.innerHTML = '';
        people.forEach(p => {
            const div = document.createElement('div');
            div.className = 'member-item';
            div.dataset.id = p.id;
            const initials = ((p.firstName || '')[0] || '') + ((p.lastName || '')[0] || '');
            div.innerHTML = `
                <div class="member-avatar">${initials.toUpperCase() || '?'}</div>
                <span class="member-name">${FF.Utils.escapeHtml([p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed')}</span>
                ${p.status === 'deceased' ? '<span class="member-deceased">✝</span>' : ''}
            `;
            div.onclick = () => {
                this.app.state.selectedPersonIds = [p.id];
                const pos = this.app.state.getPosition(p.id);
                if (pos) {
                    this.app.canvas.centerOn(pos.x + 90, pos.y + 70);
                }
                this.showDetails(p.id);
                this.app.render();
            };
            list.appendChild(div);
        });
    }
};
