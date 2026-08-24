import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import "./Dictionary.css"
import { Table } from "./Table";

const DICT_KEY = "relay-dictionary";

export type DictEntry = {
  def: string,
  before: string,
  after: string,
  double: string,
  color: string,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  strikethrough: boolean,
  notes: string,
}

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
];
type EditDict = EditDictEntry[];

function exportDict(dict: EditDict) {
  const filtered = dict.filter(e => Number.isInteger(parseInt(e[0])));
  const exported = {
    wordDict: {
      keys: filtered.map(e => parseInt(e[0])),
      values: filtered.map(e => e[1]),
    },
    descDict: {
      keys: filtered.map(e => parseInt(e[0])),
      values: filtered.map(e => ({
        desc: e[5],
        formatMode: toFormatMode(e[2]),
        formatModeAfter: toFormatMode(e[3]),
        breakOnDouble: e[4] !== '',
        color: e[6],
        bold: Boolean(e[7]),
        italic: Boolean(e[8]),
        underline: Boolean(e[9]),
        strikethrough: Boolean(e[10]),
      })),
    },
    id: 1,
    beforeUserDefaultMode: 1,
    afterUserDefaultMode: 1,
  }

  return JSON.stringify(exported);
}

function importDict(json: string): EditDict {
  const imported = JSON.parse(json);
  if (!imported.wordDict) throw new Error("No word dict");
  if (!Array.isArray(imported.wordDict.keys)) throw new Error("Invalid word dict");
  if (!Array.isArray(imported.wordDict.values)) throw new Error("Invalid word dict");
  if (imported.wordDict.keys.length !== imported.wordDict.values.length) throw new Error("Invalid word dict");
  const dict: EditDict = [];
  for (let i = 0; i < imported.wordDict.keys.length; i++) {
    dict.push([
      String(imported.wordDict.keys[i]),
      String(imported.wordDict.values[i]),
      fromFormatMode(imported.descDict?.values?.[i]?.formatMode),
      fromFormatMode(imported.descDict?.values?.[i]?.formatModeAfter),
      imported.descDict?.values?.[i]?.breakOnDouble ? "\n" : "",
      String(imported.descDict?.values?.[i]?.desc),
      String(imported.descDict?.values?.[i]?.color ?? '#ffffff'),
      imported.descDict?.values?.[i]?.bold ?? false,
      imported.descDict?.values?.[i]?.italic ?? false,
      imported.descDict?.values?.[i]?.underline ?? false,
      imported.descDict?.values?.[i]?.strikethrough ?? false,
    ]);
  }
  return dict;
}

export type DictionaryHandle = {
  focusSignal: (signal: number) => void,
};

export function Dictionary(props: {
  onChangeDict: (dict: Map<number, DictEntry>) => void,
  ref?: React.Ref<DictionaryHandle>,
}) {

  const [detail, setDetail] = useState(false);
  const [focus, setFocus] = useState(-1);

  const [dict, setDict] = useState<EditDict>(
    () => {
    try {
        return (JSON.parse(localStorage.getItem(DICT_KEY)!) ?? [])
          .map((x: any) => [
            x[0] ?? "",
            x[1] ?? "",
            x[2] ?? " ",
            x[3] ?? " ",
            x[4] ?? "",
            x[5] ?? "",
            x[6] ?? '#ffffff',
            x[7] ?? false,
            x[8] ?? false,
            x[9] ?? false,
            x[10] ?? false,
          ]);
    } catch (e) {
      return [];
    }
    }
  );

  useEffect(() => {
    localStorage.setItem(DICT_KEY, JSON.stringify(dict));

    const dictMap = new Map<number, DictEntry>();
    for (const def of dict) {
      try {
        const signal = parseInt(def[0]);
        dictMap.set(signal, {
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
        });
      } catch (e) {
        // Skip the pair if it is invalid
      }
    }
    props.onChangeDict(dictMap);
  }, [dict]);

  function changeDict(updater: (prev: EditDict) => EditDict) {
    const newdict = updater(dict);
    setDict(newdict);
  }

  function updateCell(row: number, col: number, value: string) {
    return (prev: EditDict): EditDict => {
      return [...prev.slice(0, row),
        [...prev[row].slice(0, col), value, ...prev[row].slice(col+1)],
      ...prev.slice(row+1)] as any;
    }
  }

  function toggleBoolCell(row: number, col: number) {
    return (prev: EditDict): EditDict => {
      return [
        ...prev.slice(0, row),
        [
          ...prev[row].slice(0, col),
          !prev[row][col],
          ...prev[row].slice(col + 1),
        ],
        ...prev.slice(row + 1),
      ] as any;
    };
  }

  const containerRef = useRef<HTMLDivElement | null>(null);

  function addRow(signal?: number) {
    changeDict(prev => [...prev, [
      signal ? signal.toString() : "",
      signal ? signal.toString() : "",
      " ",
      " ",
      "",
      "",
      '#ffffff',
      false,
      false,
      false,
      false,
    ] satisfies EditDict[number]]);

    window.setTimeout(() => {
      const newEditor = containerRef.current!.children.item(containerRef.current!.childElementCount - 2);
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

  useImperativeHandle(props.ref, () => ({
    focusSignal(signal: number) {
      const existingEditor = containerRef.current!
        .getElementsByClassName(`dict-editor-def-${signal}`)
        .item(0);
      if (existingEditor) {
        existingEditor.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        window.setTimeout(() => {
          if (existingEditor instanceof HTMLInputElement) {
            existingEditor.focus();
            existingEditor.selectionStart = existingEditor.selectionEnd = existingEditor.value.length;
          }
        }, 250);
      } else {
        addRow(signal);
      }
    },
  }), [dict]);

  return <div className="dict">
    <div className="dict-editor-controls">
      <button onClick={() => {
        const confirmation = confirm("Are you sure you want to import a dictionary?");
        if (!confirmation) return;
        navigator.clipboard.readText().then(text => {
          try {
            setDict(importDict(text));
          } catch (e) {};
        })
      }}>→Import</button>
      <button onClick={() => {
        navigator.clipboard.writeText(exportDict(dict));
      }}>Export→</button>
    </div>
    <Table
      ref={containerRef}
      columns={["Signal", "Definition"]}
      dataColumnWidths="74px 2fr"
      rows={dict.map(def => [def[0], def[1]])}
      onChangeCell={(row, col, value) => changeDict(updateCell(row, col, value))}
      onDeleteRow={row => changeDict(prev => prev.filter((_, i) => i !== row))}
      onAddRow={() => addRow()}
      onFocusCell={row => setFocus(row)}
      onFocusDeleteRow={() => setFocus(-1)}
      cellClassName={(row, col) => {
        const focusClass = focus === row ? "table-focus" : "";
        if (col !== 1) return focusClass;
        let idClass = "";
        try {
          idClass = parseInt(dict[row][0]).toString();
        } catch (e) {};
        return `${focusClass} dict-editor-def-${idClass}`;
      }}
      cellStyle={(row, col) => {
        if (col === 0) return;
        return {
          color: dict[row][6],
          fontWeight: dict[row][7] ? 'bold' : undefined,
          fontStyle: dict[row][8] ? 'italic' : undefined,
          textDecoration: [
            dict[row][9] ? 'underline' : '',
            dict[row][10] ? 'line-through' : '',
          ]
            .join(' ')
            .trim(),
        } satisfies CSSProperties;
      }}
      />
    <div className="dict-editor-controls">
      <button onClick={() => {
        setDetail(d => !d)
      }}>Detail</button>
      <button onClick={() => {
        changeDict(prev => prev.toSorted((a, b) => +b[0] - +a[0]))
      }}>Sort</button>
    </div>
    {detail && <div className="dict-editor-detail">
      {[2, 3, 4].map(i =>
        <div className="dict-editor-controls" key={i}>
          <div className="dict-editor-format-label">{["Before", "After", "Double"][i-2]}</div>
          <button className="dict-editor-format-choice" disabled={focus<0 || dict[focus][i]===""}
            onClick={() => changeDict(updateCell(focus, i, ""))}>
            </button>
          <button className="dict-editor-format-choice" disabled={focus<0 || dict[focus][i]===" "}
            onClick={() => changeDict(updateCell(focus, i, " "))}>
            _</button>
          <button className="dict-editor-format-choice" disabled={focus<0 || dict[focus][i]==="\n"}
            onClick={() => changeDict(updateCell(focus, i, "\n"))}>
            1</button>
          <button className="dict-editor-format-choice" disabled={focus<0 || dict[focus][i]==="\n\n"}
            onClick={() => changeDict(updateCell(focus, i, "\n\n"))}>
            2</button>
          <input className="dict-editor-format" value={focus<0 ? "" : dict[focus][i] as string} disabled={focus<0}
            onChange={e => changeDict(updateCell(focus, i, e.currentTarget.value))}/>
        </div>
      )}
      <div className="dict-editor-controls">
        <div className="dict-editor-format-label">Color</div>
        <input
          type="text"
          className="dict-editor-format"
          value={focus < 0 ? '#ffffff' : dict[focus][6]}
          disabled={focus < 0}
          onChange={(e) => changeDict(updateCell(focus, 6, e.target.value))}
        />
        <div className="dict-editor-format-color-picker">
          <input
            type="color"
          value={focus < 0 ? '#ffffff' : dict[focus][6]}
            disabled={focus < 0}
            onChange={(e) => changeDict(updateCell(focus, 6, e.target.value))}
            />
          <span className="material-symbols-outlined"
            style={{color: focus < 0 ? undefined : dict[focus][6]}}
          >colors</span>
        </div>
        <button
          className={'dict-editor-format-button'}
          onClick={() => changeDict(updateCell(focus, 6, "#ffffff"))}
        >
          <span className="material-symbols-outlined">format_color_reset</span>
        </button>
      </div>
      <div className="dict-editor-controls">
        <div className="dict-editor-format-label">Style</div>
        <button
          className={
            'dict-editor-format-toggle ' +
            (focus < 0 || dict[focus][7] ? 'selected' : '')
          }
          onClick={() => changeDict(toggleBoolCell(focus, 7))}
        >
          <span className="material-symbols-outlined">format_bold</span>
        </button>
        <button
          className={
            'dict-editor-format-toggle ' +
            (focus < 0 || dict[focus][8] ? 'selected' : '')
          }
          onClick={() => changeDict(toggleBoolCell(focus, 8))}
        >
          <span className="material-symbols-outlined">format_italic</span>
        </button>
        <button
          className={
            'dict-editor-format-toggle ' +
            (focus < 0 || dict[focus][9] ? 'selected' : '')
          }
          onClick={() => changeDict(toggleBoolCell(focus, 9))}
        >
          <span className="material-symbols-outlined">format_underlined</span>
        </button>
        <button
          className={
            'dict-editor-format-toggle ' +
            (focus < 0 || dict[focus][10] ? 'selected' : '')
          }
          onClick={() => changeDict(toggleBoolCell(focus, 10))}
        >
          <span className="material-symbols-outlined">strikethrough_s</span>
        </button>
      </div>
      <textarea className="dict-editor-notes" value={focus<0 ? "" : dict[focus][5]} disabled={focus<0}
        spellCheck={false}
        placeholder="Notes"
        autoComplete="off"
        onChange={(e) => changeDict(updateCell(focus, 5, e.target.value))}
        />
    </div>}
  </div>;
}
