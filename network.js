const researchTopics = {
  genetics: {
    title: "Molecular Genetics",
    description:
      "Investigating how genes and biochemical pathways contribute " +
      "to biological function, including experimental approaches " +
      "to studying fungal siderophore biosynthesis."
  },

  evolution: {
    title: "Microbial Evolution",
    description:
      "Exploring how microbial functions originate, diversify, " +
      "and persist across evolutionary time, including the " +
      "evolutionary history of iron acquisition systems."
  },

  genomics: {
    title: "Computational Genomics",
    description:
      "Using sequence analysis, comparative genomics, and " +
      "bioinformatics to identify genes, characterize " +
      "biological pathways, and investigate genomic variation."
  },

  experimental: {
    title: "Experimental Evolution",
    description:
      "Investigating evolutionary responses through controlled " +
      "experiments, with particular interests in bacteriophage " +
      "adaptation and genomic change."
  },

  modeling: {
    title: "Predictive Modeling",
    description:
      "A long-term research direction focused on developing " +
      "computational approaches to predict how molecular " +
      "variation and perturbations influence biological systems."
  }
};

const topicButtons = document.querySelectorAll(".network-node");
const topicTitle = document.getElementById("network-title");
const topicDescription = document.getElementById("network-description");

topicButtons.forEach(button => {
  button.addEventListener("click", () => {
    const topic = researchTopics[button.dataset.topic];

    if (!topic || !topicTitle || !topicDescription) return;

    topicButtons.forEach(node => {
      node.classList.remove("active");
      node.setAttribute("aria-pressed", "false");
    });

    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");

    topicTitle.textContent = topic.title;
    topicDescription.textContent = topic.description;
  });
});
