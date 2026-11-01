(function () {
    const $ = (id) => document.getElementById(id);

    document.addEventListener('DOMContentLoaded', () => {
        const modal = $('personModal');
        const form = $('personForm');
        const siblingRows = $('siblingRows');
        const childRows = $('childRows');

        // Keep a clean copy of each row so we can add more
        const siblingTemplate = siblingRows.firstElementChild.cloneNode(true);
        const childTemplate = childRows.firstElementChild.cloneNode(true);

        const ageHint = form.age.closest('.form-row').nextElementSibling;
        const defaultHint = ageHint.textContent;

        // ---------- Repeating rows (siblings, children) ----------
        function addRow(container, template) {
            const row = template.cloneNode(true);
            container.appendChild(row);
            const first = row.querySelector('input');
            if (first) first.focus();
        }

        function clearRow(row) {
            row.querySelectorAll('input').forEach(i => (i.value = ''));
            row.querySelectorAll('select').forEach(s => (s.selectedIndex = 0));
        }

        function resetRows(container, template) {
            container.innerHTML = '';
            container.appendChild(template.cloneNode(true));
        }

        function handleRemove(container) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('.row-remove');
                if (!btn) return;
                const row = btn.closest('.repeat-row');
                if (container.children.length > 1) row.remove();
                else clearRow(row);
            });
        }

        $('addSiblingBtn').onclick = () => addRow(siblingRows, siblingTemplate);
        $('addChildBtn').onclick = () => addRow(childRows, childTemplate);
        handleRemove(siblingRows);
        handleRemove(childRows);

        // ---------- Show / hide fields ----------
        function updateVisibility() {
            const deceased = form.status.value === 'deceased';
            form.dateOfDeath.closest('.form-group').classList.toggle('form-hidden', !deceased);

            const notSingle = form.maritalStatus.value !== 'single';
            form.spouseName.closest('.form-group').classList.toggle('form-hidden', !notSingle);

            form.fatherName.classList.toggle('form-hidden', !!form.fatherId.value);
            form.motherName.classList.toggle('form-hidden', !!form.motherId.value);
        }

        // ---------- Age and date of birth ----------
        function calcAge(dobStr, refStr) {
            const dob = new Date(dobStr);
            if (isNaN(dob)) return '';
            const ref = refStr ? new Date(refStr) : new Date();
            let age = ref.getFullYear() - dob.getFullYear();
            const m = ref.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
            return age >= 0 ? age : '';
        }

        function updateAge() {
            const dob = form.dateOfBirth.value;
            if (dob) {
                const deceasedRef = form.status.value === 'deceased' ? form.dateOfDeath.value : '';
                form.age.value = calcAge(dob, deceasedRef);
                form.age.readOnly = true;
                ageHint.textContent = 'Age is worked out from the date of birth.';
            } else {
                form.age.readOnly = false;
                const age = parseInt(form.age.value, 10);
                if (!isNaN(age) && age >= 0) {
                    ageHint.textContent = 'Estimated birth year: ' + (new Date().getFullYear() - age);
                } else {
                    ageHint.textContent = defaultHint;
                }
            }
        }

        // ---------- Father / Mother dropdowns ----------
        function populateParents() {
            const app = window.familyFlowApp;
            if (!app) return;
            [form.fatherId, form.motherId].forEach(select => {
                const keep = select.value;
                select.innerHTML = '';
                const none = document.createElement('option');
                none.value = '';
                none.textContent = 'Not in the list';
                select.appendChild(none);
                app.state.people.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = app.state.getPersonName(p.id);
                    select.appendChild(opt);
                });
                select.value = keep;
            });
        }

        // ---------- Reset the new fields each time the form opens ----------
        function resetNewFields() {
            form.age.value = '';
            form.fatherId.value = '';
            form.fatherName.value = '';
            form.motherId.value = '';
            form.motherName.value = '';
            form.maritalStatus.value = 'single';
            form.spouseName.value = '';
            form.designation.value = '';
            form.company.value = '';
            resetRows(siblingRows, siblingTemplate);
            resetRows(childRows, childTemplate);
        }

        new MutationObserver(() => {
            if (!modal.classList.contains('active')) return;
            resetNewFields();
            populateParents();
            updateVisibility();
            updateAge();
        }).observe(modal, { attributes: true, attributeFilter: ['class'] });

        // ---------- Listeners ----------
        ['status', 'maritalStatus', 'fatherId', 'motherId'].forEach(n =>
            form[n].addEventListener('change', updateVisibility));
        form.status.addEventListener('change', updateAge);
        form.dateOfBirth.addEventListener('input', updateAge);
        form.dateOfDeath.addEventListener('input', updateAge);
        form.age.addEventListener('input', updateAge);
    });
})();