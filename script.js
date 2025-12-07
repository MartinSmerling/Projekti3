let workouts = [];

let workoutChart = null;

$(function () {
  
  renderWorkouts();
  updateSummary();
  renderChart();

  $("#workout-form").on("submit", function (e) {
    e.preventDefault();

    const date = $("#date").val();
    const type = $("#type").val();
    const duration = parseInt($("#duration").val(), 10);
    const intensity = $("#intensity").val();
    const notes = $("#notes").val().trim();

    if (!date || !type || !duration || !intensity) {
      return;
    }

    const workout = {
      date,
      type,
      duration,
      intensity,
      notes
    };

    workouts.push(workout);

    this.reset();

    renderWorkouts();
    updateSummary();
    renderChart();
  });

  $("#filter-type, #filter-intensity").on("change", function () {
    renderWorkouts();
    updateSummary();
    renderChart();
  });

  $("#clear-filters").on("click", function () {
    $("#filter-type").val("Kaikki");
    $("#filter-intensity").val("Kaikki");
    renderWorkouts();
    updateSummary();
    renderChart();
  });

  $("#workout-table tbody").on("click", ".btn-delete", function () {
    const index = $(this).data("index");
    workouts.splice(index, 1);
    renderWorkouts();
    updateSummary();
    renderChart();
  });
});

function getFilteredWorkouts() {
  const typeFilter = $("#filter-type").val();
  const intensityFilter = $("#filter-intensity").val();

  return workouts.filter((w) => {
    const matchType =
      typeFilter === "Kaikki" || w.type === typeFilter;
    const matchIntensity =
      intensityFilter === "Kaikki" || w.intensity === intensityFilter;
    return matchType && matchIntensity;
  });
}

function renderWorkouts() {
  const $tbody = $("#workout-table tbody");
  $tbody.empty();

  const filtered = getFilteredWorkouts();

  if (filtered.length === 0) {
    $tbody.append(
      `<tr><td colspan="6" class="text-center text-muted">Ei treenejä valituilla suodattimilla.</td></tr>`
    );
    return;
  }

  filtered.forEach((w, index) => {
    const intensityClass = `badge-${w.intensity}`;
    const notesText = w.notes || "-";

    const originalIndex = workouts.indexOf(w);

    const row = `
      <tr>
        <td>${w.date}</td>
        <td>${w.type}</td>
        <td>${w.duration}</td>
        <td>
          <span class="badge-intensity ${intensityClass}">
            ${w.intensity}
          </span>
        </td>
        <td>${notesText}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger btn-delete" data-index="${originalIndex}">
            Poista
          </button>
        </td>
      </tr>
    `;
    $tbody.append(row);
  });
}

function updateSummary() {
  const filtered = getFilteredWorkouts();

  const totalWorkouts = filtered.length;
  const totalMinutes = filtered.reduce((sum, w) => sum + w.duration, 0);
  const avgMinutes = totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0;

  $("#total-workouts").text(totalWorkouts);
  $("#total-minutes").text(totalMinutes);
  $("#avg-minutes").text(avgMinutes);
}

function renderChart() {
  const ctx = document.getElementById("workout-chart").getContext("2d");
  const filtered = getFilteredWorkouts();

  const typeMap = {};
  filtered.forEach((w) => {
    if (!typeMap[w.type]) {
      typeMap[w.type] = 0;
    }
    typeMap[w.type] += w.duration;
  });

  const labels = Object.keys(typeMap);
  const data = Object.values(typeMap);

  if (workoutChart) {
    workoutChart.destroy();
  }

  workoutChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Kokonaiskesto (min)",
          data
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}
