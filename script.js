const views = {
  invite: document.getElementById("invite"),
  bouquet: document.getElementById("bouquet"),
  celebrate: document.getElementById("celebrate"),
  details: document.getElementById("details"),
};

const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");
const buttonZone = document.getElementById("buttonZone");
const actionsRow = document.querySelector("#buttonZone .actions");
const continueBtn = document.getElementById("continueBtn");
const petalsContainer = document.getElementById("petals");
const toDetailsBtn = document.getElementById("toDetailsBtn");
const portraitImg = document.querySelector('.portrait');
const portraitWrap = document.querySelector('.portrait-wrap');

const state = {
  current: "INVITE_IDLE",
  moveCooldownMs: 460,
  lastMoveAt: 0,
  detailsShown: false,
  timers: new Set(),
};

const petalPalette = [
  "#ffd166",
  "#f9c74f",
  "#4cc9f0",
  "#06d6a0",
  "#cdb4db",
  "#84a59d",
  "#ff99c8",
];

function setState(next) {
  state.current = next;
}

function clearTimers() {
  for (const id of state.timers) {
    clearTimeout(id);
  }
  state.timers.clear();
}

function activateView(name) {
  Object.entries(views).forEach(([key, node]) => {
    const isActive = key === name;
    node.hidden = !isActive;
    node.classList.toggle("view-active", isActive);
  });

  if (name === "invite") {
    noBtn.style.display = "flex";
    noBtn.classList.add("floating");
    requestAnimationFrame(() => {
      alignButtonPair();
      placeNoButtonNearYes();
      clampNoButtonInZone(true, 0);
    });
  } else {
    noBtn.style.display = "none";
    noBtn.classList.remove("floating");
  }
}

function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

function getNoButtonSize() {
  const width = noBtn.offsetWidth || 120;
  const height = noBtn.offsetHeight || 52;
  return { width, height };
}

function moveNoButton(x, y, instant = false) {
  const prevTransition = noBtn.style.transition;
  if (instant) {
    noBtn.style.transition = "none";
  }

  noBtn.style.left = `${x}px`;
  noBtn.style.top = `${y}px`;

  if (instant) {
    requestAnimationFrame(() => {
      noBtn.style.transition = prevTransition || "";
    });
  }
}

function getNoButtonPosition() {
  const x = parseFloat(noBtn.style.left);
  const y = parseFloat(noBtn.style.top);
  return { x, y };
}

function getZoneMetrics() {
  return {
    width: buttonZone.clientWidth,
    height: buttonZone.clientHeight,
  };
}

function getYesRectInZone() {
  const zoneRect = buttonZone.getBoundingClientRect();
  const yesRect = yesBtn.getBoundingClientRect();
  return {
    left: yesRect.left - zoneRect.left,
    top: yesRect.top - zoneRect.top,
    right: yesRect.right - zoneRect.left,
    bottom: yesRect.bottom - zoneRect.top,
    width: yesRect.width,
    height: yesRect.height,
  };
}

function rectsIntersect(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function isOverlappingYes(x, y, padding = 8) {
  const { width: btnWidth, height: btnHeight } = getNoButtonSize();
  const yes = getYesRectInZone();
  const noRect = {
    left: x,
    top: y,
    right: x + btnWidth,
    bottom: y + btnHeight,
  };
  const blocked = {
    left: yes.left - padding,
    top: yes.top - padding,
    right: yes.right + padding,
    bottom: yes.bottom + padding,
  };
  return rectsIntersect(noRect, blocked);
}

function clampPointToZone(x, y, padding = 8) {
  const { width: zoneWidth, height: zoneHeight } = getZoneMetrics();
  const { width: btnWidth, height: btnHeight } = getNoButtonSize();
  const minX = padding;
  const maxX = Math.max(minX, zoneWidth - btnWidth - padding);
  const minY = padding;
  const maxY = Math.max(minY, zoneHeight - btnHeight - padding);
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

function distanceToZoneEdgeAlongAngle(origin, angle, padding = 8) {
  const { width: zoneWidth, height: zoneHeight } = getZoneMetrics();
  const { width: btnWidth, height: btnHeight } = getNoButtonSize();
  const minX = padding;
  const maxX = Math.max(minX, zoneWidth - btnWidth - padding);
  const minY = padding;
  const maxY = Math.max(minY, zoneHeight - btnHeight - padding);

  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  const tValues = [];

  if (Math.abs(vx) > 1e-6) {
    tValues.push((minX - origin.x) / vx);
    tValues.push((maxX - origin.x) / vx);
  }
  if (Math.abs(vy) > 1e-6) {
    tValues.push((minY - origin.y) / vy);
    tValues.push((maxY - origin.y) / vy);
  }

  let best = 0;
  for (const t of tValues) {
    if (t <= 0) {
      continue;
    }

    const tx = origin.x + vx * t;
    const ty = origin.y + vy * t;
    const inside = tx >= minX && tx <= maxX && ty >= minY && ty <= maxY;
    if (inside && t > best) {
      best = t;
    }
  }

  return best;
}

function alignButtonPair() {
  const { width: yesWidth } = yesBtn.getBoundingClientRect();
  const { width: noWidth } = getNoButtonSize();
  const gap = 18;
  const shift = (yesWidth + noWidth + gap) / 4;
  actionsRow.style.transform = `translateX(-${shift}px)`;
}

function chooseRandomFarNoTarget() {
  const { width: zoneWidth, height: zoneHeight } = getZoneMetrics();
  const { x: currentX, y: currentY } = getNoButtonPosition();
  const current = Number.isFinite(currentX) && Number.isFinite(currentY)
    ? { x: currentX, y: currentY }
    : clampPointToZone(zoneWidth * 0.55, zoneHeight * 0.45);

  const minAbsolute = 70;

  for (let i = 0; i < 40; i += 1) {
    const angle = randomInRange(0, Math.PI * 2);
    const maxTravel = distanceToZoneEdgeAlongAngle(current, angle, 8);
    if (maxTravel < minAbsolute) {
      continue;
    }

    const minTravel = Math.max(maxTravel * 0.7, minAbsolute);
    if (minTravel > maxTravel) {
      continue;
    }

    const distance = randomInRange(minTravel, maxTravel);
    const candidate = clampPointToZone(
      current.x + Math.cos(angle) * distance,
      current.y + Math.sin(angle) * distance,
      8,
    );

    const actualMove = Math.hypot(candidate.x - current.x, candidate.y - current.y);
    if (actualMove < minTravel * 0.9) {
      continue;
    }

    if (isOverlappingYes(candidate.x, candidate.y, 10)) {
      continue;
    }

    return candidate;
  }

  // Fallback: random valid position in zone that does not overlap Yes.
  for (let i = 0; i < 30; i += 1) {
    const candidate = clampPointToZone(
      randomInRange(8, Math.max(8, zoneWidth - getNoButtonSize().width - 8)),
      randomInRange(8, Math.max(8, zoneHeight - getNoButtonSize().height - 8)),
      8,
    );
    if (!isOverlappingYes(candidate.x, candidate.y, 10)) {
      return candidate;
    }
  }

  return current;
}

function clampNoButtonInZone(instant = false, padding = 8) {
  const { x: currentLeft, y: currentTop } = getNoButtonPosition();
  const hasValidPosition = Number.isFinite(currentLeft) && Number.isFinite(currentTop);

  if (!hasValidPosition) {
    return false;
  }

  const { x: clampedX, y: clampedY } = clampPointToZone(currentLeft, currentTop, padding);
  const changed = clampedX !== currentLeft || clampedY !== currentTop;

  if (changed) {
    moveNoButton(clampedX, clampedY, instant);
  }

  return true;
}

function placeNoButtonNearYes() {
  const { width: zoneWidth } = getZoneMetrics();
  const { width: btnWidth, height: btnHeight } = getNoButtonSize();
  const yesRect = getYesRectInZone();
  const padding = 0;
  const gap = 18;
  const alignedTop = yesRect.top;

  const rightCandidate = clampPointToZone(
    yesRect.right + gap,
    alignedTop,
    padding,
  );
  const leftCandidate = clampPointToZone(
    yesRect.left - btnWidth - gap,
    alignedTop,
    padding,
  );

  const rightFits = !isOverlappingYes(rightCandidate.x, rightCandidate.y, 10);
  const leftFits = !isOverlappingYes(leftCandidate.x, leftCandidate.y, 10);

  let x = rightCandidate.x;
  let y = rightCandidate.y;
  if (!rightFits && leftFits) {
    x = leftCandidate.x;
    y = leftCandidate.y;
  }
  if (!rightFits && !leftFits) {
    x = Math.max(padding, zoneWidth - btnWidth - padding);
    y = alignedTop;
  }

  moveNoButton(x, y, true);
}

function dodgeNoButton() {
  if (state.current !== "INVITE_IDLE" && state.current !== "INVITE_NO_DODGE") {
    return;
  }

  const now = performance.now();
  if (now - state.lastMoveAt < state.moveCooldownMs) {
    return;
  }

  state.lastMoveAt = now;
  setState("INVITE_NO_DODGE");

  const target = chooseRandomFarNoTarget();
  const x = target.x;
  const y = target.y;

  moveNoButton(x, y);
  noBtn.style.transform = "translateZ(0)";

  if (!clampNoButtonInZone()) {
    placeNoButtonNearYes();
    clampNoButtonInZone(true);
  }

  const resetId = setTimeout(() => {
    if (state.current === "INVITE_NO_DODGE") {
      setState("INVITE_IDLE");
    }
    state.timers.delete(resetId);
  }, 280);
  state.timers.add(resetId);
}

function pointerNearNoButton(event) {
  const rect = noBtn.getBoundingClientRect();
  const px = event.clientX;
  const py = event.clientY;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = px - cx;
  const dy = py - cy;
  const distance = Math.hypot(dx, dy);
  return distance < 96;
}

function startBouquetFlow() {
  clearTimers();
  setState("YES_CONFIRMED");
  activateView("bouquet");
  setState("BOUQUET_ANIMATING");
  spawnPetals();
}

function startCelebrate() {
  clearTimers();
  setState("CELEBRATE");
  activateView("celebrate");
}

// confetti removed; celebration now just shows portrait

function ensurePortrait() {
  if (!portraitImg) return;
  // if the default src fails to load, show a fallback
  portraitImg.addEventListener('error', () => {
    if (!portraitWrap) return;
    portraitWrap.innerHTML = '';
    const fallback = document.createElement('div');
    fallback.className = 'portrait-empty';
    fallback.textContent = 'Lloydie';
    portraitWrap.appendChild(fallback);
  });
}

function showDetails() {
  if (state.detailsShown) {
    return;
  }

  clearTimers();
  state.detailsShown = true;
  setState("DETAILS_VISIBLE");
  activateView("details");
}

function spawnPetals() {
  petalsContainer.innerHTML = "";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const amount = reducedMotion ? 0 : 28;

  for (let i = 0; i < amount; i += 1) {
    const petal = document.createElement("span");
    petal.className = "petal";

    const left = randomInRange(6, 94);
    const delay = randomInRange(120, 1700);
    const duration = randomInRange(1800, 3300);
    const color = petalPalette[i % petalPalette.length];

    petal.style.left = `${left}%`;
    petal.style.top = `${randomInRange(-5, 20)}%`;
    petal.style.background = color;
    petal.style.animationDelay = `${delay}ms`;
    petal.style.animationDuration = `${duration}ms`;

    petalsContainer.appendChild(petal);
  }
}

function onNoAttempt(event) {
  event.preventDefault();
  dodgeNoButton();
}

function attachEvents() {
  yesBtn.addEventListener("click", startBouquetFlow);
  continueBtn.addEventListener("click", startCelebrate);
  if (toDetailsBtn) toDetailsBtn.addEventListener("click", showDetails);

  // Move only on direct click/tap of No.
  noBtn.addEventListener("click", onNoAttempt);

  window.addEventListener("resize", () => {
    alignButtonPair();
    if (!clampNoButtonInZone()) {
      placeNoButtonNearYes();
      clampNoButtonInZone(true, 0);
    }
  });
}

function init() {
  alignButtonPair();
  activateView("invite");
  placeNoButtonNearYes();
  clampNoButtonInZone(true, 0);
  attachEvents();
  ensurePortrait();
}

init();
