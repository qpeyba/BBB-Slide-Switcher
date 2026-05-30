import { MessageType, Message, STORAGE_KEYS } from '../types';
import {
  getSlideNumberFromUrl,
  selectVisibleSlideImage,
  setSlideImageNumber,
} from './slide';

const SLIDE_SELECTORS = [
  '#slide-background-shape_image',
  'img[alt="tl_image_asset"]',
  'img[src*="/svg/"]',
];
const DEBUG = false;

let followPresenter = true;
let localSlideNumber: number | null = null;
let ignoredSlideNumber: number | null = null;
let lastLiveSlideNumber: number | null = null;
let lastLoggedSlideSrc: string | null = null;
let debounceTimer: number;
let observer: MutationObserver | null = null;

function debugLog(message: string, data?: unknown): void {
  if (!DEBUG) return;
  console.debug(`[BBB Slide Switcher] ${message}`, data ?? '');
}

function isSlideImage(element: Element): element is HTMLImageElement {
  return element instanceof HTMLImageElement && getSlideNumberFromUrl(element.src) !== null;
}

function getSlideImage(): HTMLImageElement | null {
  const images: HTMLImageElement[] = [];

  for (const selector of SLIDE_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (isSlideImage(element) && !images.includes(element)) {
        images.push(element);
      }
    }
  }

  const image = selectVisibleSlideImage(images);
  if (image && image.src !== lastLoggedSlideSrc) {
    lastLoggedSlideSrc = image.src;
    debugLog('found slide image', image.src);
  }

  return image;
}

function getCurrentSlideNumber(): number | null {
  const img = getSlideImage();
  if (!img) return null;

  return getSlideNumberFromUrl(img.src);
}

function setSlideNumber(slideNumber: number): number | null {
  const img = getSlideImage();
  if (!img) return null;
  if (slideNumber < 1) return null;

  if (getCurrentSlideNumber() === slideNumber) {
    localSlideNumber = slideNumber;
    return slideNumber;
  }

  if (setSlideImageNumber(img, slideNumber) === null) return null;

  ignoredSlideNumber = slideNumber;
  localSlideNumber = slideNumber;
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
    default:
      return false;
  }
}

function setupObserver(): void {
  if (observer) return;

  observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const slideNumber = getCurrentSlideNumber();
      if (slideNumber === null) return;

      if (slideNumber === lastSeenSlideNumber) return;

      if (slideNumber === ignoredSlideNumber) {
        ignoredSlideNumber = null;
        debugLog('ignored extension mutation', slideNumber);
        return;
      }

      if (slideNumber === lastLiveSlideNumber) return;

      lastLiveSlideNumber = slideNumber;
      notifyLiveSlideChanged(slideNumber);
      debugLog('live slide changed', slideNumber);

      if (followPresenter) {
        localSlideNumber = slideNumber;
        notifySlideNumberChanged(slideNumber);
        return;
      }

      if (localSlideNumber !== null && localSlideNumber !== slideNumber) {
        setSlideNumber(localSlideNumber);
      }
    }, 200);
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['src', 'style', 'class'],
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener(handleMessage);

chrome.storage.local.get([STORAGE_KEYS.FOLLOW_PRESENTER], (result) => {
  followPresenter = result[STORAGE_KEYS.FOLLOW_PRESENTER] !== false;
  const slideNumber = getCurrentSlideNumber();
  if (followPresenter && slideNumber !== null) {
    localSlideNumber = slideNumber;
    lastLiveSlideNumber = slideNumber;
    notifyLiveSlideChanged(slideNumber);
    notifySlideNumberChanged(slideNumber);
  }
});

function initialize(): void {
  localSlideNumber = getCurrentSlideNumber();
  lastLiveSlideNumber = localSlideNumber;
  setupObserver();
}

initialize();

export { getSlideImage, getCurrentSlideNumber, changeSlide, setSlideNumber };
