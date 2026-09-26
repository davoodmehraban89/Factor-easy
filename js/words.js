function numberToPersianWords(num,currencyLabel){
  const cur=currencyLabel||'ریال';
  if(!num||isNaN(num)||num==0)return 'صفر '+cur;
  const yegan=["","یک","دو","سه","چهار","پنج","شش","هفت","هشت","نه"];
  const dahgan=["","","بیست","سی","چهل","پنجاه","شصت","هفتاد","هشتاد","نود"];
  const dah_ta_bist=["ده","یازده","دوازده","سیزده","چهارده","پانزده","شانزده","هفده","هجده","نوزده"];
  const sadgan=["","صد","دویست","سیصد","چهارصد","پانصد","ششصد","هفتصد","هشتصد","نهصد"];
  const part_names=["","هزار","میلیون","میلیارد","تریلیون"];
  function threeDigitToWords(n){
    let c=Math.floor(n/100);
    let d=Math.floor((n%100)/10);
    let y=n%10;
    let parts=[];
    if(c>0)parts.push(sadgan[c]);
    if(d===1)parts.push(dah_ta_bist[y]);
    else{
      if(d>1)parts.push(dahgan[d]);
      if(y>0)parts.push(yegan[y]);
    }
    return parts.join(" و ");
  }
  let parts=[];
  let chunkIdx=0;
  let temp=Math.abs(Math.round(num));
  while(temp>0){
    let chunk=temp%1000;
    if(chunk>0){
      let w=threeDigitToWords(chunk);
      if(part_names[chunkIdx])w+=" "+part_names[chunkIdx];
      parts.unshift(w);
    }
    temp=Math.floor(temp/1000);
    chunkIdx++;
  }
  return parts.join(" و ")+" "+cur;
}
