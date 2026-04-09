/**
 * UI Components — Bloomberg/Investing.com inspired
 * Axiom Institutional design system (dark-first, 0px radius, IBM Plex Mono)
 * Each component is a plain function: (container, data) => void
 */

const UIComponents = (() => {

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function sparklineSVG(values, color = '#10b981', width = 120, height = 40) {
    if (!values || values.length < 2) return el('span', { class: 'sparkline-empty' }, '—');
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.display = 'block';

    const fillPts = `0,${height} ` + pts + ` ${width},${height}`;
    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    fill.setAttribute('points', fillPts);
    fill.setAttribute('fill', color);
    fill.setAttribute('fill-opacity', '0.12');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', pts);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(fill);
    svg.appendChild(line);
    return svg;
  }

  function changeColor(value) {
    if (value > 0) return 'var(--color-up)';
    if (value < 0) return 'var(--color-down)';
    return 'var(--color-flat)';
  }

  function changeArrow(value) {
    if (value > 0) return '▲';
    if (value < 0) return '▼';
    return '–';
  }

  function formatChange(value, suffix = '%') {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}${suffix}`;
  }

  // ─── 1. Tab Navigation ───────────────────────────────────────────────────────

  /**
   * TabNav — horizontal tab bar with optional overflow menu
   * @param {HTMLElement} container
   * @param {{ tabs: string[], active: string, onChange?: (tab: string) => void }} data
   */
  function TabNav(container, { tabs, active, onChange }) {
    container.innerHTML = '';
    const nav = el('nav', { class: 'tab-nav' });
    for (const tab of tabs) {
      const btn = el('button', {
        class: `tab-nav__item${tab === active ? ' tab-nav__item--active' : ''}`,
      }, tab);
      btn.addEventListener('click', () => {
        nav.querySelectorAll('.tab-nav__item').forEach(b => b.classList.remove('tab-nav__item--active'));
        btn.classList.add('tab-nav__item--active');
        onChange?.(tab);
      });
      nav.appendChild(btn);
    }
    nav.appendChild(el('button', { class: 'tab-nav__more', 'aria-label': 'More' }, '⋮'));
    container.appendChild(nav);
  }

  // ─── 2. Time Range Selector ──────────────────────────────────────────────────

  /**
   * TimeRange — compact period selector row
   * @param {HTMLElement} container
   * @param {{ periods: string[], active: string, onChange?: (p: string) => void }} data
   */
  function TimeRange(container, { periods, active, onChange }) {
    container.innerHTML = '';
    const bar = el('div', { class: 'time-range' });
    for (const p of periods) {
      const btn = el('button', {
        class: `time-range__btn${p === active ? ' time-range__btn--active' : ''}`,
      }, p);
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.time-range__btn').forEach(b => b.classList.remove('time-range__btn--active'));
        btn.classList.add('time-range__btn--active');
        onChange?.(p);
      });
      bar.appendChild(btn);
    }
    bar.appendChild(el('button', { class: 'time-range__grid', 'aria-label': 'Chart type' }, '▦'));
    container.appendChild(bar);
  }

  // ─── 3. Main Sparkline Chart ─────────────────────────────────────────────────

  /**
   * MainChart — responsive area chart using inline SVG
   * @param {HTMLElement} container
   * @param {{ values: number[], labels: string[], color?: string }} data
   */
  function MainChart(container, { values, labels, color = '#38bdf8' }) {
    container.innerHTML = '';
    const wrap = el('div', { class: 'main-chart' });
    const W = 480, H = 120;

    if (!values || values.length < 2) {
      wrap.appendChild(el('div', { class: 'main-chart__empty' }, 'No data'));
      container.appendChild(wrap);
      return;
    }

    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const padX = 8, padY = 10;
    const innerW = W - padX * 2, innerH = H - padY * 2;

    const toX = i => padX + (i / (values.length - 1)) * innerW;
    const toY = v => H - padY - ((v - min) / range) * innerH;

    const pts = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const fillPts = `${padX},${H - padY} ` + pts + ` ${toX(values.length - 1)},${H - padY}`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.cssText = 'width:100%;height:100%;display:block;';

    const yLevels = [max, (max + min) / 2, min];
    for (const yv of yLevels) {
      const yPos = toY(yv);
      const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', padX); gridLine.setAttribute('x2', W - padX);
      gridLine.setAttribute('y1', yPos.toFixed(1)); gridLine.setAttribute('y2', yPos.toFixed(1));
      gridLine.setAttribute('stroke', 'var(--color-border)');
      gridLine.setAttribute('stroke-width', '0.5');
      svg.appendChild(gridLine);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', W - padX + 2);
      label.setAttribute('y', (yPos + 4).toFixed(1));
      label.setAttribute('fill', 'var(--color-muted)');
      label.setAttribute('font-size', '9');
      label.setAttribute('font-family', 'IBM Plex Mono, monospace');
      label.textContent = yv >= 1000 ? (yv / 1000).toFixed(1) + 'k' : yv.toFixed(0);
      svg.appendChild(label);
    }

    const fillEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    fillEl.setAttribute('points', fillPts);
    fillEl.setAttribute('fill', color);
    fillEl.setAttribute('fill-opacity', '0.10');

    const lineEl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    lineEl.setAttribute('points', pts);
    lineEl.setAttribute('fill', 'none');
    lineEl.setAttribute('stroke', color);
    lineEl.setAttribute('stroke-width', '1.5');
    lineEl.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(fillEl);
    svg.appendChild(lineEl);

    if (labels && labels.length) {
      const step = Math.ceil(labels.length / 5);
      labels.forEach((lbl, i) => {
        if (i % step !== 0 && i !== labels.length - 1) return;
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', toX(i).toFixed(1));
        t.setAttribute('y', H - 1);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('fill', 'var(--color-muted)');
        t.setAttribute('font-size', '9');
        t.setAttribute('font-family', 'IBM Plex Mono, monospace');
        t.textContent = lbl;
        svg.appendChild(t);
      });
    }

    wrap.appendChild(svg);
    container.appendChild(wrap);
  }

  // ─── 4. Market Ticker Table ───────────────────────────────────────────────────

  /**
   * MarketTickerTable — dense row list of instruments + price changes
   * @param {HTMLElement} container
   * @param {{ rows: Array<{ name: string, price: string, change: number, changePct: number }> }} data
   */
  function MarketTickerTable(container, { rows }) {
    container.innerHTML = '';
    const table = el('div', { class: 'ticker-table' });
    for (const row of rows) {
      const color = changeColor(row.changePct);
      const isPos = row.changePct > 0;
      table.appendChild(
        el('div', { class: 'ticker-row' },
          el('span', { class: 'ticker-row__name' }, row.name),
          el('span', { class: 'ticker-row__price' }, row.price),
          el('span', { class: 'ticker-row__change', style: { color } },
            formatChange(row.change, '')
          ),
          el('span', { class: 'ticker-row__pct', style: { color } },
            `${formatChange(row.changePct)}`
          ),
          el('span', { class: `ticker-row__dot ticker-row__dot--${isPos ? 'up' : 'down'}` })
        )
      );
    }
    container.appendChild(table);
  }

  // ─── 5. News Impact Table Card ────────────────────────────────────────────────

  /**
   * NewsImpactCard — article with embedded data table (Bloomberg style)
   * @param {HTMLElement} container
   * @param {{ title: string, updated: string, columnHeader: string, rows: Array<{ label: string, value: string, change: number, isLink?: boolean }> }} data
   */
  function NewsImpactCard(container, { title, updated, columnHeader, rows }) {
    container.innerHTML = '';
    const card = el('div', { class: 'news-impact-card' });
    card.appendChild(el('h3', { class: 'news-impact-card__title' }, title));
    card.appendChild(el('p', { class: 'news-impact-card__updated' }, `Updated: ${updated}`));

    const tbl = el('div', { class: 'news-impact-table' });
    tbl.appendChild(
      el('div', { class: 'news-impact-table__header' },
        el('span'),
        el('span', { class: 'news-impact-table__col-header' }, columnHeader)
      )
    );
    for (const row of rows) {
      const color = changeColor(row.change);
      const arrow = changeArrow(row.change);
      tbl.appendChild(
        el('div', { class: 'news-impact-table__row' },
          el('span', { class: `news-impact-table__label${row.isLink ? ' news-impact-table__label--link' : ''}` }, row.label),
          el('span', { class: 'news-impact-table__value', style: { color } },
            `${arrow} ${row.value}`
          )
        )
      );
    }
    card.appendChild(tbl);
    container.appendChild(card);
  }

  // ─── 6. Commodity Card Grid ───────────────────────────────────────────────────

  /**
   * CommodityCardGrid — grid of mini commodity cards with sparklines
   * @param {HTMLElement} container
   * @param {{ cards: Array<{ ticker: string, price: string, unit: string, changePct: number, values: number[] }> }} data
   */
  function CommodityCardGrid(container, { cards }) {
    container.innerHTML = '';
    const grid = el('div', { class: 'commodity-grid' });
    for (const card of cards) {
      const color = card.changePct >= 0 ? 'var(--color-up)' : 'var(--color-down)';
      const sparkColor = card.changePct >= 0 ? '#10b981' : '#f43f5e';
      const arrow = changeArrow(card.changePct);

      const cardEl = el('div', { class: 'commodity-card' });
      cardEl.appendChild(el('div', { class: 'commodity-card__ticker' }, card.ticker));
      cardEl.appendChild(
        el('div', { class: 'commodity-card__price' },
          card.price, ' ', el('span', { class: 'commodity-card__unit' }, card.unit)
        )
      );
      cardEl.appendChild(
        el('div', { class: 'commodity-card__change', style: { color } },
          `${arrow} ${Math.abs(card.changePct).toFixed(2)}%`
        )
      );
      const sparkWrap = el('div', { class: 'commodity-card__spark' });
      sparkWrap.appendChild(sparklineSVG(card.values, sparkColor, 120, 36));
      cardEl.appendChild(sparkWrap);
      grid.appendChild(cardEl);
    }
    container.appendChild(grid);
  }

  // ─── 7. Topic Follow Pills ────────────────────────────────────────────────────

  /**
   * TopicFollowPills — Bloomberg "Follow Topics" pill grid
   * @param {HTMLElement} container
   * @param {{ title: string, subtitle: string, topics: string[], sections?: string[][] }} data
   */
  function TopicFollowPills(container, { title, subtitle, topics, sections }) {
    container.innerHTML = '';
    const wrap = el('div', { class: 'topic-follow' });

    wrap.appendChild(
      el('div', { class: 'topic-follow__header' },
        el('span', { class: 'topic-follow__icon' }, '≔'),
        el('span', { class: 'topic-follow__title' }, title)
      )
    );
    if (subtitle) wrap.appendChild(el('p', { class: 'topic-follow__subtitle' }, subtitle));

    const allGroups = sections ? sections : [topics];
    for (const group of allGroups) {
      const row = el('div', { class: 'topic-follow__row' });
      for (const t of group) {
        const pill = el('button', { class: 'topic-pill' },
          el('span', { class: 'topic-pill__plus' }, '⊕'),
          ' ',
          t
        );
        pill.addEventListener('click', () => pill.classList.toggle('topic-pill--active'));
        row.appendChild(pill);
      }
      wrap.appendChild(row);
    }
    container.appendChild(wrap);
  }

  return {
    TabNav,
    TimeRange,
    MainChart,
    MarketTickerTable,
    NewsImpactCard,
    CommodityCardGrid,
    TopicFollowPills,
    sparklineSVG,
  };
})();
