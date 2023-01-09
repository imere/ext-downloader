new MutationObserver((list, observer) => {
  for (let mutation of list) {
    if (mutation.type === "attributes" && mutation.attributeName === "src") {
      download(mutation.target);
    } else if (mutation.type === "childList") {
      mutation.addedNodes.forEach(walk);
    }
  }
}).observe(document.documentElement, {
  attributes: true,
  subtree: true,
  childList: true,
});

walk(document.documentElement);

function walk(/** @type {Node} */ node) {
  download(node);
  node.childNodes.forEach(walk);
}

function download(/** @type {Node} */ node) {
  if (["IMG", "VIDEO"].includes(node.nodeName)) {
    const message = {
      a: "download",
      /** @type {IDetail} */
      payload: {
        type: { IMG: "image", VIDEO: "media" }[node.nodeName],
        url: node.src,
      },
    };
    chrome.runtime.sendMessage(message);
  }
}
