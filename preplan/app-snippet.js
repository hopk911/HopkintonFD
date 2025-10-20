// Drop-in snippet for your main page to open the editor in a new tab.
// Call this when rendering your Actions column for each DataTable row.
function actionButtons(row) {
  // Prefer a stable key if you have one (e.g., row.ID). Fallback to row._rowNumber set by your listing endpoint.
  const key = row.ID || row._rowNumber;
  return `
    <button class="btn btn-sm" onclick="window.open('edit.html?key=${encodeURIComponent(key)}', '_blank')">
      Edit
    </button>
  `;
}

// If your table build path differs, you can also attach like so:
// document.addEventListener('click', (e) => {
//   const btn = e.target.closest('[data-edit-key]');
//   if (!btn) return;
//   const key = btn.getAttribute('data-edit-key');
//   window.open('edit.html?key=' + encodeURIComponent(key), '_blank');
// });
