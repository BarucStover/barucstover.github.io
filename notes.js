const grid = document.getElementById("notes-grid");
const searchInput = document.getElementById("notes-search");

let researchNotes = [];

function renderNotes(query = "") {
  if (!grid) return;

  grid.replaceChildren();

  const matching = researchNotes.filter(note =>
    [note.title, note.category, note.description, note.status]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  if (matching.length === 0) {
    grid.textContent = "No matching research notes found.";
    return;
  }

  matching.forEach(note => {
    const card = document.createElement("article");
    card.className = "note-card";

    const category = document.createElement("span");
    category.className = "note-category";
    category.textContent = note.category;

    const title = document.createElement("h3");
    title.textContent = note.title;

    const description = document.createElement("p");
    description.textContent = note.description;

    const footer = document.createElement("div");
    footer.className = "note-footer";

    const date = document.createElement("time");
    date.dateTime = note.date;
    date.textContent = note.date;

    const status = document.createElement("span");
    status.textContent = note.status;

    footer.append(date, status);
    card.append(category, title, description, footer);
    grid.append(card);
  });
}

async function loadNotes() {
  if (!grid) return;

  try {
    const response = await fetch("notes.json");

    if (!response.ok) {
      throw new Error("Unable to load notes");
    }

    researchNotes = await response.json();

    researchNotes.sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    renderNotes();
  } catch (error) {
    grid.textContent = "Research notes could not be loaded.";
    console.error(error);
  }
}

searchInput?.addEventListener("input", event => {
  renderNotes(event.target.value);
});

loadNotes();
