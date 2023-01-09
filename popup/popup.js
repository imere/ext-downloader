/**
 * @typedef {object} MatchType
 * @property {"type"} type
 * @property {Array<"image" | "media">} value
 */

/**
 * @typedef {object} MatchRegExp
 * @property {"regexp"} type
 * @property {string} value
 */

/**
 * @typedef {object} MatchString
 * @property {"string"} type
 * @property {string} value
 */

/**
 * @typedef {object} Rule
 * @property {boolean} [Rule.disabled] 禁用
 * @property {boolean} [Rule.guessExt] 推断文件后缀名
 * @property {MatchType | MatchRegExp | MatchString} Rule.match
 * @property {string} Rule.dir 下载子目录
 */

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
  /** @type {Rule[]} */
  rules: [],
};

const app = document.getElementById("app");

if (app) {
  initState().then(initUI).then(() => {
    chrome.storage.sync.onChanged.addListener(({ rules }) => {
      if (!rules) return;
      chrome.runtime.sendMessage({
        a: "storage.sync.onChanged",
      });
      initUI();
    });
  }).catch((ex) => {
    sendToCurrentTab({
      a: "err",
      payload: ex.message || ex,
    });
  });
}

async function initState() {
  let rules = await storage.get("rules");
  if (!rules) storage.set("rules", rules = []);
  State.rules = rules;
}

async function updateState() {
  storage.set("rules", State.rules);
}

function initUI() {
  if (!app) return;
  app.innerHTML = "";
  app.append(
    h("button", null, {
      onclick() {
        State.rules.push({
          disabled: true,
          guessExt: true,
          match: {
            type: "string",
            value: ".gif",
          },
          dir: "资源/gif",
        });
        State.rules.push({
          disabled: true,
          guessExt: true,
          match: {
            type: "type",
            value: ["image", "media"],
          },
          dir: "资源",
        });
        State.rules.push({
          disabled: true,
          guessExt: true,
          match: {
            type: "regexp",
            value: "\\.(jpg|png)$",
          },
          dir: "资源",
        });
        updateState();
      },
    }, "添加下载规则"),
    h("div", { margin: "4px" }, null, "即时生效，由上到下匹配第一个；有 * 为必填。"),
    h("div", { margin: "4px" }, null, "资源太多下载会卡。"),
  );
  for (let i = 0; i < State.rules.length; i++) {
    initRule(i);
  }
}

function initRule(/**@type {number} */ n) {
  const options = [
    { label: "类型", value: "type" },
    { label: "包含字符", value: "string" },
    { label: "匹配正则", value: "regexp" },
  ];
  const elMatchSelect = h(
    "select",
    null,
    {
      onchange({ target }) {
        const type = target?.value;
        State.rules[n].match.type = type;
        State.rules[n].match.value = ["type"].includes(type)
          ? []
          : (["string", "regexp"].includes(type))
          ? ""
          : "";
        updateState();
      },
    },
    options.map(({ label, value }) => {
      return h("option", null, { value }, label);
    }),
  );
  elMatchSelect.selectedIndex = options.findIndex(({ value }) =>
    value === State.rules[n].match.type
  );
  /** @type {HTMLElement} */
  let elMatchInput;
  switch (State.rules[n].match.type) {
    case "type":
      elMatchInput = h(
        "span",
        null,
        null,
        [
          { label: "图片", value: "image" },
          { label: "媒体", value: "media" },
        ].map(({ label, value: type }) => {
          return h(
            "span",
            { display: "inline-flex", alignItems: "center" },
            null,
            [
              h("input", null, {
                type: "checkbox",
                checked: State.rules[n].match.value.includes(type),
                onchange({ target }) {
                  /** @type {Set<"image" | "media">} */
                  const set = new Set(State.rules[n].match.value);
                  target.checked ? set.add(type) : set.delete(type);
                  State.rules[n].match.value = [...set];
                  updateState();
                },
              }),
              h("label", null, null, label),
            ],
          );
        }),
      );
      break;
    case "string":
    case "regexp":
      elMatchInput = h("input", null, {
        value: State.rules[n].match.value,
        onchange({ target }) {
          State.rules[n].match.value = target?.value;
          updateState();
        },
      });
      break;
  }
  const elRule = h(
    "div",
    { display: "flex", justifyContent: "space-between", marginTop: "8px" },
    null,
    [
      h("div", null, null, [
        h(
          "span",
          { display: "inline-flex", alignItems: "center" },
          null,
          [
            h("input", null, {
              type: "checkbox",
              checked: !State.rules[n].disabled,
              onchange({ target }) {
                State.rules[n].disabled = !target.checked;
                updateState();
              },
            }),
            h("label", null, null, "启用"),
          ],
        ),
        h(
          "span",
          { display: "inline-flex", alignItems: "center" },
          null,
          [
            h("input", null, {
              type: "checkbox",
              checked: State.rules[n].guessExt,
              onchange({ target }) {
                State.rules[n].guessExt = target.checked;
                updateState();
              },
            }),
            h("label", null, null, "推断文件后缀(如.jpg)"),
          ],
        ),
        h("div", null, null, [
          h("label", null, null, "*资源匹配："),
          elMatchSelect,
          elMatchInput,
        ]),
        h("div", null, null, [
          h("label", null, null, "子目录："),
          h("input", null, {
            placeholder: "相对于下载目录",
            value: State.rules[n].dir,
            onchange({ target }) {
              State.rules[n].dir = target?.value;
              updateState();
            },
          }),
        ]),
      ]),
      h(
        "div",
        null,
        null,
        h("button", null, {
          onclick() {
            {
              State.rules.splice(n, 1);
              updateState();
            }
          },
        }, "删除"),
      ),
    ],
  );
  app?.append(elRule);
}

/**
 * @template {keyof HTMLElementTagNameMap} T
 * @template {keyof HTMLElementTagNameMap[T]} Prop
 *
 * @param {T} tag
 * @param {string | Partial<CSSStyleDeclaration>?} [css]
 * @param {Partial<Record<Prop, HTMLElementTagNameMap[T][Prop]>>?} [props]
 * @param {Element | Node | string | Array<Element | Node | string> | undefined?} [children]
 * @return {HTMLElementTagNameMap[T]}
 */
function h(tag, css, props, children) {
  const ret = document.createElement(tag);

  if (css) {
    if (typeof css === "string") ret.style.cssText = css;
    else for (const [key, value] of Object.entries(css)) ret.style[key] = value;
  }

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      ret[key] = value;
    }
  }

  if (children) {
    if (!Array.isArray(children)) ret.append(children);
    else if (children.length) ret.append(...children);
  }

  return ret;
}
