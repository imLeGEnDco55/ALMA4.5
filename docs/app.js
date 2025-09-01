// ===== Config mínima =====
const DEFAULT_FILE = '@Main.md';
const DEFAULT_BRANCH = 'main';

// Intenta inferir owner/repo desde la URL de Pages: user.github.io/repo
const [ownerGuess, repoGuess] = (() => {
  const parts = location.pathname.split('/').filter(Boolean);
  // e.g. /ALMA45/ -> ["ALMA45"]
  const repo = parts.length ? parts[0] : '';
  const host = location.host; // user.github.io
  const owner = host.split('.')[0];
  return [owner, repo];
})();

const REPO_OWNER = ownerGuess || 'imLeGEnDco55'; // fallback
const REPO_NAME  = repoGuess  || 'ALMA45';       // fallback

// ===== Helpers =====
const $ = s => document.querySelector(s);
function md(t) {
  // opcional: oculta front‑matter YAML del inicio
  t = t.replace(/^---[\s\S]*?---\s*/,'');
  marked.setOptions({ mangle:false, headerIds:true });
  const raw = marked.parse(t);
  return DOMPurify.sanitize(raw);
}

// ===== UI refs =====
const preview = $('#preview');
const editor  = $('#editor');
const counts  = $('#counts');
const bar     = $('#bar');
const limitSel= $('#limit');

const crumbPath = $('#path');
const repoTitle = $('#repo');

const drawer = $('#drawer');
const panel  = $('#panel');
const filelist = $('#filelist');
const search = $('#search');

const btnDrawer = $('#btn-drawer');
const btnCloseDrawer = $('#btn-close-drawer');
const btnPanel = $('#btn-panel');
const btnClosePanel = $('#btn-close-panel');

const toggleEdit = $('#toggle-edit');
const toolbar = $('#toolbar');
const btnAccept = $('#btn-accept');
const btnExportMD = $('#btn-export-md');
const btnExportHTML = $('#btn-export-html');
const btnExportPDF = $('#btn-export-pdf');

// ===== State =====
let currentPath = DEFAULT_FILE;
let currentText = '';
let files = [];

// ===== Init =====
repoTitle.textContent = `${REPO_OWNER}/${REPO_NAME}`;

btnDrawer.onclick = () => drawer.classList.add('open');
btnCloseDrawer.onclick = () => drawer.classList.remove('open');
btnPanel.onclick = () => panel.classList.add('open');
btnClosePanel.onclick = () => panel.classList.remove('open');

toggleEdit.onchange = () => setEditMode(toggleEdit.checked);
btnAccept.onclick = downloadMD;
btnExportMD.onclick = downloadMD;
btnExportHTML.onclick = downloadHTML;
btnExportPDF.onclick = () => window.print();

limitSel.onchange = () => updateCounts(editor.hidden ? currentText : editor.value);

// Toolbar commands
toolbar.addEventListener('click', (e)=>{
  if (!e.target.dataset.cmd) return;
  const cmd = e.target.dataset.cmd;
  applyCmd(cmd);
});

// Filtro lista
search.addEventListener('input', ()=>{
  const q = search.value.toLowerCase();
  renderList(files.filter(f => f.toLowerCase().includes(q)));
});

// Load tree and initial file
loadTree().then(()=>{
  // Permite ?file=path.md
  const url = new URL(location.href);
  const qp = url.searchParams.get('file');
  if (qp && files.includes(qp)) currentPath = qp;
  openFile(currentPath);
});

// ===== Functions =====
async function loadTree(){
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${DEFAULT_BRANCH}?recursive=1`;
  const res = await fetch(api);
  const data = await res.json();
  files = (data.tree || [])
    .filter(x => x.type === 'blob' && x.path.toLowerCase().endsWith('.md'))
    .map(x => x.path)
    .sort((a,b)=> a.localeCompare(b, 'es', {sensitivity:'base'}));
  renderList(files);
}
function renderList(list){
  filelist.innerHTML = '';
  list.forEach(p=>{
    const li = document.createElement('li');
    li.textContent = p;
    li.onclick = ()=> { drawer.classList.remove('open'); openFile(p); };
    filelist.appendChild(li);
  });
}
async function openFile(path){
  currentPath = path;
  crumbPath.textContent = path;
  const raw = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${DEFAULT_BRANCH}/${encodeURI(path)}`;
  const res = await fetch(raw);
  currentText = await res.text();
  preview.innerHTML = md(currentText);
  // crea id de ancla en headers si no lo puso marked
  preview.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h=>{
    if (!h.id) {
      h.id = h.textContent.trim()
        .toLowerCase()
        .replace(/[^\w\- ]+/g,'')
        .replace(/\s+/g,'-');
    }
    h.style.cursor = 'pointer';
    h.addEventListener('click', ()=>{
      const url = new URL(location.href);
      url.hash = h.id;
      history.replaceState(null, '', url);
    });
  });
  // si llega con #hash, scrollea
  if (location.hash) {
    const t = preview.querySelector(location.hash);
    if (t) t.scrollIntoView({behavior:'smooth', block:'start'});
  }
  editor.value = currentText;
  updateCounts(currentText);
  // Modo lectura por defecto
  setEditMode(false);
  // Mueve al top
  window.scrollTo({top:0, behavior:'instant'});
  // Actualiza querystring
  const url = new URL(location.href);
  url.searchParams.set('file', path);
  history.replaceState(null, '', url);
  // hace que los enlaces a .md abran dentro del viewer
  preview.querySelectorAll('a[href]').forEach(a=>{
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.endsWith('.md')) {
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        const next = decodeURI(href);
        // soporta rutas relativas como Codex/Tarot.md
        openFile(next);
      });
    } else if (href.startsWith('#')) {
      // permitir anclas internas
    } else {
      // externos en nueva pestaña
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener');
    }
  });
}
function setEditMode(on){
  toggleEdit.checked = on;
  toolbar.hidden = !on;
  editor.hidden = !on;
  preview.style.display = on ? 'none' : 'block';
  if (on) editor.focus();
}
function updateCounts(txt){
  const chars = txt.length;
  const words = (txt.match(/\b\w+\b/g) || []).length;
  const paras = (txt.trim().split(/\n{2,}/).filter(Boolean)).length || (txt.trim()?1:0);
  counts.textContent = `${chars} chars · ${words} palabras · ${paras} párrafos`;
  const lim = parseInt(limitSel.value,10) || 0;
  if (lim>0){
    let pct = Math.min(100, Math.round(chars/lim*100));
    bar.style.width = pct + '%';
  } else {
    bar.style.width = '0';
  }
}
editor.addEventListener('input', ()=>{
  updateCounts(editor.value);
  // Render “fantasma” para ver cómo quedará mientras editas (opcional)
  preview.innerHTML = md(editor.value);
});

function applyCmd(cmd){
  const t = editor;
  const [start,end] = [t.selectionStart, t.selectionEnd];
  const selected = t.value.slice(start,end);
  const wrap = (pre, post=pre)=> t.value = t.value.slice(0,start) + pre + selected + post + t.value.slice(end);
  if (cmd==='bold') wrap('**');
  if (cmd==='italic') wrap('*');
  if (cmd==='h2') wrap('\n\n## ','\n\n');
  if (cmd==='h3') wrap('\n\n### ','\n\n');
  if (cmd==='ul') wrap('\n- ','');
  if (cmd==='quote') wrap('\n> ','');
  if (cmd==='code') wrap('`','`');
  // recolocar cursor al final del bloque insertado
  setTimeout(()=> t.focus(), 0);
}

function downloadMD(){
  const blob = new Blob([editor.value], {type:'text/markdown;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // sugerir mismo nombre
  a.download = currentPath.split('/').pop();
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadHTML(){
  // empaqueta el HTML renderizado del preview
  const content = `<!doctype html><meta charset="utf-8"><title>${currentPath}</title>
  <style>body{font-family:serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.7}
  h1,h2,h3{font-family:sans-serif}</style>
  <article>${preview.innerHTML}</article>`;
  const blob = new Blob([content], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = currentPath.replace(/\//g,'_').replace('.md','') + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Scroll progress (línea finita implícita en topbar? usamos barra inferior)
document.addEventListener('scroll', ()=>{
  // nada por ahora (ya tenemos barra de límite); si quieres progreso de scroll lo añadimos luego
});
