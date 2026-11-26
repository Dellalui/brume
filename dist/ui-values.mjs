// Avoid DOM mutations when the displayed value has not changed.
export function setText(node,value){const text=String(value??'');if(node&&node.textContent!==text)node.textContent=text}
export function setHidden(node,value){const hidden=!!value;if(node&&node.hidden!==hidden)node.hidden=hidden}
export function setValue(node,value){const text=String(value??'');if(node&&node.value!==text)node.value=text}
export function setData(node,key,value){const text=String(value);if(node&&node.dataset[key]!==text)node.dataset[key]=text}
export function setAttr(node,key,value){const text=String(value);if(node&&node.getAttribute(key)!==text)node.setAttribute(key,text)}
