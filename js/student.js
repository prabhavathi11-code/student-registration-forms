// Student Dashboard Controller
document.addEventListener('DOMContentLoaded', async () => {
  // Route Protection: Student only
  const sessionUser = API.requireAuth('student');
  if (!sessionUser) return;

  const userEmailNav = document.getElementById('userEmailNav');
  if (userEmailNav) userEmailNav.textContent = sessionUser.email;

  // Logout button
  document.getElementById('studentLogoutBtn')?.addEventListener('click', () => {
    API.clearSession();
    window.location.href = 'login.html';
  });

  const alertContainer = document.getElementById('studentAlertContainer');
  const editModalEl = document.getElementById('editProfileModal');
  const editModal = new bootstrap.Modal(editModalEl);
  const editForm = document.getElementById('studentEditForm');
  const fileInput = document.getElementById('stdEditAadhaar');
  const fileError = document.getElementById('stdFileError');
  const saveBtn = document.getElementById('saveStdProfileBtn');

  let currentStudentData = null;

  function showAlert(msg, type = 'success') {
    alertContainer.className = type === 'success' ? 'alert-custom-success mb-4' : 'alert-custom-error mb-4';
    alertContainer.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}-fill me-2"></i> ${msg}`;
    setTimeout(() => {
      alertContainer.className = 'mb-4 d-none';
    }, 4000);
  }

  // Load and Render Student Profile
  async function loadProfile() {
    try {
      currentStudentData = await API.getStudentById(sessionUser.id);
      renderProfile(currentStudentData);
    } catch (err) {
      showAlert('Failed to load profile details: ' + err.message, 'error');
    }
  }

  function renderProfile(student) {
    // Exact Required Banner Format: "Welcome, [User Name] (User ID: #[ID])"
    document.getElementById('welcomeBannerText').textContent = `Welcome, ${student.name} (User ID: #${student.id})`;

    document.getElementById('dispName').textContent = student.name || 'N/A';
    document.getElementById('dispEmail').textContent = student.email || 'N/A';
    document.getElementById('dispDob').textContent = student.dob || 'N/A';

    const age = API.calculateAge(student.dob);
    document.getElementById('dispAge').textContent = age !== null ? `${age} years old` : 'N/A';

    document.getElementById('dispGender').textContent = student.gender || 'N/A';
    document.getElementById('dispQualification').textContent = student.qualification || 'N/A';
    document.getElementById('dispClass').textContent = student.class || 'N/A';
    document.getElementById('dispSubject').textContent = student.subject || 'N/A';
    document.getElementById('dispMarks').textContent = `${student.marks || 0}%`;

    // Aadhaar Link
    const aadhaarLink = document.getElementById('dispAadhaarLink');
    if (student.aadhaarDataUrl) {
      aadhaarLink.href = student.aadhaarDataUrl;
    } else if (student.aadhaarPath) {
      aadhaarLink.href = `uploads/${student.aadhaarPath}`;
    } else {
      aadhaarLink.href = '#';
    }

    // Interests
    const dispInterests = document.getElementById('dispInterests');
    const interests = Array.isArray(student.interests) ? student.interests : [];
    if (interests.length > 0) {
      dispInterests.innerHTML = interests.map(i => `<span class="interest-badge">${escapeHtml(i)}</span>`).join('');
    } else {
      dispInterests.innerHTML = '<span class="text-muted small">No interests recorded</span>';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // File validation for replacement Aadhaar
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      if (!isPdf) {
        fileInput.classList.add('is-invalid');
        fileError.classList.remove('d-none');
      } else {
        fileInput.classList.remove('is-invalid');
        fileError.classList.add('d-none');
      }
    } else {
      fileInput.classList.remove('is-invalid');
      fileError.classList.add('d-none');
    }
  });

  // Populate Edit Modal
  document.getElementById('openEditProfileBtn').addEventListener('click', () => {
    if (!currentStudentData) return;

    document.getElementById('stdEditName').value = currentStudentData.name || '';
    
    // EMAIL IS STRICTLY LOCKED / UNEDITABLE
    const emailInput = document.getElementById('stdEditEmail');
    emailInput.value = currentStudentData.email || '';
    emailInput.disabled = true;
    emailInput.readOnly = true;

    document.getElementById('stdEditDob').value = currentStudentData.dob || '';

    const genderRadios = document.querySelectorAll('input[name="stdEditGender"]');
    genderRadios.forEach(r => {
      r.checked = r.value === currentStudentData.gender;
    });

    document.getElementById('stdEditQualification').value = currentStudentData.qualification || '';
    document.getElementById('stdEditClass').value = currentStudentData.class || '';
    document.getElementById('stdEditSubject').value = currentStudentData.subject || '';
    document.getElementById('stdEditMarks').value = currentStudentData.marks || 0;

    const interests = Array.isArray(currentStudentData.interests) ? currentStudentData.interests : [];
    document.querySelectorAll('.std-interest-cb').forEach(cb => {
      cb.checked = interests.includes(cb.value);
    });

    fileInput.value = '';
    fileInput.classList.remove('is-invalid');
    fileError.classList.add('d-none');
  });

  // Handle Profile Update Submission
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    if (file) {
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
      if (!isPdf) {
        fileInput.classList.add('is-invalid');
        fileError.classList.remove('d-none');
        return;
      }
    }

    const selectedInterests = [];
    document.querySelectorAll('.std-interest-cb:checked').forEach(cb => {
      selectedInterests.push(cb.value);
    });

    const updateData = {
      name: document.getElementById('stdEditName').value.trim(),
      // Email is excluded from update
      dob: document.getElementById('stdEditDob').value,
      gender: document.querySelector('input[name="stdEditGender"]:checked')?.value || 'Other',
      qualification: document.getElementById('stdEditQualification').value,
      interests: selectedInterests,
      class: document.getElementById('stdEditClass').value.trim(),
      subject: document.getElementById('stdEditSubject').value.trim(),
      marks: document.getElementById('stdEditMarks').value
    };

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

    try {
      const res = await API.updateStudent(sessionUser.id, updateData, file, 'student');
      editModal.hide();
      showAlert('Profile and Aadhaar document updated successfully!');
      
      // Update session if name changed
      if (updateData.name) {
        sessionUser.name = updateData.name;
        API.setSession(sessionUser);
      }

      await loadProfile();
    } catch (err) {
      showAlert('Failed to update profile: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Update Profile';
    }
  });

  // Initial Load
  await loadProfile();
});
