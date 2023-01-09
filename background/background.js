const storage = {
  async get(/** @type {string}*/ key) {
    const ret = await chrome.storage.sync.get(key);
    return ret[key];
  },
  async set(/** @type {string}*/ key, val) {
    await chrome.storage.sync.set({ [key]: val });
  },
  async del(/** @type {string}*/ key) {
    await chrome.storage.sync.remove(key);
  },
};

function sendToCurrentTab(msg) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      msg,
    );
  });
}

function guidGenerator() {
  const S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return ([
    S4() + S4(),
    S4(),
    S4(),
    S4(),
    S4() + S4() + S4(),
  ].join("-"));
}

const State = {
  loaded: false,
  /** @type {Rule[]} */
  rules: [],
};

function refreshState() {
  State.loaded = false;
  return storage.get("rules").then((rules) => {
    State.rules = rules || [];
    State.loaded = true;
    flushWaitQueue();
  });
}

/**
 * @typedef {{type: chrome.webRequest.WebResponseCacheDetails['type'], url: string}} IDetail
 */

/** @type {Array<IDetail>} */
const waitQueue = [];
function flushWaitQueue() {
  let detail;
  while (detail = waitQueue.shift()) {
    setTimeout(() => handleWebRequest(detail), 500);
  }
}

refreshState();

chrome.runtime.onMessage.addListener((message) => {
  if (message.a !== "storage.sync.onChanged") return;
  refreshState();
});

chrome.webRequest.onCompleted.addListener((details) => {
  if (!State.rules.length) return;
  setTimeout(() => handleWebRequest(details), 500);
}, {
  urls: ["<all_urls>"],
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.a !== "download") return;
  const { payload } = message;
  setTimeout(() => handleWebRequest(payload), 500);
});

chrome.downloads.onCreated.addListener(async (item) => {
  const { id, totalBytes } = item;
  // await chrome.downloads.search({ url: item.url });
  if (!totalBytes) chrome.downloads.cancel(id);
});

async function handleWebRequest(
  /** @type {IDetail} */ details,
) {
  if (details.type === "ping") return;
  // if (!State.loaded) {
  //   waitQueue.push(details);
  //   return;
  // }

  for (let i = 0; i < State.rules.length; i++) {
    const rule = State.rules[i];

    const { disabled, guessExt, match, dir } = rule;

    if (disabled) continue;

    const option = {
      url: details.url,
      /** @type {string | undefined} */
      filename: normalizeDir(dir),
    };

    if (!["type", "string", "regexp"].includes(match.type)) return;

    const tests = [
      match.type === "type" && match.value.includes(details.type.toString()),
      match.type === "string" && details.url.includes(match.value),
      match.type === "regexp" && RegExp(match.value).test(details.url),
    ];

    if (tests.some(Boolean)) {
      if (option.filename) {
        const fileName = await getFileNameFromUrl(details.url, guessExt);
        if (fileName) option.filename += `/${fileName}`;
      }
      chrome.downloads.download(option);
      break;
    }
  }
}

async function getFileNameFromUrl(
  /** @type {string} */ url,
  /** @type {boolean=} */ guessExt,
) {
  if (url.startsWith("data:")) return undefined;
  try {
    const { host, pathname, search, hash } = new URL(url);
    if (pathname !== "/") {
      let name = pathname.slice(pathname.lastIndexOf("/") + 1);
      if (guessExt && !name.includes(".")) {
        const mime = await fetch(url, {
          method: "HEAD",
        }).then((_) => _.headers.get("Content-Type")).catch(() => null);
        if (mime) name += `${name}.${mime.split(/;?\s+/)[0].split("/")[1]}`;
      }
      return name;
    }
  } catch {}
  return url;
}

function normalizeDir(/** @type {string} */ dir) {
  if (!dir) return undefined;
  dir = dir.trim();
  dir = dir.replace(RegExp("^(/|\\\\)+"), "");
  dir = dir.replace(RegExp("(/|\\\\)+$"), "");
  return dir || undefined;
}
