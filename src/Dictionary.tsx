import { useEffect, useRef, useState } from "react";
import "./Dictionary.css"

const DICT_KEY = "relay-dictionary";

export type DictEntry = {
  def: string,
  before: string,
  after: string,
  double: string,
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

type EditDict = [string, string, string, string, string, string][];

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
        breakOnDouble: e[4] !== "",
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
    ])
  }
  return dict;
}

export function Dictionary(props: {
  onChangeDict: (dict: Map<number, DictEntry>) => void,
  setOnDefine: (onDefine: (signal: number) => void) => void,
}) {

  const [detail, setDetail] = useState(false);
  const [focus, setFocus] = useState(-1);

  const [dict, setDict] = useState<EditDict>(
    () => {
      try {
        return (JSON.parse(localStorage.getItem(DICT_KEY)!) ?? []);
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

  const ref = useRef<HTMLDivElement | null>(null);
  
  function addRow(signal?: number) {
    changeDict(prev => [...prev, [
      signal ? signal.toString() : "",
      signal ? signal.toString() : "",
      " ",
      " ",
      "",
      "",
    ]]);

    window.setTimeout(() => {
      const newEditor = ref.current!.children.item(ref.current!.childElementCount - 2);
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

  useEffect(() => {
    props.setOnDefine(signal => {
      const existingEditor = ref.current!
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
      } else if (signal < 0) {
        addRow(signal);
      }
    });
  }, [ref.current, dict]);

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
    <div className="dict-editor" ref={ref}>
      <div className="dict-editor-header">Signal</div>
      <div className="dict-editor-header">Definition</div>
      <button className='dict-editor-header dict-editor-delete'
        onClick={() => addRow()}
      >+</button>
      {dict.map((def, row) => {
        let idClass = "";
        try {
          idClass = parseInt(def[0]).toString();
        } catch (e) {};
        return <>
          <input className={`dict-editor-cell dict-editor-focus-${focus === row}`}
            value={def[0]}
            onFocus={() => setFocus(row)}
            onChange={e => changeDict(updateCell(row, 0, e.currentTarget.value))}/>
          <input className={`dict-editor-cell dict-editor-focus-${focus === row} dict-editor-def-${idClass}`}
            value={def[1]}
            onFocus={() => setFocus(row)}
            onChange={e => changeDict(updateCell(row, 1, e.currentTarget.value))}/>
          <button className={`dict-editor-cell dict-editor-focus-${focus === row} dict-editor-delete`}
            onFocus={() => setFocus(-1)}
            onClick={() => changeDict(prev => prev.filter((_,i) => i !== row))}
          >x</button>
        </>
      })}
    </div>
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
        <div className="dict-editor-controls">
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
          <input className="dict-editor-format" value={focus<0 ? "" : dict[focus][i]} disabled={focus<0}
            onChange={e => changeDict(updateCell(focus, i, e.currentTarget.value))}/>
        </div>
      )}
      <textarea className="dict-editor-notes" value={focus<0 ? "" : dict[focus][5]} disabled={focus<0}
        spellCheck={false}
        placeholder="Notes"
        autoComplete="off"
        onChange={(e) => changeDict(updateCell(focus, 5, e.target.value))}
        />
    </div>}
  </div>;
}
