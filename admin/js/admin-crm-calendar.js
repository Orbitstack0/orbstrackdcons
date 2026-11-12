/**
 * Decolar Consórcios — admin-crm-calendar.js
 * Lógica exclusivamente visual e client-side para o calendário da Agenda do CRM Decolar.
 *
 * Funcionalidades:
 * - Alternância entre Visão Semanal e Visão Mensal.
 * - Navegação temporal (Anterior, Próximo, Hoje) para qualquer mês e ano futuro.
 * - Seleção visual de data com destaque e preparação para o botão "+ Novo Compromisso".
 * - Sem persistência, sem formulários funcionais, sem requisições ao Supabase.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos da interface
  const prevBtn = document.getElementById('crm-cal-prev');
  const nextBtn = document.getElementById('crm-cal-next');
  const todayBtn = document.getElementById('crm-cal-today');
  const periodTitleEl = document.getElementById('crm-cal-period-title');
  const viewWeekBtn = document.getElementById('crm-view-week-btn');
  const viewMonthBtn = document.getElementById('crm-view-month-btn');
  const weekViewContainer = document.getElementById('crm-calendar-week-view');
  const monthViewContainer = document.getElementById('crm-calendar-month-view');
  const monthDaysGrid = document.getElementById('crm-month-days-grid');
  const selectedLabelEl = document.getElementById('crm-cal-selected-label');
  const newAppointmentBtn = document.getElementById('crm-new-appointment-btn');

  if (!periodTitleEl || !monthDaysGrid) return;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekdayNames = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  // Estado atual do calendário
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let currentView = 'week'; // 'week' ou 'month'
  let selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Demonstrações ilustrativas exclusivas do período inicial de teste (não se repetem em outros meses)
  const demoEvents = {
    // Ano-Mês-Dia (1-indexed para mês)
    [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-09`]: 'Reunião Consultiva Imóveis (Demo)',
    [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`]: 'Fechamento Cota Auto (Demo)',
    [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-11`]: 'Retorno Proposta (Demo)',
    [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-12`]: 'Diagnóstico Financeiro (Demo)',
    [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-13`]: 'Assembleia & Lances (Demo)'
  };

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatSelectedFull(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const weekday = weekdayNames[date.getDay()];
    return `${weekday}, ${day} de ${month} de ${year}`;
  }

  function updateSelectionDisplay() {
    if (selectedLabelEl) {
      selectedLabelEl.textContent = formatSelectedFull(selectedDate);
    }
    if (newAppointmentBtn) {
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const monthShort = monthNames[selectedDate.getMonth()].slice(0, 3).toLowerCase();
      newAppointmentBtn.setAttribute('title', `Data selecionada: ${day}/${monthShort}/${selectedDate.getFullYear()}`);
    }
  }

  function renderPeriodTitle() {
    if (currentView === 'month') {
      periodTitleEl.textContent = `${monthNames[viewMonth]} de ${viewYear}`;
    } else {
      // Período da semana em exibição
      periodTitleEl.textContent = `${monthNames[viewMonth]} de ${viewYear}`;
    }
  }

  function renderMonthView() {
    renderPeriodTitle();
    monthDaysGrid.innerHTML = '';

    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo
    const lastDateOfMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const lastDateOfPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const selectedIso = formatDateISO(selectedDate);
    const todayIso = formatDateISO(now);

    // Dias do mês anterior para completar o início da grade
    for (let i = firstDayIndex; i > 0; i--) {
      const dayNum = lastDateOfPrevMonth - i + 1;
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
      const cell = createDayCell(prevDate, dayNum, true);
      monthDaysGrid.appendChild(cell);
    }

    // Dias do mês atual
    for (let day = 1; day <= lastDateOfMonth; day++) {
      const date = new Date(viewYear, viewMonth, day);
      const cell = createDayCell(date, day, false);
      monthDaysGrid.appendChild(cell);
    }

    // Dias do próximo mês para completar a última linha da grade (múltiplo de 7)
    const totalCells = firstDayIndex + lastDateOfMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      const nextDate = new Date(viewYear, viewMonth + 1, day);
      const cell = createDayCell(nextDate, day, true);
      monthDaysGrid.appendChild(cell);
    }
  }

  function createDayCell(date, dayNum, isOtherMonth) {
    const cell = document.createElement('div');
    cell.className = 'admin-crm-month-cell';
    if (isOtherMonth) cell.classList.add('is-other-month');

    const iso = formatDateISO(date);
    if (iso === formatDateISO(now)) cell.classList.add('is-today');
    if (iso === formatDateISO(selectedDate)) cell.classList.add('is-selected');

    const numEl = document.createElement('span');
    numEl.className = 'admin-crm-month-cell-num';
    numEl.textContent = dayNum;
    cell.appendChild(numEl);

    // Se houver evento de demonstração configurado
    if (demoEvents[iso]) {
      const chip = document.createElement('span');
      chip.className = 'admin-crm-month-cell-demo-chip';
      chip.textContent = demoEvents[iso];
      chip.setAttribute('title', demoEvents[iso]);
      cell.appendChild(chip);
    }

    cell.addEventListener('click', () => {
      selectedDate = date;
      if (isOtherMonth) {
        viewYear = date.getFullYear();
        viewMonth = date.getMonth();
        renderMonthView();
      } else {
        document.querySelectorAll('.admin-crm-month-cell').forEach(c => c.classList.remove('is-selected'));
        cell.classList.add('is-selected');
      }
      updateSelectionDisplay();
    });

    return cell;
  }

  function updateWeekViewSelection() {
    renderPeriodTitle();
    // Colunas da semana
    const cols = document.querySelectorAll('.admin-crm-calendar-col');
    cols.forEach(col => {
      col.classList.remove('is-selected');
      const dayHeader = col.querySelector('.admin-crm-calendar-day-header');
      if (!dayHeader) return;

      // Event listener para seleção de coluna
      if (!col.dataset.hasListener) {
        col.dataset.hasListener = 'true';
        col.addEventListener('click', () => {
          cols.forEach(c => c.classList.remove('is-selected'));
          col.classList.add('is-selected');
          // Atualiza a data selecionada aproximada para o dia da semana
          updateSelectionDisplay();
        });
      }
    });
  }

  // Navegação de Período
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (viewMonth === 0) {
        viewMonth = 11;
        viewYear--;
      } else {
        viewMonth--;
      }
      if (currentView === 'month') {
        renderMonthView();
      } else {
        renderPeriodTitle();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (viewMonth === 11) {
        viewMonth = 0;
        viewYear++;
      } else {
        viewMonth++;
      }
      if (currentView === 'month') {
        renderMonthView();
      } else {
        renderPeriodTitle();
      }
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const today = new Date();
      viewYear = today.getFullYear();
      viewMonth = today.getMonth();
      selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      updateSelectionDisplay();
      if (currentView === 'month') {
        renderMonthView();
      } else {
        renderPeriodTitle();
      }
    });
  }

  // Alternância entre Visão Semanal e Mensal
  if (viewWeekBtn && viewMonthBtn) {
    viewWeekBtn.addEventListener('click', () => {
      currentView = 'week';
      viewWeekBtn.classList.add('is-active');
      viewMonthBtn.classList.remove('is-active');
      if (weekViewContainer) weekViewContainer.hidden = false;
      if (monthViewContainer) monthViewContainer.hidden = true;
      renderPeriodTitle();
    });

    viewMonthBtn.addEventListener('click', () => {
      currentView = 'month';
      viewMonthBtn.classList.add('is-active');
      viewWeekBtn.classList.remove('is-active');
      if (weekViewContainer) weekViewContainer.hidden = true;
      if (monthViewContainer) monthViewContainer.hidden = false;
      renderMonthView();
    });
  }

  // Inicialização
  updateSelectionDisplay();
  renderPeriodTitle();
  updateWeekViewSelection();
});

