const hypothesisGrid = document.getElementById("hypothesis-grid");
const hypothesisSearch = document.getElementById("hypothesis-search");
const hypothesisFilter = document.getElementById("hypothesis-filter");

let hypotheses = [];

function createTextElement(tag, className, value) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function addHypothesisField(container, label, value) {
  const field = document.createElement("div");
  field.className = "hypothesis-field";

  field.append(
    createTextElement("h4", "", label),
    createTextElement("p", "", value)
  );

  container.append(field);
}

function renderHypotheses() {
  if (!hypothesisGrid) return;

  const query = hypothesisSearch.value.toLowerCase().trim();
  const filter = hypothesisFilter.value;

  const filtered = hypotheses.filter(item => {
    const searchable = [
      item.title,
      item.question,
      item.category,
      item.evidence,
      item.hypothesis,
      item.alternatives,
      item.tests
    ].join(" ").toLowerCase();

    return searchable.includes(query) &&
      (filter === "all" || item.status === filter);
  });

  hypothesisGrid.replaceChildren();

  if (filtered.length === 0) {
    hypothesisGrid.textContent = "No matching research questions.";
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "hypothesis-card";

    const metadata = document.createElement("div");
    metadata.className = "hypothesis-meta";

    metadata.append(
      createTextElement("span", "hypothesis-id", item.id),
      createTextElement("span", "hypothesis-status", item.status)
    );

    const category = createTextElement(
      "span", "hypothesis-category", item.category
    );

    const title = createTextElement("h3", "", item.title);
    const question = createTextElement(
      "p", "hypothesis-question", item.question
    );

    const details = document.createElement("details");
    details.className = "hypothesis-details";

    const summary = createTextElement(
      "summary", "", "Explore scientific reasoning"
    );

    const content = document.createElement("div");
    content.className = "hypothesis-content";

    addHypothesisField(content, "Existing Evidence", item.evidence);
    addHypothesisField(content, "Working Hypothesis", item.hypothesis);
    addHypothesisField(content, "Alternative Explanations", item.alternatives);
    addHypothesisField(content, "Proposed Tests", item.tests);
    addHypothesisField(content, "Limitations", item.limitations);

    const updated = createTextElement(
      "p", "hypothesis-updated", "Updated: " + item.updated
    );

    details.append(summary, content);
    card.append(metadata, category, title, question, details, updated);

    hypothesisGrid.append(card);
  });
}

async function loadHypotheses() {
  if (!hypothesisGrid) return;

  try {
    const response = await fetch("hypotheses.json");

    if (!response.ok) {
      throw new Error("Unable to load hypotheses");
    }

    hypotheses = await response.json();

    renderHypotheses();
  } catch (error) {
    hypothesisGrid.textContent = "Unable to load research questions.";
    console.error(error);
  }
}

hypothesisSearch?.addEventListener("input", renderHypotheses);
hypothesisFilter?.addEventListener("change", renderHypotheses);

loadHypotheses();
