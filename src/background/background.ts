import { Message, MessageType, STORAGE_KEYS } from '../types';

function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean | void {
  if (message.type === MessageType.SLIDE_NUMBER_CHANGED) {
    chrome.storage.local.set({
      [STORAGE_KEYS.LAST_LIVE_SLIDE]: message.slideNumber,
    });
  } else if (message.type === MessageType.GET_LAST_SLIDE) {
    chrome.storage.local.get([STORAGE_KEYS.LAST_LIVE_SLIDE], (result) => {
      sendResponse({ slideNumber: result[STORAGE_KEYS.LAST_LIVE_SLIDE] || null });
    });
    return true;
  }
}

chrome.runtime.onMessage.addListener(handleMessage);



