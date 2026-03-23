// ═══════════════════════════════════════════════════════════
//  FAST FRAME — script.js  (auditado, sem declarações duplicadas)
// ═══════════════════════════════════════════════════════════

// ── Estado global ──
let qImg=null, cImg=null, wEnvImg=null, wArtImg=null;
let customW=null, customH=null;
let wallFrameColor='#3C2F1E';
let ppActive=false, ppColor='#FFFFFF';
let splitOrient='h';  // 'h', 'v', 'grid'
let gridCols=2, gridRows=2;
let partWidths=[1], partHeights=[1];
let totalWcm=null, totalHcm=null;
let enhOrigCanvas=null, enhScale=1, enhFilter='none';


// ─────────────────────────────────────────────────────────
//  NOME DO ARQUIVO — prompt nativo
// ─────────────────────────────────────────────────────────
function askFileName(suffix, callback) {
  // Sugestão baseada no arquivo carregado
  let suggestion = 'fastframe';
  if (typeof qImg !== 'undefined' && qImg && qImg.file) {
    suggestion = qImg.file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  }
  const suggestedName = suggestion + '-' + suffix;

  // Detecta se o formato é PDF ou JPG pelo sufixo do callback
  // O callback vai chamar esta função com o nome final — precisamos saber o tipo
  // Guardamos para uso no saveWithPicker
  askFileName._lastSuffix = suffix;
  askFileName._lastCallback = callback;
  askFileName._lastSuggested = suggestedName;

  // Tenta usar File System Access API (Chrome/Edge)
  if (window.showSaveFilePicker) {
    // Determina extensão: será definida por quem chama (pdf ou jpg)
    // Não sabemos ainda — deixamos o callback decidir via _saveAs
    callback(suggestedName); // passa o nome sugerido, o download usará _saveAs
  } else {
    // Fallback: prompt simples
    const input = prompt('Nome do arquivo (sem extensão):', suggestedName.replace(/-[^-]+$/, '').replace(/-$/, ''));
    if (input === null) return;
    const base = (input.trim() || suggestion).replace(/[^a-zA-Z0-9\u00C0-\u00FF\s\-_]/g, '').replace(/\s+/g, '-').toLowerCase();
    callback(base + '-' + suffix);
  }
}

// Salva um Blob com janela nativa do sistema operacional
async function _saveAs(blob, suggestedName, mimeType) {
  const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
  const fullName = suggestedName.endsWith('.' + ext) ? suggestedName : suggestedName + '.' + ext;

  if (window.showSaveFilePicker) {
    try {
      const types = ext === 'pdf'
        ? [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
        : [{ description: 'Imagem JPEG', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }];

      const handle = await window.showSaveFilePicker({
        suggestedName: fullName,
        types
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // usuário cancelou
      // Fallback se der erro inesperado
    }
  }
  // Fallback: download automático
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fullName;
  a.click();
  return true;
}


// ─────────────────────────────────────────────────────────
//  NAVEGAÇÃO
// ─────────────────────────────────────────────────────────
function switchTab(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  // Sync desktop nav
  document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));
  // Sync mobile nav
  document.querySelectorAll('[data-mobilenav]').forEach(b=>b.classList.toggle('active',b.dataset.mobilenav===id));
  // Re-render simulação de quadros
  if(id==='simquadro'&&typeof sqImg!=='undefined'&&sqImg) requestAnimationFrame(()=>renderFrame());
  // Auto-popular simulação de quadros a partir da imagem carregada
  if(id==='simquadro'&&!sqImg&&typeof qImg!=='undefined'&&qImg){
    const box=document.getElementById('sqUploadBox');
    if(box&&box.style.display!=='none'){ sqImg=qImg; showSQ(); toast('Usando a imagem carregada em Imagem & Qualidade.'); }
  }
  // Auto-popular divisão a partir da imagem carregada
  if(id==='canvas'&&!cImg&&typeof qImg!=='undefined'&&qImg){
    const results=document.getElementById('cResults');
    if(results&&results.style.display==='none'){
      cImg=qImg;
      const box=document.getElementById('cUploadBox');
      if(box) box.style.display='none';
      showC();
      toast('Usando a imagem carregada em Imagem & Qualidade.');
    }
  }
}

// ─────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3200);
}

// ─────────────────────────────────────────────────────────
//  DRAG & DROP
// ─────────────────────────────────────────────────────────
function dov(e,zid){ e.preventDefault(); document.getElementById(zid).classList.add('drag'); }
function dol(e,zid){ document.getElementById(zid).classList.remove('drag'); }

function dod(e,zid,type){
  e.preventDefault();
  document.getElementById(zid).classList.remove('drag');
  const file=e.dataTransfer.files[0];
  if(!file) return;
  // aceitar PDF ou imagem
  const isPDF=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
  if(!isPDF&&!file.type.startsWith('image/')) return toast('Envie uma imagem ou PDF válido.');
  loadImgFile(file,type);
}

// ─────────────────────────────────────────────────────────
//  CARREGAR IMAGEM / PDF
// ─────────────────────────────────────────────────────────
function loadQ(e){ loadImgFile(e.target.files[0],'q'); }
function loadC(e){ loadImgFile(e.target.files[0],'c'); }

function loadImgFile(file,type){
  if(!file) return;
  if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
    loadPDF(file,type); return;
  }
  const run=(blob)=>{
    const imgEl=new Image();
    imgEl.onload=()=>{
      const d2={img:imgEl,file,w:imgEl.naturalWidth,h:imgEl.naturalHeight};
      if(type==='q'){ qImg=d2; showQ(); }
      else if(type==='sq'){ sqImg=d2; showSQ(); }
      else           { cImg=d2; showC(); }
    };
    imgEl.src=URL.createObjectURL(blob);
  };
  (file.type==='image/heic'||file.type==='image/heif')
    ? heic2any({blob:file,toType:'image/jpeg',quality:.9}).then(run)
    : run(file);
}

function loadPDF(file,type){
  const url=URL.createObjectURL(file);
  const pdfImg=new Image();
  pdfImg.onload=()=>{
    _dispatchImg({img:pdfImg,file,w:pdfImg.naturalWidth||800,h:pdfImg.naturalHeight||600},type);
    URL.revokeObjectURL(url);
  };
  pdfImg.onerror=()=>{
    URL.revokeObjectURL(url);
    const c=document.createElement('canvas'); c.width=800; c.height=600;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#F4F4F4'; ctx.fillRect(0,0,800,600);
    ctx.fillStyle='#1A3051'; ctx.font='bold 26px sans-serif'; ctx.textAlign='center';
    ctx.fillText('PDF: '+file.name,400,260);
    ctx.font='17px sans-serif'; ctx.fillStyle='#666';
    ctx.fillText('Converta para JPG ou PNG para melhor resultado',400,310);
    c.toBlob(blob=>{
      const fi=new Image();
      fi.onload=()=>{ _dispatchImg({img:fi,file,w:800,h:600},type); };
      fi.src=URL.createObjectURL(blob);
    });
  };
  pdfImg.src=url;
}

// ─────────────────────────────────────────────────────────
//  MOTOR DE QUALIDADE
// ─────────────────────────────────────────────────────────
function qualityLevel(imgW,imgH,printCmW,printCmH){
  const dpi=Math.round(Math.min(imgW/(printCmW/2.54),imgH/(printCmH/2.54)));
  if(dpi>=250) return{level:5,label:'⭐ Perfeita',         color:'#2E7D52',bg:'#EBF7F0',icon:'✅'};
  if(dpi>=180) return{level:4,label:'👍 Muito boa',        color:'#3A6E2A',bg:'#EFF6EB',icon:'✅'};
  if(dpi>=120) return{level:3,label:'👌 Boa',              color:'#8B6400',bg:'#FDF6E3',icon:'⚠️'};
  if(dpi>=80)  return{level:2,label:'⚠️ Aceitável',        color:'#A0520A',bg:'#FEF0E4',icon:'⚠️'};
  return              {level:1,label:'❌ Não recomendado', color:'#9B2020',bg:'#FDECEC',icon:'❌'};
}

function qualityBar(level){
  const fills=['#9B2020','#C06020','#B8903C','#3A6E2A','#2E7D52'];
  const bars=[];
  for(let i=1;i<=5;i++)
    bars.push(`<div style="flex:1;height:8px;border-radius:4px;background:${i<=level?fills[level-1]:'#E0DAD0'};transition:background .3s"></div>`);
  return `<div style="display:flex;gap:4px;margin-top:6px">${bars.join('')}</div>`;
}

function maxPrintCm(imgW,imgH){
  const mn=Math.min(imgW,imgH), mx=Math.max(imgW,imgH);
  const mnC=Math.floor(mn/180*2.54), mxC=Math.floor(mx/180*2.54);
  return imgW>=imgH ? [mxC,mnC] : [mnC,mxC];
}

// ─────────────────────────────────────────────────────────
//  ABA QUADROS
// ─────────────────────────────────────────────────────────
function showQ(){
  const{img,file,w,h}=qImg;
  document.getElementById('qThumb').style.display='block';
  document.getElementById('qThumb').innerHTML=buildThumb(img.src,file.name,w,h,file.size,'resetQ()');
  document.getElementById('pxDisp').innerHTML=w.toLocaleString()+' × '+h.toLocaleString()+' px';

  const mp=w*h/1e6;
  let qlabel,qcolor,qdesc;
  if(mp>=12)     { qlabel='⭐⭐⭐ Alta resolução'; qcolor='#2E7D52'; qdesc='Ideal para quadros grandes'; }
  else if(mp>=6) { qlabel='⭐⭐ Boa resolução';    qcolor='#3A6E2A'; qdesc='Ótima para a maioria dos tamanhos'; }
  else if(mp>=2) { qlabel='⭐ Resolução média';    qcolor='#8B6400'; qdesc='Adequada para quadros pequenos e médios'; }
  else           { qlabel='Resolução baixa';       qcolor='#9B2020'; qdesc='Recomendada apenas para quadros pequenos'; }

  document.getElementById('imgQuality').innerHTML=
    `<div style="font-size:18px;font-weight:700;color:${qcolor}">${qlabel}</div>
     <div style="font-size:12px;color:#8C8278;margin-top:3px">${qdesc}</div>`;

  const[mw,mh]=maxPrintCm(w,h);
  document.getElementById('maxSize').innerHTML=
    `<span style="font-size:28px;font-weight:800;color:var(--brown)">${mw} × ${mh} cm</span>
     <div style="font-size:12px;color:var(--gray);margin-top:4px">Maior tamanho com ótima qualidade</div>`;

  const sizes=[[20,30],[30,40],[40,50],[40,60],[50,70],[60,80],[60,90],[70,100],[80,100],[80,120],[100,150],[120,160],[120,180]];
  const tb=document.getElementById('sugTb');
  tb.innerHTML='';
  sizes.forEach(([sw,sh])=>{
    const q=qualityLevel(w,h,sw,sh);
    tb.innerHTML+=`<tr>
      <td style="font-weight:600">${sw} × ${sh} cm</td>
      <td>${qualityBar(q.level)}</td>
      <td><span style="background:${q.bg};color:${q.color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap">${q.label}</span></td>
    </tr>`;
  });

  document.getElementById('qResults').style.display='block';
  document.getElementById('enhCard').style.display='block';
  initEnhFromQImg();
  suggestFileNameFromImage(img);
}

function checkCustom(){
  const w=parseFloat(document.getElementById('cW').value);
  const h=parseFloat(document.getElementById('cH').value);
  if(!w||!h||!qImg) return toast('Informe a largura e a altura em cm.');
  customW=w; customH=h;

  const q=qualityLevel(qImg.w,qImg.h,w,h);
  const el=document.getElementById('cRes');
  el.style.display='block';
  el.innerHTML=`
    <div style="background:${q.bg};border-radius:6px;padding:14px 16px">
      <div style="font-size:17px;font-weight:700;color:${q.color};margin-bottom:4px">${q.icon} ${q.label}</div>
      <div style="font-size:12px;color:#5A4530">Para um quadro de <strong>${w} × ${h} cm</strong></div>
      ${qualityBar(q.level)}
    </div>`;

  document.getElementById('previewSizeLabel').textContent=`${w} × ${h} cm`;

  const cvs=document.getElementById('previewCanvas');
  const ctx=cvs.getContext('2d');
  const ratio=w/h;
  const maxS=300;
  let dw,dh;
  if(w>=h){ dw=maxS; dh=dw/ratio; } else { dh=maxS; dw=dh*ratio; }
  cvs.width=dw; cvs.height=dh;
  ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,dw,dh);
  ctx.drawImage(qImg.img,0,0,dw,dh);
  ctx.strokeStyle='rgba(26,48,81,0.25)'; ctx.lineWidth=1;
  ctx.strokeRect(0,0,dw,dh);
  document.getElementById('cPreview').style.display='block';
}

function openPreviewModal(){
  if(!qImg) return;
  const w=parseFloat(document.getElementById('cW').value);
  const h=parseFloat(document.getElementById('cH').value);
  if(!w||!h) return;

  const modal=document.getElementById('previewModal');
  const cvs=document.getElementById('largePreviewCanvas');
  const ctx=cvs.getContext('2d');

  let dw=Math.min(700,window.innerWidth*.8);
  let dh=dw/(w/h);
  const mH=window.innerHeight*.65;
  if(dh>mH){ dh=mH; dw=dh*(w/h); }

  cvs.width=Math.round(dw); cvs.height=Math.round(dh);
  ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,cvs.width,cvs.height);
  ctx.drawImage(qImg.img,0,0,cvs.width,cvs.height);
  ctx.strokeStyle='rgba(26,48,81,0.5)'; ctx.lineWidth=3;
  ctx.strokeRect(1.5,1.5,cvs.width-3,cvs.height-3);

  document.getElementById('previewModalSize').textContent=`Tamanho real: ${w} × ${h} cm`;
  modal.style.display='flex';
  document.body.style.overflow='hidden';
}

function closePreviewModal(){
  document.getElementById('previewModal').style.display='none';
  document.body.style.overflow='auto';
}

function resetQ(){
  qImg=null;
  customW=null; customH=null;
  document.getElementById('qThumb').style.display='none';
  document.getElementById('qResults').style.display='none';
  document.getElementById('qFile').value='';
  document.getElementById('cRes').style.display='none';
  document.getElementById('cPreview').style.display='none';
  document.getElementById('enhCard').style.display='none';
  enhOrigCanvas=null; enhScale=1;
  resetEnhSliders();
}

// ─────────────────────────────────────────────────────────
//  ABA CANVAS — divisão livre
// ─────────────────────────────────────────────────────────
function showC(){
  document.getElementById('cResults').style.display='block';
  const box=document.getElementById('cUploadBox');
  if(box) box.style.display='none';

  const[mw,mh]=maxPrintCm(cImg.w,cImg.h);
  totalWcm = customW || mw;
  totalHcm = customH || mh;
  document.getElementById('totalW').value=totalWcm;
  document.getElementById('totalH').value=totalHcm;
  partWidths=[totalWcm]; partHeights=[totalHcm];
  buildPartSizesTable();
  updateCInfo();
  requestAnimationFrame(()=>renderSplit());
}

function updateCInfo(){
  if(!cImg) return;
  const[mw,mh]=maxPrintCm(cImg.w,cImg.h);
  let info=`<strong style="color:var(--brown)">${cImg.file.name}</strong><br>`+
           `${cImg.w.toLocaleString()} × ${cImg.h.toLocaleString()} px · ${fmtB(cImg.file.size)}<br>`+
           `<span style="font-size:11px;color:var(--gray)">Maior tamanho recomendado: ${mw} × ${mh} cm</span>`;
  if(totalWcm&&totalHcm)
    info+=`<br><span style="font-size:11px;color:var(--brown)">Tamanho definido: ${totalWcm} × ${totalHcm} cm</span>`;
  document.getElementById('cInfo').innerHTML=info;
}

function setOrient(dir,btn){
  splitOrient=dir;
  document.querySelectorAll('.orient-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Mostrar/esconder controles de grade
  const gridControls=document.getElementById('gridControls');
  const numPartsRow=document.getElementById('numPartsRow');
  if(gridControls) gridControls.style.display=dir==='grid'?'block':'none';
  if(numPartsRow)  numPartsRow.style.display=dir==='grid'?'none':'flex';
  onNumPartsChange();
}

function onNumPartsChange(){
  const w=totalWcm||(cImg?maxPrintCm(cImg.w,cImg.h)[0]:100);
  const h=totalHcm||(cImg?maxPrintCm(cImg.w,cImg.h)[1]:70);
  if(splitOrient==='grid'){
    gridCols=parseInt(document.getElementById('gridCols')?.value)||2;
    gridRows=parseInt(document.getElementById('gridRows')?.value)||2;
    const n=gridCols*gridRows;
    partWidths =Array(n).fill(+(w/gridCols).toFixed(1));
    partHeights=Array(n).fill(+(h/gridRows).toFixed(1));
  } else {
    const n=parseInt(document.getElementById('numParts').value)||1;
    if(splitOrient==='h'){
      partWidths =Array(n).fill(+(w/n).toFixed(1));
      partHeights=Array(n).fill(h);
    } else {
      partWidths =Array(n).fill(w);
      partHeights=Array(n).fill(+(h/n).toFixed(1));
    }
  }
  buildPartSizesTable();
  renderSplit();
}

function applyDimensions(){
  const w=parseFloat(document.getElementById('totalW').value);
  const h=parseFloat(document.getElementById('totalH').value);
  if(!w||!h) return toast('Informe largura e altura.');
  totalWcm=w; totalHcm=h;
  if(splitOrient==='grid'){
    gridCols=parseInt(document.getElementById('gridCols')?.value)||2;
    gridRows=parseInt(document.getElementById('gridRows')?.value)||2;
    const n=gridCols*gridRows;
    partWidths =Array(n).fill(+(w/gridCols).toFixed(1));
    partHeights=Array(n).fill(+(h/gridRows).toFixed(1));
  } else {
    const n=parseInt(document.getElementById('numParts').value)||1;
    if(splitOrient==='h'){
      partWidths =Array(n).fill(+(w/n).toFixed(1));
      partHeights=Array(n).fill(h);
    } else {
      partWidths =Array(n).fill(w);
      partHeights=Array(n).fill(+(h/n).toFixed(1));
    }
  }
  buildPartSizesTable();
  updateCInfo();
  renderSplit();
  toast('Dimensões aplicadas!');
}

function buildPartSizesTable(){
  const n=partWidths.length;
  const card=document.getElementById('partSizesCard');
  const tbody=document.getElementById('partSizesTbody');
  card.style.display=n>1?'block':'none';
  if(n<=1) return;
  tbody.innerHTML='';
  for(let i=0;i<n;i++){
    tbody.innerHTML+=`<tr>
      <td style="font-weight:600;color:var(--brown)">Parte ${i+1}</td>
      <td><input type="number" id="pw${i}" value="${partWidths[i]}" min="1" step="0.5"></td>
      <td><input type="number" id="ph${i}" value="${partHeights[i]}" min="1" step="0.5"></td>
    </tr>`;
  }
}

function applyPartSizes(){
  const n=partWidths.length;
  for(let i=0;i<n;i++){
    const wv=parseFloat(document.getElementById('pw'+i).value);
    const hv=parseFloat(document.getElementById('ph'+i).value);
    if(!wv||!hv) return toast('Preencha todos os campos.');
    partWidths[i]=wv; partHeights[i]=hv;
  }
  renderSplit();
  toast('Composição aplicada!');
}

function renderSplit(){
  if(!cImg) return;
  const{img,w:imgW,h:imgH}=cImg;
  const cvs=document.getElementById('splitCanvas');
  // Gap branco visível entre painéis (simula espaço real entre chassi)
  const PANEL_GAP=12; // px no display

  let avail=cvs.parentElement.offsetWidth-28;
  if(avail<=0) avail=600;
  const maxW=Math.min(avail,820);
  const maxH=520;

  if(splitOrient==='grid'){
    const cols=gridCols, rows=gridRows;
    const n=cols*rows;
    const cellW=partWidths[0]  || (totalWcm||100)/cols;
    const cellH=partHeights[0] || (totalHcm||70)/rows;
    const totW=cellW*cols, totH=cellH*rows;

    const scaleW=(maxW - PANEL_GAP*(cols-1))/totW;
    const scaleH=(maxH - PANEL_GAP*(rows-1))/totH;
    const scale=Math.min(scaleW,scaleH);

    const cellWpx=Math.round(cellW*scale);
    const cellHpx=Math.round(cellH*scale);
    cvs.width =cols*cellWpx + PANEL_GAP*(cols-1);
    cvs.height=rows*cellHpx + PANEL_GAP*(rows-1);

    const ctx=cvs.getContext('2d');
    // Fundo branco entre painéis
    ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,cvs.width,cvs.height);

    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const dx=c*(cellWpx+PANEL_GAP);
        const dy=r*(cellHpx+PANEL_GAP);
        const srcX=Math.round(c*imgW/cols);
        const srcY=Math.round(r*imgH/rows);
        const srcW=Math.round(imgW/cols);
        const srcH=Math.round(imgH/rows);
        ctx.drawImage(img,srcX,srcY,srcW,srcH,dx,dy,cellWpx,cellHpx);
        // Borda de cada painel
        ctx.strokeStyle='rgba(26,48,81,0.5)'; ctx.lineWidth=2;
        ctx.strokeRect(dx+1,dy+1,cellWpx-2,cellHpx-2);
      }
    }

    const sizeLabel=document.getElementById('splitSizeLabel');
    if(sizeLabel) sizeLabel.textContent=`Grade ${cols}×${rows}  —  Cada painel: ${cellW}×${cellH}cm  —  Total: ${totW.toFixed(0)}×${totH.toFixed(0)}cm`;

  } else {
    const n=partWidths.length;
    const totW=splitOrient==='h'?partWidths.reduce((a,b)=>a+b,0):partWidths[0];
    const totH=splitOrient==='v'?partHeights.reduce((a,b)=>a+b,0):partHeights[0];

    const scaleByW=(maxW - PANEL_GAP*(n-1))/totW;
    const scaleByH=(maxH - PANEL_GAP*(n-1))/totH;
    const scale=Math.min(scaleByW,scaleByH);

    const sizeLabel=document.getElementById('splitSizeLabel');
    if(sizeLabel){
      sizeLabel.textContent=n===1
        ?`${totW} × ${totH} cm`
        :`Total: ${totW} × ${totH} cm  —  `+partWidths.map((w,i)=>`${w}×${partHeights[i]}cm`).join(' | ');
    }

    // Calcular canvas com gaps
    let totalDispW=0, totalDispH=0;
    const pWpxArr=[], pHpxArr=[];
    for(let i=0;i<n;i++){
      pWpxArr.push(Math.round(partWidths[i]*scale));
      pHpxArr.push(Math.round(partHeights[i]*scale));
    }
    if(splitOrient==='h'){
      totalDispW=pWpxArr.reduce((a,b)=>a+b,0)+PANEL_GAP*(n-1);
      totalDispH=pHpxArr[0];
    } else {
      totalDispW=pWpxArr[0];
      totalDispH=pHpxArr.reduce((a,b)=>a+b,0)+PANEL_GAP*(n-1);
    }

    cvs.width=totalDispW; cvs.height=totalDispH;
    const ctx=cvs.getContext('2d');
    // Fundo branco = gap entre painéis
    ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,cvs.width,cvs.height);

    let offX=0, offY=0;
    for(let i=0;i<n;i++){
      const pW=pWpxArr[i], pH=pHpxArr[i];
      const dx=splitOrient==='h'?offX:0;
      const dy=splitOrient==='v'?offY:0;
      const srcX=splitOrient==='h'?Math.round(i*imgW/n):0;
      const srcW=splitOrient==='h'?Math.round(imgW/n):imgW;
      const srcY=splitOrient==='v'?Math.round(i*imgH/n):0;
      const srcH=splitOrient==='v'?Math.round(imgH/n):imgH;
      ctx.drawImage(img,srcX,srcY,srcW,srcH,dx,dy,pW,pH);
      ctx.strokeStyle='rgba(26,48,81,0.5)'; ctx.lineWidth=2;
      ctx.strokeRect(dx+1,dy+1,pW-2,pH-2);
      if(splitOrient==='h') offX+=pW+PANEL_GAP;
      else                   offY+=pH+PANEL_GAP;
    }
  }
  buildDlRow();
}

function buildDlRow(){
  const dr=document.getElementById('dlRow');
  if(splitOrient==='grid'){
    const n=gridCols*gridRows;
    let b='';
    for(let i=0;i<n;i++){
      const r=Math.floor(i/gridCols), c=i%gridCols;
      b+=`<button class="dl-btn" onclick="dlPiece(${i},${n},'pdf')">⬇ L${r+1}C${c+1} PDF</button>`;
    }
    b+=`<button class="dl-btn pri" onclick="dlAll('pdf')">⬇ Todos PDF</button>`;
    b+=`<button class="dl-btn"     onclick="dlAll('jpg')">⬇ Todos JPEG</button>`;
    dr.innerHTML=b;
  } else {
    const n=partWidths.length;
    if(n===1){
      dr.innerHTML=`
        <button class="dl-btn pri" onclick="dlPiece(0,1,'pdf')">⬇ PDF</button>
        <button class="dl-btn"     onclick="dlPiece(0,1,'jpg')">⬇ JPEG</button>`;
    } else {
      let b='';
      for(let i=0;i<n;i++) b+=`<button class="dl-btn" onclick="dlPiece(${i},${n},'pdf')">⬇ Parte ${i+1} PDF</button>`;
      b+=`<button class="dl-btn pri" onclick="dlAll('pdf')">⬇ Todos PDF</button>`;
      b+=`<button class="dl-btn"     onclick="dlAll('jpg')">⬇ Todos JPEG</button>`;
      dr.innerHTML=b;
    }
  }
}

function dlPiece(idx,total,fmt){
  if(!cImg) return;
  const{img,w:imgW,h:imgH}=cImg;
  const DPI=300;
  let pW,pH,srcX,srcY,srcW,srcH,name;
  if(splitOrient==='grid'){
    const cols=gridCols, rows=gridRows;
    const r=Math.floor(idx/cols), c=idx%cols;
    pW=Math.round(partWidths[0]/2.54*DPI);
    pH=Math.round(partHeights[0]/2.54*DPI);
    srcX=Math.round(c*imgW/cols); srcW=Math.round(imgW/cols);
    srcY=Math.round(r*imgH/rows); srcH=Math.round(imgH/rows);
    name=`fastframe-L${r+1}C${c+1}de${rows}x${cols}`;
  } else {
    pW=Math.round(partWidths[idx]/2.54*DPI);
    pH=Math.round(partHeights[idx]/2.54*DPI);
    srcX=splitOrient==='h'?Math.round(idx*imgW/total):0;
    srcW=splitOrient==='h'?Math.round(imgW/total):imgW;
    srcY=splitOrient==='v'?Math.round(idx*imgH/total):0;
    srcH=splitOrient==='v'?Math.round(imgH/total):imgH;
    name=`fastframe-parte${idx+1}de${total}`;
  }
  const cv=document.createElement('canvas'); cv.width=pW; cv.height=pH;
  cv.getContext('2d').drawImage(img,srcX,srcY,srcW,srcH,0,0,pW,pH);
  const suffix = name.replace(/^fastframe-?/,'') || 'parte';
  if(fmt==='jpg'){
    askFileName(suffix, (finalName) => {
      cv.toBlob(b=>{ _saveAs(b, finalName, 'image/jpeg'); toast('JPEG exportado!'); },'image/jpeg',1.0);
    });
  } else {
    askFileName(suffix, (finalName) => { exportPDFsave(cv, finalName); toast('PDF exportado!'); });
  }
}

function dlAll(fmt){
  const n=splitOrient==='grid'?gridCols*gridRows:partWidths.length;
  for(let i=0;i<n;i++) setTimeout(()=>dlPiece(i,n,fmt),i*700);
}

// ─────────────────────────────────────────────────────────
//  SANGRIA
// ─────────────────────────────────────────────────────────
function applyBleed(){
  if(!cImg) return toast('Carregue uma imagem primeiro.');
  const{img,w:imgW,h:imgH}=cImg;
  const DPI=300;
  const BP=Math.round(5/2.54*DPI);   // 5cm a 300dpi em pixels
  const PIECE_GAP_PX=8;              // gap branco entre painéis no preview

  function buildPiece(srcX,srcY,srcW,srcH,sw,sh){
    const pc=document.createElement('canvas');
    pc.width=sw+BP*2; pc.height=sh+BP*2;
    const p=pc.getContext('2d');
    // Área útil central
    p.drawImage(img,srcX,srcY,srcW,srcH,BP,BP,sw,sh);
    // Borda superior espelhada
    p.save(); p.translate(BP,BP); p.scale(1,-1);
    p.drawImage(img,srcX,srcY,srcW,Math.round(srcH*BP/sh),0,0,sw,BP);
    p.restore();
    // Borda inferior espelhada
    p.save(); p.translate(BP,sh+BP); p.scale(1,-1);
    p.drawImage(img,srcX,srcY+srcH-Math.round(srcH*BP/sh),srcW,Math.round(srcH*BP/sh),0,-BP,sw,BP);
    p.restore();
    // Borda esquerda espelhada
    p.save(); p.translate(BP,BP); p.scale(-1,1);
    p.drawImage(img,srcX,srcY,Math.round(srcW*BP/sw),srcH,0,0,BP,sh);
    p.restore();
    // Borda direita espelhada
    p.save(); p.translate(sw+BP,BP); p.scale(-1,1);
    p.drawImage(img,srcX+srcW-Math.round(srcW*BP/sw),srcY,Math.round(srcW*BP/sw),srcH,-BP,0,BP,sh);
    p.restore();
    // Cantos
    const cpSrcW=Math.round(srcW*BP/sw), cpSrcH=Math.round(srcH*BP/sh);
    p.save(); p.translate(BP,BP);       p.scale(-1,-1); p.drawImage(img,srcX,srcY,cpSrcW,cpSrcH,0,0,BP,BP);                       p.restore();
    p.save(); p.translate(sw+BP,BP);    p.scale(1,-1);  p.drawImage(img,srcX+srcW-cpSrcW,srcY,cpSrcW,cpSrcH,0,0,BP,BP);           p.restore();
    p.save(); p.translate(BP,sh+BP);    p.scale(-1,1);  p.drawImage(img,srcX,srcY+srcH-cpSrcH,cpSrcW,cpSrcH,0,0,BP,BP);           p.restore();
    p.save(); p.translate(sw+BP,sh+BP);                 p.drawImage(img,srcX+srcW-cpSrcW,srcY+srcH-cpSrcH,cpSrcW,cpSrcH,0,0,BP,BP); p.restore();
    return pc;
  }

  let bigC;
  const pieces=[];

  if(splitOrient==='grid'){
    const cols=gridCols, rows=gridRows;
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const outW=Math.round(partWidths[0]/2.54*DPI);
        const outH=Math.round(partHeights[0]/2.54*DPI);
        const srcX=Math.round(c*imgW/cols), srcW=Math.round(imgW/cols);
        const srcY=Math.round(r*imgH/rows), srcH=Math.round(imgH/rows);
        pieces.push(buildPiece(srcX,srcY,srcW,srcH,outW,outH));
      }
    }
    const cellFullW=pieces[0].width, cellFullH=pieces[0].height;
    bigC=document.createElement('canvas');
    bigC.width =cols*cellFullW + PIECE_GAP_PX*(cols-1);
    bigC.height=rows*cellFullH + PIECE_GAP_PX*(rows-1);
    const bc=bigC.getContext('2d');
    bc.fillStyle='#FFFFFF'; bc.fillRect(0,0,bigC.width,bigC.height);
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        bc.drawImage(pieces[r*cols+c], c*(cellFullW+PIECE_GAP_PX), r*(cellFullH+PIECE_GAP_PX));
      }
    }
  } else {
    const n=partWidths.length;
    if(n===1){
      bigC=buildPiece(0,0,imgW,imgH,
        Math.round(partWidths[0]/2.54*DPI),
        Math.round(partHeights[0]/2.54*DPI));
    } else {
      for(let i=0;i<n;i++){
        const outW=Math.round(partWidths[i]/2.54*DPI);
        const outH=Math.round(partHeights[i]/2.54*DPI);
        const srcX=splitOrient==='h'?Math.round(i*imgW/n):0;
        const srcW=splitOrient==='h'?Math.round(imgW/n):imgW;
        const srcY=splitOrient==='v'?Math.round(i*imgH/n):0;
        const srcH=splitOrient==='v'?Math.round(imgH/n):imgH;
        pieces.push(buildPiece(srcX,srcY,srcW,srcH,outW,outH));
      }
      let bigW,bigH;
      if(splitOrient==='h'){
        bigW=pieces.reduce((a,p2)=>a+p2.width,0)+PIECE_GAP_PX*(n-1);
        bigH=pieces[0].height;
      } else {
        bigW=pieces[0].width;
        bigH=pieces.reduce((a,p2)=>a+p2.height,0)+PIECE_GAP_PX*(n-1);
      }
      bigC=document.createElement('canvas'); bigC.width=bigW; bigC.height=bigH;
      const bc=bigC.getContext('2d');
      bc.fillStyle='#FFFFFF'; bc.fillRect(0,0,bigW,bigH);
      let ox=0,oy=0;
      pieces.forEach(p2=>{
        bc.drawImage(p2,ox,oy);
        if(splitOrient==='h') ox+=p2.width+PIECE_GAP_PX;
        else                   oy+=p2.height+PIECE_GAP_PX;
      });
    }
  }

  cImg.bleed=bigC;

  // ── Prévia ─────────────────────────────────────────────
  const sv=document.getElementById('splitCanvas');
  let svAvail=sv.parentElement.offsetWidth-28;
  if(svAvail<=0) svAvail=600;
  const svMaxW=Math.min(svAvail,820);
  const svMaxH=520;

  const ratioW=svMaxW/bigC.width;
  const ratioH=svMaxH/bigC.height;
  const ratio=Math.min(ratioW,ratioH);

  sv.width =Math.round(bigC.width *ratio);
  sv.height=Math.round(bigC.height*ratio);

  const pc2=sv.getContext('2d');
  pc2.drawImage(bigC,0,0,sv.width,sv.height);

  // Linha tracejada vermelha no contorno de corte de CADA painel
  const bpDisp=Math.round(BP*ratio);
  pc2.strokeStyle='rgba(178,34,34,0.9)';
  pc2.setLineDash([6,4]); pc2.lineWidth=1.5;

  if(splitOrient==='grid'){
    const cols=gridCols, rows=gridRows;
    const cellFullW=pieces[0].width, cellFullH=pieces[0].height;
    const cellDispW=Math.round(cellFullW*ratio);
    const cellDispH=Math.round(cellFullH*ratio);
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const dx=c*(cellDispW + Math.round(PIECE_GAP_PX*ratio));
        const dy=r*(cellDispH + Math.round(PIECE_GAP_PX*ratio));
        // Linha tracejada = borda útil dentro da sangria
        pc2.strokeRect(dx+bpDisp, dy+bpDisp, cellDispW-bpDisp*2, cellDispH-bpDisp*2);
      }
    }
  } else if(partWidths.length===1){
    pc2.strokeRect(bpDisp,bpDisp,sv.width-bpDisp*2,sv.height-bpDisp*2);
  } else {
    const n=pieces.length;
    let ox=0,oy=0;
    pieces.forEach(p2=>{
      const pw=Math.round(p2.width*ratio);
      const ph=Math.round(p2.height*ratio);
      // Linha tracejada de corte em cada painel
      pc2.strokeRect(ox+bpDisp, oy+bpDisp, pw-bpDisp*2, ph-bpDisp*2);
      // Linha tracejada na junção interna entre painéis
      if(splitOrient==='h') ox+=pw+Math.round(PIECE_GAP_PX*ratio);
      else                   oy+=ph+Math.round(PIECE_GAP_PX*ratio);
    });
  }
  pc2.setLineDash([]);

  // Label atualizado
  const sizeLabel=document.getElementById('splitSizeLabel');
  if(sizeLabel){
    if(splitOrient==='grid'){
      sizeLabel.textContent=`Grade ${gridCols}×${gridRows}  —  Cada painel: ${partWidths[0]}×${partHeights[0]}cm (+5cm sangria)`;
    } else {
      const totW=splitOrient==='h'?partWidths.reduce((a,b)=>a+b,0):partWidths[0];
      const totH=splitOrient==='v'?partHeights.reduce((a,b)=>a+b,0):partHeights[0];
      const n=partWidths.length;
      sizeLabel.textContent=n===1
        ?`${totW} × ${totH} cm  (+5cm sangria em cada lado)`
        :`Total: ${totW} × ${totH} cm  (+5cm sangria por painel)`;
    }
  }

  toast('Sangria aplicada! Linha tracejada = área de corte.');
}


function removeBleed(){
  if(!cImg) return;
  if(!cImg.bleed) return toast('Nenhuma sangria aplicada.');
  cImg.bleed=null;
  renderSplit();
  toast('Sangria removida!');
}

function dlBleed(fmt){
  if(!cImg?.bleed){ applyBleed(); setTimeout(()=>dlBleed(fmt),350); return; }
  if(fmt==='jpg'){
    askFileName('sangria', (finalName) => {
      cImg.bleed.toBlob(b=>{ _saveAs(b, finalName, 'image/jpeg').then(()=>toast('JPEG com sangria baixado!')); },'image/jpeg',1.0);
    });
  } else {
    askFileName('sangria', (finalName) => { exportPDFsave(cImg.bleed, finalName); toast('PDF com sangria exportado!'); });
  }
}

function exportPDF(canvas,name){
  try{
    const{jsPDF}=window.jspdf;
    const wC=+(canvas.width /300*2.54).toFixed(2);
    const hC=+(canvas.height/300*2.54).toFixed(2);
    const pdf=new jsPDF({unit:'cm',format:[wC,hC]});
    pdf.addImage(canvas.toDataURL('image/jpeg',1.0),'JPEG',0,0,wC,hC);
    pdf.save(name+'.pdf');
  } catch {
    canvas.toBlob(b=>{
      const a=document.createElement('a');
      a.href=URL.createObjectURL(b); a.download=finalName+'.jpg'; a.click();
    },'image/jpeg',1.0);
  }
}
// Versão com janela nativa de salvar (File System Access API)
async function exportPDFsave(canvas, name) {
  try {
    const{jsPDF}=window.jspdf;
    const wC=+(canvas.width /300*2.54).toFixed(2);
    const hC=+(canvas.height/300*2.54).toFixed(2);
    const pdf=new jsPDF({unit:'cm',format:[wC,hC]});
    pdf.addImage(canvas.toDataURL('image/jpeg',1.0),'JPEG',0,0,wC,hC);
    const blob = pdf.output('blob');
    await _saveAs(blob, name, 'application/pdf');
  } catch(e) {
    exportPDF(canvas, name); // fallback
  }
}


// ─────────────────────────────────────────────────────────
//  SIMULADOR DE PAREDE
// ─────────────────────────────────────────────────────────
const ROOM_PATHS={
  sala1:    '/static/assets/img/rooms/sala1.jpg',
  sala2:    '/static/assets/img/rooms/sala2.jpg',
  sala3:    '/static/assets/img/rooms/sala3.jpg',
  sala4:    '/static/assets/img/rooms/sala4.jpg',
  qcasal:   '/static/assets/img/rooms/qcasal.jpg',
  qhospede: '/static/assets/img/rooms/qhospede.jpg',
  qcrianca: '/static/assets/img/rooms/qcrianca.jpg',
  gourmet:  '/static/assets/img/rooms/gourmet.jpg',
};
const ROOM_DEFAULTS={
  sala1:   {x:50,y:38,w:100,h:70}, sala2:   {x:50,y:35,w:120,h:80},
  sala3:   {x:50,y:40,w:90,h:60},  sala4:   {x:50,y:36,w:80,h:60},
  qcasal:  {x:50,y:36,w:100,h:70}, qhospede:{x:50,y:38,w:80,h:60},
  qcrianca:{x:50,y:38,w:60,h:50},  gourmet: {x:50,y:40,w:80,h:60},
};

function loadPresetRoom(key){
  document.querySelectorAll('.room-thumb').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.room-thumb').forEach(t=>{
    if(t.getAttribute('onclick')===`loadPresetRoom('${key}')`) t.classList.add('active');
  });
  const roomImg=new Image();
  roomImg.crossOrigin='anonymous';
  roomImg.onload=()=>{ wEnvImg=roomImg; _applyRoomDefaults(key); checkWall(); toast('Ambiente carregado!'); };
  roomImg.onerror=()=>{ wEnvImg=generateRoomCanvas(key); _applyRoomDefaults(key); checkWall(); toast('Ambiente ilustrativo. Substitua pela foto real em static/assets/img/rooms/'+key+'.jpg'); };
  roomImg.src=ROOM_PATHS[key];
}

function _applyRoomDefaults(key){
  const def=ROOM_DEFAULTS[key]||{x:50,y:38,w:80,h:60};
  document.getElementById('wX').value=def.x;
  document.getElementById('wY').value=def.y;
  document.getElementById('wW').value=def.w;
  document.getElementById('wH').value=def.h;
}

function generateRoomCanvas(key){
  const rooms={
    sala1:   {wall:'#E8E0D5',floor:'#8B6F47',accent:'#5A4530',name:'Sala Clássica'},
    sala2:   {wall:'#F0EDE8',floor:'#C4A882',accent:'#3C2F1E',name:'Sala Moderna'},
    sala3:   {wall:'#D4CFC8',floor:'#6B5B45',accent:'#B8903C',name:'Sala Industrial'},
    sala4:   {wall:'#FAFAF8',floor:'#E0D8CC',accent:'#888888',name:'Sala Minimalista'},
    qcasal:  {wall:'#EDE8E2',floor:'#A08060',accent:'#7A5C42',name:'Quarto Casal'},
    qhospede:{wall:'#EAE6E0',floor:'#B89878',accent:'#5A4530',name:'Quarto Hóspede'},
    qcrianca:{wall:'#E8F0F8',floor:'#D4C8B8',accent:'#4A8AB8',name:'Quarto Criança'},
    gourmet: {wall:'#2C2420',floor:'#4A3828',accent:'#B8903C',name:'Área Gourmet'},
  };
  const s=rooms[key]||rooms.sala1;
  const c=document.createElement('canvas'); c.width=1200; c.height=800;
  const ctx=c.getContext('2d');
  ctx.fillStyle=s.wall; ctx.fillRect(0,0,1200,800);
  ctx.fillStyle=s.floor; ctx.fillRect(0,580,1200,220);
  ctx.fillStyle=s.accent; ctx.fillRect(0,572,1200,12);
  const gr=ctx.createLinearGradient(0,560,0,620);
  gr.addColorStop(0,'rgba(0,0,0,0.18)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gr; ctx.fillRect(0,560,1200,60);
  if(['sala1','sala2','sala3','sala4'].includes(key)){
    ctx.fillStyle=key==='sala3'?'#4A4A4A':'#BDB0A0';
    ctx.beginPath(); ctx.roundRect(200,460,800,120,8); ctx.fill();
  } else if(['qcasal','qhospede'].includes(key)){
    ctx.fillStyle='#8B7355'; ctx.beginPath(); ctx.roundRect(300,420,600,160,6); ctx.fill();
    ctx.fillStyle='#F5F0E8'; ctx.beginPath(); ctx.roundRect(310,390,580,100,4); ctx.fill();
  } else if(key==='qcrianca'){
    ctx.fillStyle='#6AABCF'; ctx.beginPath(); ctx.roundRect(320,420,560,150,8); ctx.fill();
  } else if(key==='gourmet'){
    ctx.fillStyle='#6B5030'; ctx.beginPath(); ctx.roundRect(0,420,1200,160,0); ctx.fill();
  }
  ctx.font='bold 22px sans-serif'; ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.textAlign='center';
  ctx.fillText(s.name,600,760);
  const roomImg=new Image(); roomImg.src=c.toDataURL(); return roomImg;
}

function setWallFrameColor(c){ wallFrameColor=c; renderWall(); }

function loadEnv(e){
  const file=e.target.files[0]; if(!file) return;
  const run=(blob)=>{ const img=new Image(); img.onload=()=>{ wEnvImg=img; checkWall(); }; img.src=URL.createObjectURL(blob); };
  (file.type==='image/heic'||file.type==='image/heif') ? heic2any({blob:file,toType:'image/jpeg',quality:.9}).then(run) : run(file);
}
function loadArt(e){
  const file=e.target.files[0]; if(!file) return;
  const run=(blob)=>{ const img=new Image(); img.onload=()=>{ wArtImg=img; checkWall(); }; img.src=URL.createObjectURL(blob); };
  (file.type==='image/heic'||file.type==='image/heif') ? heic2any({blob:file,toType:'image/jpeg',quality:.9}).then(run) : run(file);
}

function checkWall(){
  if(!wEnvImg) return;
  document.getElementById('wPh').style.display='none';
  document.getElementById('wallCanvas').style.display='block';
  if(wArtImg){ document.getElementById('wControls').style.display='block'; renderWall(); }
  else {
    const c=document.getElementById('wallCanvas');
    const mw=c.parentElement.offsetWidth-32;
    c.width=mw; c.height=Math.round(wEnvImg.naturalHeight*mw/wEnvImg.naturalWidth);
    c.getContext('2d').drawImage(wEnvImg,0,0,c.width,c.height);
  }
}

function togglePP(){
  ppActive=document.getElementById('ppEnabled').checked;
  document.getElementById('ppControls').style.display=ppActive?'block':'none';
  renderWall();
}
function setPPColor(color,idx){
  ppColor=color;
  document.getElementById('ppColorPicker').value=color;
  for(let i=0;i<7;i++){
    const sw=document.getElementById('ppSw'+i);
    if(sw) sw.classList.toggle('active',i===idx);
  }
  renderWall();
}

function renderWall(){
  if(!wEnvImg||!wArtImg) return;
  const wCm=+document.getElementById('wW').value;
  const hCm=+document.getElementById('wH').value;
  const xP =+document.getElementById('wX').value/100;
  const yP =+document.getElementById('wY').value/100;
  const sl =+document.getElementById('wS').value;

  document.getElementById('wWL').textContent=wCm+'cm';
  document.getElementById('wHL').textContent=hCm+'cm';
  document.getElementById('wXL').textContent=Math.round(xP*100)+'%';
  document.getElementById('wYL').textContent=Math.round(yP*100)+'%';
  ['Sem sombra','Leve','Média','Forte'].forEach((l,i)=>{ if(i===sl) document.getElementById('wSL').textContent=l; });

  const c=document.getElementById('wallCanvas');
  const mw=Math.min(c.parentElement.offsetWidth-32,900);
  c.width=mw; c.height=Math.round(wEnvImg.naturalHeight*mw/wEnvImg.naturalWidth);
  const ctx=c.getContext('2d');
  ctx.drawImage(wEnvImg,0,0,c.width,c.height);

  const ppc=c.width/300;
  const fw=Math.round(wCm*ppc), fh=Math.round(hCm*ppc);
  const fx=Math.round(xP*c.width-fw/2), fy=Math.round(yP*c.height-fh/2);

  if(sl>0){
    const blurs=[0,10,22,40][sl], offs=[0,5,12,24][sl], alphas=[0,.28,.48,.65][sl];
    ctx.save();
    ctx.shadowColor=`rgba(0,0,0,${alphas})`; ctx.shadowBlur=blurs;
    ctx.shadowOffsetX=offs; ctx.shadowOffsetY=offs;
    ctx.fillStyle='#000'; ctx.fillRect(fx,fy,fw,fh);
    ctx.restore();
  }

  if(ppActive){
    const ppCm=parseFloat(document.getElementById('ppSize').value)||3;
    const ppPx=Math.round(ppCm*ppc);
    const tx=fx-ppPx, ty=fy-ppPx, tw=fw+ppPx*2, th=fh+ppPx*2;
    if(sl>0){
      const [blurs2,offs2,alphas2]=[[0,10,22,40][sl],[0,5,12,24][sl],[0,.28,.48,.65][sl]];
      ctx.save();
      ctx.shadowColor=`rgba(0,0,0,${alphas2})`; ctx.shadowBlur=blurs2;
      ctx.shadowOffsetX=offs2; ctx.shadowOffsetY=offs2;
      ctx.fillStyle=ppColor; ctx.fillRect(tx,ty,tw,th);
      ctx.restore();
    } else {
      ctx.fillStyle=ppColor; ctx.fillRect(tx,ty,tw,th);
    }
    ctx.drawImage(wArtImg,fx,fy,fw,fh);
    const bwPP=Math.max(2,tw*0.018);
    if(wallFrameColor){
      ctx.strokeStyle=wallFrameColor; ctx.lineWidth=bwPP;
      ctx.strokeRect(tx+bwPP/2,ty+bwPP/2,tw-bwPP,th-bwPP);
    }
  } else {
    ctx.drawImage(wArtImg,fx,fy,fw,fh);
    const bw=Math.max(2,fw*0.018);
    if(wallFrameColor){
      ctx.strokeStyle=wallFrameColor; ctx.lineWidth=bw;
      ctx.strokeRect(fx+bw/2,fy+bw/2,fw-bw,fh-bw);
      ctx.globalAlpha=0.5; ctx.lineWidth=bw*.35;
      ctx.strokeRect(fx+bw*1.6,fy+bw*1.6,fw-bw*3.2,fh-bw*3.2);
      ctx.globalAlpha=1;
    }
  }
}

function dlWall(fmt){
  if(!wEnvImg||!wArtImg) return toast('Carregue o ambiente e o quadro primeiro.');
  const cvs=document.getElementById('wallCanvas');
  if(fmt==='pdf'){
    askFileName('simulacao-ambiente', (finalName) => { exportPDFsave(cvs, finalName); toast('PDF de simulação baixado!'); });
  } else {
    askFileName('simulacao-ambiente', (finalName) => {
      cvs.toBlob(b=>{ _saveAs(b, finalName, 'image/jpeg').then(()=>toast('JPEG de simulação baixado!')); },'image/jpeg',.93);
    });
  }
}

// ─────────────────────────────────────────────────────────
//  MELHORADOR DE IMAGEM
// ─────────────────────────────────────────────────────────
function initEnhFromQImg(){
  if(!qImg) return;
  enhScale=1;
  const img=qImg.img;
  const beforeCvs=document.getElementById('enhBefore');
  const maxD=400;
  let bw=img.naturalWidth, bh=img.naturalHeight;
  if(bw>maxD){ bh=Math.round(bh*maxD/bw); bw=maxD; }
  if(bh>maxD){ bw=Math.round(bw*maxD/bh); bh=maxD; }
  beforeCvs.width=bw; beforeCvs.height=bh;
  beforeCvs.getContext('2d').drawImage(img,0,0,bw,bh);
  document.getElementById('enhBeforeInfo').textContent=
    `${img.naturalWidth} × ${img.naturalHeight} px · ${fmtB(qImg.file.size)}`;

  enhOrigCanvas=document.createElement('canvas');
  enhOrigCanvas.width=img.naturalWidth; enhOrigCanvas.height=img.naturalHeight;
  enhOrigCanvas.getContext('2d').drawImage(img,0,0);

  const afterCvs=document.getElementById('enhAfter');
  afterCvs.width=1; afterCvs.height=1;
  document.getElementById('enhAfterInfo').textContent='';
  resetEnhSliders();
  updateScaleInfo();
}

function setEnhFilter(f,btn){
  enhFilter=f;
  ['filterNone','filterBW','filterSepia','filterVivid'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove('active');
  });
  btn.classList.add('active');
  applyEnhancement();
}

function setScale(s,btn){
  enhScale=s;
  document.querySelectorAll('[id^=scaleBtn]').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  updateScaleInfo(); applyEnhancement();
}

function updateScaleInfo(){
  if(!enhOrigCanvas) return;
  const nw=enhOrigCanvas.width*enhScale, nh=enhOrigCanvas.height*enhScale;
  document.getElementById('enhScaleInfo').textContent=`Saída: ${nw.toLocaleString()} × ${nh.toLocaleString()} px`;
}

function applyEnhancement(){
  if(!enhOrigCanvas) return;
  const bright  =parseInt(document.getElementById('brightS').value);
  const contrast=parseInt(document.getElementById('contrastS').value);
  const sat     =parseInt(document.getElementById('satS').value);
  const sharp   =parseInt(document.getElementById('sharpS').value);
  const noise   =parseInt(document.getElementById('noiseS').value);
  const temp    =parseInt(document.getElementById('tempS').value);

  const progWrap=document.getElementById('enhProgress');
  const progBar =document.getElementById('enhProgressBar');
  const progLbl =document.getElementById('enhProgressLabel');
  if(enhScale>1){ progWrap.style.display='block'; progLbl.textContent='Aumentando resolução…'; progBar.style.width='20%'; }

  setTimeout(()=>{
    // Upscale bicúbico por passagens de 1.5×
    let cur=enhOrigCanvas;
    let cw=cur.width, ch=cur.height;
    const tw=cw*enhScale, th=ch*enhScale;
    while(cw<tw){
      const sw=Math.min(Math.round(cw*1.5),tw);
      const sh=Math.min(Math.round(ch*1.5),th);
      const tmp=document.createElement('canvas'); tmp.width=sw; tmp.height=sh;
      const tc=tmp.getContext('2d');
      tc.imageSmoothingEnabled=true; tc.imageSmoothingQuality='high';
      tc.drawImage(cur,0,0,sw,sh);
      cur=tmp; cw=sw; ch=sh;
    }
    if(progBar) progBar.style.width='60%';

    const out=document.createElement('canvas'); out.width=cur.width; out.height=cur.height;
    const ctx=out.getContext('2d'); ctx.drawImage(cur,0,0);

    // Temperatura via overlay
    if(temp!==0){
      ctx.save(); ctx.globalAlpha=Math.abs(temp)/200;
      ctx.fillStyle=temp>0?'#FF9900':'#0099FF';
      ctx.fillRect(0,0,out.width,out.height); ctx.restore();
    }

    // Brilho + contraste + saturação via ImageData
    const imgData=ctx.getImageData(0,0,out.width,out.height);
    const d=imgData.data;
    const cf=(contrast/100+1)**2;
    const bf=bright/100*255;
    for(let i=0;i<d.length;i+=4){
      let r=d[i], g=d[i+1], b2=d[i+2];
      r+=bf; g+=bf; b2+=bf;
      r=(r-128)*cf+128; g=(g-128)*cf+128; b2=(b2-128)*cf+128;
      if(sat!==0){
        const gray=.299*r+.587*g+.114*b2;
        const sf=sat/100+1;
        r=gray+(r-gray)*sf; g=gray+(g-gray)*sf; b2=gray+(b2-gray)*sf;
      }
      d[i]=Math.max(0,Math.min(255,r));
      d[i+1]=Math.max(0,Math.min(255,g));
      d[i+2]=Math.max(0,Math.min(255,b2));
    }
    ctx.putImageData(imgData,0,0);

    // Filtros de estilo (B&W, Sépia, Vívido)
    if(enhFilter!=='none'){
      const fImgData=ctx.getImageData(0,0,out.width,out.height);
      const fPx=fImgData.data;
      for(let fi=0;fi<fPx.length;fi+=4){
        const fGray=Math.round(.299*fPx[fi]+.587*fPx[fi+1]+.114*fPx[fi+2]);
        if(enhFilter==='bw'){
          fPx[fi]=fGray; fPx[fi+1]=fGray; fPx[fi+2]=fGray;
        } else if(enhFilter==='sepia'){
          fPx[fi]  =Math.min(255,Math.round(fGray*.393+fGray*.769+fGray*.189));
          fPx[fi+1]=Math.min(255,Math.round(fGray*.349+fGray*.686+fGray*.168));
          fPx[fi+2]=Math.min(255,Math.round(fGray*.272+fGray*.534+fGray*.131));
        } else if(enhFilter==='vivid'){
          const vf=(1.2)**2;
          let vr=(fPx[fi]-128)*vf+128;
          let vg=(fPx[fi+1]-128)*vf+128;
          let vb=(fPx[fi+2]-128)*vf+128;
          const vGray=.299*vr+.587*vg+.114*vb;
          const vs=1.6;
          fPx[fi]  =Math.max(0,Math.min(255,vGray+(vr-vGray)*vs));
          fPx[fi+1]=Math.max(0,Math.min(255,vGray+(vg-vGray)*vs));
          fPx[fi+2]=Math.max(0,Math.min(255,vGray+(vb-vGray)*vs));
        }
      }
      ctx.putImageData(fImgData,0,0);
    }

    for(let ni=0;ni<noise;ni++) applyBoxBlur(ctx,out.width,out.height);
    for(let si=0;si<sharp;si++) applyUnsharp(ctx,out.width,out.height);

    if(progBar) progBar.style.width='100%';
    setTimeout(()=>{ if(progWrap) progWrap.style.display='none'; },400);
    hideLoading();

    const afterCvs=document.getElementById('enhAfter');
    const maxD=400;
    let aw=out.width, ah=out.height;
    if(aw>maxD){ ah=Math.round(ah*maxD/aw); aw=maxD; }
    if(ah>maxD){ aw=Math.round(aw*maxD/ah); ah=maxD; }
    afterCvs.width=aw; afterCvs.height=ah;
    afterCvs.getContext('2d').drawImage(out,0,0,aw,ah);
    document.getElementById('enhAfterInfo').textContent=`${out.width.toLocaleString()} × ${out.height.toLocaleString()} px`;

    enhOrigCanvas._processed=out;
  },30);
}

function applyBoxBlur(ctx,w,h){
  const imgData=ctx.getImageData(0,0,w,h);
  const d=imgData.data, o=new Uint8ClampedArray(d);
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      for(let ch=0;ch<3;ch++){
        let s=0;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) s+=d[((y+dy)*w+(x+dx))*4+ch];
        o[(y*w+x)*4+ch]=s/9;
      }
      o[(y*w+x)*4+3]=d[(y*w+x)*4+3];
    }
  }
  imgData.data.set(o); ctx.putImageData(imgData,0,0);
}

function applyUnsharp(ctx,w,h){
  const orig=ctx.getImageData(0,0,w,h);
  const tmp=document.createElement('canvas'); tmp.width=w; tmp.height=h;
  const tc=tmp.getContext('2d');
  tc.putImageData(new ImageData(new Uint8ClampedArray(orig.data),w,h),0,0);
  applyBoxBlur(tc,w,h);
  const bd=tc.getImageData(0,0,w,h).data;
  const od=orig.data;
  for(let i=0;i<od.length;i+=4)
    for(let ch=0;ch<3;ch++)
      od[i+ch]=Math.max(0,Math.min(255,od[i+ch]+1.2*(od[i+ch]-bd[i+ch])));
  ctx.putImageData(orig,0,0);
}

function resetEnhSliders(){
  ['brightS','contrastS','satS','sharpS','noiseS','tempS'].forEach(id=>document.getElementById(id).value=0);
  ['brightL','contrastL','satL','sharpL','noiseL','tempL'].forEach(id=>document.getElementById(id).textContent=0);
  enhScale=1; enhFilter='none';
  const btn1=document.getElementById('scaleBtn1');
  if(btn1) btn1.classList.add('active');
  ['scaleBtn2','scaleBtn3','scaleBtn4'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.remove('active');
  });
  // Resetar filtro
  const fnEl=document.getElementById('filterNone');
  if(fnEl){ fnEl.classList.add('active'); ['filterBW','filterSepia','filterVivid'].forEach(fid=>{const fel=document.getElementById(fid);if(fel) fel.classList.remove('active');}); }
}

function dlEnhanced(fmt){
  if(!enhOrigCanvas?._processed) return toast('Aplique os ajustes primeiro.');
  const isPDF=fmt==='pdf';
  if(isPDF){
    askFileName('melhorada', (finalName) => { exportPDFsave(enhOrigCanvas._processed, finalName); toast('PDF baixado!'); });
  } else {
    askFileName('melhorada', (finalName) => {
      enhOrigCanvas._processed.toBlob(b=>{ _saveAs(b, finalName, 'image/jpeg').then(()=>toast('JPEG baixado!')); },'image/jpeg',.95);
    });
  }
}

// ─────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────────
function fmtB(b){ return b>1048576?(b/1048576).toFixed(1)+' MB':(b/1024).toFixed(0)+' KB'; }

function buildThumb(src,name,w,h,size,resetFn){
  return `<div class="thumb-row">
    <img class="thumb-img" src="${src}">
    <div class="thumb-info">
      <div class="tname">${name}</div>
      <div class="tmeta">${w.toLocaleString()} × ${h.toLocaleString()} px · ${fmtB(size)}</div>
    </div>
    <button class="btn-rm" onclick="${resetFn}">✕ Remover</button>
  </div>`;
}

// ─────────────────────────────────────────────────────────
//  NAVEGAÇÃO INTELIGENTE
// ─────────────────────────────────────────────────────────
function goToDivisao(){
  if(!qImg) return toast('Carregue uma imagem primeiro.');
  cImg=qImg;
  switchTab('canvas');
  window.scrollTo({top:0,behavior:'smooth'});
  requestAnimationFrame(()=>showC());
}

function goToSelecao(){
  switchTab('quadros');
  const box=document.getElementById('cUploadBox');
  if(box) box.style.display='block';
  window.scrollTo({top:0,behavior:'smooth'});
}

// ─────────────────────────────────────────────────────────
//  EVENTOS
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  const modal=document.getElementById('previewModal');
  if(modal){
    modal.addEventListener('click',e=>{ if(e.target===modal) closePreviewModal(); });
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&modal?.style.display==='flex') closePreviewModal();
  });
});

// ─────────────────────────────────────────────────────────
//  SIMULAÇÃO DE QUADROS (aba individual)
// ─────────────────────────────────────────────────────────
let sqImg=null;
let sqFrameColor='#3C2F1E';
let sqPpColor='#FFFFFF';
let sqBgColor='#E8EDF2';

function loadSQ(e){ loadImgFile(e.target.files[0],'sq'); }

// Override the img load dispatch to handle sq
function _dispatchImg(d, type){
  if(type==='q'){  qImg=d; showQ(); }
  else if(type==='c'){ cImg=d; showC(); }
  else if(type==='sq'){ sqImg=d; showSQ(); }
}

function showSQ(){
  document.getElementById('sqUploadBox').style.display='none';
  document.getElementById('sqResults').style.display='block';
  // Pré-preencher dimensões com tamanho máximo recomendado
  const[mw,mh]=maxPrintCm(sqImg.w,sqImg.h);
  document.getElementById('sqW').value=mw;
  document.getElementById('sqH').value=mh;
  requestAnimationFrame(()=>renderFrame());
}

function resetSQ(){
  sqImg=null;
  document.getElementById('sqUploadBox').style.display='block';
  document.getElementById('sqResults').style.display='none';
  document.getElementById('sqFile').value='';
}

function renderFrame(){
  if(!sqImg) return;
  const cvs=document.getElementById('frameCanvas');
  const stage=document.getElementById('frameStage');
  const stageW=stage.offsetWidth-28||600;

  const wCm=parseFloat(document.getElementById('sqW').value)||80;
  const hCm=parseFloat(document.getElementById('sqH').value)||60;
  const frameWcm=parseFloat(document.getElementById('sqFrameW').value)||0;
  const ppOn=document.getElementById('sqPpEnabled').checked;
  const ppCm=ppOn?(parseFloat(document.getElementById('sqPpSize').value)||3):0;

  // Tamanho total = imagem + passepartout + moldura (2 lados)
  const totalWcm=wCm+(ppCm+frameWcm)*2;
  const totalHcm=hCm+(ppCm+frameWcm)*2;

  // Escala de display
  const scaleW=stageW/totalWcm;
  const scaleH=520/totalHcm;
  const scale=Math.min(scaleW,scaleH);

  const totalWpx=Math.round(totalWcm*scale);
  const totalHpx=Math.round(totalHcm*scale);
  const frameWpx=Math.round(frameWcm*scale);
  const ppPx=Math.round(ppCm*scale);
  const imgWpx=Math.round(wCm*scale);
  const imgHpx=Math.round(hCm*scale);

  cvs.width=totalWpx; cvs.height=totalHpx;
  const ctx=cvs.getContext('2d');

  // Fundo da cena
  ctx.fillStyle=sqBgColor; ctx.fillRect(0,0,totalWpx,totalHpx);

  // Sombra do conjunto
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=20; ctx.shadowOffsetX=4; ctx.shadowOffsetY=6;
  ctx.fillStyle=sqFrameColor||'transparent';
  ctx.fillRect(0,0,totalWpx,totalHpx);
  ctx.restore();

  // Moldura (fundo)
  if(frameWcm>0){
    ctx.fillStyle=sqFrameColor;
    ctx.fillRect(0,0,totalWpx,totalHpx);
    // Bisel interno da moldura (efeito 3D simples)
    const bevel=Math.max(2,frameWpx*0.12);
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(totalWpx,0); ctx.lineTo(totalWpx-bevel,bevel); ctx.lineTo(bevel,bevel); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(bevel,bevel); ctx.lineTo(bevel,totalHpx-bevel); ctx.lineTo(0,totalHpx); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(totalWpx,totalHpx); ctx.lineTo(0,totalHpx); ctx.lineTo(bevel,totalHpx-bevel); ctx.lineTo(totalWpx-bevel,totalHpx-bevel); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(totalWpx,totalHpx); ctx.lineTo(totalWpx-bevel,totalHpx-bevel); ctx.lineTo(totalWpx-bevel,bevel); ctx.lineTo(totalWpx,0); ctx.closePath(); ctx.fill();
  }

  // Passepartout
  if(ppOn&&ppCm>0){
    ctx.fillStyle=sqPpColor;
    ctx.fillRect(frameWpx,frameWpx,totalWpx-frameWpx*2,totalHpx-frameWpx*2);
    // Borda interna do passepartout (chanfro sutil)
    const ppBevel=Math.max(1,ppPx*0.08);
    ctx.strokeStyle='rgba(0,0,0,0.1)'; ctx.lineWidth=ppBevel;
    ctx.strokeRect(frameWpx+ppPx-ppBevel/2, frameWpx+ppPx-ppBevel/2, imgWpx+ppBevel, imgHpx+ppBevel);
  }

  // Imagem
  const imgX=frameWpx+ppPx;
  const imgY=frameWpx+ppPx;
  ctx.drawImage(sqImg.img, imgX, imgY, imgWpx, imgHpx);

  // Info de tamanho
  const info=document.getElementById('sqSizeInfo');
  if(info){
    const parts=[`Imagem: ${wCm}×${hCm}cm`];
    if(ppOn&&ppCm>0) parts.push(`Passepartout: ${ppCm}cm`);
    if(frameWcm>0) parts.push(`Moldura: ${frameWcm}cm`);
    parts.push(`Total: ${totalWcm.toFixed(1)}×${totalHcm.toFixed(1)}cm`);
    info.textContent=parts.join('  ·  ');
  }
}

function setSQFrameColor(color,idx){
  sqFrameColor=color;
  document.getElementById('sqFrameColorPicker').value=color;
  for(let i=0;i<7;i++){
    const el=document.getElementById('sqFc'+i);
    if(el) el.classList.toggle('active',i===idx);
  }
  renderFrame();
}
function clearSQFrameActive(){ for(let i=0;i<7;i++){const el=document.getElementById('sqFc'+i);if(el) el.classList.remove('active');} }

function setSQPpColor(color,idx){
  sqPpColor=color;
  document.getElementById('sqPpColorPicker').value=color;
  for(let i=0;i<7;i++){
    const el=document.getElementById('sqPpSw'+i);
    if(el) el.classList.toggle('active',i===idx);
  }
  renderFrame();
}
function clearSQPpActive(){ for(let i=0;i<7;i++){const el=document.getElementById('sqPpSw'+i);if(el) el.classList.remove('active');} }

function setSQBg(color,idx){
  sqBgColor=color;
  document.getElementById('sqBgPicker').value=color;
  for(let i=0;i<5;i++){
    const el=document.getElementById('sqBg'+i);
    if(el) el.classList.toggle('active',i===idx);
  }
  renderFrame();
}
function clearSQBgActive(){ for(let i=0;i<5;i++){const el=document.getElementById('sqBg'+i);if(el) el.classList.remove('active');} }

function dlFrame(fmt){
  const cvs=document.getElementById('frameCanvas');
  if(!cvs||!sqImg) return toast('Carregue uma imagem primeiro.');
  if(fmt==='pdf'){
    askFileName('quadro', (finalName) => { exportPDFsave(cvs, finalName); toast('PDF do quadro baixado!'); });
  } else {
    askFileName('quadro', (finalName) => {
      cvs.toBlob(b=>{ _saveAs(b, finalName, 'image/jpeg').then(()=>toast('JPEG do quadro baixado!')); },'image/jpeg',.95);
    });
  }
}


// ─────────────────────────────────────────────────────────
//  MOBILE NAV
// ─────────────────────────────────────────────────────────
function toggleMobileNav(){
  const nav=document.getElementById('mobileNav');
  const ham=document.getElementById('hamburger');
  if(!nav||!ham) return;
  const isOpen=nav.classList.toggle('open');
  ham.classList.toggle('open',isOpen);
  document.body.style.overflow=isOpen?'hidden':'';
}

// (mobile nav sync integrado em switchTab)

// ─────────────────────────────────────────────────────────
//  LOADING OVERLAY
// ─────────────────────────────────────────────────────────
function showLoading(msg){
  const el=document.getElementById('ffLoading');
  const ml=document.getElementById('ffLoadingMsg');
  if(el){ el.classList.add('show'); if(ml) ml.textContent=msg||'Processando…'; }
}
function hideLoading(){
  const el=document.getElementById('ffLoading');
  if(el) el.classList.remove('show');
}

// Wrap applyBleed with loading
const _applyBleedOrig=applyBleed;
window.applyBleed=function(){
  showLoading('Calculando sangria…');
  setTimeout(()=>{ _applyBleedOrig(); hideLoading(); },50);
};

// Wrap applyEnhancement with loading for upscale
const _applyEnhOrig=applyEnhancement;
window.applyEnhancement=function(){
  if(typeof enhScale!=='undefined'&&enhScale>1) showLoading('Aumentando resolução…');
  _applyEnhOrig();
  // hideLoading is called inside applyEnhancement after setTimeout
};

// ─────────────────────────────────────────────────────────
//  VALIDAÇÃO DE ENTRADAS
// ─────────────────────────────────────────────────────────
function validateCmInput(input, min, max){
  const v=parseFloat(input.value);
  const invalid=isNaN(v)||v<min||v>max;
  input.classList.toggle('invalid', invalid);
  // Find or create validation message
  let msg=input.parentElement.querySelector('.validation-msg');
  if(!msg){
    msg=document.createElement('div');
    msg.className='validation-msg';
    input.parentElement.appendChild(msg);
  }
  if(invalid){
    msg.textContent=`Valor entre ${min} e ${max} cm`;
    msg.classList.add('show');
  } else {
    msg.classList.remove('show');
  }
  return !invalid;
}

// Add validation to cm inputs on change
document.addEventListener('DOMContentLoaded',()=>{
  // Verificar tamanho específico
  const cWEl=document.getElementById('cW');
  const cHEl=document.getElementById('cH');
  if(cWEl) cWEl.addEventListener('input',()=>validateCmInput(cWEl,1,500));
  if(cHEl) cHEl.addEventListener('input',()=>validateCmInput(cHEl,1,500));

  // Tamanho total divisão
  const twEl=document.getElementById('totalW');
  const thEl=document.getElementById('totalH');
  if(twEl) twEl.addEventListener('input',()=>validateCmInput(twEl,1,500));
  if(thEl) thEl.addEventListener('input',()=>validateCmInput(thEl,1,500));

  // Quadro simulação
  const sqWEl=document.getElementById('sqW');
  const sqHEl=document.getElementById('sqH');
  if(sqWEl) sqWEl.addEventListener('input',()=>validateCmInput(sqWEl,5,300));
  if(sqHEl) sqHEl.addEventListener('input',()=>validateCmInput(sqHEl,5,300));

  // Close mobile nav on ESC
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      const nav=document.getElementById('mobileNav');
      if(nav&&nav.classList.contains('open')) toggleMobileNav();
    }
  });

  // Close mobile nav on overlay click (outside menu)
  const mobileNav=document.getElementById('mobileNav');
  if(mobileNav){
    mobileNav.addEventListener('click',e=>{
      if(e.target===mobileNav) toggleMobileNav();
    });
  }
});

// (persistência de imagem entre abas integrada em switchTab)

// Orçamento — ativar quando necessário
function abrirOrcamento(){
  window.open("https://wa.me/5515991355747?text=Olá! Gostaria de fazer um orçamento.", "_blank");
}
/* ═══ ASSISTENTE IA — DESATIVADO (descomentar para ativar) ═══
// ═══════════════════════════════════════════════════════════
//  ASSISTENTE IA — Chatbot com simulador ao vivo
// ═══════════════════════════════════════════════════════════

let chatImg = null;
let chatHistory = [];
let chatBusy = false;
const chatState = {
  w: 80, h: 60,
  frameColor: '#3C2F1E', frameW: 3,
  ppOn: false, ppColor: '#FFFFFF', ppSize: 3,
  bgColor: '#E8EDF2'
};

const CHAT_SYSTEM = `Voce e o Assistente da Fast Frame Sorocaba, especialista em molduras, passepartout e simulacao de quadros.

Quando o usuario descrever o quadro desejado, responda de forma simpatica em portugues e inclua um JSON de configuracao no formato exato:
<config>{"w":80,"h":60,"frameColor":"#3C2F1E","frameW":3,"ppOn":false,"ppColor":"#FFFFFF","ppSize":3}</config>

Campos:
- w, h: tamanho do quadro em cm
- frameColor: cor hex da moldura
- frameW: espessura da moldura em cm (0 = sem moldura, max 12)
- ppOn: true/false para passepartout
- ppColor: cor hex do passepartout
- ppSize: borda do passepartout em cm

Cores de referencia:
- Dourado: #B8903C
- Madeira escura: #3C2F1E
- Madeira clara: #C9A97F
- Cobre: #8A5F2B
- Branco: #FFFFFF
- Preto: #000000
- Prata: #888888

Exemplos:
- "moldura dourada" -> frameColor:#B8903C, frameW:3
- "sem moldura" -> frameW:0
- "passepartout branco" -> ppOn:true, ppColor:#FFFFFF, ppSize:3
- "moldura fina preta" -> frameColor:#000000, frameW:1.5
- "estilo classico" -> frameColor:#B8903C, frameW:4, ppOn:true, ppColor:#F5F0E8, ppSize:5
- "minimalista" -> frameColor:#888, frameW:1, ppOn:false
- "quadro 100x70" -> w:100, h:70

Sempre inclua o bloco config. Seja conciso (maximo 3 linhas de texto).`;

function initChat() {
  const msgs = document.getElementById('chatMessages');
  if (!msgs || msgs.children.length > 0) return;
  addBotMsg('Ola! Sou o assistente da <strong>Fast Frame Sorocaba</strong>.<br>Descreva o quadro que deseja e vou configurar a simulacao em tempo real!');
}

async function sendChatMsg() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || chatBusy) return;
  input.value = '';
  input.style.height = '44px';
  document.getElementById('chatSuggestions').style.display = 'none';
  addUserMsg(text);
  chatHistory.push({ role: 'user', content: text });
  setChatBusy(true);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: CHAT_SYSTEM,
        messages: chatHistory
      })
    });
    const data = await response.json();
    const fullText = data.content?.[0]?.text || '';
    const cfgMatch = fullText.match(/<config>([\s\S]*?)<\/config>/);
    const displayText = fullText.replace(/<config>[\s\S]*?<\/config>/g, '').trim();
    if (cfgMatch) {
      try { applyChatConfig(JSON.parse(cfgMatch[1])); } catch(e) {}
    }
    chatHistory.push({ role: 'assistant', content: fullText });
    addBotMsg(displayText);
  } catch (err) {
    addBotMsg('Ops, problema de conexao. Tente novamente!');
  }
  setChatBusy(false);
}

function chatSuggest(btn) {
  document.getElementById('chatInput').value = btn.textContent;
  sendChatMsg();
}

function applyChatConfig(cfg) {
  if (cfg.w)          { chatState.w = cfg.w; const el=document.getElementById('chatW'); if(el) el.value=cfg.w; }
  if (cfg.h)          { chatState.h = cfg.h; const el=document.getElementById('chatH'); if(el) el.value=cfg.h; }
  if (cfg.frameColor) { chatState.frameColor = cfg.frameColor; const el=document.getElementById('chatFrameColorPicker'); if(el) el.value=cfg.frameColor; clearChatFrameActive(); }
  if (cfg.frameW !== undefined) { chatState.frameW = cfg.frameW; const sl=document.getElementById('chatFrameWSlider'); if(sl) sl.value=cfg.frameW; const lb=document.getElementById('chatFrameWLabel'); if(lb) lb.textContent=cfg.frameW+'cm'; }
  if (cfg.ppOn !== undefined)   { chatState.ppOn = cfg.ppOn; const el=document.getElementById('chatPpCheck'); if(el) el.checked=cfg.ppOn; }
  if (cfg.ppColor)    { chatState.ppColor = cfg.ppColor; const el=document.getElementById('chatPpColorPicker'); if(el) el.value=cfg.ppColor; clearChatPpActive(); }
  if (cfg.ppSize !== undefined) { chatState.ppSize = cfg.ppSize; const sl=document.getElementById('chatPpSlider'); if(sl) sl.value=cfg.ppSize; const lb=document.getElementById('chatPpLabel'); if(lb) lb.textContent=cfg.ppSize+'cm'; }
  renderChatFrame();
  updateChatInfo();
}

function renderChatFrame() {
  const cvs = document.getElementById('chatFrameCanvas');
  const placeholder = document.getElementById('chatSimPlaceholder');
  if (!chatImg) return;
  if(placeholder) placeholder.style.display = 'none';
  cvs.style.display = 'block';
  const ctrl = document.getElementById('chatSimControls');
  if(ctrl) { ctrl.style.display='flex'; ctrl.style.flexDirection='column'; }
  const dl = document.getElementById('chatSimDl');
  if(dl) dl.style.display='flex';
  const stage = cvs.parentElement;
  const stageW = (stage ? stage.offsetWidth - 40 : 0) || 360;
  const { w, h, frameColor, frameW, ppOn, ppColor, ppSize } = chatState;
  const ppCm = ppOn ? ppSize : 0;
  const totW = w + (ppCm + frameW) * 2;
  const totH = h + (ppCm + frameW) * 2;
  const scale = Math.min(stageW / totW, 260 / totH);
  const totalWpx = Math.round(totW * scale);
  const totalHpx = Math.round(totH * scale);
  const fWpx = Math.round(frameW * scale);
  const ppPx = Math.round(ppCm * scale);
  const imgWpx = Math.round(w * scale);
  const imgHpx = Math.round(h * scale);
  cvs.width = totalWpx; cvs.height = totalHpx;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = chatState.bgColor; ctx.fillRect(0,0,totalWpx,totalHpx);
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=16; ctx.shadowOffsetX=3; ctx.shadowOffsetY=4;
  ctx.fillStyle=frameColor||'#ccc'; ctx.fillRect(0,0,totalWpx,totalHpx);
  ctx.restore();
  if (frameW > 0) {
    ctx.fillStyle=frameColor; ctx.fillRect(0,0,totalWpx,totalHpx);
    const bevel=Math.max(2,fWpx*0.12);
    ctx.fillStyle='rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(totalWpx,0); ctx.lineTo(totalWpx-bevel,bevel); ctx.lineTo(bevel,bevel); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(bevel,bevel); ctx.lineTo(bevel,totalHpx-bevel); ctx.lineTo(0,totalHpx); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.moveTo(totalWpx,totalHpx); ctx.lineTo(0,totalHpx); ctx.lineTo(bevel,totalHpx-bevel); ctx.lineTo(totalWpx-bevel,totalHpx-bevel); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(totalWpx,totalHpx); ctx.lineTo(totalWpx-bevel,totalHpx-bevel); ctx.lineTo(totalWpx-bevel,bevel); ctx.lineTo(totalWpx,0); ctx.closePath(); ctx.fill();
  }
  if (ppOn && ppCm > 0) { ctx.fillStyle=ppColor; ctx.fillRect(fWpx,fWpx,totalWpx-fWpx*2,totalHpx-fWpx*2); }
  ctx.drawImage(chatImg, fWpx+ppPx, fWpx+ppPx, imgWpx, imgHpx);
}

function updateChatInfo() {
  const el = document.getElementById('chatQuadroInfo');
  if (!el) return;
  const { w, h, frameW, ppOn, ppSize } = chatState;
  const ppCm = ppOn ? ppSize : 0;
  const totW = w + (ppCm + frameW) * 2;
  const totH = h + (ppCm + frameW) * 2;
  el.style.display = 'block';
  el.innerHTML = `<div class="card-h">Resumo do Quadro</div>
    <div>Imagem: <strong>${w} x ${h} cm</strong></div>
    ${frameW>0?`<div>Moldura: <strong>${frameW}cm</strong></div>`:'<div>Sem moldura</div>'}
    ${ppOn?`<div>Passepartout: <strong>${ppSize}cm</strong></div>`:''}
    <div>Total: <strong>${totW.toFixed(1)} x ${totH.toFixed(1)} cm</strong></div>`;
}

function loadChatImg(e) {
  const file = e.target.files[0]; if (!file) return;
  const run = (blob) => {
    const img = new Image();
    img.onload = () => {
      chatImg = img;
      const [mw,mh] = maxPrintCm(img.naturalWidth, img.naturalHeight);
      chatState.w=mw; chatState.h=mh;
      const cw=document.getElementById('chatW'); if(cw) cw.value=mw;
      const ch=document.getElementById('chatH'); if(ch) ch.value=mh;
      renderChatFrame(); updateChatInfo();
      suggestFileNameFromImage(img);
      addBotMsg(`Imagem carregada! Tamanho maximo recomendado: <strong>${mw} x ${mh} cm</strong>.<br>Que tipo de moldura voce deseja?`);
    };
    img.src = URL.createObjectURL(blob);
  };
  (file.type==='image/heic'||file.type==='image/heif') ? heic2any({blob:file,toType:'image/jpeg',quality:.9}).then(run) : run(file);
}

function dlChatFrame(fmt) {
  const cvs = document.getElementById('chatFrameCanvas');
  if (!cvs||!chatImg) return toast('Carregue uma imagem primeiro.');
  if (fmt==='pdf') { askFileName('quadro-assistente', (fn) => { exportPDF(cvs, fn); toast('PDF baixado!'); }); }
  else { askFileName('quadro-assistente', (fn) => { cvs.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fn+'.jpg'; a.click(); toast('JPEG baixado!'); },'image/jpeg',.95); }); }
}

function addBotMsg(html) {
  const msgs = document.getElementById('chatMessages');
  if(!msgs) return;
  const typing = msgs.querySelector('.msg-typing');
  if (typing) typing.remove();
  const div = document.createElement('div');
  div.className = 'msg bot'; div.innerHTML = html;
  msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function addUserMsg(text) {
  const msgs = document.getElementById('chatMessages');
  if(!msgs) return;
  const div = document.createElement('div');
  div.className = 'msg user'; div.textContent = text;
  msgs.appendChild(div);
  const typing = document.createElement('div');
  typing.className = 'msg-typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
}

function setChatBusy(busy) {
  chatBusy = busy;
  const btn=document.getElementById('chatSendBtn'); if(btn) btn.disabled=busy;
  const inp=document.getElementById('chatInput');   if(inp) inp.disabled=busy;
}

function setChatFrame(color,idx) {
  chatState.frameColor=color;
  const cp=document.getElementById('chatFrameColorPicker'); if(cp) cp.value=color;
  clearChatFrameActive();
  for(let i=0;i<6;i++){const el=document.getElementById('cfb'+i);if(el) el.classList.toggle('active',i===idx);}
  renderChatFrame();
}
function clearChatFrameActive(){for(let i=0;i<6;i++){const el=document.getElementById('cfb'+i);if(el) el.classList.remove('active');}}

function setChatPp(color,idx) {
  chatState.ppColor=color;
  const cp=document.getElementById('chatPpColorPicker'); if(cp) cp.value=color;
  clearChatPpActive();
  for(let i=0;i<5;i++){const el=document.getElementById('cppb'+i);if(el) el.classList.toggle('active',i===idx);}
  renderChatFrame();
}
function clearChatPpActive(){for(let i=0;i<5;i++){const el=document.getElementById('cppb'+i);if(el) el.classList.remove('active');}}

// Hook no switchTab para inicializar o chat
const _origSwitchTab = switchTab;
window.switchTab = function(id, btn) {
  _origSwitchTab(id, btn);
  if (id === 'assistente') {
    initChat();
    if (!chatImg && qImg) {
      chatImg = qImg.img;
      const [mw,mh] = maxPrintCm(qImg.w, qImg.h);
      chatState.w=mw; chatState.h=mh;
      const cw=document.getElementById('chatW'); if(cw) cw.value=mw;
      const ch=document.getElementById('chatH'); if(ch) ch.value=mh;
      setTimeout(()=>{ renderChatFrame(); updateChatInfo(); }, 50);
    }
  }
};
═══ FIM ASSISTENTE IA ═══ */