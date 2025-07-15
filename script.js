// ===== CONFIGURAÇÕES GERAIS =====
const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const fotoBtn = document.getElementById("foto");
const bumerangueBtn = document.getElementById("bumerangue");
const statusUpload = document.getElementById("statusUpload");
const qrDiv = document.getElementById("qrDownload");
const moldura = document.getElementById("moldura");

// Configurações do Bumerangue
const BOOMERANG_SETTINGS = {
  width: 540,
  height: 960,
  fps: 30,
  duration: 2
};

// Variáveis de estado
let stream;
let mediaRecorder;
let chunks = [];
let cancelRecording = false;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  iniciarCamera();
  criarBotaoCancelar();
});

// ===== FUNÇÕES PRINCIPAIS =====

// 1. Sistema de Upload para GoFile
async function enviarParaGoFile(blob, tipo) {
  statusUpload.innerText = `Enviando ${tipo === 'foto' ? 'imagem' : 'vídeo'}...`;
  statusUpload.style.display = 'block';

  try {
    // Obter servidor ativo
    const serverRes = await fetch("https://api.gofile.io/getServer");
    const { data: { server } } = await serverRes.json();

    // Preparar arquivo
    const extensao = tipo === 'foto' ? 'png' : (tipo === 'webm' ? 'webm' : 'mp4');
    const formData = new FormData();
    formData.append('file', blob, `showfest_${Date.now()}.${extensao}`);

    // Fazer upload
    const uploadRes = await fetch(`https://${server}.gofile.io/uploadFile`, {
      method: 'POST',
      body: formData
    });
    const { data } = await uploadRes.json();

    if (!data?.downloadPage) throw new Error("Upload falhou");
    return data.downloadPage;

  } catch (erro) {
    console.error("Erro no upload:", erro);
    throw erro;
  } finally {
    statusUpload.style.display = 'none';
  }
}

// 2. Função para Fotos
async function processarFoto() {
  // Capturar imagem do canvas
  const imgData = canvas.toDataURL('image/png');
  const blob = dataURLtoBlob(imgData);

  try {
    // Upload para GoFile
    const gofileUrl = await enviarParaGoFile(blob, 'foto');
    
    // Gerar QR Code primeiro
    gerarQRCode(gofileUrl);
    
    // Download local após 1s (opcional)
    setTimeout(() => {
      baixarImagemLocal(imgData);
    }, 1000);

  } catch (erro) {
    mostrarErro("Erro ao processar foto");
  }
}

// 3. Função para Bumerangue
async function processarBumerangue() {
  try {
    const webmBlob = new Blob(chunks, { type: 'video/webm' });
    
    // Converter para MP4
    statusUpload.innerText = "Convertendo para MP4...";
    statusUpload.style.display = 'block';
    const mp4Blob = await converterParaMP4(webmBlob);
    
    // Upload para GoFile
    const gofileUrl = await enviarParaGoFile(mp4Blob, 'video');
    
    // Gerar QR Code
    gerarQRCode(gofileUrl);
    
    // Download local após 1s (opcional)
    setTimeout(() => {
      const url = URL.createObjectURL(mp4Blob);
      baixarVideoLocal(url, 'bumerangue.mp4');
    }, 1000);

  } catch (erro) {
    mostrarErro("Erro ao processar vídeo");
  }
}

// ===== FUNÇÕES DE APOIO =====

// Conversão WebM → MP4
async function converterParaMP4(webmBlob) {
  const { createFFmpeg } = FFmpeg;
  const ffmpeg = createFFmpeg({ log: true });
  await ffmpeg.load();

  ffmpeg.FS('writeFile', 'input.webm', new Uint8Array(await webmBlob.arrayBuffer()));
  await ffmpeg.run(
    '-i', 'input.webm',
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-pix_fmt', 'yuv420p',
    'output.mp4'
  );

  const data = ffmpeg.FS('readFile', 'output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}

// Download local de imagem
function baixarImagemLocal(dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `foto_showfest_${Date.now()}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => document.body.removeChild(link), 100);
}

// Download local de vídeo
function baixarVideoLocal(url, nome) {
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 100);
}

// Geração de QR Code
function gerarQRCode(url) {
  qrDiv.innerHTML = `
    <h3 style="color:#FFD700;text-align:center">Escaneie para baixar</h3>
    <div id="qrcode" style="margin:0 auto"></div>
    <a href="${url}" target="_blank" style="color:#FFD700;display:block;margin-top:10px">
      Abrir link diretamente
    </a>
  `;
  
  new QRCode(document.getElementById("qrcode"), {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff"
  });
}

// ===== FUNÇÕES AUXILIARES =====
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

function mostrarErro(mensagem) {
  qrDiv.innerHTML = `<p style="color:red">${mensagem}</p>`;
  statusUpload.style.display = 'none';
}

function iniciarCamera() {
  navigator.mediaDevices.getUserMedia({
    video: { width: 1920, height: 1080, facingMode: 'user' },
    audio: false
  }).then(s => {
    stream = s;
    video.srcObject = stream;
  }).catch(err => {
    console.error("Erro na câmera:", err);
  });
}

function criarBotaoCancelar() {
  const btn = document.createElement('button');
  btn.id = 'cancelBtn';
  btn.textContent = '✖ Cancelar';
  btn.style.cssText = `
    display: none;
    background: #ff4444;
    color: white;
    padding: 10px 15px;
    border: none;
    border-radius: 5px;
    margin: 10px auto;
    cursor: pointer;
  `;
  btn.onclick = () => {
    cancelRecording = true;
    if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop();
    document.getElementById('contador').innerText = '';
    btn.style.display = 'none';
  };
  document.body.appendChild(btn);
}
