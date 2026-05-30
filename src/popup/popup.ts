import { MessageType, Message, STORAGE_KEYS } from '../types';

const slideNumberDisplay = document.getElementById('slideNumber') as HTMLDivElement;
const lastLiveSlideDisplay = document.getElementById('lastLiveSlide') as HTMLElement;
const prevButton = document.getElementById('prevButton') as HTMLButtonElement;
const nextButton = document.getElementById('nextButton') as HTMLButtonElement;
const followPresenterToggle = document.getElementById(
  'followPresenterToggle'
) as HTMLInputElement;
const syncButton = document.getElementById('syncButton') as HTMLButtonElement;
const statusArea = document.getElementById('statusArea') as HTMLDivElement;

let pollInterval: number | null = null;

function setStatus(message: string, type: 'success' | 'error' | 'info' | 'empty'): void {
  statusArea.textContent = message;
  statusArea.className = `status-area ${type}`;
}

function setContentControlsEnabled(enabled: boolean): void {
  prevButton.disabled = !enabled;
  nextButton.disabled = !enabled;
  syncButton.disabled = !enabled;
}

async function getActiveTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id || null;
}

async function getLastLiveSlide(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: MessageType.GET_LAST_SLIDE,
      } as Message,
      (response) => {
        resolve(response?.slideNumber || null);
      }
    );
  });
}

async function updateLastLiveSlide(): Promise<number | null> {
  const slideNumber = await getLastLiveSlide();
  lastLiveSlideDisplay.textContent = slideNumber !== null ? String(slideNumber) : '-';
  return slideNumber;
}

function startPolling(): void {
  if (pollInterval) return;

  pollInterval = window.setInterval(() => {
    updateSlideNumber();
  }, 1000);
}

function stopPolling(): void {
  if (pollInterval) {
    window.clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function updateSlideNumber(): Promise<number | null> {
  try {
    const tabId = await getActiveTabId();
    if (tabId === null) {
      slideNumberDisplay.textContent = '-';
      setContentControlsEnabled(false);
      setStatus('Откройте вкладку BigBlueButton', 'info');
      return null;
    }

    const response = await chrome.tabs.sendMessage(tabId, {
      type: MessageType.GET_CURRENT_SLIDE,
    } as Message);

    const slideNumber = response?.slideNumber || null;
    slideNumberDisplay.textContent = slideNumber !== null ? String(slideNumber) : '-';
    setContentControlsEnabled(slideNumber !== null);
    if (slideNumber !== null) {
      setStatus('', 'empty');
    }
    return slideNumber;
  } catch (error) {
    slideNumberDisplay.textContent = '-';
    setContentControlsEnabled(false);
    setStatus('Content script недоступен на этой вкладке', 'error');
    console.error('Failed to get current slide:', error);
    return null;
  }
}

async function handlePrevSlide(): Promise<void> {
  try {
    const tabId = await getActiveTabId();
    if (tabId === null) return;

    await chrome.tabs.sendMessage(tabId, {
      type: MessageType.PREV_SLIDE,
    } as Message);

    await updateSlideNumber();
  } catch (error) {
    console.error('Failed to navigate to previous slide:', error);
  }
}

async function handleNextSlide(): Promise<void> {
  try {
    const tabId = await getActiveTabId();
    if (tabId === null) return;

    await chrome.tabs.sendMessage(tabId, {
      type: MessageType.NEXT_SLIDE,
    } as Message);

    await updateSlideNumber();
  } catch (error) {
    console.error('Failed to navigate to next slide:', error);
  }
}

async function handleSyncToLive(): Promise<void> {
  try {
    const lastLiveSlide = await updateLastLiveSlide();

    if (lastLiveSlide === null) {
      setStatus('Нет сохранённого слайда преподавателя', 'info');
      return;
    }

    const tabId = await getActiveTabId();
    if (tabId === null) return;

    await chrome.tabs.sendMessage(tabId, {
      type: MessageType.GO_TO_SLIDE,
      slideNumber: lastLiveSlide,
    } as Message);

    await updateSlideNumber();
    setStatus(`Восстановлен слайд ${lastLiveSlide}`, 'success');
  } catch (error) {
    setStatus('Не удалось восстановить слайд', 'error');
    console.error('Failed to sync to live slide:', error);
  }
}

async function toggleFollowPresenter(): Promise<void> {
  const isChecked = followPresenterToggle.checked;

  chrome.storage.local.set({
    [STORAGE_KEYS.FOLLOW_PRESENTER]: isChecked,
  });

  if (isChecked) {
    startPolling();
  } else {
    stopPolling();
  }

  const tabId = await getActiveTabId();
  if (tabId === null) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MessageType.SET_FOLLOW_PRESENTER,
      followPresenter: isChecked,
    } as Message);
    setStatus(
      isChecked ? 'Следование за преподавателем включено' : 'Следование отключено',
      'info'
    );
  } catch (error) {
    setStatus('Настройка сохранена, но вкладка BBB недоступна', 'error');
    console.error('Failed to update content script:', error);
  }
}

function handleSlideNumberChanged(message: Message): void {
  if (message.type === MessageType.SLIDE_NUMBER_CHANGED) {
    if (followPresenterToggle.checked) {
      updateSlideNumber();
    }
  } else if (message.type === MessageType.LIVE_SLIDE_CHANGED) {
    updateLastLiveSlide();
  }
}

function initializePopup(): void {
  chrome.storage.local.get([STORAGE_KEYS.FOLLOW_PRESENTER], (result) => {
    const followPresenter = result[STORAGE_KEYS.FOLLOW_PRESENTER] !== false;
    followPresenterToggle.checked = followPresenter;

    if (followPresenter) {
      startPolling();
    }
  });

  updateSlideNumber();
  updateLastLiveSlide();

  prevButton.addEventListener('click', handlePrevSlide);
  nextButton.addEventListener('click', handleNextSlide);
  syncButton.addEventListener('click', handleSyncToLive);
  followPresenterToggle.addEventListener('change', toggleFollowPresenter);

  chrome.runtime.onMessage.addListener(handleSlideNumberChanged);
}

document.addEventListener('DOMContentLoaded', initializePopup);
