import config from "../../config.js";
import IchigoBuilder from "../../src/lib/ichigo-builder.js";
const { AIRich } = IchigoBuilder;

const pluginConfig = {
  name: "piano",
  alias: ["htmlpiano", "pianowidget", "virtualpiano"],
  category: "tools",
  description: "Menampilkan Widget Piano HTML Interaktif di WhatsApp",
  usage: ".piano",
  example: ".piano",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

const PIANO_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{margin:0;padding:0;background:linear-gradient(#5c94fc,#8fc4ff);font-family:Arial,sans-serif;overflow-x:hidden;}
body{padding:20px 0;}
.title{text-align:center;color:white;font-size:22px;font-weight:bold;}
.sub{text-align:center;color:white;font-size:13px;margin:6px 0 25px;}
.piano-wrap{width:100%;padding:0 12px;}
.piano{position:relative;width:100%;height:52vw;max-height:260px;min-height:170px;display:flex;touch-action:none;}
.white{position:relative;width:12.5%;flex:1 1 12.5%;height:100%;padding:0;margin:0;background:#fff;border:1px solid #222;border-radius:0 0 8px 8px;color:#222;font-size:11px;font-weight:bold;display:flex;align-items:flex-end;justify-content:center;padding-bottom:14px;box-shadow:0 5px 0 #aaa;z-index:1;}
.white:first-child{border-radius:10px 0 0 10px;}
.white:last-child{border-radius:0 10px 10px 0;}
.white:active,.white.active{background:#ddd;transform:translateY(5px);box-shadow:0 1px 0 #888;}
.black{position:absolute;top:0;width:9%;height:58%;padding:0;margin:0;background:linear-gradient(90deg,#111,#333,#050505);border:2px solid #000;border-radius:0 0 6px 6px;color:white;font-size:9px;font-weight:bold;display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;box-shadow:0 6px 5px rgba(0,0,0,.5);z-index:5;}
.black:active,.black.active{background:#555;transform:translateY(4px);box-shadow:0 2px 3px rgba(0,0,0,.5);}
.b1{left:7.8%}.b2{left:20.3%}.b3{left:45.3%}.b4{left:57.8%}.b5{left:70.3%}
#note{text-align:center;color:white;font-size:22px;font-weight:bold;margin-top:25px;}
</style>
</head>
<body>
<div class="title">PIANO</div>
<div class="sub">Do - Re - Mi - Fa - Sol - La - Si - Do</div>
<div class="piano-wrap">
<div class="piano">
<button class="white" data-freq="261.63" data-name="Do">Do</button>
<button class="white" data-freq="293.66" data-name="Re">Re</button>
<button class="white" data-freq="329.63" data-name="Mi">Mi</button>
<button class="white" data-freq="349.23" data-name="Fa">Fa</button>
<button class="white" data-freq="392.00" data-name="Sol">Sol</button>
<button class="white" data-freq="440.00" data-name="La">La</button>
<button class="white" data-freq="493.88" data-name="Si">Si</button>
<button class="white" data-freq="523.25" data-name="Do">Do</button>
<button class="black b1" data-freq="277.18" data-name="Do#">Do#</button>
<button class="black b2" data-freq="311.13" data-name="Re#">Re#</button>
<button class="black b3" data-freq="369.99" data-name="Fa#">Fa#</button>
<button class="black b4" data-freq="415.30" data-name="Sol#">Sol#</button>
<button class="black b5" data-freq="466.16" data-name="La#">La#</button>
</div>
</div>
<div id="note">Tekan piano</div>
<script>
let audioContext=null;
function initAudio(){
if(!audioContext){
const AudioContext=window.AudioContext||window.webkitAudioContext;
if(!AudioContext){
document.getElementById('note').textContent='Audio tidak didukung';
return null;
}
audioContext=new AudioContext();
}
if(audioContext.state==='suspended'){
audioContext.resume();
}
return audioContext;
}
function playPiano(freq){
const ctx=initAudio();
if(!ctx)return;
const now=ctx.currentTime;
const master=ctx.createGain();
master.gain.setValueAtTime(0,now);
master.gain.linearRampToValueAtTime(0.5,now+0.015);
master.gain.exponentialRampToValueAtTime(0.001,now+1.2);
master.connect(ctx.destination);
const osc1=ctx.createOscillator();
const osc2=ctx.createOscillator();
const osc3=ctx.createOscillator();
const gain1=ctx.createGain();
const gain2=ctx.createGain();
const gain3=ctx.createGain();
osc1.type='triangle';
osc2.type='sine';
osc3.type='sine';
osc1.frequency.value=freq;
osc2.frequency.value=freq*2;
osc3.frequency.value=freq*3;
gain1.gain.value=1;
gain2.gain.value=.22;
gain3.gain.value=.08;
osc1.connect(gain1);
osc2.connect(gain2);
osc3.connect(gain3);
gain1.connect(master);
gain2.connect(master);
gain3.connect(master);
osc1.start(now);
osc2.start(now);
osc3.start(now);
osc1.stop(now+1.3);
osc2.stop(now+1.3);
osc3.stop(now+1.3);
}
document.querySelectorAll('.white,.black').forEach(function(key){
function press(e){
e.preventDefault();
key.classList.add('active');
document.getElementById('note').textContent=key.dataset.name;
playPiano(parseFloat(key.dataset.freq));
}
function release(){
key.classList.remove('active');
}
key.addEventListener('pointerdown',press);
key.addEventListener('pointerup',release);
key.addEventListener('pointercancel',release);
key.addEventListener('pointerleave',release);
});
</script>
</body>
</html>`;

async function handler(m, { sock }) {
  m.react("🎹");
  const conn = sock || m.conn;

  const rich = new AIRich(conn).setTitle("Fiora Sylvie Piano");

  try {
    await rich.send(m.chat, { quoted: m });
    await new Promise((r) => setTimeout(r, 400));

    rich.addSection({
      view_model: {
        __typename: "GenAISingleLayoutViewModel",
        primitive: {
          __typename: "GenAIaeacdsnwHtmlPrimitive",
          trusted_sources: ["nixel.dev"],
          payload: PIANO_HTML,
        },
      },
    });

    await rich.sendEdit();
  } catch (e) {
    m.reply(`❌ *Gagal memuat Fiora Sylvie Piano:* ${e.message}`);
  }
}

export { pluginConfig as config, handler };
