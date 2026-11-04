// Only display records already returned by the authorized state endpoint.
export function memoryDetails(message,memories,owner){
 const ids=new Set(message.memoryIds||[]);
 const references=memories.filter(memory=>ids.has(memory.id));
 const details=document.createElement('details');
 const summary=document.createElement('summary');
 summary.textContent='本次召回参考记忆 · '+references.length+' 条';details.append(summary);
 const note=document.createElement('p');note.className='muted';note.textContent='这些记录曾作为生成上下文；仍需核对回复是否准确使用了它们。';details.append(note);
 if(!references.length){note.textContent='本次没有可展示的参考记忆。';return details;}
 for(const memory of references){const item=document.createElement('div');item.className='memory';const text=document.createElement('p');text.textContent=memory.text;item.append(text);if(owner&&memory.evidenceQuote){const quote=document.createElement('blockquote');quote.textContent=memory.evidenceQuote;item.append(quote);}details.append(item);}
 return details;
}
