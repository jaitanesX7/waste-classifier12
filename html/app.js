// Intelligent Waste Classifier - Frontend Application
document.addEventListener("DOMContentLoaded", () => {
    // Determine API Base URL dynamically
    const isLocalFile = window.location.protocol === 'file:';
    const API_BASE = isLocalFile ? "http://127.0.0.1:8000/api" : "/api";

    // State
    let currentStream = null;
    let selectedImageFile = null;
    let categoriesData = [];
    let isAnalyzing = false;

    // DOM Elements - Navigation
    const navScanner = document.getElementById("nav-scanner");
    const navGuide = document.getElementById("nav-guide");
    const navHistory = document.getElementById("nav-history");

    const viewScanner = document.getElementById("view-scanner");
    const viewGuide = document.getElementById("view-guide");
    const viewHistory = document.getElementById("view-history");

    // Input mode buttons
    const btnModeWebcam = document.getElementById("btn-mode-webcam");
    const btnModeUpload = document.getElementById("btn-mode-upload");
    const sectionWebcam = document.getElementById("section-webcam");
    const sectionUpload = document.getElementById("section-upload");

    // Webcam Elements
    const videoElem = document.getElementById("webcam-video");
    const snapshotCanvas = document.getElementById("snapshot-canvas");
    const btnStartCamera = document.getElementById("btn-start-camera");
    const btnCapture = document.getElementById("btn-capture");
    const webcamStatusText = document.getElementById("webcam-status");
    const scannerContainer = document.getElementById("scanner-container");

    // Upload Elements
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const uploadPreviewContainer = document.getElementById("upload-preview-container");
    const uploadPreviewImg = document.getElementById("upload-preview-img");
    const btnAnalyzeUpload = document.getElementById("btn-analyze-upload");
    const btnRemoveUpload = document.getElementById("btn-remove-upload");

    // Result Panel Elements
    const resultPlaceholder = document.getElementById("result-placeholder");
    const resultLoading = document.getElementById("result-loading");
    const resultContent = document.getElementById("result-content");
    const resCategory = document.getElementById("res-category");
    const resConfidence = document.getElementById("res-confidence");
    const resBinName = document.getElementById("res-bin-name");
    const resBinCard = document.getElementById("res-bin-card");
    const resActionSteps = document.getElementById("res-action-steps");
    const resEcoTip = document.getElementById("res-eco-tip");
    const resProbabilities = document.getElementById("res-probabilities");

    // Guide & History Elements
    const guideGrid = document.getElementById("guide-grid");
    const guideSearchInput = document.getElementById("guide-search");
    const historyList = document.getElementById("history-list");
    const btnClearHistory = document.getElementById("btn-clear-history");
    const apiStatusBadge = document.getElementById("api-status-badge");

    // Initialize Lucide Icons
    const refreshIcons = () => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    };

    // ==========================================
    // Tab Navigation
    // ==========================================
    const switchTab = (tab) => {
        // Reset classes
        [navScanner, navGuide, navHistory].forEach(btn => {
            btn.classList.remove("text-emerald-400", "border-emerald-400", "bg-emerald-950/40");
            btn.classList.add("text-slate-400", "border-transparent");
        });
        [viewScanner, viewGuide, viewHistory].forEach(view => view.classList.add("hidden"));

        if (tab === "scanner") {
            navScanner.classList.add("text-emerald-400", "border-emerald-400", "bg-emerald-950/40");
            navScanner.classList.remove("text-slate-400", "border-transparent");
            viewScanner.classList.remove("hidden");
        } else if (tab === "guide") {
            navGuide.classList.add("text-emerald-400", "border-emerald-400", "bg-emerald-950/40");
            navGuide.classList.remove("text-slate-400", "border-transparent");
            viewGuide.classList.remove("hidden");
            loadCategories();
        } else if (tab === "history") {
            navHistory.classList.add("text-emerald-400", "border-emerald-400", "bg-emerald-950/40");
            navHistory.classList.remove("text-slate-400", "border-transparent");
            viewHistory.classList.remove("hidden");
            loadHistory();
        }
        refreshIcons();
    };

    navScanner.addEventListener("click", () => switchTab("scanner"));
    navGuide.addEventListener("click", () => switchTab("guide"));
    navHistory.addEventListener("click", () => switchTab("history"));

    // ==========================================
    // Input Mode Switching (Webcam vs Upload)
    // ==========================================
    const switchInputMode = (mode) => {
        if (mode === "webcam") {
            btnModeWebcam.classList.add("bg-emerald-600", "text-white");
            btnModeWebcam.classList.remove("text-slate-300", "hover:text-white");
            btnModeUpload.classList.remove("bg-emerald-600", "text-white");
            btnModeUpload.classList.add("text-slate-300", "hover:text-white");

            sectionWebcam.classList.remove("hidden");
            sectionUpload.classList.add("hidden");
        } else {
            btnModeUpload.classList.add("bg-emerald-600", "text-white");
            btnModeUpload.classList.remove("text-slate-300", "hover:text-white");
            btnModeWebcam.classList.remove("bg-emerald-600", "text-white");
            btnModeWebcam.classList.add("text-slate-300", "hover:text-white");

            sectionUpload.classList.remove("hidden");
            sectionWebcam.classList.add("hidden");
            stopCamera();
        }
        refreshIcons();
    };

    btnModeWebcam.addEventListener("click", () => switchInputMode("webcam"));
    btnModeUpload.addEventListener("click", () => switchInputMode("upload"));

    // ==========================================
    // Webcam Management
    // ==========================================
    async function startCamera() {
        try {
            webcamStatusText.textContent = "Connecting to camera...";
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "environment"
                },
                audio: false
            });
            currentStream = stream;
            videoElem.srcObject = stream;
            videoElem.play();

            btnStartCamera.classList.add("hidden");
            btnCapture.classList.remove("hidden");
            scannerContainer.classList.add("scanner-active");
            webcamStatusText.textContent = "Live Feed Active. Align waste item and click Capture.";
        } catch (err) {
            console.error("Camera access failed:", err);
            webcamStatusText.textContent = "Camera access denied or unavailable. Please check permissions.";
            alert("Could not access camera: " + err.message);
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
            videoElem.srcObject = null;
            btnStartCamera.classList.remove("hidden");
            btnCapture.classList.add("hidden");
            scannerContainer.classList.remove("scanner-active");
            webcamStatusText.textContent = "Camera stopped.";
        }
    }

    btnStartCamera.addEventListener("click", startCamera);

    btnCapture.addEventListener("click", () => {
        if (!currentStream) return;
        snapshotCanvas.width = videoElem.videoWidth || 640;
        snapshotCanvas.height = videoElem.videoHeight || 480;
        const ctx = snapshotCanvas.getContext("2d");
        ctx.drawImage(videoElem, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        const base64Data = snapshotCanvas.toDataURL("image/jpeg", 0.9);

        classifyBase64(base64Data);
    });

    // ==========================================
    // File Upload Handling
    // ==========================================
    dropZone.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        handleSelectedFile(file);
    });

    // Drag and drop events
    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add("border-emerald-500", "bg-emerald-950/20");
        });
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove("border-emerald-500", "bg-emerald-950/20");
        });
    });

    dropZone.addEventListener("drop", (e) => {
        const file = e.dataTransfer.files[0];
        handleSelectedFile(file);
    });

    function handleSelectedFile(file) {
        if (!file || !file.type.startsWith("image/")) {
            alert("Please select a valid image file (PNG, JPG, JPEG, WEBP).");
            return;
        }
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadPreviewImg.src = event.target.result;
            dropZone.classList.add("hidden");
            uploadPreviewContainer.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    }

    btnRemoveUpload.addEventListener("click", () => {
        selectedImageFile = null;
        fileInput.value = "";
        uploadPreviewImg.src = "";
        uploadPreviewContainer.classList.add("hidden");
        dropZone.classList.remove("hidden");
    });

    btnAnalyzeUpload.addEventListener("click", () => {
        if (!selectedImageFile) return;
        classifyUpload(selectedImageFile);
    });

    // ==========================================
    // Classification API Requests
    // ==========================================
    function setAnalyzingState(loading) {
        isAnalyzing = loading;
        if (loading) {
            resultPlaceholder.classList.add("hidden");
            resultContent.classList.add("hidden");
            resultLoading.classList.remove("hidden");
        } else {
            resultLoading.classList.add("hidden");
        }
    }

    async function classifyBase64(base64Data) {
        setAnalyzingState(true);
        try {
            const response = await fetch(`${API_BASE}/classify/base64`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_base64: base64Data })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Classification failed.");
            }

            const data = await response.json();
            renderResult(data);
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
            resultPlaceholder.classList.remove("hidden");
        } finally {
            setAnalyzingState(false);
        }
    }

    async function classifyUpload(file) {
        setAnalyzingState(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`${API_BASE}/classify`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Classification failed.");
            }

            const data = await response.json();
            renderResult(data);
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
            resultPlaceholder.classList.remove("hidden");
        } finally {
            setAnalyzingState(false);
        }
    }

    // ==========================================
    // Render Results
    // ==========================================
    function renderResult(data) {
        resultPlaceholder.classList.add("hidden");
        resultContent.classList.remove("hidden");

        // Top detected category
        resCategory.textContent = data.category;
        resConfidence.textContent = `${data.confidence.toFixed(1)}% Confidence`;

        // Guideline Card
        const g = data.guideline;
        resBinName.textContent = g.bin_name;
        resBinCard.style.borderLeftColor = g.color_hex;

        // Action Steps
        resActionSteps.innerHTML = "";
        g.action_steps.forEach((step, idx) => {
            const li = document.createElement("li");
            li.className = "flex items-start gap-2 text-sm text-slate-300";
            li.innerHTML = `
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white shrink-0 mt-0.5" style="background-color: ${g.color_hex}">
                    ${idx + 1}
                </span>
                <span>${step}</span>
            `;
            resActionSteps.appendChild(li);
        });

        // Eco Tip
        resEcoTip.textContent = g.eco_tip;

        // Probability Breakdown
        resProbabilities.innerHTML = "";
        data.predictions.slice(0, 5).forEach(pred => {
            const row = document.createElement("div");
            row.className = "space-y-1";
            row.innerHTML = `
                <div class="flex justify-between text-xs font-medium text-slate-300">
                    <span>${pred.label}</span>
                    <span>${pred.percentage.toFixed(1)}%</span>
                </div>
                <div class="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700" style="width: ${pred.percentage}%; background-color: ${pred.label.toLowerCase() === data.category.toLowerCase() ? g.color_hex : '#94a3b8'}"></div>
                </div>
            `;
            resProbabilities.appendChild(row);
        });

        refreshIcons();
    }

    // ==========================================
    // Categories / Recycling Guide View
    // ==========================================
    async function loadCategories() {
        if (categoriesData.length > 0) return;
        try {
            const response = await fetch(`${API_BASE}/categories`);
            if (!response.ok) throw new Error("Failed to load categories.");
            categoriesData = await response.json();
            renderCategoryGrid(categoriesData);
        } catch (err) {
            console.error("Categories fetch error:", err);
            guideGrid.innerHTML = `<p class="col-span-full text-center text-rose-400 py-8">Failed to fetch recycling guide. Please ensure backend is active.</p>`;
        }
    }

    function renderCategoryGrid(list) {
        guideGrid.innerHTML = "";
        if (list.length === 0) {
            guideGrid.innerHTML = `<p class="col-span-full text-center text-slate-400 py-8">No matching categories found.</p>`;
            return;
        }

        list.forEach(cat => {
            const card = document.createElement("div");
            card.className = "glass-card rounded-2xl p-6 flex flex-col justify-between border-t-4";
            card.style.borderTopColor = cat.color_hex;

            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-xl font-bold text-white">${cat.category}</h4>
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold" style="background-color: ${cat.badge_bg}; color: ${cat.badge_text};">
                            ${cat.bin_name.split(' ')[0]} Bin
                        </span>
                    </div>
                    <p class="text-xs font-semibold text-slate-400 mb-3">${cat.bin_name}</p>
                    <div class="space-y-2 mb-4">
                        ${cat.action_steps.map(step => `
                            <div class="flex items-start gap-2 text-xs text-slate-300">
                                <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></i>
                                <span>${step}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-700/60 text-xs text-emerald-300/80 italic flex items-center gap-1.5">
                    <i data-lucide="lightbulb" class="w-4 h-4 shrink-0"></i>
                    <span>${cat.eco_tip}</span>
                </div>
            `;
            guideGrid.appendChild(card);
        });
        refreshIcons();
    }

    guideSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = categoriesData.filter(item => 
            item.category.toLowerCase().includes(query) ||
            item.bin_name.toLowerCase().includes(query) ||
            item.action_steps.some(s => s.toLowerCase().includes(query))
        );
        renderCategoryGrid(filtered);
    });

    // ==========================================
    // History View
    // ==========================================
    async function loadHistory() {
        try {
            const response = await fetch(`${API_BASE}/history`);
            if (!response.ok) throw new Error("Failed to load history.");
            const items = await response.json();
            renderHistoryList(items);
        } catch (err) {
            console.error("History fetch error:", err);
            historyList.innerHTML = `<p class="text-center text-slate-400 py-8">Unable to fetch history.</p>`;
        }
    }

    function renderHistoryList(items) {
        historyList.innerHTML = "";
        if (items.length === 0) {
            historyList.innerHTML = `
                <div class="text-center py-12 text-slate-500">
                    <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                    <p>No scans recorded yet. Classify an item to see records here.</p>
                </div>
            `;
            refreshIcons();
            return;
        }

        items.forEach(item => {
            const row = document.createElement("div");
            row.className = "glass-card rounded-xl p-4 flex items-center justify-between border-l-4";
            row.style.borderLeftColor = item.color_hex;

            row.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background-color: ${item.color_hex}22; color: ${item.color_hex}">
                        <i data-lucide="recycle" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <div class="font-semibold text-white text-base">${item.category}</div>
                        <div class="text-xs text-slate-400">${item.bin_name}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-bold text-emerald-400">${item.confidence.toFixed(1)}%</div>
                    <div class="text-xs text-slate-500">${item.timestamp}</div>
                </div>
            `;
            historyList.appendChild(row);
        });
        refreshIcons();
    }

    btnClearHistory.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to clear your scan history?")) return;
        try {
            await fetch(`${API_BASE}/history`, { method: "DELETE" });
            loadHistory();
        } catch (err) {
            alert("Failed to clear history.");
        }
    });

    // Check API Health on load
    async function checkHealth() {
        try {
            const res = await fetch(`${API_BASE}/health`);
            if (res.ok) {
                const data = await res.json();
                apiStatusBadge.innerHTML = `
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span class="text-emerald-400 text-xs font-medium">Backend Ready (${data.device.toUpperCase()})</span>
                `;
            } else {
                throw new Error("API not ok");
            }
        } catch (e) {
            apiStatusBadge.innerHTML = `
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span class="text-amber-400 text-xs font-medium">API Connecting...</span>
            `;
        }
    }

    // Startup
    checkHealth();
    refreshIcons();
});
