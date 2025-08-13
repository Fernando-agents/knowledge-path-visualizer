/*
 * Knowledge Path Visualizer
 *
 * This script builds an interactive graph using D3.js.  Nodes represent
 * learning topics with dependencies and a progress level.  Clicking an
 * unlocked node opens a modal where you can view details and update
 * progress.  Progress is persisted to localStorage.
 */

// Example data set.  Feel free to extend or modify this object to suit
// your curriculum.  Each node defines an id, a display title, a
// description (Markdown or plain text), an array of dependency ids and
// an initial progress level.  The `dependencies` field declares which
// topics must reach at least 75 % before this one is unlocked.
const knowledgeGraph = {
  nodes: [
    {
      id: 'basics',
      title: 'Programming Fundamentals',
      description:
        'Learn variables, control flow, functions and the building blocks of code.',
      dependencies: [],
      progress: 0,
    },
    {
      id: 'datastructures',
      title: 'Data Structures',
      description:
        'Study arrays, lists, stacks, queues, trees and more.  Knowing how data is organised is essential.',
      dependencies: ['basics'],
      progress: 0,
    },
    {
      id: 'algorithms',
      title: 'Algorithms',
      description:
        'Explore sorting, searching and other fundamental algorithms.  Learn to reason about complexity.',
      dependencies: ['basics'],
      progress: 0,
    },
    {
      id: 'graphs',
      title: 'Graph Theory',
      description:
        'Understand nodes and edges, traversal algorithms and shortest paths.',
      dependencies: ['datastructures', 'algorithms'],
      progress: 0,
    },
    {
      id: 'machinelearning',
      title: 'Machine Learning',
      description:
        'Dive into supervised and unsupervised learning, regression, classification and neural networks.',
      dependencies: ['algorithms'],
      progress: 0,
    },
  ],
  links: [],
};

// Build links array based on dependencies.  Each dependency becomes a link
// from the prerequisite to this node.  We avoid generating duplicate links.
knowledgeGraph.links = knowledgeGraph.nodes.flatMap((node) =>
  node.dependencies.map((dep) => ({ source: dep, target: node.id }))
);

// Map for quick lookup by id
const nodeMap = new Map();
knowledgeGraph.nodes.forEach((n) => {
  nodeMap.set(n.id, n);
});

// Restore persisted progress from localStorage.  Progress is saved under
// `kpv-progress-{id}` keys.  Only update if a value is stored.
function loadProgress() {
  knowledgeGraph.nodes.forEach((node) => {
    const stored = localStorage.getItem(`kpv-progress-${node.id}`);
    if (stored !== null) {
      node.progress = parseInt(stored, 10);
    }
  });
}

// Save progress back to localStorage
function saveProgress(node) {
  localStorage.setItem(`kpv-progress-${node.id}`, String(node.progress));
}

// Determine whether each node is unlocked based on dependencies.  A node is
// unlocked if every dependency has progress ≥ 75 %.  Nodes with no
// dependencies are always unlocked.
function computeUnlocks() {
  knowledgeGraph.nodes.forEach((node) => {
    if (!node.dependencies || node.dependencies.length === 0) {
      node.unlocked = true;
    } else {
      node.unlocked = node.dependencies.every((depId) => {
        const depNode = nodeMap.get(depId);
        return depNode && depNode.progress >= 75;
      });
    }
  });
}

// Given a progress value, return a fill colour.  Colours transition
// gradually from dark navy to light gold as progress increases.  We use
// interpolated values to approximate the Civ VI palette.
function progressColor(progress) {
  const stops = [
    { p: 0, color: [10, 26, 47] }, // dark navy
    { p: 25, color: [32, 55, 93] }, // navy blue
    { p: 50, color: [62, 88, 145] }, // medium blue
    { p: 75, color: [97, 122, 180] }, // light blue
    { p: 100, color: [255, 215, 0] }, // gold
  ];
  // Find two stops surrounding progress
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (progress >= stops[i].p && progress <= stops[i + 1].p) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const ratio =
    lower.p === upper.p
      ? 0
      : (progress - lower.p) / (upper.p - lower.p);
  const interp = lower.color.map((c, i) => {
    return Math.round(c + (upper.color[i] - c) * ratio);
  });
  return `rgb(${interp[0]}, ${interp[1]}, ${interp[2]})`;
}

// Build the graph once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadProgress();
  computeUnlocks();
  renderGraph();
});

function renderGraph() {
  const container = document.getElementById('graph-container');
  // Remove any existing SVG
  container.innerHTML = '';

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3
    .select('#graph-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  const linkGroup = svg.append('g').attr('class', 'link');
  const nodeGroup = svg.append('g');

  const simulation = d3
    .forceSimulation(knowledgeGraph.nodes)
    .force(
      'link',
      d3
        .forceLink(knowledgeGraph.links)
        .id((d) => d.id)
        .distance(160)
        .strength(0.1)
    )
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(60));

  // Draw links
  const links = linkGroup
    .selectAll('line')
    .data(knowledgeGraph.links)
    .enter()
    .append('line');

  // Draw nodes
  const nodes = nodeGroup
    .selectAll('g')
    .data(knowledgeGraph.nodes)
    .enter()
    .append('g')
    .attr('class', (d) => (d.unlocked ? 'node' : 'node locked'))
    .on('click', (event, d) => {
      if (d.unlocked) {
        openModal(d);
      }
    })
    .call(
      d3
        .drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

  // Node rectangles
  nodes
    .append('rect')
    .attr('x', -50)
    .attr('y', -20)
    .attr('width', 100)
    .attr('height', 40)
    .attr('fill', (d) => progressColor(d.progress));

  // Node text (title)
  nodes
    .append('text')
    .attr('dy', '0.35em')
    .text((d) => d.title)
    .style('pointer-events', 'none');

  // Simulation update
  simulation.on('tick', () => {
    // Link positions
    links
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    // Node positions
    nodes.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // Cache toggle elements
  const toggleLinksCheckbox = document.getElementById('toggle-links');
  const toggleCompletedCheckbox = document.getElementById('toggle-completed');
  const toggleActiveCheckbox = document.getElementById('toggle-active');

  // Apply current filters to nodes.  Nodes are hidden if they fall into
  // a category that is toggled off.  For example, completed nodes are
  // hidden when "Show completed" is unchecked and active nodes
  // (progress < 100) are hidden when "Show active" is unchecked.
  function applyFilters() {
    const activeChecked = toggleActiveCheckbox.checked;
    const completedChecked = toggleCompletedCheckbox.checked;
    nodeGroup
      .selectAll('g')
      .classed('hidden', (d) => {
        return (!completedChecked && d.progress >= 100) ||
               (!activeChecked && d.progress < 100);
      });
  }

  // Toggle link visibility using a class on the SVG root
  toggleLinksCheckbox.addEventListener('change', () => {
    svg.classed('hidden-links', !toggleLinksCheckbox.checked);
  });
  // Apply filters whenever the active/completed toggles change
  toggleActiveCheckbox.addEventListener('change', applyFilters);
  toggleCompletedCheckbox.addEventListener('change', applyFilters);
  // Apply filters once on initial render
  applyFilters();
}

// Open modal with node details
function openModal(node) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const descEl = document.getElementById('modal-description');
  const depsList = document.getElementById('modal-deps');
  const select = document.getElementById('modal-progress');

  titleEl.textContent = node.title;
  descEl.textContent = node.description;
  // Populate dependencies list
  depsList.innerHTML = '';
  if (node.dependencies.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'None';
    depsList.appendChild(li);
  } else {
    node.dependencies.forEach((depId) => {
      const depNode = nodeMap.get(depId);
      const li = document.createElement('li');
      if (depNode) {
        li.textContent = `${depNode.title} – ${depNode.progress}%`;
      } else {
        li.textContent = depId;
      }
      depsList.appendChild(li);
    });
  }
  // Set select value to current progress
  select.value = String(node.progress);

  // Save node reference for update
  select.onchange = () => {
    const newVal = parseInt(select.value, 10);
    node.progress = newVal;
    saveProgress(node);
    computeUnlocks();
    overlay.classList.add('hidden');
    renderGraph();
  };

  overlay.classList.remove('hidden');

  // Close button
  const closeBtn = document.getElementById('modal-close');
  closeBtn.onclick = () => {
    overlay.classList.add('hidden');
  };
  // Hide overlay when clicking outside modal
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  };
}
