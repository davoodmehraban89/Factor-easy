// ============== فرمت سه رقمی اعداد هنگام تایپ (قیمت‌ها و مبالغ) ==============
function toEnglishDigitsMoney(str){
  if(str===null||str===undefined)return '';
  const fa={'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  const ar={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
  return String(str).replace(/[۰-۹]/g,d=>fa[d]).replace(/[٠-٩]/g,d=>ar[d]);
}
function parseFormattedNumber(v){
  if(v===null||v===undefined||v==='')return 0;
  const normalized=toEnglishDigitsMoney(String(v))
    .replace(/[٬،,\u00A0\u202F\s]/g,'')
    .replace(/[٫]/g,'.');
  const cleaned=normalized.replace(/[^0-9.\-]/g,'');
  const n=parseFloat(cleaned);
  return isNaN(n)?0:n;
}
function handleMoneyInput(el){
  if(!el)return;
  const caretFromEnd=el.value.length-(el.selectionStart||el.value.length);
  const raw=parseFormattedNumber(el.value);
  const hasDigit=/[0-9۰-۹٠-٩]/.test(el.value);
  const formatted=(!hasDigit)?'':raw.toLocaleString('en-US');
  el.value=formatted;
  const pos=Math.max(0,el.value.length-caretFromEnd);
  try{el.setSelectionRange(pos,pos);}catch(e){}
}
