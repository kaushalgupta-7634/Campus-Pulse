/**
 * Campus Pulse - Client Application Logic
 * Pure Vanilla JavaScript with zero external frameworks.
 */

// Application state
const state = {
    notices: [],
    filterCategory: "ALL",
    filterStatus: "ALL",
    searchQuery: "",
    sortBy: "date-asc",
    viewMode: "cards", // "cards" or "timeline"
    hasGeminiKey: false
};

// DOM Elements
const elements = {
    // API Status
    apiStatusBadge: document.getElementById("api-status-badge"),
    apiStatusText: document.getElementById("api-status-text"),

    // Stats
    statTotal: document.getElementById("stat-total"),
    statUrgent: document.getElementById("stat-urgent"),
    statToday: document.getElementById("stat-today"),
    statUpcoming: document.getElementById("stat-upcoming"),

    // Sections & Grids
    todaySection: document.getElementById("today-spotlight-section"),
    todayGrid: document.getElementById("today-cards-grid"),
    todayBadgeCount: document.getElementById("today-badge-count"),
    noticesGrid: document.getElementById("notices-cards-grid"),
    timelineView: document.getElementById("notices-timeline-view"),
    sectionViewTitle: document.getElementById("section-view-title"),
    noticesCountLabel: document.getElementById("notices-count-label"),
    emptyState: document.getElementById("empty-state"),
    emptyStateMsg: document.getElementById("empty-state-msg"),

    // Controls
    searchInput: document.getElementById("search-input"),
    searchClearBtn: document.getElementById("search-clear-btn"),
    categoryChips: document.getElementById("category-chips"),
    statusChips: document.getElementById("status-chips"),
    sortSelect: document.getElementById("sort-select"),
    viewModeCards: document.getElementById("view-mode-cards"),
    viewModeTimeline: document.getElementById("view-mode-timeline"),

    // Modals & Smart Input
    noticeModal: document.getElementById("notice-modal"),
    noticeForm: document.getElementById("notice-form"),
    btnOpenSmartInput: document.getElementById("btn-open-smart-input"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalCancelBtn: document.getElementById("modal-cancel-btn"),

    // Smart Input Tabs & Panels
    tabBtnSmart: document.getElementById("tab-btn-smart"),
    tabBtnManual: document.getElementById("tab-btn-manual"),
    smartInputPanel: document.getElementById("smart-input-panel"),
    manualInputPanel: document.getElementById("manual-input-panel"),
    smartRawInput: document.getElementById("smart-raw-input"),
    btnAiExtract: document.getElementById("btn-ai-extract"),
    extractBtnText: document.getElementById("extract-btn-text"),
    aiExtractStatus: document.getElementById("ai-extract-status"),

    // AI Preview Box
    aiExtractedPreview: document.getElementById("ai-extracted-preview"),
    previewTitle: document.getElementById("preview-title"),
    previewCategoryBadge: document.getElementById("preview-category-badge"),
    previewDatetime: document.getElementById("preview-datetime"),
    previewVenue: document.getElementById("preview-venue"),
    previewUrgent: document.getElementById("preview-urgent"),
    previewSummary: document.getElementById("preview-summary"),
    btnPreviewSave: document.getElementById("btn-preview-save"),
    btnPreviewEdit: document.getElementById("btn-preview-edit"),

    // Sample buttons
    sampleButtons: document.querySelectorAll(".btn-sample-chip"),

    // Weekly Digest Elements (Phase 4)
    digestModal: document.getElementById("digest-modal"),
    btnWeeklyDigest: document.getElementById("btn-weekly-digest"),
    digestCloseBtn: document.getElementById("digest-close-btn"),
    digestDismissBtn: document.getElementById("digest-dismiss-btn"),
    digestLoading: document.getElementById("digest-loading"),
    digestContent: document.getElementById("digest-content"),
    digestHeadline: document.getElementById("digest-headline"),
    digestOverview: document.getElementById("digest-overview"),
    digestUrgentBox: document.getElementById("digest-urgent-box"),
    digestUrgentList: document.getElementById("digest-urgent-list"),
    digestEventsBox: document.getElementById("digest-events-box"),
    digestEventsList: document.getElementById("digest-events-list"),
    digestProTip: document.getElementById("digest-pro-tip"),
    btnDigestCopy: document.getElementById("btn-digest-copy"),
    btnDigestRefresh: document.getElementById("btn-digest-refresh"),

    // Toasts
    toastContainer: document.getElementById("toast-container")
};

// Store current extracted notice draft & current AI digest
let currentExtractedData = null;
let currentDigestData = null;

// ==========================================
// Initialization & Data Fetching
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    checkApiStatus();
    loadNotices();
    setupEventListeners();
});

/**
 * Checks server health and Gemini API key presence.
 */
async function checkApiStatus() {
    try {
        const res = await fetch("/api/status");
        const data = await res.json();
        state.hasGeminiKey = data.has_gemini_key;

        if (state.hasGeminiKey) {
            elements.apiStatusBadge.className = "status-badge connected";
            elements.apiStatusText.textContent = "Gemini AI Active";
        } else {
            elements.apiStatusBadge.className = "status-badge missing-key";
            elements.apiStatusText.textContent = "AI Key Missing in .env";
        }
    } catch (err) {
        elements.apiStatusBadge.className = "status-badge";
        elements.apiStatusText.textContent = "Server Offline";
    }
}

/**
 * Loads all notices from the backend SQLite database.
 */
async function loadNotices() {
    try {
        const res = await fetch("/api/notices");
        const data = await res.json();

        if (data.success) {
            state.notices = data.notices || [];
            updateStats();
            renderNotices();
        } else {
            showToast("Failed to load notices: " + data.error, "error");
        }
    } catch (err) {
        showToast("Error connecting to server", "error");
    }
}

// ==========================================
// Date & Timing Calculations
// ==========================================

function getTodayString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculates number of days between today and event_date.
 * Returns 0 for today, 1 for tomorrow, positive for upcoming, negative for past.
 */
function getDaysDifference(dateStr) {
    if (!dateStr) return null;
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parts = dateStr.split("-");
        if (parts.length === 3) {
            const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            target.setHours(0, 0, 0, 0);
            const diffTime = target - today;
            return Math.round(diffTime / (1000 * 60 * 60 * 24));
        }
    } catch (e) {
        // Fallback
    }
    return null;
}

/**
 * Returns DOM badge element for the countdown status.
 */
function createCountdownBadgeElement(dateStr) {
    const diff = getDaysDifference(dateStr);
    if (diff === null) return null;

    const badge = document.createElement("span");
    badge.className = "badge-countdown";

    if (diff === 0) {
        badge.classList.add("countdown-today");
        badge.textContent = "⚡ TODAY!";
    } else if (diff === 1) {
        badge.classList.add("countdown-tomorrow");
        badge.textContent = "⏰ Tomorrow";
    } else if (diff > 1 && diff <= 7) {
        badge.classList.add("countdown-soon");
        badge.textContent = `In ${diff} days`;
    } else if (diff > 7) {
        badge.classList.add("countdown-soon");
        badge.textContent = `In ${diff} days`;
    } else {
        const absDiff = Math.abs(diff);
        badge.classList.add("countdown-expired");
        badge.textContent = `⌛ Expired ${absDiff}d ago`;
    }
    return badge;
}

/**
 * Returns date status: 'today', 'upcoming', 'expired', or 'none'.
 */
function getTimingStatus(dateStr) {
    if (!dateStr) return "none";
    const diff = getDaysDifference(dateStr);
    if (diff === null) return "none";
    if (diff === 0) return "today";
    if (diff > 0) return "upcoming";
    return "expired";
}

/**
 * Formats YYYY-MM-DD into a human-readable string (e.g., Nov 5, 2026).
 */
function formatHumanDate(dateStr) {
    if (!dateStr) return "Date to be announced";
    try {
        const parts = dateStr.split("-");
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    } catch (e) {
        // Fallback
    }
    return dateStr;
}

// ==========================================
// Stats Calculation & Update
// ==========================================

function updateStats() {
    let urgentCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;

    state.notices.forEach(n => {
        if (n.is_urgent) urgentCount++;
        
        const status = getTimingStatus(n.event_date);
        if (status === "today") {
            todayCount++;
        } else if (status === "upcoming") {
            upcomingCount++;
        }
    });

    elements.statTotal.textContent = state.notices.length;
    elements.statUrgent.textContent = urgentCount;
    elements.statToday.textContent = todayCount;
    elements.statUpcoming.textContent = upcomingCount;
}

// ==========================================
// Rendering
// ==========================================

function getCategoryBadgeClass(category) {
    const cat = (category || "").toLowerCase();
    if (cat.includes("exam") || cat.includes("deadline")) return "badge-cat-exam";
    if (cat.includes("club") || cat.includes("cultural")) return "badge-cat-club";
    if (cat.includes("placement")) return "badge-cat-placement";
    if (cat.includes("academic")) return "badge-cat-academic";
    if (cat.includes("sport")) return "badge-cat-sports";
    return "badge-cat-general";
}

function createNoticeCardElement(notice) {
    const card = document.createElement("article");
    const isUrgent = Boolean(notice.is_urgent);
    card.className = `notice-card ${isUrgent ? "urgent" : ""}`;

    const timing = getTimingStatus(notice.event_date);
    let timingLabel = "";
    let timingClass = "";

    if (timing === "today") {
        timingLabel = "⚡ Happening Today";
        timingClass = "status-today";
    } else if (timing === "upcoming") {
        timingLabel = "📅 Upcoming";
        timingClass = "status-upcoming";
    } else if (timing === "expired") {
        timingLabel = "⌛ Past Event";
        timingClass = "status-expired";
    }

    // Content container
    const contentDiv = document.createElement("div");

    // Card Top Row
    const cardTop = document.createElement("div");
    cardTop.className = "card-top";

    // Badges wrapper
    const badgesWrapper = document.createElement("div");
    badgesWrapper.className = "badges-wrapper";

    // Countdown Badge
    const countdownBadge = createCountdownBadgeElement(notice.event_date);
    if (countdownBadge) {
        badgesWrapper.appendChild(countdownBadge);
    }

    // Urgent Badge (Has explicit icon + text label)
    if (isUrgent) {
        const urgentBadge = document.createElement("span");
        urgentBadge.className = "card-badge badge-urgent";
        urgentBadge.textContent = "🚨 Urgent";
        badgesWrapper.appendChild(urgentBadge);
    }

    // Category Badge (Has explicit text name)
    const categoryBadge = document.createElement("span");
    const catClass = getCategoryBadgeClass(notice.category);
    categoryBadge.className = `card-badge badge-category ${catClass}`;
    categoryBadge.textContent = notice.category || "General";
    badgesWrapper.appendChild(categoryBadge);

    cardTop.appendChild(badgesWrapper);

    // Card Actions Row
    const actionsRow = document.createElement("div");
    actionsRow.className = "card-actions-row";

    // Urgency toggle button
    const urgencyBtn = document.createElement("button");
    urgencyBtn.type = "button";
    urgencyBtn.className = `btn-toggle-urgency ${isUrgent ? "is-urgent" : ""}`;
    urgencyBtn.dataset.id = notice.id;
    urgencyBtn.textContent = isUrgent ? "🚨" : "⭐";
    urgencyBtn.title = isUrgent ? "Remove urgent flag" : "Mark as urgent priority";
    urgencyBtn.setAttribute(
        "aria-label",
        isUrgent ? `Remove urgent priority for "${notice.title}"` : `Mark "${notice.title}" as urgent priority`
    );
    urgencyBtn.addEventListener("click", () => handleToggleUrgency(notice.id));
    actionsRow.appendChild(urgencyBtn);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-card-delete";
    deleteBtn.dataset.id = notice.id;
    deleteBtn.textContent = "×";
    deleteBtn.title = `Delete notice: ${notice.title}`;
    deleteBtn.setAttribute("aria-label", `Delete notice: ${notice.title}`);
    deleteBtn.addEventListener("click", () => handleDeleteNotice(notice.id, notice.title));
    actionsRow.appendChild(deleteBtn);

    cardTop.appendChild(actionsRow);
    contentDiv.appendChild(cardTop);

    // Card Title (Heading Level 3 under Level 2 section)
    const titleElem = document.createElement("h3");
    titleElem.className = "card-title";
    titleElem.textContent = notice.title || "Untitled Notice";
    contentDiv.appendChild(titleElem);

    // Card Meta List
    const metaList = document.createElement("div");
    metaList.className = "card-meta-list";

    // Date & Time Item
    const dateItem = document.createElement("div");
    dateItem.className = "card-meta-item";
    const dateIcon = document.createElement("span");
    dateIcon.className = "card-meta-icon";
    dateIcon.textContent = "🗓️";
    dateIcon.setAttribute("aria-hidden", "true");
    const dateText = document.createElement("span");
    const dateStr = formatHumanDate(notice.event_date);
    dateText.textContent = notice.event_time ? `${dateStr} • ${notice.event_time}` : dateStr;
    dateItem.appendChild(dateIcon);
    dateItem.appendChild(dateText);
    metaList.appendChild(dateItem);

    // Venue Item
    if (notice.venue && notice.venue.trim()) {
        const venueItem = document.createElement("div");
        venueItem.className = "card-meta-item";
        const venueIcon = document.createElement("span");
        venueIcon.className = "card-meta-icon";
        venueIcon.textContent = "📍";
        venueIcon.setAttribute("aria-hidden", "true");
        const venueText = document.createElement("span");
        venueText.textContent = notice.venue.trim();
        venueItem.appendChild(venueIcon);
        venueItem.appendChild(venueText);
        metaList.appendChild(venueItem);
    }
    contentDiv.appendChild(metaList);

    // Raw text preview
    let rawToggleBtn = null;
    if (notice.raw_text && notice.raw_text.trim()) {
        const rawBox = document.createElement("div");
        rawBox.id = `raw-${notice.id}`;
        rawBox.className = "raw-text-preview hidden";

        const rawHeader = document.createElement("strong");
        rawHeader.textContent = "Original Text:";
        const rawBody = document.createElement("div");
        rawBody.className = "raw-text-body";
        rawBody.textContent = notice.raw_text.trim();

        rawBox.appendChild(rawHeader);
        rawBox.appendChild(rawBody);
        contentDiv.appendChild(rawBox);

        rawToggleBtn = document.createElement("button");
        rawToggleBtn.type = "button";
        rawToggleBtn.className = "raw-toggle-btn";
        rawToggleBtn.textContent = "View Original";
        rawToggleBtn.setAttribute("aria-expanded", "false");
        rawToggleBtn.setAttribute("aria-controls", `raw-${notice.id}`);
        rawToggleBtn.addEventListener("click", () => {
            const isHidden = rawBox.classList.contains("hidden");
            rawBox.classList.toggle("hidden");
            rawToggleBtn.textContent = isHidden ? "Hide Original" : "View Original";
            rawToggleBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
        });
    }

    card.appendChild(contentDiv);

    // Card Footer
    const footer = document.createElement("div");
    footer.className = "card-footer";

    const timingSpan = document.createElement("span");
    timingSpan.className = `timing-status ${timingClass}`;
    timingSpan.textContent = timingLabel;
    footer.appendChild(timingSpan);

    if (rawToggleBtn) {
        footer.appendChild(rawToggleBtn);
    } else {
        footer.appendChild(document.createElement("span"));
    }

    card.appendChild(footer);
    return card;
}

/**
 * Filters and sorts notices based on current UI state.
 */
function getFilteredAndSortedNotices() {
    const query = state.searchQuery.toLowerCase().trim();
    const category = state.filterCategory;
    const status = state.filterStatus;

    // Filter notices
    let result = state.notices.filter(n => {
        // Category filter
        if (category !== "ALL" && n.category !== category) {
            return false;
        }

        // Status filter
        if (status !== "ALL") {
            const timing = getTimingStatus(n.event_date);
            if (status === "urgent" && !n.is_urgent) return false;
            if (status === "today" && timing !== "today") return false;
            if (status === "upcoming" && timing !== "upcoming") return false;
            if (status === "expired" && timing !== "expired") return false;
        }

        // Search filter
        if (query) {
            const matchTitle = (n.title || "").toLowerCase().includes(query);
            const matchVenue = (n.venue || "").toLowerCase().includes(query);
            const matchRaw = (n.raw_text || "").toLowerCase().includes(query);
            const matchCategory = (n.category || "").toLowerCase().includes(query);
            if (!matchTitle && !matchVenue && !matchRaw && !matchCategory) {
                return false;
            }
        }
        return true;
    });

    // Sort notices
    result.sort((a, b) => {
        if (state.sortBy === "urgent-first") {
            if (b.is_urgent !== a.is_urgent) {
                return (b.is_urgent || 0) - (a.is_urgent || 0);
            }
            // Secondary sort: soonest date
            return compareNoticeDates(a, b);
        } else if (state.sortBy === "newest") {
            return (b.id || 0) - (a.id || 0);
        } else {
            // Default: date-asc (soonest event first)
            return compareNoticeDates(a, b);
        }
    });

    return result;
}

function compareNoticeDates(a, b) {
    if (!a.event_date && !b.event_date) return (b.id || 0) - (a.id || 0);
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    if (a.event_date === b.event_date) return (b.id || 0) - (a.id || 0);
    return a.event_date.localeCompare(b.event_date);
}

function renderNotices() {
    const filtered = getFilteredAndSortedNotices();
    const todayStr = getTodayString();

    // Attention Today Spotlight (Always shows today's items + urgent items unless filtered out)
    const todayItems = state.notices.filter(n => {
        const timing = getTimingStatus(n.event_date);
        return timing === "today" || (n.is_urgent && timing !== "expired");
    });

    elements.todayGrid.replaceChildren();
    if (todayItems.length > 0 && state.filterCategory === "ALL" && state.filterStatus === "ALL" && !state.searchQuery) {
        elements.todaySection.classList.remove("hidden");
        elements.todayBadgeCount.textContent = `${todayItems.length} items`;
        todayItems.forEach(n => {
            elements.todayGrid.appendChild(createNoticeCardElement(n));
        });
    } else {
        elements.todaySection.classList.add("hidden");
    }

    // Set count label
    elements.noticesCountLabel.textContent = `Showing ${filtered.length} notice${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
        elements.emptyState.classList.remove("hidden");
        elements.noticesGrid.classList.add("hidden");
        elements.timelineView.classList.add("hidden");
        return;
    }

    elements.emptyState.classList.add("hidden");

    // Render depending on active view mode
    if (state.viewMode === "cards") {
        elements.sectionViewTitle.textContent = "All Campus Notices";
        elements.noticesGrid.classList.remove("hidden");
        elements.timelineView.classList.add("hidden");

        elements.noticesGrid.replaceChildren();
        filtered.forEach(n => {
            elements.noticesGrid.appendChild(createNoticeCardElement(n));
        });
    } else {
        elements.sectionViewTitle.textContent = "Campus Timeline & Calendar View";
        elements.noticesGrid.classList.add("hidden");
        elements.timelineView.classList.remove("hidden");

        renderTimelineView(filtered);
    }
}

/**
 * Renders notices grouped into intuitive timeline / calendar buckets.
 */
function renderTimelineView(notices) {
    elements.timelineView.replaceChildren();

    const buckets = [
        { id: "today", title: "⚡ Happening Today", icon: "⚡", filter: n => getDaysDifference(n.event_date) === 0, isToday: true },
        { id: "tomorrow", title: "🗓️ Tomorrow", icon: "🗓️", filter: n => getDaysDifference(n.event_date) === 1 },
        { id: "this-week", title: "📆 Upcoming This Week", icon: "📆", filter: n => {
            const d = getDaysDifference(n.event_date);
            return d !== null && d >= 2 && d <= 7;
        }},
        { id: "later", title: "📌 Later This Month & Beyond", icon: "📌", filter: n => {
            const d = getDaysDifference(n.event_date);
            return d !== null && d > 7;
        }},
        { id: "past", title: "⌛ Past / Expired Events", icon: "⌛", filter: n => {
            const d = getDaysDifference(n.event_date);
            return d !== null && d < 0;
        }},
        { id: "undated", title: "📋 Notices Without Specific Date", icon: "📋", filter: n => !n.event_date }
    ];

    buckets.forEach(b => {
        const items = notices.filter(b.filter);
        if (items.length > 0) {
            const bucketElem = document.createElement("section");
            bucketElem.className = `timeline-bucket ${b.isToday ? 'bucket-today' : ''}`;

            const header = document.createElement("div");
            header.className = "timeline-bucket-header";

            const h3 = document.createElement("h3");
            h3.className = "bucket-title";
            h3.textContent = b.title;

            const count = document.createElement("span");
            count.className = "bucket-count";
            count.textContent = `${items.length} notice${items.length === 1 ? '' : 's'}`;

            header.appendChild(h3);
            header.appendChild(count);
            bucketElem.appendChild(header);

            const cardsContainer = document.createElement("div");
            cardsContainer.className = "bucket-cards";
            items.forEach(item => {
                cardsContainer.appendChild(createNoticeCardElement(item));
            });
            bucketElem.appendChild(cardsContainer);

            elements.timelineView.appendChild(bucketElem);
        }
    });
}

// ==========================================
// Event Listeners & Interactions
// ==========================================

function setupEventListeners() {
    // Search input
    elements.searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery) {
            elements.searchClearBtn.classList.remove("hidden");
        } else {
            elements.searchClearBtn.classList.add("hidden");
        }
        renderNotices();
    });

    elements.searchClearBtn.addEventListener("click", () => {
        elements.searchInput.value = "";
        state.searchQuery = "";
        elements.searchClearBtn.classList.add("hidden");
        renderNotices();
    });

    // View Mode Toggle (Cards vs Timeline)
    elements.viewModeCards.addEventListener("click", () => {
        state.viewMode = "cards";
        elements.viewModeCards.classList.add("active");
        elements.viewModeTimeline.classList.remove("active");
        renderNotices();
    });

    elements.viewModeTimeline.addEventListener("click", () => {
        state.viewMode = "timeline";
        elements.viewModeTimeline.classList.add("active");
        elements.viewModeCards.classList.remove("active");
        renderNotices();
    });

    // Category chips
    elements.categoryChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;

        elements.categoryChips.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        state.filterCategory = chip.dataset.category || "ALL";
        renderNotices();
    });

    // Status chips
    elements.statusChips.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip-status");
        if (!chip) return;

        elements.statusChips.querySelectorAll(".chip-status").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");

        state.filterStatus = chip.dataset.status || "ALL";
        renderNotices();
    });

    // Sort Selector
    elements.sortSelect.addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        renderNotices();
    });

    // Add Notice Modal trigger
    elements.btnOpenSmartInput.addEventListener("click", () => {
        resetSmartInputModal();
        openModal(elements.noticeModal);
        elements.smartRawInput.focus();
    });

    elements.modalCloseBtn.addEventListener("click", () => closeModal(elements.noticeModal));
    elements.modalCancelBtn.addEventListener("click", () => closeModal(elements.noticeModal));

    elements.noticeModal.addEventListener("click", (e) => {
        if (e.target === elements.noticeModal) closeModal(elements.noticeModal);
    });

    // Smart Input Tab Navigation
    elements.tabBtnSmart.addEventListener("click", () => switchModalTab("smart"));
    elements.tabBtnManual.addEventListener("click", () => switchModalTab("manual"));

    // Quick Sample Buttons
    elements.sampleButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const sampleType = btn.dataset.sample;
            populateSampleNotice(sampleType);
        });
    });

    // AI Extract Button
    elements.btnAiExtract.addEventListener("click", handleAiExtract);

    // Extracted Preview Action Buttons
    elements.btnPreviewSave.addEventListener("click", handlePreviewSave);
    elements.btnPreviewEdit.addEventListener("click", handlePreviewEdit);

    // Manual Notice Form Submission
    elements.noticeForm.addEventListener("submit", handleCreateNotice);

    // Weekly Digest Modal (Phase 4)
    elements.btnWeeklyDigest.addEventListener("click", openWeeklyDigest);
    elements.btnDigestRefresh.addEventListener("click", openWeeklyDigest);
    elements.btnDigestCopy.addEventListener("click", copyDigestToClipboard);
    elements.digestCloseBtn.addEventListener("click", () => closeModal(elements.digestModal));
    elements.digestDismissBtn.addEventListener("click", () => closeModal(elements.digestModal));
    elements.digestModal.addEventListener("click", (e) => {
        if (e.target === elements.digestModal) closeModal(elements.digestModal);
    });

    // Global keyboard shortcuts (ESC to close modals)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal(elements.noticeModal);
            closeModal(elements.digestModal);
        }
    });
}

// ==========================================
// Phase 4: Weekly AI Digest Handlers
// ==========================================

async function openWeeklyDigest() {
    openModal(elements.digestModal);
    elements.digestLoading.classList.remove("hidden");
    elements.digestContent.classList.add("hidden");

    try {
        const res = await fetch("/api/digest");
        const data = await res.json();
        if (data.success) {
            currentDigestData = data;
            renderDigestUI(data);
        } else {
            showToast("Failed to generate digest: " + (data.error || "Unknown error"), "error");
        }
    } catch (err) {
        showToast("Error connecting to AI digest service", "error");
    } finally {
        elements.digestLoading.classList.add("hidden");
        elements.digestContent.classList.remove("hidden");
    }
}

function renderDigestUI(data) {
    elements.digestHeadline.textContent = data.headline || "Your Weekly Campus Briefing ⚡";
    elements.digestOverview.textContent = data.overview || "";

    // Render Urgent Deadlines safely
    const urgentItems = data.urgent_deadlines || [];
    elements.digestUrgentList.replaceChildren();
    if (urgentItems.length === 0) {
        elements.digestUrgentBox.classList.add("hidden");
    } else {
        elements.digestUrgentBox.classList.remove("hidden");
        urgentItems.forEach(item => {
            const row = document.createElement("div");
            row.className = "digest-item-row";

            const infoDiv = document.createElement("div");
            infoDiv.className = "digest-item-info";

            const titleSpan = document.createElement("span");
            titleSpan.className = "digest-item-title";
            titleSpan.textContent = item.title || "Critical Deadline";

            const timeSpan = document.createElement("span");
            timeSpan.className = "digest-item-time";
            timeSpan.textContent = `🗓️ ${item.date_time || 'TBA'}`;

            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(timeSpan);
            row.appendChild(infoDiv);

            if (item.action) {
                const actionSpan = document.createElement("span");
                actionSpan.className = "digest-item-action";
                actionSpan.textContent = item.action;
                row.appendChild(actionSpan);
            }

            elements.digestUrgentList.appendChild(row);
        });
    }

    // Render Key Events safely
    const keyEvents = data.key_events || [];
    elements.digestEventsList.replaceChildren();
    if (keyEvents.length === 0) {
        elements.digestEventsBox.classList.add("hidden");
    } else {
        elements.digestEventsBox.classList.remove("hidden");
        keyEvents.forEach(item => {
            const row = document.createElement("div");
            row.className = "digest-item-row";

            const infoDiv = document.createElement("div");
            infoDiv.className = "digest-item-info";

            const titleSpan = document.createElement("span");
            titleSpan.className = "digest-item-title";
            titleSpan.textContent = item.title || "Campus Event";

            const timeSpan = document.createElement("span");
            timeSpan.className = "digest-item-time";
            const venuePart = item.venue ? ` • 📍 ${item.venue}` : '';
            timeSpan.textContent = `🗓️ ${item.date_time || 'TBA'}${venuePart}`;

            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(timeSpan);
            row.appendChild(infoDiv);

            if (item.category) {
                const catSpan = document.createElement("span");
                catSpan.className = `card-badge badge-category ${getCategoryBadgeClass(item.category)}`;
                catSpan.textContent = item.category;
                row.appendChild(catSpan);
            }

            elements.digestEventsList.appendChild(row);
        });
    }

    // Render Pro Tip safely
    elements.digestProTip.textContent = data.pro_tip || "Stay organized and review deadline dates ahead of time!";
}

async function copyDigestToClipboard() {
    if (!currentDigestData) {
        showToast("No digest loaded yet", "error");
        return;
    }

    const d = currentDigestData;
    let text = `⚡ CAMPUS PULSE — WEEKLY BRIEFING ⚡\n\n`;
    text += `${d.headline}\n`;
    text += `${d.overview}\n\n`;

    if (d.urgent_deadlines && d.urgent_deadlines.length > 0) {
        text += `🚨 CRITICAL DEADLINES:\n`;
        d.urgent_deadlines.forEach(u => {
            text += `• ${u.title} (${u.date_time}) — ${u.action || 'Action required'}\n`;
        });
        text += `\n`;
    }

    if (d.key_events && d.key_events.length > 0) {
        text += `📅 NOTABLE EVENTS:\n`;
        d.key_events.forEach(e => {
            text += `• ${e.title} (${e.date_time}) at ${e.venue || 'Campus'}\n`;
        });
        text += `\n`;
    }

    if (d.pro_tip) {
        text += `💡 CAMPUS PRO-TIP:\n${d.pro_tip}\n`;
    }

    try {
        await navigator.clipboard.writeText(text);
        showToast("Digest copied to clipboard!");
    } catch (e) {
        showToast("Copied text to clipboard");
    }
}

function openModal(modal) {
    if (modal) modal.classList.remove("hidden");
}

function closeModal(modal) {
    if (modal) modal.classList.add("hidden");
}

// ==========================================
// Phase 2: Smart Input & AI Handlers
// ==========================================

const SAMPLE_NOTICES = {
    whatsapp: "🔥 CSSS Tech Fest 2026 is officially here! 🚀\nCalling all innovators & coders across all departments. The annual hackathon kicks off on 2026-11-05 at 10:00 AM in Auditorium Hall B. Free refreshments, certificates, and $1500 prizes! Register your team at fest.campus.edu before slots fill up! Tag your squad now! 🙌🎉",
    exam: "⚠️ URGENT CIRCULAR / CONTROLLER OF EXAMINATIONS\nAttention all CS/IT B.Tech 3rd year students: Mid-term examination for Operating Systems has been rescheduled to 2026-11-08 from 02:00 PM to 05:00 PM in Exam Hall 3. Attendance is strictly mandatory. Bring student ID cards and admit tickets without fail.",
    placement: "📢 CAMPUS PLACEMENT TALK & INTERVIEW DRIVE\nTechCorp Solutions is visiting our campus on 2026-11-15 at 09:30 AM at Seminar Hall 1 for recruitment of 2027 batch. Roles: Software Engineer & Cloud Trainee. Eligible students must carry 2 printed resumes. Dress code: Strictly formal."
};

function populateSampleNotice(type) {
    const text = SAMPLE_NOTICES[type];
    if (text) {
        elements.smartRawInput.value = text;
        showToast("Loaded sample notice into text box");
    }
}

function switchModalTab(tab) {
    if (tab === "smart") {
        elements.tabBtnSmart.classList.add("active");
        elements.tabBtnManual.classList.remove("active");
        elements.smartInputPanel.classList.remove("hidden");
        elements.manualInputPanel.classList.add("hidden");
    } else {
        elements.tabBtnManual.classList.add("active");
        elements.tabBtnSmart.classList.remove("active");
        elements.manualInputPanel.classList.remove("hidden");
        elements.smartInputPanel.classList.add("hidden");
    }
}

function resetSmartInputModal() {
    elements.smartRawInput.value = "";
    elements.aiExtractedPreview.classList.add("hidden");
    elements.aiExtractStatus.classList.add("hidden");
    elements.aiExtractStatus.textContent = "";
    elements.noticeForm.reset();
    currentExtractedData = null;
    switchModalTab("smart");
}

async function handleAiExtract() {
    const text = elements.smartRawInput.value.trim();
    if (!text) {
        showToast("Please paste some notice text or click a sample first", "error");
        elements.smartRawInput.focus();
        return;
    }

    // Set UI to loading state
    elements.btnAiExtract.disabled = true;
    elements.extractBtnText.textContent = "Analyzing with Gemini...";
    elements.aiExtractStatus.classList.remove("hidden");
    elements.aiExtractStatus.textContent = "Extracting title, dates, venue & category...";
    elements.aiExtractedPreview.classList.add("hidden");

    try {
        const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        const data = await res.json();
        if (data.success && data.data) {
            const extracted = data.data;
            currentExtractedData = { ...extracted, raw_text: text };

            // Render Preview Card
            elements.previewTitle.textContent = extracted.title || "Campus Announcement";
            elements.previewCategoryBadge.textContent = extracted.category || "General";
            elements.previewCategoryBadge.className = `card-badge badge-category ${getCategoryBadgeClass(extracted.category)}`;
            
            const dateStr = formatHumanDate(extracted.event_date);
            const timeStr = extracted.event_time ? ` at ${extracted.event_time}` : "";
            elements.previewDatetime.textContent = `${dateStr}${timeStr}`;
            elements.previewVenue.textContent = extracted.venue || "Campus Venue TBD";
            elements.previewUrgent.textContent = extracted.is_urgent ? "🚨 Urgent Priority" : "Standard Priority";
            elements.previewSummary.textContent = extracted.confidence_summary || "Notice details extracted cleanly.";

            // Populate manual form in case user clicks edit
            document.getElementById("form-title").value = extracted.title || "";
            document.getElementById("form-date").value = extracted.event_date || "";
            document.getElementById("form-time").value = extracted.event_time || "";
            document.getElementById("form-venue").value = extracted.venue || "";
            document.getElementById("form-category").value = extracted.category || "General";
            document.getElementById("form-urgent").checked = Boolean(extracted.is_urgent);
            document.getElementById("form-raw-text").value = text;

            elements.aiExtractedPreview.classList.remove("hidden");
            elements.aiExtractStatus.textContent = data.is_fallback 
                ? "Extracted (Local fallback mode)" 
                : "✨ Successfully extracted by Gemini!";
            showToast("Details extracted!");
        } else {
            showToast(data.error || "Failed to extract details", "error");
            elements.aiExtractStatus.textContent = "Extraction failed. Try manual entry.";
        }
    } catch (err) {
        showToast("Error connecting to extraction API", "error");
        elements.aiExtractStatus.textContent = "Connection error.";
    } finally {
        elements.btnAiExtract.disabled = false;
        elements.extractBtnText.textContent = "Extract with Gemini AI";
    }
}

async function handlePreviewSave() {
    if (!currentExtractedData || !currentExtractedData.title) {
        showToast("No extracted notice to save", "error");
        return;
    }

    try {
        const res = await fetch("/api/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentExtractedData)
        });

        const data = await res.json();
        if (data.success) {
            showToast("Notice added to board!");
            closeModal(elements.noticeModal);
            resetSmartInputModal();
            await loadNotices();
        } else {
            showToast(data.error || "Failed to save notice", "error");
        }
    } catch (err) {
        showToast("Error saving notice", "error");
    }
}

function handlePreviewEdit() {
    switchModalTab("manual");
    document.getElementById("form-title").focus();
}

// ==========================================
// Handlers: Create & Delete
// ==========================================

async function handleCreateNotice(e) {
    e.preventDefault();

    const title = document.getElementById("form-title").value.trim();
    if (!title) {
        showToast("Please enter a title for the notice", "error");
        return;
    }

    const payload = {
        title: title,
        event_date: document.getElementById("form-date").value || null,
        event_time: document.getElementById("form-time").value.trim() || null,
        venue: document.getElementById("form-venue").value.trim() || null,
        category: document.getElementById("form-category").value,
        is_urgent: document.getElementById("form-urgent").checked ? 1 : 0,
        raw_text: document.getElementById("form-raw-text").value.trim()
    };

    try {
        const res = await fetch("/api/notices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            showToast("Notice added successfully!");
            elements.noticeForm.reset();
            closeModal(elements.noticeModal);
            await loadNotices();
        } else {
            showToast(data.error || "Failed to add notice", "error");
        }
    } catch (err) {
        showToast("Error saving notice", "error");
    }
}

async function handleDeleteNotice(id, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/notices/${id}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (data.success) {
            showToast("Notice removed");
            await loadNotices();
        } else {
            showToast("Failed to delete notice", "error");
        }
    } catch (err) {
        showToast("Error deleting notice", "error");
    }
}

async function handleToggleUrgency(id) {
    try {
        const res = await fetch(`/api/notices/${id}/urgency`, {
            method: "PATCH"
        });
        const data = await res.json();
        if (data.success) {
            const notice = state.notices.find(n => n.id === id);
            if (notice) {
                notice.is_urgent = data.is_urgent;
            }
            updateStats();
            renderNotices();
            showToast(data.message || "Priority updated");
        } else {
            showToast(data.error || "Failed to update priority", "error");
        }
    } catch (err) {
        showToast("Error updating notice priority", "error");
    }
}

// ==========================================
// Utilities
// ==========================================

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const iconSpan = document.createElement("span");
    iconSpan.textContent = type === "error" ? "⚠️" : "✅";
    iconSpan.setAttribute("aria-hidden", "true");

    const textSpan = document.createElement("span");
    textSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 250);
    }, 3000);
}
