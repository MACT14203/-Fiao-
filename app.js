/* App Fiados – JS (PWA v2.1) */

// ---------- Almacenamiento ----------
const STORAGE_KEY = 'fiados_store_v21';

function loadStore(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { people: [] };
    return JSON.parse(raw);
  }catch{ return { people: [] }; }
}
function saveStore(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
let store = loadStore();

// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const fmt = n => (Number(n||0)).toFixed(2);
const nowStr = () => new Date().toLocaleString('es-PR', {hour12:false});
const uid = () => Math.random().toString(36).slice(2,10);
const escapeHtml = (str='') => str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#039;'}[m]));

// Suma firmada: fiado (+ si no está pagado), crédito (-), ajuste (lo que ponga)
function signedAmount(t){
  const a = Number(t.amount||0);
  if(t.type==='fiado') return t.paid ? 0 : a;
  if(t.type==='credito') return -a;
  if(t.type==='ajuste') return a;
  return a;
}
function personTotal(p){
  return Number(p.transactions.reduce((s,t)=> s + signedAmount(t), 0).toFixed(2));
}
function personStatusClass(p){
  const total = personTotal(p);
  if(total <= 0) return 'green';
  const rem = Number(p.limit) - total;
  if(rem <= 2) return 'red';
  return 'gray';
}
function roleLabel(role){
  return ({estudiante:'Estudiante', maestro:'Maestro', asistente:'Asistente', otro:'Otro'})[role] || role;
}

// ---------- UI refs ----------
const cardsContainer = $('#cardsContainer');
const addPersonBtn = $('#addPersonBtn');
const reportMenuBtn = $('#reportMenuBtn');
const reportMenuWrap = reportMenuBtn.parentElement;
const downloadTxtBtn = $('#downloadTxtBtn');
const downloadPdfBtn = $('#downloadPdfBtn');
const sendWhatsAppBtn = $('#sendWhatsAppBtn');

const roleTabs = $('#roleTabs');
let activeRole = 'all';
const searchInput = $('#searchInput');

// Person modal
const personModal = $('#personModal');
const personModalTitle = $('#personModalTitle');
const personForm = $('#personForm');
const personId = $('#personId');
const personName = $('#personName');
const personRole = $('#personRole');
const personGrade = $('#personGrade');
const personNote = $('#personNote');
const personLimit = $('#personLimit');
const initialAmount = $('#initialAmount');
const initialDesc = $('#initialDesc');
const gradeField = $('#gradeField');
const personCancelBtn = $('#personCancelBtn');

// Detail modal
const detailModal = $('#detailModal');
const detailName = $('#detailName');
const detailMeta = $('#detailMeta');
const detailTotal = $('#detailTotal');
const detailLimit = $('#detailLimit');
const detailRemaining = $('#detailRemaining');
const adjustTarget = $('#adjustTarget');
const applyAdjustBtn = $('#applyAdjustBtn');
const txAmount = $('#txAmount');
const txDesc = $('#txDesc');
const addTxBtn = $('#addTxBtn');
const addCreditBtn = $('#addCreditBtn');
const txList = $('#txList');
const editPersonBtn = $('#editPersonBtn');
const deletePersonBtn = $('#deletePersonBtn');
const closeDetailBtn = $('#closeDetailBtn');

let currentDetailId = null;

// ---------- Render ----------
function render(){
  const term = searchInput.value.trim().toLowerCase();

  const filtered = store.people
    .filter(p => activeRole==='all' ? true : p.role===activeRole)
    .filter(p => p.name.toLowerCase().includes(term))
    .sort((a,b) => a.name.localeCompare(b.name, 'es'));

  cardsContainer.innerHTML = '';

  for(const p of filtered){
    const total = personTotal(p);
    const cls = personStatusClass(p);

    const card = document.createElement('div');
    card.className = `card ${cls}`;
    card.innerHTML = `
      <div class="row">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="badges">
          <span class="badge">${roleLabel(p.role)}</span>
          ${p.role==='estudiante' && p.grade ? `<span class="badge">Grado ${escapeHtml(p.grade)}</span>`:''}
        </div>
      </div>
      <div class="meta">${p.note ? escapeHtml(p.note) : ''}</div>
      <div class="row">
        <div class="meta">Total: $<strong>${fmt(total)}</strong></div>
        <div class="meta">Límite: $${fmt(p.limit)}</div>
      </div>
      <div class="actions">
        <button class="btn" data-action="open" data-id="${p.id}">Abrir</button>
        <button class="btn" data-action="quickadd" data-id="${p.id}">+ Fiado</button>
        <button class="btn" data-action="quickcredit" data-id="${p.id}">+ Crédito</button>
        <button class="btn" data-action="edit" data-id="${p.id}">Editar</button>
        <button class="btn danger" data-action="delete" data-id="${p.id}">Borrar</button>
      </div>
    `;
    cardsContainer.appendChild(card);
  }
}

// ---------- Eventos globales ----------
addPersonBtn.addEventListener('click', () => openPersonModal());
personCancelBtn.addEventListener('click', () => closePersonModal());

personRole.addEventListener('change', () => {
  gradeField.style.display = personRole.value==='estudiante' ? '' : 'none';
});
personForm.addEventListener('submit', savePersonFromModal);

roleTabs.addEventListener('click', (e)=>{
  const btn = e.target.closest('.tab');
  if(!btn) return;
  $$('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  activeRole = btn.dataset.role;
  render();
});

searchInput.addEventListener('input', render);

// Acciones en tarjetas
cardsContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  if(action==='open') openDetail(id);
  if(action==='edit') openPersonModal(id);
  if(action==='delete') {
    if(confirm('¿Eliminar este fiador y todo su historial?')){
      store.people = store.people.filter(x => x.id!==id);
      saveStore(); render();
      if(currentDetailId===id) detailModal.classList.add('hidden');
    }
  }
  if(action==='quickadd') {
    const amount = prompt('Monto fiado ($):');
    if(amount && !isNaN(amount) && Number(amount)>0){
      const desc = prompt('Descripción (opcional):') || '';
      addTransaction(id, Number(amount), desc, 'fiado');
    }
  }
  if(action==='quickcredit') {
    const amount = prompt('Monto del crédito ($):');
    if(amount && !isNaN(amount) && Number(amount)>0){
      const desc = prompt('Descripción (opcional):') || '';
      addTransaction(id, Number(amount), desc, 'credito');
    }
  }
});

// Menú de reportes
reportMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  reportMenuWrap.classList.toggle('open');
});
document.addEventListener('click', (e)=>{
  if(!reportMenuWrap.contains(e.target)){
    reportMenuWrap.classList.remove('open');
  }
});

// Resúmenes
downloadTxtBtn.addEventListener('click', () => {
  const txt = buildSummaryText();
  const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fiados_resumen_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  reportMenuWrap.classList.remove('open');
});

downloadPdfBtn.addEventListener('click', async () => {
  const txt = buildSummaryText();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'a4'});
  const lines = doc.splitTextToSize(txt, 520);
  doc.setFont('helvetica','');
  doc.setFontSize(12);
  doc.text(lines, 40, 50);
  doc.save(`fiados_resumen_${Date.now()}.pdf`);
  reportMenuWrap.classList.remove('open');
});

sendWhatsAppBtn.addEventListener('click', () => {
  const txt = buildSummaryText();
  const number = '17874582646'; // +1 Puerto Rico
  const url = `https://wa.me/${number}?text=${encodeURIComponent(txt)}`;
  window.open(url, '_blank');
  reportMenuWrap.classList.remove('open');
});

// ---------- Modal Persona ----------
function openPersonModal(id=null){
  personForm.reset();
  personId.value = id || '';
  gradeField.style.display = 'none';
  if(id){
    const p = store.people.find(x => x.id===id);
    if(!p) return;
    personModalTitle.textContent = 'Editar fiador';
    personName.value = p.name;
    personRole.value = p.role;
    gradeField.style.display = p.role==='estudiante' ? '' : 'none';
    personGrade.value = p.grade || '';
    personNote.value = p.note || '';
    personLimit.value = p.limit ?? 10;
    initialAmount.value = 0;
    initialDesc.value = '';
  }else{
    personModalTitle.textContent = 'Nuevo fiador';
    personLimit.value = 10;
  }
  personModal.classList.remove('hidden');
  personName.focus();
}
function closePersonModal(){
  personModal.classList.add('hidden');
}
function savePersonFromModal(e){
  e.preventDefault();
  const id = personId.value || uid();
  const name = personName.value.trim();
  const role = personRole.value;
  const grade = role==='estudiante' ? personGrade.value.trim() : '';
  const note = personNote.value.trim();
  const limit = Number(personLimit.value || 0);
  const initAmt = Number(initialAmount.value || 0);
  const initDesc = initialDesc.value.trim();

  if(!name || !role) return alert('Nombre y Rol son requeridos.');
  if(isNaN(limit) || limit < 0) return alert('Límite inválido.');

  let p = store.people.find(x => x.id===id);
  if(!p){
    p = { id, name, role, grade, note, limit, createdAt: nowStr(), transactions: [] };
    store.people.push(p);
  }else{
    p.name = name; p.role = role; p.grade = grade; p.note = note; p.limit = limit;
  }
  if(initAmt && initAmt > 0){
    p.transactions.push({
      id: uid(),
      date: nowStr(),
      type: 'fiado',
      amount: Number(initAmt),
      description: initDesc || 'Registro inicial',
      paid: false
    });
  }
  saveStore();
  render();
  closePersonModal();
}

// ---------- Detalle / Movimientos ----------
function openDetail(id){
  const p = store.people.find(x => x.id===id);
  if(!p) return;
  currentDetailId = id;

  detailName.textContent = p.name;
  detailMeta.textContent = [
    roleLabel(p.role),
    (p.role==='estudiante' && p.grade ? `Grado ${p.grade}` : ''),
    (p.note||'')
  ].filter(Boolean).join(' • ');
  refreshDetail();
  detailModal.classList.remove('hidden');

  editPersonBtn.onclick = () => openPersonModal(id);
  deletePersonBtn.onclick = () => {
    if(confirm('¿Eliminar este fiador y todo su historial?')){
      store.people = store.people.filter(x => x.id!==id);
      saveStore(); render();
      detailModal.classList.add('hidden');
    }
  };
}
function closeDetail(){
  detailModal.classList.add('hidden');
  currentDetailId = null;
}
closeDetailBtn.addEventListener('click', closeDetail);

function refreshDetail(){
  const p = store.people.find(x => x.id===currentDetailId);
  if(!p) return;
  const total = personTotal(p);
  detailTotal.textContent = fmt(total);
  detailLimit.textContent = fmt(p.limit);
  detailRemaining.textContent = fmt(Math.max(0, Number(p.limit)-total));
  adjustTarget.value = '';

  // Historial (más reciente primero)
  const txs = [...p.transactions].sort((a,b)=> new Date(b.date) - new Date(a.date));
  txList.innerHTML = '';
  for(const t of txs){
    const row = document.createElement('div');
    row.className = `tx ${t.type}`;
    const desc = t.description ? ` • ${escapeHtml(t.description)}` : '';
    row.innerHTML = `
      <div>
        <div class="desc"><strong>${t.type==='ajuste'?'Ajuste':(t.type==='credito'?'Crédito':'Fiado')}</strong>${desc}</div>
        <div class="date">${t.date}${t.paid?` · <span class="paid" style="color:#9be4b0">CANCELADO</span>`:''}</div>
      </div>
      <div class="amount">$${fmt(t.amount)}</div>
      <div class="row">
        ${t.type==='fiado' && !t.paid ? `<button class="btn" data-act="pay" data-id="${t.id}">Cancelar fiado</button>` : ''}
        <button class="btn danger" data-act="del" data-id="${t.id}">Borrar</button>
      </div>
    `;
    // Eventos por fila
    row.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const act = b.dataset.act;
        if(act==='pay'){
          t.paid = true;
        }else if(act==='del'){
          if(confirm('¿Eliminar esta transacción?')){
            p.transactions = p.transactions.filter(x => x.id!==t.id);
          } else {
            return;
          }
        }
        saveStore();
        refreshDetail();
        render();
      });
    });
    txList.appendChild(row);
  }

  // Añadir movimientos
  addTxBtn.onclick = () => {
    const amt = Number(txAmount.value);
    if(isNaN(amt) || amt<=0) return alert('Monto inválido.');
    addTransaction(p.id, amt, txDesc.value.trim(), 'fiado');
    txAmount.value = '';
    txDesc.value = '';
  };
  addCreditBtn.onclick = () => {
    const amt = Number(txAmount.value);
    if(isNaN(amt) || amt<=0) return alert('Monto inválido.');
    addTransaction(p.id, amt, txDesc.value.trim(), 'credito');
    txAmount.value = '';
    txDesc.value = '';
  };

  // Ajuste directo a un total objetivo
  applyAdjustBtn.onclick = () => {
    const target = Number(adjustTarget.value);
    if(isNaN(target) || target<0) return alert('Monto objetivo inválido.');
    const current = personTotal(p);
    const diff = Number((target - current).toFixed(2));
    if(diff === 0) return alert('Ya estás en ese total.');
    p.transactions.push({
      id: uid(),
      date: nowStr(),
      type: 'ajuste',
      amount: diff,
      description: `Ajuste para llevar total a $${fmt(target)}`,
      paid: false
    });
    saveStore();
    refreshDetail();
    render();
  };
}

function addTransaction(personId, amount, description='', type='fiado'){
  const p = store.people.find(x => x.id===personId);
  if(!p) return;
  p.transactions.push({
    id: uid(),
    date: nowStr(),
    type,
    amount: Number(amount),
    description,
    paid: false
  });
  saveStore();
  if(currentDetailId===personId) refreshDetail();
  render();
}

// ---------- Resumen de texto ----------
function buildSummaryText(){
  let lines = [];
  lines.push(`Resumen de fiados – ${nowStr()}`);
  lines.push(`Total de personas: ${store.people.length}`);
  lines.push('='.repeat(60));

  const sorted = [...store.people].sort((a,b)=>a.name.localeCompare(b.name,'es'));
  for(const p of sorted){
    const total = personTotal(p);
    lines.push(`${p.name} (${roleLabel(p.role)}${p.role==='estudiante' && p.grade ? ` • Grado ${p.grade}`:''})`);
    lines.push(`  Nota: ${p.note || '-'}`);
    lines.push(`  Límite: $${fmt(p.limit)} · Total a deber: $${fmt(total)}`);
    const txs = [...p.transactions].sort((a,b)=> new Date(a.date)-new Date(b.date));
    for(const t of txs){
      const tname = t.type==='ajuste'?'Ajuste':(t.type==='credito'?'Crédito':'Fiado');
      const sign = t.type==='credito' ? '+' : '';
      lines.push(`  - ${t.date} · ${tname} ${sign}$${fmt(t.amount)}${t.description?` · ${t.description}`:''}${t.paid?' · CANCELADO':''}`);
    }
    lines.push('-'.repeat(60));
  }
  return lines.join('\n');
}

// ---------- Cerrar modales tocando fuera ----------
[personModal, detailModal].forEach(mod=>{
  mod.addEventListener('click', (e) => {
    if(e.target===mod) mod.classList.add('hidden');
  });
});

// ---------- Init ----------
render();
