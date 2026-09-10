/** Trusted original SVG paths, normalized to a 100-square garment study. No user markup. */
export function pieceDrawing(shape:string):string{
 const path=(d:string,extra='')=>`<path d="${d}" ${extra}/>`;
 const line=(d:string)=>path(d,'fill="none" stroke="var(--trim,#7d6b50)"');
 const circle=(x:number,y:number,r:number)=>`<circle cx="${x}" cy="${y}" r="${r}"/>`;
 const star=(x:number,y:number,r:number)=>path(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,q=i%2?r*.45:r;return`${i?'L':'M'}${x+Math.cos(a)*q} ${y+Math.sin(a)*q}`;}).join(' ')+'Z');
 if(['cable','cardigan','waistcoat','pinstripe','raincoat','fisherman','sequin','tunic','tailcoat','vest'].includes(shape)){
  const vest=['waistcoat','vest'].includes(shape),long=['tailcoat','raincoat'].includes(shape);
  let art=path(vest?'M29 15L44 10L50 31L56 10L71 15L66 39L73 82L52 91L49 83L27 89L34 39Z':`M30 14L42 10Q50 21 58 10L70 14L92 37L80 52L72 43L76 ${long?96:85}L24 ${long?96:85}L28 43L20 52L8 37Z`);
  if(['cable','fisherman'].includes(shape)){for(let i=0;i<4;i++)art+=line(shape==='cable'?`M${35+i*10} 28q-6 7 0 14t0 14t0 17`:`M28 ${30+i*14}H72`);}
  if(['cardigan','waistcoat','pinstripe','tailcoat','vest'].includes(shape))art+=line('M42 12L50 38L38 30L30 16M58 12L50 38L62 30L70 16M50 38V83');
  if(['cardigan','waistcoat','pinstripe','raincoat','tunic','tailcoat','vest'].includes(shape)){for(let i=0;i<3;i++){art+=circle(shape==='tunic'?42:51,44+i*12,1.8);if(shape==='tunic')art+=circle(59,44+i*12,1.8);}art+=line('M29 64h13v11H29ZM59 64h13v11H59Z');}
  if(shape==='pinstripe')for(let i=0;i<6;i++)art+=line(`M${29+i*8} 38V80`);
  if(shape==='sequin')for(let y=29;y<81;y+=9)for(let x=32;x<72;x+=9)art+=`<circle cx="${x}" cy="${y}" r="2.3" fill="var(--trim,#c6b478)"/>`;
  if(shape==='vest')for(let i=0;i<4;i++)art+=line(`M33 ${42+i*9}q-8-7 0-5q8-7 0 5M65 ${42+i*9}q-8-7 0-5q8-7 0 5`);
  if(shape==='raincoat')art+=line('M29 30H71M30 17Q50 31 70 17');return art;
 }
 if(shape==='cape')return path('M33 16Q50 7 67 16Q74 56 93 86Q82 94 72 87Q60 95 50 89Q37 96 25 87Q12 94 7 86Q26 53 33 16Z')+line('M36 24L23 84M43 24L37 88M57 24L63 88M64 24L78 84')+circle(50,20,4);
 if(shape==='apron')return path('M37 12H63L66 38L79 88H21L34 38Z')+line('M37 12Q50-1 63 12M34 40L8 51M66 40L92 51M36 56H64V75H36Z');
 if(['toque','watchcap','bakercap','beret','souwester'].includes(shape)){
  const beret=shape==='beret',hat=path(beret?'M17 57Q5 29 38 24Q91 10 88 47L73 64L27 67Z':'M23 66Q21 29 50 27Q79 29 77 66Z');let art=hat+path('M22 62Q50 55 78 62V74Q50 68 22 74Z');if(shape==='toque')art+=circle(50,21,9);if(beret)art+=line('M49 26L54 15');if(shape==='souwester')art+=path('M22 58Q50 49 78 58L94 78Q52 69 6 81Z');if(['toque','watchcap'].includes(shape))for(let x=29;x<77;x+=7)art+=line(`M${x} 63v8`);return art;
 }
 if(shape==='visor')return path('M21 49Q50 38 79 49V58L21 58Z')+path('M21 56Q50 47 79 56L95 73Q50 64 5 73Z');
 if(shape==='chef')return path('M30 71L27 45Q9 44 15 26Q21 14 35 21Q44 4 59 16Q78 6 85 27Q89 43 73 46L70 71Z')+path('M29 61H71V77H29Z')+line('M36 44V61M47 41V61M59 41V61M67 44V61');
 if(shape==='crown')return path('M20 70L12 31L34 45L50 18L66 45L88 31L80 70Z')+path('M19 65H81V77H19Z')+circle(50,50,5);
 if(['round','rectangle','oval','star'].includes(shape)){
  const rim=shape==='round'?circle(28,50,18)+circle(72,50,18):shape==='oval'?'<ellipse cx="27" cy="50" rx="22" ry="15"/><ellipse cx="73" cy="50" rx="22" ry="15"/>':shape==='star'?star(26,50,25)+star(74,50,25):'<rect x="6" y="34" width="40" height="32" rx="5"/><rect x="54" y="34" width="40" height="32" rx="5"/>';
  return `<g fill="none" stroke="var(--piece)" stroke-width="4">${rim}${path('M46 47Q50 43 54 47M6 44L1 42M94 44L99 42')}</g>`;
 }
 if(shape==='scarf')return path('M17 24Q50 6 83 24L75 46L69 86H52L57 47L46 50L40 92H24L31 47L17 43Z')+line('M22 29Q50 44 78 29M26 82v14M32 82v14M38 82v14M57 79v13M63 79v13');
 if(shape==='tie')return path('M37 19L50 14L63 19L56 32L67 78L50 94L33 78L44 32Z')+line('M44 32H56M40 55L58 43M36 73L63 56');
 if(['neckerchief','gingham'].includes(shape)){let art=path('M9 23Q50 5 91 23L50 85Z')+path('M45 42L58 42L62 68L52 60L43 73Z');if(shape==='gingham')for(let i=0;i<5;i++)art+=line(`M${25+i*12} 23L50 ${46+i*7}M${21+i*5} ${29+i*7}H${79-i*5}`);else art+=line('M20 26L50 69L80 26');return art;}
 if(shape==='bow')return path('M44 43Q9 14 12 54Q9 80 44 56L35 89L49 80L60 89L57 57Q95 81 88 49Q95 13 56 43Z')+circle(50,50,9);
 if(['ribbon','yarn','bell'].includes(shape))return path('M8 30Q50 42 92 30V46Q50 58 8 46Z')+(shape==='bell'?path('M41 53Q36 78 50 83Q64 78 59 53Z')+line('M43 74H57'):circle(50,50,10)+line('M44 44L56 56M56 44L44 56'));
 let chain=line('M20 7Q13 44 50 40Q87 44 80 7');
 if(shape==='chain')return chain+line('M18 13Q12 50 50 47Q88 50 82 13');
 if(shape==='teacup')return chain+path('M29 50H64L59 78H35Z')+line('M63 52Q85 48 77 68Q73 76 61 70')+path('M23 79Q50 90 76 79L66 89H33Z');
 if(['watch','cameo','stamp'].includes(shape))return chain+`<ellipse cx="50" cy="65" rx="23" ry="${shape==='cameo'?29:23}"/>`+`<ellipse cx="50" cy="65" rx="18" ry="${shape==='cameo'?24:18}" fill="var(--trim,#d9cab0)"/>`+(shape==='watch'?line('M50 51V65L60 70'):path('M40 72L40 58L46 62L53 57L61 61L62 73Z'));
 if(shape==='starpendant')return chain+star(50,65,28);
 if(shape==='whisk')return chain+line('M50 90V63Q17 22 50 43Q83 22 50 63M50 63Q30 31 45 41M50 63Q70 31 55 41')+path('M47 65H53V94H47Z');
 if(shape==='puffin')return chain+path('M35 90Q22 78 32 57Q28 32 49 33Q70 33 66 56Q78 85 61 92Z')+path('M62 41L80 51L63 56Z')+'<ellipse cx="50" cy="72" rx="13" ry="18" fill="var(--trim,#eee4cc)"/>'+circle(54,44,2);
 if(shape==='fish')return chain+path('M17 70L5 53V85L17 75Q53 32 91 70Q53 107 17 75Z')+circle(74,65,3);
 if(shape==='tooth')return chain+path('M29 45Q50 35 71 45L64 85L51 96L40 85Z');
 if(shape==='clip')return chain+line('M37 82V46Q50 34 63 46V85Q50 101 42 83V52Q50 46 56 52V78');
 return chain;
}
