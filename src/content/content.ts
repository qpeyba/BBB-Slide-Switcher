import { MessageType, Message, STORAGE_KEYS } from '../types';
import {
  findSlideImage,
  getCurrentVisibleSlide,
  getSlideNumberFromUrl,
  setVisibleSlide,
} from './slide';

const DEBUG = false;

let followPresenter = true;
let localSlideNumber: number | null = null;
let liveSlideNumber: number | null = null;
let displayedSlideNumber: number | null = null;
let pendingExtensionSlideNumber: number | null = null;
let lastLoggedSlideSrc: string | null = null;
let debounceTimer: number;
let observer: MutationObserver | null = null;
let pendingMutations: MutationRecord[] = [];

function debugLog(message: string, data?: unknown): void {
  if (!DEBUG) return;
  console.debug(`[BBB Slide Switcher] ${message}`, data ?? '');
}

function getSlideImage(): HTMLImageElement | null {
  const image = findSlideImage();
  if (image && image.src !== lastLoggedSlideSrc) {
    lastLoggedSlideSrc = image.src;
    debugLog('found slide image', image.src);
  }

  return image;
}

function getCurrentSlideNumber(): number | null {
  return getCurrentVisibleSlide()?.slideNumber || null;
}

function setSlideNumber(slideNumber: number): number | null {
  const currentSlide = getCurrentVisibleSlide();
  if (!currentSlide) return null;
  if (slideNumber < 1) return null;

  if (currentSlide.slideNumber === slideNumber) {
    localSlideNumber = slideNumber;
    displayedSlideNumber = slideNumber;
    return slideNumber;
  }

  if (setVisibleSlide(slideNumber) === null) return null;

  pendingExtensionSlideNumber = slideNumber;
  localSlideNumber = slideNumber;
  displayedSlideNumber = slideNumber;
  debugLog('local slide changed', slideNumber);

  return slideNumber;
}

function notifySlideNumberChanged(slideNumber: number): void {
  chrome.runtime.sendMessage({
    type: MessageType.SLIDE_NUMBER_CHANGED,
    slideNumber,
  });
}

function notifyLiveSlideChanged(slideNumber: number): void {
  chrome.runtime.sendMessage({
    type: MessageType.LIVE_SLIDE_CHANGED,
    slideNumber,
  });
}

function hasSlideTransition(
  mutations: MutationRecord[],
  fromSlide: number | null,
  toSlide: number
): boolean {
  if (fromSlide === null) return false;

  for (const mutation of mutations) {
    if (mutation.type !== 'attributes' || mutation.attributeName !== 'src') {
      continue;
    }

    const oldSlide = mutation.oldValue
      ? getSlideNumberFromUrl(mutation.oldValue)
      : null;
    const target = mutation.target;
    const newSlide =
      target instanceof HTMLImageElement ? getSlideNumberFromUrl(target.src) : null;

    if (oldSlide === fromSlide && newSlide === toSlide) {
      return true;
    }
  }

  return false;
}

function setLiveSlideNumber(slideNumber: number): void {
  if (liveSlideNumber === slideNumber) return;

  liveSlideNumber = slideNumber;
  notifyLiveSlideChanged(slideNumber);
  debugLog('live slide changed', slideNumber);
}

function processObservedSlide(mutations: MutationRecord[]): void {
  const currentSlide = getCurrentVisibleSlide();
  if (currentSlide === null) return;

  const slideNumber = currentSlide.slideNumber;
  const hasLiveTransition = hasSlideTransition(mutations, liveSlideNumber, slideNumber);

  if (slideNumber === pendingExtensionSlideNumber) {
    pendingExtensionSlideNumber = null;
    displayedSlideNumber = slideNumber;
    debugLog('ignored extension mutation', slideNumber);
    return;
  }

  if (slideNumber === displayedSlideNumber && !hasLiveTransition) {
    debugLog('ignored slide rerender', slideNumber);
    return;
  }

  displayedSlideNumber = slideNumber;

  if (!followPresenter) {
    setLiveSlideNumber(slideNumber);

    if (localSlideNumber !== null && localSlideNumber !== slideNumber) {
      setSlideNumber(localSlideNumber);
    }

    return;
  }

  setLiveSlideNumber(slideNumber);

  if (localSlideNumber !== slideNumber) {
    localSlideNumber = slideNumber;
    notifySlideNumberChanged(slideNumber);
  }
}

function changeSlide(direction: 'next' | 'prev'): number | null {
  const currentSlide = getCurrentSlideNumber();
  if (currentSlide === null) return null;

  const newSlide = direction === 'next' ? currentSlide + 1 : currentSlide - 1;
  const slideNumber = setSlideNumber(newSlide);
  if (slideNumber !== null) {
    notifySlideNumberChanged(slideNumber);
  }

  return slideNumber;
}

function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  switch (message.type) {
    case MessageType.GET_CURRENT_SLIDE: {
      const slideNumber = getCurrentSlideNumber();
      sendResponse({ slideNumber });
      return false;
    }
    case MessageType.NEXT_SLIDE: {
      const slideNumber = changeSlide('next');
      sendResponse({ slideNumber });
      return false;
    }
    case MessageType.PREV_SLIDE: {
      const slideNumber = changeSlide('prev');
      sendResponse({ slideNumber });
      return false;
    }
    case MessageType.GO_TO_SLIDE: {
      const targetSlide = message.slideNumber;
      const slideNumber =
        typeof targetSlide === 'number' ? setSlideNumber(targetSlide) : null;
      if (slideNumber !== null) {
        notifySlideNumberChanged(slideNumber);
      }
      sendResponse({ slideNumber });
      return false;
    }
    case MessageType.SET_FOLLOW_PRESENTER: {
      followPresenter = message.followPresenter === true;
      debugLog('follow presenter changed', followPresenter);
      sendResponse({ ok: true });
      return false;
    }
    case MessageType.GET_FOLLOW_PRESENTER: {
      sendResponse({ followPresenter });
      return false;
    }
    default:
      return false;
  }
}

function setupObserver(): void {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    pendingMutations.push(...mutations);
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const mutations = pendingMutations;
      pendingMutations = [];
      processObservedSlide(mutations);
    }, 200);
  });

  observer.observe(document.body, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['src', 'style', 'class'],
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener(handleMessage);

function initialize(): void {
  followPresenter = true;
  localSlideNumber = getCurrentSlideNumber();
  liveSlideNumber = localSlideNumber;
  displayedSlideNumber = localSlideNumber;
  pendingExtensionSlideNumber = null;
  chrome.storage.local.set({
    [STORAGE_KEYS.FOLLOW_PRESENTER]: true,
  });

  if (localSlideNumber !== null) {
    notifyLiveSlideChanged(localSlideNumber);
    notifySlideNumberChanged(localSlideNumber);
  }

  setupObserver();
}

initialize();

export { getSlideImage, getCurrentSlideNumber, changeSlide, setSlideNumber };
