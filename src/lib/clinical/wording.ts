// Finite clinical wording equivalences; no clinical inference.
const phrases:[RegExp,string][]=[[/\b(?:twice daily|two times daily)\b|दिन में दो बार/giu,' twice_daily '],[/\b(?:once daily|one time daily)\b|दिन में एक बार/giu,' once_daily '],[/\bshortness of breath\b|सांस फूलने|सांस फूलना/giu,' dyspnea '],[/\bchest pain\b|सीने में दर्द/giu,' chestpain '],[/चक्कर|\bdizziness\b/giu,' dizziness '],[/थकान|\bfatigue\b/giu,' fatigue '],[/बुखार|\bfever\b/giu,' fever '],[/\bmilligrams?\b/giu,' mg '],[/\bpercent\b/giu,' % ']];
const digits:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
export function normalizeClinicalWording(text:string){
 let s=text.normalize('NFC').toLocaleLowerCase().replace(/[०-९]/g,x=>String(x.charCodeAt(0)-0x966));
 for(const [pattern,value]of phrases)s=s.replace(pattern,value);
 const hindi:Record<string,string>={'एक':'1','दो':'2','तीन':'3','चार':'4','पांच':'5','पाँच':'5','छह':'6','सात':'7','आठ':'8','नौ':'9','दस':'10'};s=s.replace(/(?<![\p{L}\p{M}])(?:एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ|दस)(?![\p{L}\p{M}])/gu,w=>hindi[w]);
 // Bounded spoken English numbers, including decimal digits; no guessed units.
 s=s.replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)(?:(?:[ -]+)(?:and|point|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))*\b/giu,words=>{
  let n=0,part=0,decimal='',point=false;for(const word of words.split(/[ -]+/)){if(word==='and')continue;if(word==='point'){point=true;continue;}if(point){if(digits[word]===undefined||digits[word]>9)return words;decimal+=digits[word];continue;}if(word==='hundred')part=(part||1)*100;else if(word==='thousand'){n+=(part||1)*1000;part=0;}else part+=digits[word]??0;}return String(n+part)+(point&&decimal?'.'+decimal:'');
 });return s.replace(/\s+/g,' ').trim();
}
