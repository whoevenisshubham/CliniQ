// Audio-energy boundaries are estimates, not independent speech annotation.
// Holds timestamps only; never retains samples or uploads a reference again.
export class LiveSpeechTiming{
 private firstEnergy:number|undefined;private lastEnergy:number|undefined;private firstInterim:number|undefined;private lastFinal:number|undefined;
 observe(pcm:Uint8Array,at:number){if(!pcm.length||pcm.length%2)return;const view=new DataView(pcm.buffer,pcm.byteOffset,pcm.byteLength);let energy=0,count=0;for(let i=0;i<pcm.byteLength;i+=64){energy+=(view.getInt16(i,true)/32768)**2;count++;}if(Math.sqrt(energy/count)>.015){this.firstEnergy??=at-pcm.byteLength/32;this.lastEnergy=at;}}
 interim(at:number){this.firstInterim??=at;}
 final(at:number){this.lastFinal=at;}
 metrics(){return{energyOnsetToInterimMs:this.firstEnergy!==undefined&&this.firstInterim!==undefined?Math.round(this.firstInterim-this.firstEnergy):undefined,energyEndToFinalMs:this.lastEnergy!==undefined&&this.lastFinal!==undefined&&this.lastFinal>=this.lastEnergy?Math.round(this.lastFinal-this.lastEnergy):undefined};}
}
