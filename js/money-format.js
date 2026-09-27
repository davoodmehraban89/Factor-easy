// ============== فرمت سه رقمی اعداد هنگام تایپ (قیمت‌ها و مبالغ) ==============
function toEnglishDigitsMoney(str){
  if(str===null||str===undefined)return '';
  const map={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  return String(str).replace(/[۰-۹]/g,d=>map[d]);
}
function parseFormattedNumber(v){
  if(v===null||v===undefined||v==='')return 0;
  const cleaned=toEnglishDigitsMoney(String(v)).replace(/[^0-9.\-]/g,'');
  const n=parseFloat(cleaned);
  return isNaN(n)?0:n;
}
function handleMoneyInput(el){
  if(!el)return;
  const caretFromEnd=el.value.length-(el.selectionStart||el.value.length);
  const raw=parseFormattedNumber(el.value);
  const hasDigit=/[0-9۰-۹]/.test(el.value);
  const formatted=(!hasDigit)?'':raw.toLocaleString('en-US');
  el.value=formatted;
  const pos=Math.max(0,el.value.length-caretFromEnd);
  try{el.setSelectionRange(pos,pos);}catch(e){}
}
