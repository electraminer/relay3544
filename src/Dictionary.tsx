import { useEffect, useImperativeHandle, useRef, useState } from "react";
import "./Dictionary.css";
import { Table } from "./Table";

const DICT_KEY = "relay-dictionary";
const SIGFMT_KEY = "relay-signal-fmt";
const NUMFMT_KEY = "relay-number-fmt";

export type DictEntry = {
  def: string;
  before: string;
  after: string;
  double: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  invert: boolean;
  notes: string;
};

function toFormatMode(sep: string) {
  if (sep === "\n\n") return 3;
  if (sep === "\n") return 2;
  if (sep === "") return 0;
  return 1;
}

function fromFormatMode(fmt: any) {
  if (fmt === 0) return "";
  if (fmt === 1) return " ";
  if (fmt === 2) return "\n";
  if (fmt === 3) return "\n\n";
  return " ";
}

type EditDictEntry = [
  def: string,
  desc: string,
  before: string,
  after: string,
  double: string,
  notes: string,
  color: string,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  strikethrough: boolean,
  invert: boolean,
];
type EditDict = EditDictEntry[];

const DEFAULT_ENTRY: EditDictEntry = [
  "",
  "",
  " ",
  " ",
  "",
  "",
  "#ffffff",
  false,
  false,
  false,
  false,
  false,
];

function fillIncompleteEntry(
  incomplete: any[],
  defaultEntry?: EditDictEntry,
): EditDictEntry {
  return (defaultEntry ?? DEFAULT_ENTRY).map(
    (x, i) => incomplete[i] ?? x,
  ) as EditDictEntry;
}

function toDictEntry(def: EditDictEntry): DictEntry {
  return {
    def: def[1],
    before: def[2],
    after: def[3],
    double: def[4],
    notes: def[5],
    color: def[6],
    bold: def[7],
    italic: def[8],
    underline: def[9],
    strikethrough: def[10],
    invert: def[11],
  };
}

function exportDict(
  dict: EditDict,
  sigFmt: EditDictEntry,
  numFmt: EditDictEntry,
) {
  const filtered = dict.filter((e) => Number.isInteger(parseInt(e[0])));
  const exported = {
    wordDict: {
      keys: filtered.map((e) => parseInt(e[0])),
      values: filtered.map((e) => e[1]),
    },
    descDict: {
      keys: filtered.map((e) => parseInt(e[0])),
      values: filtered.map((e) => ({
        desc: e[5],
        formatMode: toFormatMode(e[2]),
        formatModeAfter: toFormatMode(e[3]),
        breakOnDouble: e[4] !== "",
        color: e[6],
        bold: Boolean(e[7]),
        italic: Boolean(e[8]),
        underline: Boolean(e[9]),
        strikethrough: Boolean(e[10]),
        invert: Boolean(e[11]),
      })),
    },
    id: 1,

    beforeUserDefaultMode: toFormatMode(sigFmt[2]),
    afterUserDefaultMode: toFormatMode(sigFmt[3]),
    defaultBreakOnDouble: sigFmt[4] !== "",
    globalNotes: sigFmt[5],
    defaultColor: sigFmt[6],
    defaultBold: Boolean(sigFmt[7]),
    defaultItalic: Boolean(sigFmt[8]),
    defaultUnderline: Boolean(sigFmt[9]),
    defaultStrikethrough: Boolean(sigFmt[10]),
    defaultInvert: Boolean(sigFmt[11]),

    numberBefore: toFormatMode(numFmt[2]),
    numberAfter: toFormatMode(numFmt[3]),
    numberBreakOnDouble: numFmt[4] !== "",
    numberNotes: numFmt[5],
    numberColor: numFmt[6],
    numberBold: Boolean(numFmt[7]),
    numberItalic: Boolean(numFmt[8]),
    numberUnderline: Boolean(numFmt[9]),
    numberStrikethrough: Boolean(numFmt[10]),
    numberInvert: Boolean(numFmt[11]),
  };

  return JSON.stringify(exported);
}

function importDict(json: string): [EditDict, EditDictEntry, EditDictEntry] {
  const imported = JSON.parse(json);
  if (!imported.wordDict) throw new Error("No word dict");
  if (!Array.isArray(imported.wordDict.keys))
    throw new Error("Invalid word dict");
  if (!Array.isArray(imported.wordDict.values))
    throw new Error("Invalid word dict");
  if (imported.wordDict.keys.length !== imported.wordDict.values.length)
    throw new Error("Invalid word dict");
  const dict: EditDict = [];
  for (let i = 0; i < imported.wordDict.keys.length; i++) {
    dict.push([
      String(imported.wordDict.keys[i]),
      String(imported.wordDict.values[i]),
      fromFormatMode(imported.descDict?.values?.[i]?.formatMode),
      fromFormatMode(imported.descDict?.values?.[i]?.formatModeAfter),
      imported.descDict?.values?.[i]?.breakOnDouble ? "\n" : "",
      String(imported.descDict?.values?.[i]?.desc),
      String(imported.descDict?.values?.[i]?.color ?? "#ffffff"),
      imported.descDict?.values?.[i]?.bold ?? false,
      imported.descDict?.values?.[i]?.italic ?? false,
      imported.descDict?.values?.[i]?.underline ?? false,
      imported.descDict?.values?.[i]?.strikethrough ?? false,
      imported.descDict?.values?.[i]?.invert ?? false,
    ]);
  }

  const sigFmt = [
    "-Infinity",
    "Signal Format",
    fromFormatMode(imported.beforeUserDefaultMode ?? 1),
    fromFormatMode(imported.afterUserDefaultMode ?? 1),
    imported.defaultBreakOnDouble ? "\n" : "",
    String(imported.globalNotes),
    String(imported.defaultColor ?? "#ffffff"),
    imported.defaultBold ?? false,
    imported.defaultItalic ?? false,
    imported.defaultUnderline ?? false,
    imported.defaultStrikethrough ?? false,
    imported.defaultInvert ?? false,
  ] as EditDictEntry;

  const numFmt = [
    "Infinity",
    "Number Format",
    fromFormatMode(imported.numberBefore ?? 1),
    fromFormatMode(imported.numberAfter ?? 1),
    imported.numberBreakOnDouble ? "\n" : "",
    String(imported.numberNotes),
    String(imported.numberColor ?? "#ffffff"),
    imported.numberBold ?? false,
    imported.numberItalic ?? false,
    imported.numberUnderline ?? false,
    imported.numberStrikethrough ?? false,
    imported.numberInvert ?? false,
  ] as EditDictEntry;

  return [dict, sigFmt, numFmt];
}

export function entryStyle(entry: DictEntry) {
  const style: Record<string, string | undefined> = {};

  if (entry.invert) {
    style["backgroundColor"] = entry.color;
    style["color"] = "var(--color-background)";
  } else {
    style["color"] = entry.color;
  }

  style.fontWeight = entry.bold ? "bold" : undefined;
  style.fontStyle = entry.italic ? "italic" : undefined;
  style.textDecoration = [
    entry.underline ? "underline" : "",
    entry.strikethrough ? "line-through" : "",
  ]
    .join(" ")
    .trim();

  return style;
}

export const DEFAULT_DICTIONARY = new Map<number, DictEntry>([
  [Infinity, toDictEntry(fillIncompleteEntry(["-Infinity", "Signal Format"]))],
  [
    -Infinity,
    toDictEntry(fillIncompleteEntry(["Infinity", "Number Format", "", ""])),
  ],
]);

export type DictionaryHandle = {
  focusSignal: (signal: number) => void;
};

export function Dictionary(props: {
  onChangeDict: (dict: Map<number, DictEntry>) => void;
  ref?: React.Ref<DictionaryHandle>;
}) {
  const [detail, setDetail] = useState(false);
  const [focus, setFocus] = useState<number>(-Infinity);

  const [dict, setDict] = useState<EditDict>(() => {
    try {
      return (JSON.parse(localStorage.getItem(DICT_KEY)!) ?? []).map(
        (x: EditDictEntry) => fillIncompleteEntry(x),
      );
    } catch (e) {
      console.log(e);
      return [];
    }
  });
  const [signalFmt, setSignalFmt] = useState<EditDictEntry>(() => {
    let fmt = DEFAULT_ENTRY;
    try {
      const parsed = JSON.parse(localStorage.getItem(SIGFMT_KEY)!) ?? [];
      fmt = fillIncompleteEntry(parsed, fmt);
    } catch (e) {}
    return fillIncompleteEntry(["-Infinity", "Signal Format"], fmt);
  });
  const [numberFmt, setNumberFmt] = useState<EditDictEntry>(() => {
    let fmt = fillIncompleteEntry(["", "", "", ""]);
    try {
      const parsed = JSON.parse(localStorage.getItem(NUMFMT_KEY)!) ?? [];
      fmt = fillIncompleteEntry(parsed, fmt);
    } catch (e) {}
    return fillIncompleteEntry(["Infinity", "Number Format"], fmt);
  });

  const focusRow =
    focus >= 0 && focus < dict.length
      ? dict[focus]
      : focus === Infinity
        ? numberFmt
        : signalFmt;

  useEffect(() => {
    localStorage.setItem(DICT_KEY, JSON.stringify(dict));
    console.log(signalFmt, numberFmt);
    localStorage.setItem(SIGFMT_KEY, JSON.stringify(signalFmt));
    localStorage.setItem(NUMFMT_KEY, JSON.stringify(numberFmt));

    const dictMap = new Map<number, DictEntry>();
    for (const def of dict) {
      dictMap.set(parseInt(def[0]), toDictEntry(def));
    }
    dictMap.set(-Infinity, toDictEntry(signalFmt));
    dictMap.set(Infinity, toDictEntry(numberFmt));

    props.onChangeDict(dictMap);
  }, [dict, signalFmt, numberFmt]);

  function changeDict(
    updater: (
      prev: EditDict,
      sigFmt: EditDictEntry,
      numFmt: EditDictEntry,
    ) => [EditDict, EditDictEntry, EditDictEntry],
  ) {
    const [newDict, newSigFmt, newNumFmt] = updater(dict, signalFmt, numberFmt);
    setDict(newDict);
    setSignalFmt(newSigFmt);
    setNumberFmt(newNumFmt);
  }

  function updateCell(row: number | null, col: number, value: string) {
    return (
      prev: EditDict,
      sigFmt: EditDictEntry,
      numFmt: EditDictEntry,
    ): [EditDict, EditDictEntry, EditDictEntry] => {
      if (row !== null && Number.isFinite(row)) {
        return [
          [
            ...prev.slice(0, row),
            [...prev[row].slice(0, col), value, ...prev[row].slice(col + 1)],
            ...prev.slice(row + 1),
          ] as any,
          sigFmt,
          numFmt,
        ];
      }
      if (row === -Infinity) {
        return [
          prev,
          [...sigFmt.slice(0, col), value, ...sigFmt.slice(col + 1)] as any,
          numFmt,
        ];
      }
      if (row === Infinity) {
        return [
          prev,
          sigFmt,
          [...numFmt.slice(0, col), value, ...numFmt.slice(col + 1)] as any,
        ];
      }
      return [prev, sigFmt, numFmt];
    };
  }

  function toggleBoolCell(row: number | null, col: number) {
    return (
      prev: EditDict,
      sigFmt: EditDictEntry,
      numFmt: EditDictEntry,
    ): [EditDict, EditDictEntry, EditDictEntry] => {
      if (row !== null && Number.isFinite(row)) {
        return [
          [
            ...prev.slice(0, row),
            [
              ...prev[row].slice(0, col),
              !prev[row][col],
              ...prev[row].slice(col + 1),
            ],
            ...prev.slice(row + 1),
          ] as any,
          sigFmt,
          numFmt,
        ];
      }
      if (row === -Infinity) {
        return [
          prev,
          [
            ...sigFmt.slice(0, col),
            !sigFmt[col],
            ...sigFmt.slice(col + 1),
          ] as any,
          numFmt,
        ];
      }
      if (row === Infinity) {
        return [
          prev,
          sigFmt,
          [
            ...numFmt.slice(0, col),
            !numFmt[col],
            ...numFmt.slice(col + 1),
          ] as any,
        ];
      }
      return [prev, sigFmt, numFmt];
    };
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  function addRow(signal?: number) {
    changeDict((prev, sigFmt, numFmt) => [
      [
        ...prev,
        fillIncompleteEntry([
          signal ? signal.toString() : "",
          signal ? signal.toString() : "",
        ]),
      ],
      sigFmt,
      numFmt,
    ]);

    window.setTimeout(() => {
      const newEditor = containerRef.current!.children.item(
        containerRef.current!.childElementCount - 2,
      );
      if (!newEditor) return;
      newEditor.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      window.setTimeout(() => {
        if (newEditor instanceof HTMLInputElement) {
          newEditor.focus();
          newEditor.selectionStart = 0;
          newEditor.selectionEnd = newEditor.value.length;
        }
      }, 250);
    }, 0);
  }

  useImperativeHandle(
    props.ref,
    () => ({
      focusSignal(signal: number) {
        const existingEditor = containerRef
          .current!.getElementsByClassName(`dict-editor-def-${signal}`)
          .item(0);
        if (existingEditor) {
          existingEditor.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          window.setTimeout(() => {
            if (existingEditor instanceof HTMLInputElement) {
              existingEditor.focus();
              existingEditor.selectionStart = existingEditor.selectionEnd =
                existingEditor.value.length;
            }
          }, 250);
        } else {
          addRow(signal);
        }
      },
    }),
    [dict],
  );

  return (
    <div className="dict">
      <div className="dict-editor-controls">
        <button
          onClick={() => {
            const confirmation = confirm(
              "Are you sure you want to import a dictionary?",
            );
            if (!confirmation) return;
            navigator.clipboard.readText().then((text) => {
              try {
                const [dict, sigFmt, numFmt] = importDict(text);
                setDict(dict);
                setSignalFmt(sigFmt);
                setNumberFmt(numFmt);
              } catch (e) {}
            });
          }}
        >
          →Import
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              exportDict(dict, signalFmt, numberFmt),
            );
          }}
        >
          Export→
        </button>
      </div>
      <Table
        ref={containerRef}
        columns={["Signal", "Definition"]}
        dataColumnWidths="74px 2fr"
        rows={dict.map((def) => [def[0], def[1]])}
        onChangeCell={(row, col, value) =>
          changeDict(updateCell(row, col, value))
        }
        onDeleteRow={(row) =>
          changeDict((prev, sigFmt, numFmt) => [
            prev.filter((_, i) => i !== row),
            sigFmt,
            numFmt,
          ])
        }
        onAddRow={() => addRow()}
        onFocusCell={(row) => setFocus(row)}
        onFocusDeleteRow={() => setFocus(-1)}
        cellClassName={(row, col) => {
          const focusClass = focus === row ? "table-focus" : "";
          if (col !== 1) return focusClass;
          let idClass = "";
          try {
            idClass = parseInt(dict[row][0]).toString();
          } catch (e) {}
          return `${focusClass} dict-editor-def-${idClass}`;
        }}
        cellStyle={(row, col) => {
          if (col === 1) return entryStyle(toDictEntry(dict[row]));
        }}
      />
      <div className="dict-editor-controls">
        <button
          onClick={() => {
            setDetail((d) => !d);
          }}
        >
          Detail
        </button>
        <button
          onClick={() => {
            changeDict((prev, sigFmt, numFmt) => [
              prev.toSorted((a, b) => +b[0] - +a[0]),
              sigFmt,
              numFmt,
            ]);
          }}
        >
          Sort
        </button>
      </div>
      {detail && (
        <div className="dict-editor-detail">
          <div className="dict-editor-controls">
            {Number.isFinite(focus) ? (
              <input
                className="dict-editor-format"
                style={entryStyle(toDictEntry(focusRow))}
                value={focusRow[1]}
                onChange={(e) =>
                  changeDict(updateCell(focus, 1, e.currentTarget.value))
                }
              />
            ) : (
              <div
                className="dict-editor-format-signal"
                style={entryStyle(toDictEntry(focusRow))}
              >
                {focusRow[1]}
              </div>
            )}

            <button
              className="dict-editor-format-choice"
              disabled={focus === -Infinity}
              onClick={() => setFocus(-Infinity)}
            >
              S
            </button>
            <button
              className="dict-editor-format-choice"
              disabled={focus === Infinity}
              onClick={() => setFocus(Infinity)}
            >
              #
            </button>
          </div>
          {[2, 3, 4].map((i) => (
            <div className="dict-editor-controls" key={i}>
              <div className="dict-editor-format-label">
                {["Before", "After", "Double"][i - 2]}
              </div>
              <button
                className="dict-editor-format-choice"
                disabled={focusRow[i] === ""}
                onClick={() => changeDict(updateCell(focus, i, ""))}
              ></button>
              <button
                className="dict-editor-format-choice"
                disabled={focusRow[i] === " "}
                onClick={() => changeDict(updateCell(focus, i, " "))}
              >
                _
              </button>
              <button
                className="dict-editor-format-choice"
                disabled={focusRow[i] === "\n"}
                onClick={() => changeDict(updateCell(focus, i, "\n"))}
              >
                1
              </button>
              <button
                className="dict-editor-format-choice"
                disabled={focusRow[i] === "\n\n"}
                onClick={() => changeDict(updateCell(focus, i, "\n\n"))}
              >
                2
              </button>
              <input
                className="dict-editor-format"
                value={focusRow[i] as string}
                onChange={(e) =>
                  changeDict(updateCell(focus, i, e.currentTarget.value))
                }
              />
            </div>
          ))}
          <div className="dict-editor-controls">
            <div className="dict-editor-format-label">Color</div>
            <input
              type="text"
              className="dict-editor-format"
              value={focusRow[6]}
              onChange={(e) => changeDict(updateCell(focus, 6, e.target.value))}
            />
            <div className="dict-editor-format-color-picker">
              <input
                type="color"
                value={focusRow[6]}
                onChange={(e) =>
                  changeDict(updateCell(focus, 6, e.target.value))
                }
              />
              <span className="material-symbols-outlined">colors</span>
            </div>
            <button
              className={"dict-editor-format-button"}
              onClick={() => changeDict(updateCell(focus, 6, "#ffffff"))}
            >
              <span className="material-symbols-outlined">
                format_color_reset
              </span>
            </button>
          </div>
          <div className="dict-editor-controls">
            <div className="dict-editor-format-label">Style</div>
            <button
              className={
                "dict-editor-format-toggle " + (focusRow[7] ? "selected" : "")
              }
              onClick={() => changeDict(toggleBoolCell(focus, 7))}
            >
              <span className="material-symbols-outlined">format_bold</span>
            </button>
            <button
              className={
                "dict-editor-format-toggle " + (focusRow[8] ? "selected" : "")
              }
              onClick={() => changeDict(toggleBoolCell(focus, 8))}
            >
              <span className="material-symbols-outlined">format_italic</span>
            </button>
            <button
              className={
                "dict-editor-format-toggle " + (focusRow[9] ? "selected" : "")
              }
              onClick={() => changeDict(toggleBoolCell(focus, 9))}
            >
              <span className="material-symbols-outlined">
                format_underlined
              </span>
            </button>
            <button
              className={
                "dict-editor-format-toggle " + (focusRow[10] ? "selected" : "")
              }
              onClick={() => changeDict(toggleBoolCell(focus, 10))}
            >
              <span className="material-symbols-outlined">strikethrough_s</span>
            </button>
            <button
              className={
                "dict-editor-format-toggle " + (focusRow[11] ? "selected" : "")
              }
              onClick={() => changeDict(toggleBoolCell(focus, 11))}
            >
              <span className="material-symbols-outlined">invert_colors</span>
            </button>
          </div>
          <textarea
            className="dict-editor-notes"
            value={focusRow[5]}
            spellCheck={false}
            placeholder="Notes"
            autoComplete="off"
            onChange={(e) => changeDict(updateCell(focus, 5, e.target.value))}
          />
        </div>
      )}
    </div>
  );
}
