(function () {
  "use strict";
  const STORAGE_KEY = "erlangen-job-shortlist.statuses.v1";
  const LABELS = {not_applied:"Not applied",applied:"Applied",rejected:"Rejected",interview:"Interview invitation",unavailable:"Not available"};
  const MAX_RECORDS = 25000;
  function jobKey(value) {
    const u = new URL(value);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_.+|trk|trackingId|ref|source|campaign|refId|originalSubdomain)$/i.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    return u.hostname.replace(/^(www|de)\./,"").toLowerCase()+u.pathname.replace(/\/$/,"")+u.search;
  }
  function validateRecords(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid status file.");
    const result = Object.create(null), entries=Object.entries(value);
    if(entries.length>MAX_RECORDS) throw new Error("Too many status records.");
    for (const [key, record] of entries) {
      if (key.length>5000 || !key.includes("/") || key==="__proto__" || !record || !Object.hasOwn(LABELS,record.status) || typeof record.updatedAt!=="string" || !Number.isFinite(Date.parse(record.updatedAt))) throw new Error("Invalid status record.");
      result[key]={status:record.status,updatedAt:new Date(record.updatedAt).toISOString()};
    }
    return result;
  }
  function mergeRecords(current,incoming) {
    const out=Object.assign(Object.create(null),current);
    for(const [key,value] of Object.entries(incoming)) if(!out[key] || Date.parse(value.updatedAt)>Date.parse(out[key].updatedAt)) out[key]=value;
    return out;
  }
  const core={jobKey,validateRecords,mergeRecords,LABELS,STORAGE_KEY};
  if(typeof module!=="undefined" && module.exports) module.exports=core;
  if(typeof document==="undefined") return;
  if(document.getElementById("application-tracker")) return;
  const cards=[...document.querySelectorAll("article")].filter(a=>a.querySelector("h3 a[href],h4 a[href]"));
  if(!cards.length) return;
  let records=Object.create(null), storageOK=true;
  try { const raw=localStorage.getItem(STORAGE_KEY); if(raw) records=validateRecords(JSON.parse(raw)); }
  catch { storageOK=false; }
  function statusFor(key){return records[key]?.status || "not_applied";}
  const panel=document.createElement("section");
  panel.id="application-tracker"; panel.className="application-tracker"; panel.setAttribute("aria-label","Private application tracker");
  panel.innerHTML='<h2>Your application tracker</h2><p class="tracker-note">Statuses are private to this browser and are not published. They survive daily listing updates. Export/import to transfer them between computers or browsers; clearing site data removes saved statuses. Each job is grouped by its first recommendation day.</p><div id="tracker-summary" class="tracker-summary" aria-live="polite"></div><p class="tracker-summary-note">Summary follows the day, category and search selection; the status filter does not change the summary totals. Applied means awaiting a response.</p><div class="tracker-filters"><div><label for="recommendation-date">Recommendation day</label><select id="recommendation-date"><option value="all">All recommendation days</option></select></div><div><label for="application-status-filter">Application status</label><select id="application-status-filter"><option value="all">All statuses</option></select></div></div><div class="tracker-tools"><button type="button" id="export-application-status">Export statuses</button><button type="button" id="import-application-status">Import statuses</button><input type="file" id="status-import-file" accept=".json,application/json" hidden></div><p id="tracker-message" role="status" aria-live="polite"></p>';
  const header=document.querySelector("header"); if(header) header.after(panel); else document.body.prepend(panel);
  const message=document.getElementById("tracker-message");
  const statusFilter=document.getElementById("application-status-filter");
  const dateFilter=document.getElementById("recommendation-date");
  const dates=[...new Set(cards.map(a=>a.dataset.recommended).filter(Boolean))].sort().reverse();
  for(const date of dates) {const o=new Option(new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z")),date);dateFilter.add(o);}
  for(const [value,label] of Object.entries(LABELS)) statusFilter.add(new Option(label,value));
  const previousFilter=typeof window.filterJobs==="function"?window.filterJobs:null;
  function announceStorage(){if(!storageOK)message.textContent="Browser storage is unavailable or contains unreadable data. Current changes are kept for this visit; export them before closing.";}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));storageOK=true;}catch{storageOK=false;announceStorage();}}
  cards.forEach((card,index)=>{
    const link=card.querySelector("h3 a[href],h4 a[href]");
    const key=card.dataset.jobKey || jobKey(link.href);card.dataset.jobKey=key;
    card.dataset.trackerSearch=card.textContent.toLocaleLowerCase();
    const wrapper=document.createElement("div");wrapper.className="job-status-control";
    const id="application-status-"+index;
    const label=document.createElement("label");label.htmlFor=id;label.textContent="Application status";
    const select=document.createElement("select");select.id=id;select.className="job-application-status";select.setAttribute("aria-label","Application status — "+link.textContent.trim());
    for(const [value,text] of Object.entries(LABELS))select.add(new Option(text,value));
    select.value=statusFor(key);wrapper.append(label,select);link.closest("h3,h4").after(wrapper);
    select.addEventListener("change",()=>{
      records[key]={status:select.value,updatedAt:new Date().toISOString()};persist();
      for(const other of cards.filter(a=>a.dataset.jobKey===key)){other.querySelector(".job-application-status").value=select.value;other.dataset.applicationStatus=select.value;}
      refresh();if(storageOK)message.textContent="Status saved in this browser.";
    });
    card.dataset.applicationStatus=select.value;
  });
  function countsFor(list){const counts={total:0,...Object.fromEntries(Object.keys(LABELS).map(s=>[s,0]))},seen=new Set();for(const card of list){const key=card.dataset.jobKey;if(seen.has(key))continue;seen.add(key);counts.total++;counts[statusFor(key)]++;}return counts;}
  function drawSummary(target,counts){target.replaceChildren();for(const [key,label] of [["total","Total suggested"],...Object.entries(LABELS)]){const badge=document.createElement("span");badge.className="tracker-stat tracker-"+key;const n=document.createElement("strong");n.textContent=String(counts[key]);badge.append(n,document.createTextNode(" "+label));target.append(badge);}}
  function refresh(){
    if(previousFilter)previousFilter();
    const q=document.querySelector("#search")?.value.toLocaleLowerCase().trim()||"",category=document.querySelector("#category")?.value||"all",day=dateFilter.value,stage=statusFilter.value;
    const candidates=[];
    for(const card of cards){
      const cat=card.dataset.primaryCategory||card.closest("section[data-category]")?.dataset.category;
      const match=(!q||card.dataset.trackerSearch.includes(q))&&(category==="all"||category===cat)&&(day==="all"||day===card.dataset.recommended);
      if(match)candidates.push(card);
      card.hidden=!match||(stage!=="all"&&statusFor(card.dataset.jobKey)!==stage);
    }
    drawSummary(document.getElementById("tracker-summary"),countsFor(candidates));
    document.querySelectorAll("section[data-category]").forEach(s=>s.hidden=![...s.querySelectorAll("article")].some(a=>!a.hidden));
    document.querySelectorAll(".recommendation-day").forEach(group=>{
      group.hidden=![...group.querySelectorAll("article")].some(a=>!a.hidden);
      const daily=group.querySelector(".day-status-summary");if(daily)drawSummary(daily,countsFor(candidates.filter(a=>a.closest(".recommendation-day")===group)));
    });
    const count=document.getElementById("count");if(count)count.textContent=countsFor(cards.filter(a=>!a.hidden)).total+" distinct jobs shown";
    let empty=document.getElementById("tracker-empty");
    if(!empty){empty=document.createElement("p");empty.id="tracker-empty";empty.setAttribute("role","status");panel.after(empty);}
    empty.textContent=cards.some(a=>!a.hidden)?"":"No jobs match these filters.";
  }
  for(const id of ["search","category"])document.getElementById(id)?.addEventListener(id==="search"?"input":"change",refresh);
  dateFilter.addEventListener("change",refresh);statusFilter.addEventListener("change",refresh);
  window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY){try{records=e.newValue?validateRecords(JSON.parse(e.newValue)):Object.create(null);for(const card of cards){const value=statusFor(card.dataset.jobKey);card.querySelector(".job-application-status").value=value;card.dataset.applicationStatus=value;}refresh();}catch{message.textContent="A status update from another tab could not be read.";}}});
  document.getElementById("export-application-status").addEventListener("click",()=>{
    const data={schema:"erlangen-job-shortlist-statuses",version:1,exportedAt:new Date().toISOString(),records};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="job-application-statuses-"+new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin"}).format(new Date())+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message.textContent="Statuses exported. Import this file in the other browser to transfer your progress.";
  });
  document.getElementById("import-application-status").addEventListener("click",()=>document.getElementById("status-import-file").click());
  document.getElementById("status-import-file").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>5*1024*1024)throw new Error("Status file is too large.");
      const data=JSON.parse(await file.text());if(data.schema!=="erlangen-job-shortlist-statuses"||data.version!==1)throw new Error("Choose an exported job-status JSON file.");
      const incoming=validateRecords(data.records);records=mergeRecords(records,incoming);persist();
      for(const card of cards){const value=statusFor(card.dataset.jobKey);card.querySelector(".job-application-status").value=value;card.dataset.applicationStatus=value;}refresh();
      if(storageOK)message.textContent="Statuses imported. Newer updates are kept when both files contain the same job.";
    }catch(error){message.textContent="Import failed: "+error.message;}
    e.target.value="";
  });
  refresh();announceStorage();
})();
