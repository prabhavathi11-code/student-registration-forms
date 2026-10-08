// Admin Dashboard Controller
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Route Protection: Only Admin can access
  const currentUser = API.requireAuth('admin');
  if (!currentUser) return;

  // Set admin name in navbar
  const adminDisplayName = document.getElementById('adminDisplayName');
  if (adminDisplayName && currentUser.name) {
    adminDisplayName.textContent = currentUser.name;
  }

  // Logout handler
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    API.clearSession();
    window.location.href = 'login.html';
  });

  // State
  let allStudents = [];
  let pendingDeleteId = null;

  // DOM Elements
  const tableBody = document.getElementById('studentTableBody');
  const noResults = document.getElementById('noResultsState');
  const filterName = document.getElementById('filterName');
  const filterClass = document.getElementById('filterClass');
  const filterMinAge = document.getElementById('filterMinAge');
  const filterMaxAge = document.getElementById('filterMaxAge');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const adminAlertContainer = document.getElementById('adminAlertContainer');

  // Stats Elements
  const statTotal = document.getElementById('statTotalStudents');
  const statFiltered = document.getElementById('statFilteredStudents');
  const statClasses = document.getElementById('statClasses');
  const statAvgMarks = document.getElementById('statAvgMarks');

  // Modals
  const editModalEl = document.getElementById('editStudentModal');
  const editModal = new bootstrap.Modal(editModalEl);
  const deleteModalEl = document.getElementById('deleteStudentModal');
  const deleteModal = new bootstrap.Modal(deleteModalEl);
  const pdfModalEl = document.getElementById('pdfViewerModal');
  const pdfModal = new bootstrap.Modal(pdfModalEl);

  function showAlert(msg, type = 'success') {
    adminAlertContainer.className = type === 'success' ? 'alert-custom-success mb-3' : 'alert-custom-error mb-3';
    adminAlertContainer.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}-fill me-2"></i> ${msg}`;
    setTimeout(() => {
      adminAlertContainer.className = 'mb-3 d-none';
    }, 4000);
  }

  // Load students from API
  async function loadStudents() {
    try {
      allStudents = await API.getStudents();
      populateClassFilterOptions();
      applyFilters();
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="11" class="text-center text-danger py-4">Failed to load students: ${err.message}</td></tr>`;
    }
  }

  // Populate distinct classes in class filter dropdown
  function populateClassFilterOptions() {
    const classes = Array.from(new Set(allStudents.map(s => s.class).filter(Boolean))).sort();
    const currentVal = filterClass.value;
    filterClass.innerHTML = '<option value="">All Classes</option>';
    classes.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = cls;
      if (cls === currentVal) opt.selected = true;
      filterClass.appendChild(opt);
    });
  }

  // Instant Filtering Engine: Name, Class, Min Age, Max Age
  function applyFilters() {
    const nameQuery = filterName.value.trim().toLowerCase();
    const classQuery = filterClass.value.trim().toLowerCase();
    const minAge = filterMinAge.value !== '' ? parseInt(filterMinAge.value, 10) : null;
    const maxAge = filterMaxAge.value !== '' ? parseInt(filterMaxAge.value, 10) : null;

    const filtered = allStudents.filter(student => {
      // 1. Name Filter (case-insensitive substring)
      if (nameQuery && !student.name.toLowerCase().includes(nameQuery)) {
        return false;
      }

      // 2. Class Filter (exact or substring match)
      if (classQuery && student.class.toLowerCase() !== classQuery) {
        return false;
      }

      // Calculate Age from Date of Birth
      const age = API.calculateAge(student.dob);

      // 3. Min Age Filter
      if (minAge !== null && (age === null || age < minAge)) {
        return false;
      }

      // 4. Max Age Filter
      if (maxAge !== null && (age === null || age > maxAge)) {
        return false;
      }

      return true;
    });

    renderTable(filtered);
    updateStats(filtered);
  }

  function updateStats(filtered) {
    statTotal.textContent = allStudents.length;
    statFiltered.textContent = filtered.length;

    const distinctClasses = new Set(allStudents.map(s => s.class).filter(Boolean));
    statClasses.textContent = distinctClasses.size;

    if (allStudents.length > 0) {
      const totalMarks = allStudents.reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
      const avg = (totalMarks / allStudents.length).toFixed(1);
      statAvgMarks.textContent = `${avg}%`;
    } else {
      statAvgMarks.textContent = '0%';
    }
  }

  function renderTable(students) {
    if (students.length === 0) {
      tableBody.innerHTML = '';
      noResults.classList.remove('d-none');
      return;
    }

    noResults.classList.add('d-none');

    tableBody.innerHTML = students.map(student => {
      const age = API.calculateAge(student.dob);
      const ageDisplay = age !== null ? `${age} yrs` : 'N/A';
      const interestsArray = Array.isArray(student.interests) ? student.interests : [];
      const interestsHtml = interestsArray.length > 0
        ? interestsArray.map(i => `<span class="interest-badge">${escapeHtml(i)}</span>`).join('')
        : '<span class="text-muted small">None</span>';

      // Aadhaar PDF URL resolution
      let pdfUrl = '#';
      if (student.aadhaarDataUrl) {
        pdfUrl = student.aadhaarDataUrl;
      } else if (student.aadhaarPath) {
        pdfUrl = `uploads/${student.aadhaarPath}`;
      }

      return `
        <tr id="student-row-${student.id}">
          <td class="fw-bold text-secondary">#${student.id}</td>
          <td>
            <div class="fw-bold text-dark">${escapeHtml(student.name)}</div>
          </td>
          <td><span class="text-muted">${escapeHtml(student.email)}</span></td>
          <td>
            <div><strong>${ageDisplay}</strong></div>
            <div class="text-muted small">${student.dob || 'N/A'}</div>
          </td>
          <td><span class="badge bg-light text-dark border">${escapeHtml(student.gender || 'Other')}</span></td>
          <td><span class="small">${escapeHtml(student.qualification || 'N/A')}</span></td>
          <td><span class="badge bg-primary-subtle text-primary border border-primary-subtle">${escapeHtml(student.class || 'N/A')}</span></td>
          <td>
            <div class="fw-semibold">${escapeHtml(student.subject || 'N/A')}</div>
            <div class="text-success small fw-bold">${student.marks}%</div>
          </td>
          <td style="max-width: 180px;">${interestsHtml}</td>
          <td>
            <button class="btn-pdf view-pdf-btn" data-url="${pdfUrl}" data-name="${escapeHtml(student.name)}">
              <i class="bi bi-file-earmark-pdf-fill"></i> View PDF
            </button>
          </td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary edit-btn" data-id="${student.id}" title="Edit Student">
                <i class="bi bi-pencil"></i> Edit
              </button>
              <button class="btn btn-outline-danger delete-btn" data-id="${student.id}" data-name="${escapeHtml(student.name)}" title="Delete Student">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // Event Listeners for Instant Filters
  filterName.addEventListener('input', applyFilters);
  filterClass.addEventListener('change', applyFilters);
  filterMinAge.addEventListener('input', applyFilters);
  filterMaxAge.addEventListener('input', applyFilters);

  resetFiltersBtn.addEventListener('click', () => {
    filterName.value = '';
    filterClass.value = '';
    filterMinAge.value = '';
    filterMaxAge.value = '';
    applyFilters();
  });

  // Table Action Delegation
  tableBody.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      const id = editBtn.getAttribute('data-id');
      openEditModal(id);
      return;
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const name = deleteBtn.getAttribute('data-name');
      openDeleteModal(id, name);
      return;
    }

    const pdfBtn = e.target.closest('.view-pdf-btn');
    if (pdfBtn) {
      const url = pdfBtn.getAttribute('data-url');
      const name = pdfBtn.getAttribute('data-name');
      openPdfViewer(url, name);
      return;
    }
  });

  // Open PDF Viewer Modal
  function openPdfViewer(url, studentName) {
    document.getElementById('pdfViewerModalLabel').innerHTML = `<i class="bi bi-file-earmark-pdf-fill text-danger me-2"></i>Aadhaar Document: ${studentName}`;
    document.getElementById('pdfViewerFrame').src = url;
    document.getElementById('pdfOpenNewTabBtn').href = url;
    pdfModal.show();
  }

  // Clear iframe on modal hide to release memory
  pdfModalEl.addEventListener('hidden.bs.modal', () => {
    document.getElementById('pdfViewerFrame').src = '';
  });

  // Open Edit Modal with strictly LOCKED Name and Email
  async function openEditModal(id) {
    try {
      const student = await API.getStudentById(id);
      document.getElementById('editStudentId').value = student.id;

      // CRITICAL REQUIREMENT: Name and Email must stay locked/uneditable
      const nameInput = document.getElementById('editName');
      const emailInput = document.getElementById('editEmail');
      nameInput.value = student.name;
      emailInput.value = student.email;
      nameInput.disabled = true;
      nameInput.readOnly = true;
      emailInput.disabled = true;
      emailInput.readOnly = true;

      // Editable fields
      document.getElementById('editDob').value = student.dob || '';
      
      const genderRadios = document.querySelectorAll('input[name="editGender"]');
      genderRadios.forEach(r => {
        r.checked = r.value === student.gender;
      });

      document.getElementById('editQualification').value = student.qualification || '';
      document.getElementById('editClass').value = student.class || '';
      document.getElementById('editSubject').value = student.subject || '';
      document.getElementById('editMarks').value = student.marks || 0;

      // Interests checkboxes
      const interests = Array.isArray(student.interests) ? student.interests : [];
      document.querySelectorAll('.edit-interest-cb').forEach(cb => {
        cb.checked = interests.includes(cb.value);
      });

      editModal.show();
    } catch (err) {
      showAlert('Failed to fetch student details: ' + err.message, 'error');
    }
  }

  // Handle Edit Form Submission (Admin)
  document.getElementById('editStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editStudentId').value;
    const saveBtn = document.getElementById('saveEditBtn');

    // Collect updated interests
    const selectedInterests = [];
    document.querySelectorAll('.edit-interest-cb:checked').forEach(cb => {
      selectedInterests.push(cb.value);
    });

    const updateData = {
      dob: document.getElementById('editDob').value,
      gender: document.querySelector('input[name="editGender"]:checked')?.value || 'Other',
      qualification: document.getElementById('editQualification').value,
      interests: selectedInterests,
      class: document.getElementById('editClass').value.trim(),
      subject: document.getElementById('editSubject').value.trim(),
      marks: document.getElementById('editMarks').value
      // Note: Name and Email are NOT sent, preserving locked status
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    try {
      await API.updateStudent(id, updateData, null, 'admin');
      editModal.hide();
      showAlert('Student record updated successfully (Name and Email remained locked)!');
      await loadStudents();
    } catch (err) {
      showAlert('Failed to update student: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save Changes';
    }
  });

  // Open Delete Confirmation Modal
  function openDeleteModal(id, name) {
    pendingDeleteId = id;
    document.getElementById('deleteStudentName').textContent = name;
    document.getElementById('deleteStudentId').textContent = id;
    deleteModal.show();
  }

  // Confirm Delete Button Handler
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';

    try {
      await API.deleteStudent(pendingDeleteId);
      deleteModal.hide();
      showAlert(`Student #${pendingDeleteId} has been successfully deleted.`);
      pendingDeleteId = null;
      await loadStudents();
    } catch (err) {
      showAlert('Failed to delete student: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-trash me-1"></i> Delete Record';
    }
  });

  // Initial Data Load
  await loadStudents();
});
