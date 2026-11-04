// Exact source spans: no rewriting or inferred topic labels.
export function segmentSource(text,maxLength=800){
 if(typeof text!=='string'||!Number.isInteger(maxLength)||maxLength<100||maxLength>2000)throw Object.assign(Error('分段参数无效'),{status:400});
 const result=[];let start=0;
 while(start<text.length){let end=Math.min(start+maxLength,text.length);if(end<text.length){const window=text.slice(start,end);const paragraph=window.lastIndexOf('\n');const sentence=Math.max(...['。','！','？','. ','! ','? '].map(mark=>window.lastIndexOf(mark)));const boundary=paragraph>=maxLength/3?paragraph+1:sentence>=maxLength/3?sentence+1:window.length;end=start+boundary;if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;}
 result.push({index:result.length,start,end,text:text.slice(start,end)});start=end;
 }return result;
}
