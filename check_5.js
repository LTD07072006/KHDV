
(function(){
 const examStart=document.getElementById('examStart'), examSubmit=document.getElementById('examSubmit'), examTimer=document.getElementById('examTimer'), examProgress=document.getElementById('examProgress'), examQuestions=document.getElementById('examQuestions'), examResult=document.getElementById('examResult');
 const source1000=matrixData.map(q=>({...q,source:q.source||'1000 câu ma trận'}));
 const source170=data.map(q=>({...q,text:q.text||'',options:q.options||[],ans:(q.ans||'').replace(/[^A-D,]/gi,'').toUpperCase(),exp:q.exp||'Đối chiếu nội dung tương ứng trong bài giảng.',group:group170(q.n),source:q.source||'170 câu gốc',level:'TH'}));
 let examItems=[],timerId=null,seconds=4500; const esc=escapeHtml;
 function group170(n){if(n<=9||[101,102,106,107,109,112,113,115,116,130,140,143,145,146,154,161,162].includes(n))return 'Kiến trúc ứng dụng web';if((n>=10&&n<=30)||[76,91,96,98,105,111,117,120,121,124,126,135,136,137,138,141,142,148,149,156,163,168,169].includes(n))return 'HTML';if((n>=31&&n<=49)||[78,86,99,100,108,118,123,125,128,131,133,144,150,151,152,153,157,170].includes(n))return 'CSS';return 'JavaScript, DOM';}
 function scorable(q){if(!q||!Array.isArray(q.options)||q.options.length<2||!q.ans)return false;const letters=q.ans.split(',').map(x=>x.trim()).filter(Boolean);return letters.length>0&&letters.every(a=>/^[A-D]$/.test(a)&&q.options[a.charCodeAt(0)-65]);}
 const oldScorable=source170.filter(scorable);
 function shuffle(a){const out=a.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function pick(){const quotas=[['Kiến trúc ứng dụng web',10],['HTML',20],['CSS',20],['JavaScript, DOM',30]],result=[];for(const [group,count] of quotas){const pool=shuffle([...source1000.filter(q=>q.group===group&&scorable(q)),...oldScorable.filter(q=>q.group===group)]);result.push(...pool.slice(0,count));}return shuffle(result);}
 function selectedFor(i){return [...document.querySelectorAll(`input[name="exam-${i}"]:checked`)].map(x=>x.value).sort();}
 function answerText(q,ans){return (ans||'').split(',').filter(Boolean).map(a=>q.options[a.charCodeAt(0)-65]||a).join(' · ');}
 function start(){clearInterval(timerId);examItems=pick();seconds=4500;examResult.innerHTML='';examSubmit.disabled=false;examStart.textContent='Đề mới';renderExam();timerId=setInterval(()=>{seconds--;timer();if(seconds<=0){clearInterval(timerId);submit(true);}},1000);timer();}
 function timer(){const m=String(Math.floor(seconds/60)).padStart(2,'0'),s=String(seconds%60).padStart(2,'0');examTimer.textContent=`${m}:${s}`;examProgress.textContent=`Đã làm ${examItems.filter((q,i)=>selectedFor(i).length).length}/80 câu`;}
 function renderExam(){examQuestions.innerHTML=examItems.map((q,i)=>{const multi=q.ans.includes(',');return `<article class="qcard"><div class="qhead"><span class="qno">Câu ${i+1}</span><span class="pill">${esc(q.group||'')}</span></div><div class="qtext">${esc(q.text||'')}</div><div class="exam-options">${q.options.map((o,j)=>`<label><input type="${multi?'checkbox':'radio'}" name="exam-${i}" value="${String.fromCharCode(65+j)}"> ${esc(o)}</label>`).join('')}</div></article>`;}).join('');examQuestions.querySelectorAll('input').forEach(el=>el.addEventListener('change',timer));}
 function submit(auto){
  if(!examItems.length)return;
  clearInterval(timerId);
  let score=0,answered=0;
  const review=examItems.map((q,i)=>{
    const chosen=selectedFor(i), correct=(q.ans||'').split(',').filter(Boolean).sort();
    if(chosen.length)answered++;
    const ok=chosen.length===correct.length&&chosen.every((x,j)=>x===correct[j]);
    if(ok)score++;
    return {i,q,chosen,correct,ok};
  });
  const point=(score/80*10).toFixed(2);
  const reviewHtml=review.map(w=>`<div class="card ${w.ok?'exam-correct':'trap'}">
    <h3>Câu ${w.i+1} · <span class="exam-status">${w.ok?'ĐÚNG':'SAI'}</span> · ${esc(w.q.group||'')}</h3>
    <div class="qtext">${esc(w.q.text||'')}</div>
    <p><b>Bạn chọn:</b> ${esc(answerText(w.q,w.chosen.join(','))||'Chưa chọn')}<br>
    <b>Đáp án đúng:</b> ${esc(answerText(w.q,w.correct.join(',')))}</p>
    <p class="explain"><b>Giải thích:</b> ${esc(w.q.exp||'Đối chiếu phần kiến thức tương ứng trong bài giảng.')}</p>
  </div>`).join('');
  examResult.innerHTML=`<div class="card"><h3>${auto?'Hết giờ — ':''}Kết quả: ${score}/80 đúng, ${point}/10 điểm</h3><p>Đã trả lời ${answered}/80 câu. Bên dưới là phần đối chiếu <b>toàn bộ 80 câu</b>, gồm cả câu đúng và câu sai, kèm giải thích.</p></div>${reviewHtml}`;
  examSubmit.disabled=true;
  examQuestions.querySelectorAll('input').forEach(el=>el.disabled=true);
  examProgress.textContent=`Kết thúc · ${answered}/80 câu đã trả lời`;
 }
 examStart.addEventListener('click',start);examSubmit.addEventListener('click',()=>submit(false));
})();
