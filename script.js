const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const fotoBtn = document.getElementById("foto");
const bumerangueBtn = document.getElementById("bumerangue");
const beep = document.getElementById("beep");
const contador = document.getElementById("contador");
const galeria = document.getElementById("galeria");
const qrDiv = document.getElementById("qrDownload");
const moldura = document.getElementById("moldura");

let stream;

// Inicializa câmera
navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080 }, audio: false })
  .then(s => {
    stream = s;
    video.srcObject = stream;
    video.play();
  })
  .catch(err => {
    console.error("Erro ao acessar a câmera:", err);
  });

// Botão Tirar Foto
fotoBtn.onclick = () => {
  let count = 5;
  contador.innerText = count;
  const interval = setInterval(() => {
    count--;
    contador.innerText = count;
    beep.play();
    if (count === 0) {
      clearInterval(interval);
      contador.innerText = "";
      capturarFoto();
    }
  }, 1000);
};

function capturarFoto() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (moldura.complete && moldura.naturalHeight !== 0) {
    ctx.drawImage(moldura, 0, 0, canvas.width, canvas.height);
  }

  setTimeout(() => {
    const imgData = canvas.toDataURL("image/png");
    const img = new Image();
    img.src = imgData;
    img.style.cursor = "pointer";
    img.onclick = () => {
      const novaJanela = window.open();
      novaJanela.document.write(`<img src="${imgData}" style="width: 100%">`);
    };
    galeria.appendChild(img);
    enviarParaImgbb(imgData);
  }, 300);
}

function enviarParaImgbb(imgData) {
  const base64 = imgData.replace(/^data:image\/png;base64,/, "");
  const formData = new FormData();
  formData.append("key", "586fe56b6fe8223c90078eae64e1d678");
  formData.append("image", base64);
  formData.append("name", "foto_showfest_" + Date.now());

  qrDiv.innerHTML = "Enviando imagem...";

  fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      if (data?.data?.url) gerarQRCode(data.data.url);
      else throw new Error("Resposta inválida do imgbb");
    })
    .catch(error => {
      console.error("Erro no upload:", error);
      qrDiv.innerText = "Erro ao gerar QRCode.";
      qrDiv.style.color = "red";
    });
}

function gerarQRCode(link) {
  qrDiv.innerHTML = "";

  const qrContainer = document.createElement("div");
  qrContainer.style.margin = "10px auto";
  qrDiv.appendChild(qrContainer);

  new QRCode(qrContainer, {
    text: link,
    width: 256,
    height: 256,
    margin: 4
  });

  const a = document.createElement("a");
  a.href = link;
  a.innerText = "📥 Baixar";
  a.download = "";
  a.style.display = "block";
  a.style.textAlign = "center";
  a.style.marginTop = "10px";
  a.style.fontWeight = "bold";
  qrDiv.appendChild(a);

  // Scroll suave até o centro da tela
  setTimeout(() => {
    qrDiv.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 200);
}

bumerangueBtn.onclick = async () => {
  if (!stream) return alert("Câmera não inicializada.");

  let count = 5;
  contador.innerText = count;
  const interval = setInterval(() => {
    count--;
    contador.innerText = count;
    beep.play();
    if (count === 0) {
      clearInterval(interval);
      contador.innerText = "Gravando...";
      iniciarBumerangue();
    }
  }, 1000);
};

async function iniciarBumerangue() {
  const canvasVideo = document.createElement("canvas");
  const ctx = canvasVideo.getContext("2d");

  const fps = 30;
  const duration = 2;
  const totalFrames = fps * duration;
  const frames = [];

  canvasVideo.width = video.videoWidth;
  canvasVideo.height = video.videoHeight;

  for (let i = 0; i < totalFrames; i++) {
    ctx.drawImage(video, 0, 0, canvasVideo.width, canvasVideo.height);
    if (moldura.complete) {
      ctx.drawImage(moldura, 0, 0, canvasVideo.width, canvasVideo.height);
    }
    const frame = ctx.getImageData(0, 0, canvasVideo.width, canvasVideo.height);
    frames.push(frame);
    await new Promise(r => setTimeout(r, 1000 / fps));
  }

  contador.innerText = "Renderizando vídeo...";

  const finalFrames = [...frames, ...frames.slice().reverse()];
  const streamOut = canvasVideo.captureStream(fps);
  const recorder = new MediaRecorder(streamOut);
  const chunks = [];

  recorder.ondataavailable = e => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const formData = new FormData();
    formData.append("file", blob, "bumerangue.webm");

    contador.innerText = "Enviando vídeo...";
    qrDiv.innerHTML = "";

    fetch("https://upload.gofile.io/uploadfile", {
      method: "POST",
      body: formData
    })
      .then(r => r.json())
      .then(data => {
        contador.innerText = "";
        if (data.status === "ok") {
          gerarQRCode(data.data.downloadPage);
        } else {
          throw new Error("Erro no envio");
        }
      })
      .catch(err => {
        contador.innerText = "Erro ao enviar";
        console.error(err);
        qrDiv.innerText = "Erro ao enviar vídeo";
      });
  };

  recorder.start();

  for (const frame of finalFrames) {
    ctx.putImageData(frame, 0, 0);
    await new Promise(r => setTimeout(r, 1000 / (fps * 2))); // acelera o playback
  }

  recorder.stop();
}
