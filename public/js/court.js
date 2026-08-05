// Tabs switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

const canvas = document.getElementById('courtCanvas');
const ctx = canvas.getContext('2d');
const eventType = document.getElementById('eventType');
const eventResult = document.getElementById('eventResult');
const teamASelect = document.getElementById('teamA');
const teamBInput = document.getElementById('teamB');
const periodSelect = document.getElementById('periodSelect');
const categorySelect = document.getElementById('categorySelect');
const playerSelect = document.getElementById('playerSelect');
const opponentPlayerInput = document.getElementById('opponentPlayer');
const eventNoteInput = document.getElementById('eventNote');
const shotDirectionInput = document.getElementById('shotDirection');
const shotLocationInput = document.getElementById('shotLocation');
const goalDirectionPanel = document.getElementById('goalDirectionPanel');
const shotLocationPanel = document.getElementById('shotLocationPanel');
const shotLocationLabel = document.getElementById('shotLocationLabel');
const goalDirectionLabel = document.getElementById('goalDirectionLabel');
const goalDirectionButtons = document.querySelectorAll('.goal-sector');
const shotLocationCells = document.querySelectorAll('.location-cell');
const distributionPlayerSelect = document.getElementById('distributionPlayerSelect');
const distributionFilterBtn = document.getElementById('distributionFilterBtn');
const recordEventBtn = document.getElementById('recordEventBtn');
const messageArea = document.getElementById('messageArea');
const timelineList = document.getElementById('timelineList');

const courtBackground = new Image();
courtBackground.src = '/images/handball-court.jpg';
let courtBackgroundLoaded = false;
courtBackground.onload = () => { courtBackgroundLoaded = true; drawCourtMarkers(currentEvents); };

let players = [];
let categories = [];
let currentEvents = [];
let currentMatchId = null;
let timerInterval = null;
let seconds = 0;

const eventResultOptions = {
  shot: [
    { value: 'goal', label: 'هدف' },
    { value: 'miss', label: 'ضاعت' }
  ],
  shot9m: [
    { value: 'goal', label: 'هدف من 9 م' },
    { value: 'miss', label: 'ضاعت من 9 م' }
  ],
  shot7m: [
    { value: 'goal', label: 'هدف من 7 م' },
    { value: 'miss', label: 'ضاعت من 7 م' }
  ],
  shot6m: [
    { value: 'goal', label: 'هدف من 6 م' },
    { value: 'miss', label: 'ضاعت من 6 م' }
  ],
  shotWing: [
    { value: 'goal', label: 'هدف جناح' },
    { value: 'miss', label: 'ضاعت جناح' }
  ],
  shotFastBreak: [
    { value: 'goal', label: 'هدف هجمة مرتدة سريعة' },
    { value: 'miss', label: 'ضاعت هجمة مرتدة سريعة' }
  ],
  shotOrganized: [
    { value: 'goal', label: 'هدف هجمة منظمة سريعة' },
    { value: 'miss', label: 'ضاعت هجمة منظمة سريعة' }
  ],
  save: [
    { value: 'save', label: 'تصدي' },
    { value: 'miss', label: 'عدم التصدي' }
  ],
  foul: [
    { value: 'foul', label: 'مخالفة' }
  ],
  steal: [
    { value: 'steal', label: 'قطع الكرة' }
  ],
  suspension: [
    { value: '2min', label: 'دقيقتين' }
  ],
  lineTouch: [
    { value: 'lineTouch', label: 'لمس الخط' }
  ],
  walking: [
    { value: 'walking', label: 'المشي بالكرة' }
  ],
  pass: [
    { value: 'pass', label: 'تمريرة' }
  ],
  turnover: [
    { value: 'turnover', label: 'فقدان الكرة' }
  ],
  penalty: [
    { value: 'penalty', label: 'ركلة جزاء' }
  ]
};

function formatCategory(category) {
  const names = {
    under14: 'فئة تحت 14',
    under16: 'فئة تحت 16',
    under18: 'فئة تحت 18',
    under20: 'فئة تحت 20',
    man: 'فئة الكبار'
  };
  return names[category] || category;
}

function showMessage(text, type = 'success') {
  messageArea.innerHTML = `<div class="message ${type}">${text}</div>`;
  setTimeout(() => { messageArea.innerHTML = ''; }, 4000);
}

function getEventLabel(type) {
  const labels = {
    shot: 'تسديدة',
    shot9m: 'تسديدة 9 متر',
    shot7m: 'تسديدة 7 متر',
    shot6m: 'تسديدة 6 متر',
    shotWing: 'تسديدة جناح',
    shotFastBreak: 'هجمة مرتدة سريعة',
    shotOrganized: 'هجمة منظمة سريعة',
    save: 'تصدي',
    foul: 'مخالفة',
    steal: 'قطع الكرة',
    suspension: 'دقيقتين',
    lineTouch: 'لمس الخط',
    walking: 'المشي بالكرة',
    pass: 'تمريرة',
    turnover: 'فقدان الكرة',
    penalty: 'ركلة جزاء'
  };
  return labels[type] || type;
};


  const selectedPlayer = players.find(p => p._id === selectedPlayerId);
  const playerName = selectedPlayer ? selectedPlayer.name : manualOpponent;
  const playerCategory = selectedPlayer ? (selectedPlayer.category || selectedPlayer.playerCategory) : '';
  const team = selectedPlayer ? teamA : teamB;
  const result = eventResult ? (eventResult.value || eventType.value) : eventType.value;
  const goalDirection = shotDirectionInput?.value || '';
  const shotLocation = shotLocationInput?.value || '';
    if (goalDirectionPanel) goalDirectionPanel.classList.add('hidden');
    if (shotLocationPanel) shotLocationPanel.classList.add('hidden');
    if (shotDirectionInput) shotDirectionInput.value = '';
    if (shotLocationInput) shotLocationInput.value = '';
    goalDirectionButtons.forEach(btn => btn.classList.remove('selected'));
    shotLocationCells.forEach(cell => cell.classList.remove('selected'));
  

function updateEventControlsVisibility() {
  const eventControlsRow = document.getElementById('eventControlsRow');
  const hasPlayer = !!playerSelect.value;
  if (eventControlsRow) {
    eventControlsRow.classList.toggle('hidden', !hasPlayer);
  }
  if (recordEventBtn) {
    recordEventBtn.disabled = !hasPlayer;
  }
  if (!hasPlayer) {
    if (goalDirectionPanel) goalDirectionPanel.classList.add('hidden');
    if (shotLocationPanel) shotLocationPanel.classList.add('hidden');
    if (shotDirectionInput) shotDirectionInput.value = '';
    if (shotLocationInput) shotLocationInput.value = '';
    goalDirectionButtons.forEach(btn => btn.classList.remove('selected'));
    shotLocationCells.forEach(cell => cell.classList.remove('selected'));
  } else {
    setResultOptions();
  }
}

function renderCategoryOptions() {
  const options = ['<option value="">اختر فئة الفريق الأول</option>',
    ...categories.map(c => `<option value="${c}">${formatCategory(c)}</option>`)
  ];

  teamASelect.innerHTML = options.join('');
  categorySelect.innerHTML = ['<option value="">اختر فئة اللاعب</option>',
    ...categories.map(c => `<option value="${c}">${formatCategory(c)}</option>`)
  ].join('');
}

function renderPlayerOptions() {

  const selectedCategory =
    categorySelect.value;

  let filteredPlayers = players;

  if (selectedCategory) {

    filteredPlayers =
      players.filter(p => {

        return (
          p.category === selectedCategory ||
          p.playerCategory === selectedCategory
        );

      });

  }

  playerSelect.innerHTML =
    '<option value="">اختر اللاعب</option>';

  filteredPlayers.forEach(player => {

    const option =
      document.createElement('option');

    option.value = player._id;

    option.textContent =
      `${player.name}`;

    playerSelect.appendChild(option);

  });

  console.log(
    'FILTERED',
    filteredPlayers
  );

}

async function loadCategories() {
  try {
    const res = await fetch('/player-categories');
    if (!res.ok) throw new Error('فشل تحميل الفئات');
    categories = await res.json();
    renderCategoryOptions();
  } catch (err) {
    console.error(err);
    showMessage('تعذّر تحميل فئات اللاعبين من السيرفر.', 'error');
  }
}

async function loadPlayers() {
  try {
    const res = await fetch('/players');

    if (!res.ok) {
      throw new Error('players api failed');
    }

    const data = await res.json();

    console.log('PLAYERS=', data);

    // لو API يرجع {players:[...]}
    players = Array.isArray(data)
      ? data
      : data.players || [];

    renderPlayerOptions();

  } catch (err) {
    console.error(err);

    showMessage(
      'فشل تحميل اللاعبين',
      'error'
    );
  }
}

const GOAL_WIDTH = 180;
const GOAL_HEIGHT = 10;
const FIELD_MARGIN = 24;

function resetCourt() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (courtBackgroundLoaded) {
    ctx.drawImage(courtBackground, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.strokeRect(FIELD_MARGIN / 2, FIELD_MARGIN / 2, canvas.width - FIELD_MARGIN, canvas.height - FIELD_MARGIN);
    drawCourtLayout();
  }
}

function drawCourtLayout() {
  const courtLeft = FIELD_MARGIN / 2;
  const courtRight = canvas.width - FIELD_MARGIN / 2;
  const courtTop = FIELD_MARGIN / 2;
  const courtBottom = canvas.height - FIELD_MARGIN / 2;
  const centerX = canvas.width / 2;
  const goalY = courtBottom - 12;
  const goalLeft = centerX - GOAL_WIDTH / 2;
  const goalRight = centerX + GOAL_WIDTH / 2;

  // Goal area line
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(goalLeft, goalY);
  ctx.lineTo(goalRight, goalY);
  ctx.stroke();

  // Goal posts
  ctx.beginPath();
  ctx.moveTo(goalLeft, goalY);
  ctx.lineTo(goalLeft, goalY - GOAL_HEIGHT);
  ctx.moveTo(goalRight, goalY);
  ctx.lineTo(goalRight, goalY - GOAL_HEIGHT);
  ctx.stroke();

  // Six-meter line
  const sixMeterRadius = 90;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(centerX, goalY, sixMeterRadius, Math.PI, 0, true);
  ctx.stroke();

  // Nine-meter line
  const nineMeterRadius = 135;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(centerX, goalY, nineMeterRadius, Math.PI, 0, true);
  ctx.stroke();
  ctx.setLineDash([]);

  // Seven-meter mark
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(centerX, goalY - 70, 4, 0, Math.PI * 2);
  ctx.fill();

  // Midfield arc
  const centerCircleRadius = 40;
  const centerY = courtTop + 100;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, centerY, centerCircleRadius, 0, Math.PI, false);
  ctx.stroke();

  // Field instructions
  ctx.fillStyle = '#ccc';
  ctx.font = '14px Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('انقر هنا لتسجيل مكان الحدث', canvas.width / 2, canvas.height - 24);
}

function getShotMarkerColor(event) {
  if (event.type === 'shot' || event.type.startsWith('shot')) {
    if (event.result === 'goal') return '#27ae60';
    if (event.result === 'miss') return '#e74c3c';
    return '#f39c12';
  }
  if (event.type === 'save') return '#3498db';
  if (event.type === 'penalty') return '#9b59b6';
  return {
    foul: '#f39c12',
    steal: '#2ecc71',
    suspension: '#95a5a6',
    lineTouch: '#34495e',
    walking: '#34495e',
    pass: '#f1c40f',
    turnover: '#e67e22'
  }[event.type] || '#333';
}

function drawCourtMarkers(events) {
  resetCourt();

  events.forEach(event => {
    if (!event.position || event.position.x === null || event.position.y === null) return;
    const x = event.position.x;
    const y = event.position.y;
    ctx.beginPath();
    ctx.fillStyle = getShotMarkerColor(event);
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 6;
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(event.type.charAt(0).toUpperCase(), x, y + 4);
  });
}

function updatePlayerReportOptions() {
  const playerReportSelect = document.getElementById('playerReportSelect');
  const playerNames = Array.from(new Set(currentEvents.map(e => e.player))).sort();

  playerReportSelect.innerHTML = ['<option value="">اختر لاعبًا</option>',
    ...playerNames.map(name => `<option value="${name}">${name}</option>`)
  ].join('');

  if (distributionPlayerSelect) {
    distributionPlayerSelect.innerHTML = ['<option value="">All players</option>',
      ...playerNames.map(name => `<option value="${name}">${name}</option>`)
    ].join('');
  }
}

function getShotDistributionMatrix(filterPlayer = '') {
  const matrix = Array.from({ length: 3 }, () => Array(3).fill(0));
  let total = 0;
  currentEvents.forEach(event => {
    if (!event.position || event.position.x === null || event.position.y === null) return;
    if (filterPlayer && event.player !== filterPlayer) return;
    if (!(event.type === 'shot' || event.type.startsWith('shot') || event.type === 'penalty')) return;

    const col = Math.min(2, Math.floor(event.position.x / (canvas.width / 3)));
    const row = Math.min(2, Math.floor(event.position.y / (canvas.height / 3)));
    matrix[row][col] += 1;
    total += 1;
  });
  return { matrix, total };
}

function renderShotDistribution() {
  const selectedPlayer = distributionPlayerSelect?.value || '';
  const { matrix, total } = getShotDistributionMatrix(selectedPlayer);
  const grid = document.getElementById('shotDistributionGrid');
  if (!grid) return;

  grid.innerHTML = '';
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const count = matrix[row][col];
      const percent = total ? Math.round((count / total) * 100) : 0;
      const cell = document.createElement('div');
      cell.className = 'distribution-cell';
      if (count > 0) cell.classList.add('active');
      cell.innerHTML = `<span class="count">${count}</span><span class="percent">${percent}%</span>`;
      grid.appendChild(cell);
    }
  }
}

function updateShotDistribution() {
  updatePlayerReportOptions();
  renderShotDistribution();
}

function updatePlayerReport() {
  const playerReportSelect = document.getElementById('playerReportSelect');
  const playerReportText = document.getElementById('playerReportText');
  const playerName = playerReportSelect.value;

  if (!playerName) {
    playerReportText.innerHTML = 'اختر لاعبًا لعرض تقريره.';
    return;
  }

  const events = currentEvents.filter(event => event.player === playerName);
  const stats = {
    goals: events.filter(e => ((e.type === 'shot' || e.type.startsWith('shot') || e.type === 'penalty') && e.result === 'goal') || (e.type === 'save' && e.result === 'miss')).length,
    shots: events.filter(e => e.type === 'shot' || e.type.startsWith('shot')).length,
    saves: events.filter(e => e.type === 'save' && e.result === 'save').length,
    fouls: events.filter(e => e.type === 'foul').length,
    steals: events.filter(e => e.type === 'steal').length,
    suspensions: events.filter(e => e.result === '2min').length,
    turnovers: events.filter(e => e.type === 'turnover').length,
    penalties: events.filter(e => e.type === 'penalty').length
  };

  playerReportText.innerHTML = `
    <p><strong>اللاعب:</strong> ${playerName}</p>
    <p>عدد التسديدات: ${stats.shots}</p>
    <p>عدد الأهداف: ${stats.goals}</p>
    <p>عدد التصديات: ${stats.saves}</p>
    <p>عدد المخالفات: ${stats.fouls}</p>
    <p>قطع الكرة: ${stats.steals}</p>
    <p>دقائق الإيقاف: ${stats.suspensions}</p>
    <p>فقدان الكرة: ${stats.turnovers}</p>
    <p>ركلات الجزاء: ${stats.penalties}</p>
  `;
}

function computeLocalStats(events) {
  const goals = events.filter(e => ((e.type === 'shot' || e.type.startsWith('shot') || e.type === 'penalty') && e.result === 'goal') || (e.type === 'save' && e.result === 'miss')).length;
  const saves = events.filter(e => e.type === 'save' && e.result === 'save').length;
  const fouls = events.filter(e => e.type === 'foul').length;
  const steals = events.filter(e => e.type === 'steal').length;
  const suspensions = events.filter(e => e.result === '2min').length;
  const lineTouches = events.filter(e => e.type === 'lineTouch').length;
  const walking = events.filter(e => e.type === 'walking').length;
  const passes = events.filter(e => e.type === 'pass').length;
  const turnovers = events.filter(e => e.type === 'turnover').length;
  const penalties = events.filter(e => e.type === 'penalty').length;
  const shots = events.filter(e => e.type === 'shot' || e.type.startsWith('shot')).length;
  const successRate = shots ? (goals / shots * 100).toFixed(2) : 0;
  const teamScores = {};

  events.forEach(e => {
    if (e.team && (((e.type === 'shot' || e.type.startsWith('shot') || e.type === 'penalty') && e.result === 'goal') || (e.type === 'save' && e.result === 'miss'))) {
      teamScores[e.team] = (teamScores[e.team] || 0) + 1;
    }
  });

  return {
    totalEvents: events.length,
    goals,
    saves,
    fouls,
    steals,
    suspensions,
    lineTouches,
    walking,
    passes,
    turnovers,
    penalties,
    shots,
    successRate,
    teamScores
  };
}

function updateStats() {
  const stats = computeLocalStats(currentEvents);
  const scoreA = stats.teamScores[teamASelect.value] || 0;
  const scoreB = stats.teamScores[teamBInput.value.trim()] || 0;
  const statsText = document.getElementById('statsText');
  if (statsText) {
    statsText.innerHTML = `
      <h3>إحصائيات المباراة</h3>
      <p><strong>عدد الأحداث:</strong> ${stats.totalEvents}</p>
      <p><strong>النتيجة:</strong> ${scoreA} - ${scoreB}</p>
      <p><strong>التسديدات:</strong> ${stats.shots}</p>
      <p><strong>الأهداف:</strong> ${stats.goals}</p>
      <p><strong>نسبة النجاح:</strong> ${stats.successRate}%</p>
      <p><strong>التصديات الناجحة:</strong> ${stats.saves}</p>
      <p><strong>المخالفات:</strong> ${stats.fouls}</p>
      <p><strong>قطع الكرة:</strong> ${stats.steals}</p>
    `;
  }

  const scoreAEl = document.getElementById('scoreA');
  const scoreBEl = document.getElementById('scoreB');
  if (scoreAEl) scoreAEl.textContent = scoreA;
  if (scoreBEl) scoreBEl.textContent = scoreB;

  statsChart.data.datasets[0].data = [
    stats.goals,
    stats.saves,
    stats.fouls,
    stats.steals,
    stats.suspensions,
    stats.lineTouches,
    stats.walking,
    stats.passes,
    stats.turnovers,
    stats.penalties
  ];

  statsChart.update();
}

function formatDirection(direction) {
  const labels = {
    left: 'يسار',
    center: 'وسط',
    right: 'يمين'
  };
  return labels[direction] || direction;
}

function formatShotLocation(location) {
  const labels = {
    'top-left': 'أعلى يسار',
    'top-center': 'أعلى وسط',
    'top-right': 'أعلى يمين',
    'middle-left': 'منتصف يسار',
    'middle-center': 'منتصف',
    'middle-right': 'منتصف يمين',
    'bottom-left': 'أسفل يسار',
    'bottom-center': 'أسفل وسط',
    'bottom-right': 'أسفل يمين'
  };
  return labels[location] || location;
}

function getPositionFromLocation(location) {
  const locationMap = {
    'top-left': [0, 0],
    'top-center': [1, 0],
    'top-right': [2, 0],
    'middle-left': [0, 1],
    'middle-center': [1, 1],
    'middle-right': [2, 1],
    'bottom-left': [0, 2],
    'bottom-center': [1, 2],
    'bottom-right': [2, 2]
  };
  const coords = locationMap[location];
  if (!coords) return { x: null, y: null };
  const [col, row] = coords;
  const sectionWidth = canvas.width / 3;
  const sectionHeight = canvas.height / 3;
  return {
    x: col * sectionWidth + sectionWidth / 2,
    y: row * sectionHeight + sectionHeight / 2
  };
}

function addToTimeline(event) {
  const teamLabel = categories.includes(event.team) ? formatCategory(event.team) : event.team;
  const categoryLabel = event.playerCategory ? `، فئة ${formatCategory(event.playerCategory)}` : '';
  const resultLabel = eventResultOptions[event.type]?.find(o => o.value === event.result)?.label || event.result;
  const directionLabel = event.goalDirection ? ` - جهة: ${formatDirection(event.goalDirection)}` : '';
  const locationLabel = event.shotLocation ? ` - موقع: ${formatShotLocation(event.shotLocation)}` : '';
  const note = event.note ? ` - ${event.note}` : '';
  const li = document.createElement('li');
  li.innerHTML = `<span class="icon">${getEventIcon(event.type)}</span> [الشوط ${event.period}] ${event.player}${categoryLabel} (${teamLabel}) - ${getEventLabel(event.type)}: ${resultLabel}${directionLabel}${locationLabel}${note}`;
  timelineList.prepend(li);
}

function getEventIcon(type) {
  switch(type) {
    case 'shot':
    case 'shot9m':
    case 'shot7m':
    case 'shot6m':
    case 'shotWing':
    case 'shotFastBreak':
    case 'shotOrganized':
      return '⚽';
    case 'save': return '🧤';
    case 'foul': return '🚫';
    case 'steal': return '✋';
    case 'suspension': return '⏳';
    case 'lineTouch': return '↔️';
    case 'walking': return '🏃';
    case 'pass': return '🔁';
    case 'turnover': return '❌';
    case 'penalty': return '🎯';
    default: return '❓';
  }
}

function buildEventPayload(pos = null) {
  const type = eventType.value;
  const selectedPlayerId = playerSelect.value;
  const manualOpponent = opponentPlayerInput.value.trim();
  const teamA = teamASelect.value;
  const teamB = teamBInput.value.trim();
  const note = eventNoteInput.value.trim();

  if (!type) {
    showMessage('اختر نوع الحدث أولاً.', 'error');
    return null;
  }

  if (!teamA || !teamB) {
    showMessage('اختر فئة الفريق الأول وأدخل اسم الفريق المنافس.', 'error');
    return null;
  }

  if (!selectedPlayerId && !manualOpponent) {
    showMessage('اختر لاعبًا من الفئة أو أدخل لاعب الخصم يدويًا.', 'error');
    return null;
  }

  const selectedPlayer = players.find(p => p._id === selectedPlayerId);
  const playerName = selectedPlayer ? selectedPlayer.name : manualOpponent;
  const playerCategory = selectedPlayer ? (selectedPlayer.category || selectedPlayer.playerCategory) : '';
  const team = selectedPlayer ? teamA : teamB;
  const result = eventResult ? (eventResult.value || eventType.value) : eventType.value;
  const goalDirection = shotDirectionInput?.value || '';
  const shotLocation = shotLocationInput?.value || '';

  const requiresLocation = type === 'save' || type.startsWith('shot');
  if (requiresLocation && (!goalDirection || !shotLocation)) {
    showMessage('اختر جهة التسديد/التصدي والموقع أولاً.', 'error');
    return null;
  }

  const position = pos || (shotLocation ? getPositionFromLocation(shotLocation) : { x: null, y: null });

  return {
    player: playerName,
    playerId: selectedPlayerId || null,
    team,
    playerCategory,
    type,
    result,
    goalDirection,
    shotLocation,
    position,
    time: formatTimer(seconds),
    period: periodSelect.value,
    note,
    matchName: document.getElementById('matchName')?.value.trim() || '',
    opponent: teamB
  };
}

async function recordEvent(pos = null) {
  const payload = buildEventPayload(pos);
  if (!payload) return;

  currentEvents.unshift(payload);
  updatePlayerReportOptions();
  renderShotDistribution();
  drawCourtMarkers(currentEvents);
  addToTimeline(payload);
  updateStats();

  if (currentMatchId) {
    try {
      payload.matchId = currentMatchId;
      const res = await fetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        showMessage('حدث خطأ أثناء حفظ الحدث على الخادم.', 'error');
      } else {
        const data = await res.json();
        if (data.event && data.event._id) {
          payload._id = data.event._id;
        }
      }
    } catch (err) {
      console.error(err);
      showMessage('فشل الاتصال بالخادم.', 'error');
    }
  } else {
    showMessage('تم تسجيل الحدث محليًا. احفظ المباراة لحفظها في قاعدة البيانات.', 'success');
  }

  if (payload.playerId) {
    try {
      const res = await fetch('/game-stats/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        console.warn('GameStats request failed');
      } else {
        const data = await res.json();
        if (data.success) {
          showMessage('تم ربط موقع الاستقبال بإحصائيات المباراة.', 'success');
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
}

async function loadMatches() {
  try {
    const res = await fetch('/matches');
    if (!res.ok) {
      showMessage('فشل تحميل المباريات المحفوظة.', 'error');
      return;
    }
    const matches = await res.json();
    const savedMatchesSelect = document.getElementById('savedMatches');
    savedMatchesSelect.innerHTML = ['<option value="">اختر مباراة محفوظة</option>',
      ...matches.map(match => `<option value="${match._id}">${match.name} (${formatCategory(match.teamA)} vs ${match.teamB})</option>`)
    ].join('');
  } catch (err) {
    console.error(err);
    showMessage('فشل الاتصال بالخادم أثناء تحميل المباريات.', 'error');
  }
}

async function loadMatchById(matchId) {
  const res = await fetch(`/matches/${matchId}`);
  const data = await res.json();

  const match = data.match;

  currentMatchId = match._id;

  document.getElementById('matchName').value = match.name;

  teamASelect.value = match.teamA;

  // أضف هذا
  categorySelect.value = match.teamA;
  renderPlayerOptions();

  teamBInput.value = match.teamB;
  periodSelect.value = match.period;

  currentEvents = match.eventIds.map(event => ({
    ...event,
    position: event.position || { x: null, y: null }
  }));

  timelineList.innerHTML = '';
  currentEvents.forEach(addToTimeline);
  drawCourtMarkers(currentEvents);
  updatePlayerReportOptions();
  updateShotDistribution();
  updateStats();
}

async function saveMatch() {
  const name = document.getElementById('matchName').value.trim();
  const teamA = teamASelect.value;
  const teamB = teamBInput.value.trim();
  const period = periodSelect.value;
  if (!name || !teamA || !teamB) {
    showMessage('ادخل اسم المباراة، فئة الفريق الأول، واسم الفريق الثاني.', 'error');
    return;
  }
  if (!currentEvents.length) {
    showMessage('لا يوجد أحداث لحفظها.', 'error');
    return;
  }

  const eventsToSave = currentEvents
    .filter(event => !event._id)
    .map(({ _id, ...rest }) => rest);

  try {
    const url = currentMatchId ? `/matches/${currentMatchId}` : '/matches';
    const method = currentMatchId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, teamA, teamB, period, events: eventsToSave })
    });

    if (!res.ok) {
      showMessage('فشل حفظ المباراة.', 'error');
      return;
    }

    const data = await res.json();
    if (!data.success) {
      showMessage(data.message || 'فشل حفظ المباراة.', 'error');
      return;
    }

    currentMatchId = data.match._id;
    showMessage('تم حفظ المباراة بنجاح.', 'success');
    await loadMatches();
    await loadMatchById(currentMatchId);
  } catch (err) {
    console.error(err);
    showMessage('فشل الاتصال بالخادم أثناء حفظ المباراة.', 'error');
  }
}

async function loadMatch() {
  const matchId = document.getElementById('savedMatches').value;
  if (!matchId) {
    showMessage('اختر مباراة من القائمة للتحميل.', 'error');
    return;
  }

  try {
    await loadMatchById(matchId);
    showMessage('تم تحميل المباراة.', 'success');
  } catch (err) {
    console.error(err);
    showMessage(err.message || 'فشل الاتصال بالخادم أثناء تحميل المباراة.', 'error');
  }
}

async function deleteMatch() {
  const matchId = document.getElementById('savedMatches').value || currentMatchId;
  if (!matchId) {
    showMessage('اختر مباراة لحذفها.', 'error');
    return;
  }

  try {
    const res = await fetch(`/matches/${matchId}`, { method: 'DELETE' });
    if (!res.ok) {
      showMessage('فشل حذف المباراة.', 'error');
      return;
    }
    const data = await res.json();
    currentMatchId = null;
    currentEvents = [];
    timelineList.innerHTML = '';
    drawCourtMarkers(currentEvents);
    updatePlayerReportOptions();
    updateStats();
    await loadMatches();
    showMessage(data.message || 'تم حذف المباراة.', 'success');
  } catch (err) {
    console.error(err);
    showMessage('فشل الاتصال بالخادم أثناء حذف المباراة.', 'error');
  }
}

function clearMatch() {
  currentMatchId = null;
  currentEvents = [];
  timelineList.innerHTML = '';
  drawCourtMarkers(currentEvents);
  updatePlayerReportOptions();
  updateShotDistribution();
  updateStats();
  resetTimer();
  showMessage('تم مسح بيانات المباراة الحالية.', 'success');
}

function startMatch() {
  const teamA = teamASelect.value;
  const teamB = teamBInput.value.trim();
  if (!teamA || !teamB) {
    showMessage('يرجى اختيار فئة الفريق الأول وإدخال اسم الفريق المنافس.', 'error');
    return;
  }
  if (teamA === teamB) {
    showMessage('يجب أن يكون اسم الفريق المنافس مختلفًا عن الفئة الأولى.', 'error');
    return;
  }
  clearMatch();
  seconds = 60 * 60;
  const timerEl = document.getElementById('timer');
  if (timerEl) timerEl.textContent = formatTimer(seconds);
  startTimer();
  showMessage(`بدأت المباراة بين ${formatCategory(teamA)} و ${teamB}.`, 'success');
}

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function startTimer() {
  if (!timerInterval) {
    timerInterval = setInterval(() => {
      if (seconds > 0) {
        seconds--;
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = formatTimer(seconds);
      } else {
        pauseTimer();
        showMessage('انتهى الوقت!', 'error');
      }
    }, 1000);
  }
}

function pauseTimer() { clearInterval(timerInterval); timerInterval = null; }

function resetTimer() { pauseTimer(); seconds = 0; const timerEl = document.getElementById('timer'); if (timerEl) timerEl.textContent = formatTimer(seconds); }

const chartCtx = document.getElementById('statsChart').getContext('2d');
let statsChart = new Chart(chartCtx, {
  type: 'bar',
  data: {
    labels: ['أهداف', 'تصديات', 'مخالفات', 'قطع الكرة', 'دقيقتين', 'لمس الخط', 'المشي بالكرة', 'تمريرة', 'فقدان الكرة', 'ركلة جزاء'],
    datasets: [{
      label: 'إحصائيات المباراة',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336', '#6c757d', '#17a2b8', '#ffc107', '#e83e8c', '#6610f2']
    }]
  }
});

document.getElementById('playerReportSelect').addEventListener('change', updatePlayerReport);
recordEventBtn.addEventListener('click', () => recordEvent());
document.getElementById('saveMatchBtn').addEventListener('click', saveMatch);
document.getElementById('loadMatchBtn').addEventListener('click', loadMatch);
document.getElementById('deleteMatchBtn').addEventListener('click', deleteMatch);
categorySelect.addEventListener('change', () => {
  renderPlayerOptions();
  playerSelect.value = '';
  updatePlayerReportOptions();
  updateEventControlsVisibility();
});
teamASelect.addEventListener('change', () => {
    categorySelect.value = teamASelect.value;

    renderPlayerOptions();

    updateStats();
});
teamBInput.addEventListener('input', updateStats);
playerSelect.addEventListener('change', () => {
  updatePlayerReportOptions();
  updateEventControlsVisibility();
});
eventType.addEventListener('change', setResultOptions);

distributionPlayerSelect?.addEventListener('change', renderShotDistribution);
distributionFilterBtn?.addEventListener('click', renderShotDistribution);

shotLocationCells.forEach(cell => {
  cell.addEventListener('click', () => {
    shotLocationCells.forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    shotLocationInput.value = cell.dataset.location;
  });
});

goalDirectionButtons.forEach(button => {
  button.addEventListener('click', () => {
    goalDirectionButtons.forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
    shotDirectionInput.value = button.dataset.direction;
  });
});

canvas.addEventListener('click', e => {
  const pos = { x: e.offsetX, y: e.offsetY };
  recordEvent(pos);
});

loadCategories();
loadPlayers();
loadMatches();
setResultOptions();
updateEventControlsVisibility();
updateStats();
