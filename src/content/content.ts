import { MessageType, Message, STORAGE_KEYS } from '../types';
import {
  findSlideImage,
  getCurrentVisibleSlide,
  setVisibleSlide,
} from './slide';
import { reduceObservedSlide } from './slide-state';

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

function processObservedSlide(mutations: MutationRecord[]): void {
  const currentSlide = getCurrentVisibleSlide();
  if (currentSlide === null) return;

  const slideNumber = currentSlide.slideNumber;
  const result = reduceObservedSlide(
    {
      followPresenter,
      localSlideNumber,
      liveSlideNumber,
      displayedSlideNumber,
      pendingExtensionSlideNumber,
    },
    slideNumber,
    mutations
  );

  localSlideNumber = result.state.localSlideNumber;
  liveSlideNumber = result.state.liveSlideNumber;
  displayedSlideNumber = result.state.displayedSlideNumber;
  pendingExtensionSlideNumber = result.state.pendingExtensionSlideNumber;

  if (result.effects.ignoreReason !== null) {
    debugLog(`ignored ${result.effects.ignoreReason} mutation`, slideNumber);
    return;
  }

  if (result.effects.liveSlideNumber !== null) {
    notifyLiveSlideChanged(result.effects.liveSlideNumber);
    debugLog('live slide changed', result.effects.liveSlideNumber);
  }

  if (result.effects.localSlideNumber !== null) {
    notifySlideNumberChanged(result.effects.localSlideNumber);
  }

  if (result.effects.restoreSlideNumber !== null) {
    setSlideNumber(result.effects.restoreSlideNumber);
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

export { getSlideImage, getCurrentSlideNumber, changeSlide, setSlideNumber };
