'use strict';
/* ===== Utilidades ===== */
const r2 = n => Math.round(n * 100) / 100;
const fmt = n => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPES = { tarjeta: 'Tarjeta de Crédito', prestamo: 'Préstamo Personal', msi: 'Meses Sin Intereses' };
const NAMES = { min: 'Solo Mínimos', snowball: 'Bola de Nieve', avalanche: 'Avalancha' };
const COLORS = { min: '#ef4444', snowball: '#38bdf8', avalanche: '#22c55e' };

/* ===== Motor de amortización ===== */
class AmortizationEngine {
  static MAX_MONTHS = 360;

  static order(list, strategy) {
    const d = [...list];
    if (strategy === 'snowball') d.sort((a, b) => a.bal - b.bal || b.rate - a.rate);
    else if (strategy === 'avalanche') d.sort((a, b) => b.rate - a.rate || a.bal - b.bal);
    return d;
  }

  static simulate(debts, extra = 0, strategy = 'min') {
    const list = debts.filter(d => d.balance > 0).map(d => ({ ...d, bal: d.balance, rate: d.type === 'msi' ? 0 : d.rate }));
    const ordered = this.order(list, strategy);
    const roll = strategy !== 'min';
    const baseBudget = list.reduce((s, d) => s + d.min, 0) + (roll ? extra : 0);
    const warnings = [];
    if (!roll) list.forEach(d => {
      if (d.min <= d.bal * d.rate / 1200) warnings.push(`El mínimo de "${d.name}" no cubre sus intereses mensuales: la deuda nunca se liquida.`);
    });
    let month = 0, interest = 0, paid = 0;
    const curve = [r2(list.reduce((s, d) => s + d.bal, 0))], payoffs = {};
    while (month < this.MAX_MONTHS && ordered.some(d => d.bal > 0.005)) {
      month++;
      ordered.forEach(d => { if (d.bal > 0) { const i = r2(d.bal * d.rate / 1200); d.bal += i; interest += i; } });
      let budget = baseBudget;
      ordered.forEach(d => { if (d.bal > 0) { const p = Math.min(d.min, d.bal); d.bal -= p; paid += p; budget -= p; } });
      if (roll) for (const d of ordered) {
        if (budget <= 0) break;
        if (d.bal > 0) { const p = Math.min(budget, d.bal); d.bal -= p; paid += p; budget -= p; }
      }
      ordered.forEach(d => { if (d.bal <= 0.005 && !(d.id in payoffs)) { d.bal = 0; payoffs[d.id] = month; } });
      curve.push(r2(ordered.reduce((s, d) => s + d.bal, 0)));
    }
    const finished = !ordered.some(d => d.bal > 0.005);
    return { strategy, months: month, totalInterest: r2(interest), totalPaid: r2(paid), curve, payoffs, finished, warnings };
  }

  static compare(debts, extra) {
    return {
      min: this.simulate(debts, extra, 'min'),
      snowball: this.simulate(debts, extra, 'snowball'),
      avalanche: this.simulate(debts, extra, 'avalanche')
    };
  }
}

/* ===== Almacén de datos (localStorage) ===== */
class DebtStore {
  static KEY = 'deudazero.v1';
  static DEMO = [
    { id: 'd1', name: 'Tarjeta bancaria', type: 'tarjeta', balance: 18500, rate: 48, min: 925 },
    { id: 'd2', name: 'Tienda departamental', type: 'tarjeta', balance: 7200, rate: 62, min: 450 },
    { id: 'd3', name: 'Compra a 12 MSI', type: 'msi', balance: 9600, rate: 0, min: 800 },
    { id: 'd4', name: 'Préstamo personal', type: 'prestamo', balance: 25000, rate: 24, min: 1100 }
  ];

  constructor() { this.debts = []; this.extra = 0; this.load(); }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(DebtStore.KEY));
      if (data && Array.isArray(data.debts)) { this.debts = data.debts; this.extra = Number(data.extra) || 0; }
    } catch (e) { this.debts = []; }
  }
  save() {
    try { localStorage.setItem(DebtStore.KEY, JSON.stringify({ debts: this.debts, extra: this.extra })); } catch (e) { /* almacenamiento no disponible */ }
  }
  get(id) { return this.debts.find(d => d.id === id); }
  upsert(debt) {
    const i = this.debts.findIndex(d => d.id === debt.id);
    if (i >= 0) this.debts[i] = debt; else this.debts.push(debt);
    this.save();
  }
  remove(id) { this.debts = this.debts.filter(d => d.id !== id); this.save(); }
  clear() { this.debts = []; this.save(); }
  setExtra(v) { this.extra = Math.max(0, Number(v) || 0); this.save(); }
  loadDemo() { this.debts = DebtStore.DEMO.map(d => ({ ...d })); this.extra = 1500; this.save(); }
  exportJSON() {
    const blob = new Blob([JSON.stringify({ app: 'DeudaZero', exportedAt: new Date().toISOString(), extra: this.extra, debts: this.debts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deudazero-portafolio.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

/* ===== Gráfica en canvas nativo ===== */
class TimelineChart {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); }

  draw(results) {
    const c = this.canvas, ctx = this.ctx, dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = 360;
    c.width = W * dpr; c.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const m = { l: 80, r: 20, t: 40, b: 50 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const keys = ['min', 'snowball', 'avalanche'];
    const maxM = Math.max(1, ...keys.map(k => results[k].months));
    const maxY = Math.max(1, ...keys.map(k => results[k].curve[0]));
    const X = mo => m.l + (mo / maxM) * pw, Y = v => m.t + ph - (v / maxY) * ph;
    ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {               // cuadrícula y eje Y
      const v = maxY * i / 5, y = Y(v);
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(W - m.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText('$' + Math.round(v).toLocaleString('es-MX'), m.l - 8, y + 4);
    }
    for (let i = 0; i <= 6; i++) {               // cuadrícula y eje X
      const mo = Math.round(maxM * i / 6), x = X(mo);
      ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(mo, x, m.t + ph + 18);
    }
    ctx.fillText('Meses', m.l + pw / 2, H - 8);
    ctx.save(); ctx.translate(14, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Saldo total ($)', 0, 0); ctx.restore();
    keys.forEach(k => {                           // curvas
      ctx.strokeStyle = COLORS[k]; ctx.lineWidth = 2.5; ctx.beginPath();
      results[k].curve.forEach((v, i) => { i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); });
      ctx.stroke();
    });
    let lx = m.l;                                 // leyenda
    keys.forEach(k => {
      ctx.fillStyle = COLORS[k]; ctx.fillRect(lx, 14, 14, 14);
      ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left'; ctx.fillText(NAMES[k], lx + 20, 25);
      lx += 40 + ctx.measureText(NAMES[k]).width;
    });
  }
}

/* ===== Controlador de interfaz ===== */
class UIController {
  constructor() {
    this.store = new DebtStore();
    this.chart = new TimelineChart(document.getElementById('chart'));
    this.$ = id => document.getElementById(id);
    this.bind();
    this.render();
  }

  bind() {
    const $ = this.$;
    $('debtForm').addEventListener('submit', e => { e.preventDefault(); this.submitForm(); });
    $('type').addEventListener('change', () => this.syncType());
    $('cancelBtn').addEventListener('click', () => this.resetForm());
    $('demoBtn').addEventListener('click', () => { this.store.loadDemo(); this.resetForm(); this.render(); });
    $('exportBtn').addEventListener('click', () => this.store.exportJSON());
    $('clearBtn').addEventListener('click', () => { if (confirm('¿Borrar todas las deudas?')) { this.store.clear(); this.render(); } });
    $('extraRange').addEventListener('input', e => this.setExtra(e.target.value));
    $('extraNum').addEventListener('input', e => this.setExtra(e.target.value));
    $('strategySel').addEventListener('change', () => this.renderTimeline());
    $('debtBody').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      if (b.dataset.act === 'del') { this.store.remove(b.dataset.id); this.render(); } else this.startEdit(b.dataset.id);
    });
    window.addEventListener('resize', () => this.chart.draw(this.results));
  }

  syncType() {
    const msi = this.$('type').value === 'msi', r = this.$('rate');
    r.disabled = msi; if (msi) r.value = 0;
  }

  submitForm() {
    const $ = this.$, err = $('formError');
    const debt = {
      id: $('debtId').value || 'd' + Date.now(),
      name: $('name').value.trim(), type: $('type').value,
      balance: parseFloat($('balance').value), rate: $('type').value === 'msi' ? 0 : parseFloat($('rate').value),
      min: parseFloat($('min').value)
    };
    if (!debt.name) return (err.textContent = 'Escribe un nombre.');
    if (!(debt.balance > 0)) return (err.textContent = 'El saldo debe ser mayor a 0.');
    if (!(debt.rate >= 0)) return (err.textContent = 'La tasa no puede ser negativa.');
    if (!(debt.min > 0)) return (err.textContent = 'El pago mínimo debe ser mayor a 0.');
    this.store.upsert(debt); this.resetForm(); this.render();
  }

  startEdit(id) {
    const d = this.store.get(id), $ = this.$; if (!d) return;
    $('debtId').value = d.id; $('name').value = d.name; $('type').value = d.type;
    $('balance').value = d.balance; $('rate').value = d.rate; $('min').value = d.min;
    this.syncType();
    $('saveBtn').textContent = 'Guardar cambios'; $('cancelBtn').hidden = false;
    $('name').focus();
  }

  resetForm() {
    this.$('debtForm').reset(); this.$('debtId').value = ''; this.$('formError').textContent = '';
    this.$('saveBtn').textContent = 'Agregar deuda'; this.$('cancelBtn').hidden = true; this.syncType();
  }

  setExtra(v) {
    this.store.setExtra(v);
    this.$('extraRange').value = this.store.extra; this.$('extraNum').value = this.store.extra;
    this.renderResults();
  }

  render() {
    const $ = this.$;
    $('extraRange').value = this.store.extra; $('extraNum').value = this.store.extra;
    $('debtBody').innerHTML = this.store.debts.length
      ? this.store.debts.map(d => `<tr><td>${esc(d.name)}</td><td>${TYPES[d.type]}</td><td>${fmt(d.balance)}</td><td>${d.rate}%</td><td>${fmt(d.min)}</td>
        <td><button data-act="edit" data-id="${d.id}">Editar</button><button data-act="del" data-id="${d.id}">Eliminar</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="empty">Sin deudas. Agrega una o carga el portafolio demo.</td></tr>';
    this.renderResults();
  }

  renderResults() {
    const $ = this.$, debts = this.store.debts;
    this.results = AmortizationEngine.compare(debts, this.store.extra);
    const R = this.results;
    $('alerts').innerHTML = R.min.warnings.map(w => `<div class="alert">⚠ ${esc(w)}</div>`).join('');
    if (!debts.length) {
      $('results').innerHTML = '<p class="empty">Agrega deudas para ver la comparación.</p>';
    } else {
      $('results').innerHTML = ['min', 'snowball', 'avalanche'].map(k => {
        const s = R[k], base = R.min;
        const months = s.finished ? `${s.months} meses` : `${s.months}+ (no se liquida)`;
        let saveMoney = '—', saveMonths = '—';
        if (k !== 'min') {
          if (base.finished && s.finished) { saveMoney = fmt(base.totalPaid - s.totalPaid); saveMonths = `${base.months - s.months} meses`; }
          else if (s.finished) { saveMoney = 'Mínimos nunca liquida'; saveMonths = 'Mínimos nunca liquida'; }
          else { saveMoney = 'N/D'; saveMonths = 'N/D'; }
        }
        return `<article class="res" style="--c:${COLORS[k]}"><h3>${NAMES[k]}</h3><dl>
          <dt>Meses para quedar libre</dt><dd>${months}</dd>
          <dt>Total de intereses</dt><dd>${fmt(s.totalInterest)}</dd>
          <dt>Monto total desembolsado</dt><dd>${fmt(s.totalPaid)}</dd>
          <dt>Ahorro vs. solo mínimos ($)</dt><dd class="save">${saveMoney}</dd>
          <dt>Ahorro vs. solo mínimos (tiempo)</dt><dd class="save">${saveMonths}</dd></dl></article>`;
      }).join('');
    }
    this.chart.draw(R);
    this.renderTimeline();
  }

  renderTimeline() {
    const s = this.results[this.$('strategySel').value], el = this.$('timeline');
    const rows = this.store.debts.filter(d => d.balance > 0).map(d => ({ d, m: s.payoffs[d.id] }))
      .sort((a, b) => (a.m ?? Infinity) - (b.m ?? Infinity));
    el.innerHTML = rows.length
      ? rows.map(({ d, m }) => `<li>${m ? `Mes <b>${m}</b>` : '<b>Sin liquidar</b> en 360 meses'} — ${esc(d.name)} (${fmt(d.balance)})</li>`).join('')
      : '<li class="empty">Sin deudas que mostrar.</li>';
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => new UIController());
if (typeof module !== 'undefined') module.exports = { AmortizationEngine, DebtStore };
