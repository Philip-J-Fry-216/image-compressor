export function setupUI() {
  const qualityPreset = document.getElementById("qualityPreset");
  const manualBlock = document.getElementById("manualQuality");
  const manualRange = document.getElementById("manualQualityRange");
  const manualValue = document.getElementById("manualQualityValue");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const processBtn = document.getElementById("processBtn");
  const fileList = document.getElementById("fileList");
  const downloadAllBtn = document.getElementById("downloadAllBtn");

  let fileQueue = [];
  let isProcessing = false;

  // ===== Quality UI =====
  qualityPreset.addEventListener("change", () => {
    if (qualityPreset.value === "manual") {
      manualBlock.hidden = false;
    } else {
      manualBlock.hidden = true;
    }
  });

  manualRange.addEventListener("input", () => {
    manualValue.textContent = manualRange.value;
  });

  // ===== Dropzone =====
  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const newFiles = Array.from(e.target.files);

    newFiles.forEach(file => {
      if (!file.type.startsWith("image/")) return;

      const item = {
        id: crypto.randomUUID(),
        file,
        status: "idle",
        result: null,
        settingsHash: null
      };

      fileQueue.push(item);
      addFileCard(item);
    });

    processBtn.disabled = fileQueue.length === 0;
    fileInput.value = "";
  });


  // ===== Drag & Drop =====
  // ===== Global Drag & Drop =====
  let dragCounter = 0;

  document.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounter++;
    document.body.classList.add("dragover");
  });

  document.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  });

  document.addEventListener("dragleave", (e) => {
    dragCounter--;
    if (dragCounter <= 0) {
      document.body.classList.remove("dragover");
      dragCounter = 0;
    }
  });

  document.addEventListener("drop", (e) => {
    if (!e.dataTransfer.files.length) return;

    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove("dragover");

    const newFiles = Array.from(e.dataTransfer.files);

    newFiles.forEach(file => {
      if (!file.type.startsWith("image/")) return;

      const item = {
        id: crypto.randomUUID(),
        file,
        status: "idle",
        result: null,
        settingsHash: null
      };

      fileQueue.push(item);
      addFileCard(item);
    });

    processBtn.disabled = fileQueue.length === 0;
  });


  // ===== Compress button =====
  processBtn.addEventListener("click", async () => {
    if (isProcessing) return;

    const format = document.getElementById("format").value;
    let quality = qualityPreset.value;

    if (quality === "manual") {
      quality = manualRange.value;
    }

    const settingsHash = `${format}_${quality}`;

    isProcessing = true;
    processBtn.disabled = true;
    processBtn.classList.add("processing");
    processBtn.textContent = "Compressing…";

    for (const item of fileQueue) {
      // пропускаем уже сжатые с теми же настройками
      if (
        item.status === "done" &&
        item.settingsHash === settingsHash
      ) {
        continue;
      }

      item.status = "processing";
      updateCardState(item.id, "processing");

      try {
        const result = await runWorker(
          item.file,
          format,
          quality
        );

        item.result = result;
        item.status = "done";
        item.settingsHash = settingsHash;

        updateCardAfterDone(item.id, result, item.file);
      } catch (e) {
        item.status = "error";
        updateCardState(item.id, "error");
      }
    }

    isProcessing = false;
    processBtn.disabled = false;
    processBtn.classList.remove("processing");
    processBtn.textContent = "Compress";
  });

  // ===== Render =====
  function renderFiles() {
    fileList.innerHTML = "";

    fileQueue.forEach(item => {
      const file = item.file;
      const url = URL.createObjectURL(file);

      const card = document.createElement("div");
      card.className = "file-card";
      card.dataset.id = item.id;

      let infoText = "Waiting";
      let progress = "0%";
      let btnText = "Waiting";
      let btnDisabled = true;

      // если файл уже обработан
      if (item.status === "done" && item.result) {
        const before = item.result.sizeBefore;
        const after = item.result.sizeAfter;

        const beforeStr = formatSize(before);
        const afterStr = formatSize(after);
        const percent = Math.round((1 - after / before) * 100);

        infoText = `${beforeStr} → ${afterStr} (${percent > 0 ? "−" : "+"}${Math.abs(percent)}%)`;
        progress = "100%";
        btnText = "Download";
        btnDisabled = false;
      }

      if (item.status === "processing") {
        infoText = "Processing…";
        progress = "50%";
        btnText = "Processing…";
        btnDisabled = true;
      }

      card.innerHTML = `
      <img src="${url}">
      <div>
        <div>${file.name}</div>
        <div class="file-info">${infoText}</div>
        <div class="progress">
          <div class="progress-bar" style="width:${progress}"></div>
        </div>
      </div>
      <button class="download-btn" ${btnDisabled ? "disabled" : ""}>${btnText}</button>
    `;

      const btn = card.querySelector(".download-btn");

      if (item.status === "done" && item.result) {
        btn.onclick = () => {
          downloadBlob(item.result.blob, file.name, item.result.format);
        };
        card.classList.add("done");
      }

      fileList.appendChild(card);
    });
  }


  // ===== Card state updates =====
  function updateCardState(id, state) {
    const card = document.querySelector(
      `.file-card[data-id="${id}"]`
    );
    if (!card) return;

    const bar = card.querySelector(".progress-bar");
    const info = card.querySelector(".file-info");
    const btn = card.querySelector(".download-btn");

    if (state === "processing") {
      bar.style.width = "50%";
      info.textContent = "Processing…";
      btn.disabled = true;
      btn.textContent = "Processing…";
    }

    if (state === "error") {
      bar.style.width = "0%";
      info.textContent = "Error";
      btn.disabled = true;
      btn.textContent = "Error";
    }
  }

  function updateCardAfterDone(id, result, originalFile) {
    const card = document.querySelector(
      `.file-card[data-id="${id}"]`
    );
    if (!card) return;

    const bar = card.querySelector(".progress-bar");
    const info = card.querySelector(".file-info");
    const btn = card.querySelector(".download-btn");

    bar.style.width = "100%";

    const before = result.sizeBefore;
    const after = result.sizeAfter;

    const beforeStr = formatSize(before);
    const afterStr = formatSize(after);

    const percent = Math.round((1 - after / before) * 100);

    info.textContent = `${beforeStr} → ${afterStr} (${percent > 0 ? "−" : "+"}${Math.abs(percent)}%)`;

    info.classList.remove("good", "bad");
    if (after < before) {
      info.classList.add("good");
    } else if (after > before) {
      info.classList.add("bad");
    }

    btn.disabled = false;
    btn.textContent = "Download";

    btn.onclick = () => {
      downloadBlob(result.blob, originalFile.name, result.format);
    };

    card.classList.add("done");
    downloadAllBtn.disabled = false;
  }
  function addFileCard(item) {
    const file = item.file;
    const url = URL.createObjectURL(file);

    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.id = item.id;

    card.innerHTML = `
    <img src="${url}">
    <div>
      <div>${file.name}</div>
      <div class="file-info">Waiting</div>
      <div class="progress">
        <div class="progress-bar"></div>
      </div>
    </div>
    <button class="download-btn" disabled>Waiting</button>`;

    fileList.appendChild(card);
  }

  // ===== Helpers =====
  function downloadBlob(blob, filename, format) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    let ext = format.split("/")[1] || "img";
    if (ext === "jpeg") ext = "jpg";

    a.download = filename.replace(/\.\w+$/, "." + ext);

    a.click();
    URL.revokeObjectURL(url);
  }
  downloadAllBtn.addEventListener("click", async () => {
    const zip = new JSZip();
    let hasFiles = false;

    for (const item of fileQueue) {
      if (item.status === "done" && item.result) {
        const blob = item.result.blob;
        let ext = item.result.format.split("/")[1] || "img";
        if (ext === "jpeg") ext = "jpg";

        const name = item.file.name.replace(/\.\w+$/, "." + ext);
        zip.file(name, blob);

        hasFiles = true;
      }
    }

    if (!hasFiles) return;

    const content = await zip.generateAsync({ type: "blob" });

    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compressed-images.zip";
    a.click();
    URL.revokeObjectURL(url);
  });


  function formatSize(bytes) {
    const kb = bytes / 1024;
    if (kb < 1024) {
      return kb.toFixed(1) + " KB";
    }
    return (kb / 1024).toFixed(2) + " MB";
  }

  function runWorker(file, format, quality) {
    return new Promise((resolve, reject) => {
      const worker = new Worker("js/worker.js");

      worker.onmessage = (e) => {
        if (e.data.success) {
          resolve(e.data.result);
        } else {
          reject(new Error(e.data.error));
        }
        worker.terminate();
      };

      worker.postMessage({ file, format, quality });
    });
  }
}
